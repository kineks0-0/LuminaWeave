import type { FileContent, IFileSystem } from 'just-bash';
import { HALContext } from '../HALContext.js';
import { LightningBashFsAdapter } from './LightningBashFsAdapter.js';
import { cleanPath as normalizeLocalPath } from '@shared/resources/vfsPath.js';

const WORKSPACE_NAMESPACE = 'lumina.resource-runtime';
const WORKSPACE_TABLE = 'shell-workspaces';
const FORGE_BINDINGS_KEY = 'forge-project-bindings.v1';

export interface ForgeProjectWorkspaceBinding {
    forgeProjectId: string;
    conversationId: string;
    workspacePath: string;
    createdAt: number;
    updatedAt: number;
}

export interface ForgeConversationProjectionInput {
    forgeProjectId: string;
    conversationId: string;
    workspaceSessionId: string;
    workspacePath: string;
    title: string;
    createdAt: number;
    updatedAt: number;
    activeLeafId: string | null;
    messages: unknown[];
}

export interface ForgeProjectVfsFile {
    path: string;
    workspacePath: string;
    kind: 'file';
    content: string;
}

export type ForgeProjectVfsEntry = ForgeProjectVfsDirectory | ForgeProjectVfsFile;

export interface ForgeProjectVfsDirectory {
    path: string;
    workspacePath: string;
    kind: 'directory';
    content: null;
}

interface ForgeProjectWorkspaceBindingStore {
    version: 1;
    bindings: Record<string, ForgeProjectWorkspaceBinding>;
}

export interface ShellWorkspaceServiceOptions {
    filesystemName?: string;
}

export interface ShellWorkspaceResetOptions {
    clearStorage?: boolean;
}

let testFilesystemSerial = 0;

const toContentText = (content: FileContent): string =>
    content instanceof Uint8Array ? new TextDecoder().decode(content) : String(content);

const storageParams = (key: string) => ({
    namespace: WORKSPACE_NAMESPACE,
    table: WORKSPACE_TABLE,
    key
});

const chatWorkspaceRoot = (conversationId: string): string =>
    `/chat/${encodeURIComponent(conversationId)}`;

const forgeThreadLocalRoot = (projectId: string, conversationId: string): string =>
    `/forge/${encodeURIComponent(projectId)}/chat/${encodeURIComponent(conversationId)}`;

export const forgeWorkspacePath = (projectId: string): string =>
    `/workspaces/forge/${encodeURIComponent(projectId)}`;

export const forgeThreadWorkspacePath = (projectId: string, conversationId: string): string =>
    `${forgeWorkspacePath(projectId)}/chat/${encodeURIComponent(conversationId)}`;

export const resolveForgeProjectId = (input: { id?: string; forgeProjectId?: string | null }): string =>
    input.forgeProjectId || input.id || `forge_project_${Date.now().toString(36)}`;

export const resolveForgeConversationId = (input: { sessionChatId?: string; conversationId?: string | null }): string =>
    input.conversationId || input.sessionChatId || `lw_card_${Date.now().toString(36)}`;

export class ShellWorkspaceService {
    private fs: IFileSystem | null = null;
    private loadPromise: Promise<IFileSystem> | null = null;
    private bindingStore: ForgeProjectWorkspaceBindingStore | null = null;
    private testFilesystemName: string | null = null;
    private seedQueue: Promise<void> = Promise.resolve();

    constructor(private readonly options: ShellWorkspaceServiceOptions = {}) {}

    async getFileSystem(seed?: { projectId?: string; conversationId?: string }): Promise<IFileSystem> {
        const fs = await this.load();
        const seedTask = this.seedQueue.then(() => this.ensureSeedDirectories(fs, seed));
        this.seedQueue = seedTask.catch(() => undefined);
        await seedTask;
        return fs;
    }

    async persist(): Promise<void> {
        await this.load();
    }

    async listForgeProjectFiles(input: {
        forgeProjectId: string;
        conversationId?: string | null;
    }): Promise<ForgeProjectVfsFile[]> {
        const projectId = input.forgeProjectId.trim();
        if (!projectId) return [];

        return (await this.listForgeProjectEntries(input))
            .filter((entry): entry is ForgeProjectVfsFile => entry.kind === 'file');
    }

    async listForgeProjectEntries(input: {
        forgeProjectId: string;
        conversationId?: string | null;
    }): Promise<ForgeProjectVfsEntry[]> {
        const projectId = input.forgeProjectId.trim();
        if (!projectId) return [];

        const fs = await this.getFileSystem({
            projectId,
            conversationId: input.conversationId ?? undefined
        });
        const localRoot = `/forge/${encodeURIComponent(projectId)}`;
        const workspaceRoot = forgeWorkspacePath(projectId);
        const entries: ForgeProjectVfsEntry[] = [];

        for (const rawPath of fs.getAllPaths()) {
            const path = normalizeLocalPath(rawPath);
            if (path === localRoot || !path.startsWith(`${localRoot}/`)) continue;

            const stat = await fs.stat(path).catch(() => null);
            if (!stat) continue;

            const relativePath = path.slice(localRoot.length).replace(/^\//, '');
            if (!relativePath) continue;
            const workspacePath = `${workspaceRoot}/${relativePath}`;

            if (stat.isDirectory) {
                entries.push({
                    path: `./${relativePath}/`,
                    workspacePath,
                    kind: 'directory',
                    content: null
                });
                continue;
            }
            if (stat.isFile) {
                entries.push({
                    path: `./${relativePath}`,
                    workspacePath,
                    kind: 'file',
                    content: toContentText(await fs.readFile(path))
                });
            }
        }

        return entries.sort((left, right) =>
            left.path.localeCompare(right.path, 'zh-Hans-CN')
            || left.kind.localeCompare(right.kind)
        );
    }

    async bindForgeConversation(input: {
        forgeProjectId: string;
        conversationId: string;
    }): Promise<ForgeProjectWorkspaceBinding> {
        const projectId = input.forgeProjectId.trim();
        const conversationId = input.conversationId.trim();
        if (!projectId) throw new Error('forgeProjectId is required');
        if (!conversationId) throw new Error('conversationId is required');

        const store = await this.loadBindingStore();
        const existing = store.bindings[conversationId];
        const timestamp = Date.now();
        const binding: ForgeProjectWorkspaceBinding = {
            forgeProjectId: projectId,
            conversationId,
            workspacePath: forgeThreadWorkspacePath(projectId, conversationId),
            createdAt: existing?.createdAt ?? timestamp,
            updatedAt: timestamp
        };
        store.bindings[conversationId] = binding;
        await this.writeJson(FORGE_BINDINGS_KEY, store);
        await this.getFileSystem({ projectId, conversationId });
        return binding;
    }

    async writeForgeConversationProjection(input: ForgeConversationProjectionInput): Promise<void> {
        const projectId = input.forgeProjectId.trim();
        const conversationId = input.conversationId.trim();
        if (!projectId) throw new Error('forgeProjectId is required');
        if (!conversationId) throw new Error('conversationId is required');

        const fs = await this.getFileSystem({ projectId, conversationId });
        const roots = [
            chatWorkspaceRoot(conversationId),
            forgeThreadLocalRoot(projectId, conversationId)
        ];
        const threadFile = {
            version: 1,
            forgeProjectId: projectId,
            conversationId,
            workspaceSessionId: input.workspaceSessionId,
            workspacePath: input.workspacePath,
            title: input.title,
            createdAt: input.createdAt,
            updatedAt: input.updatedAt,
            activeLeafId: input.activeLeafId,
            messageCount: input.messages.length
        };
        for (const root of roots) {
            await fs.mkdir(root, { recursive: true });
            await fs.writeFile(`${root}/thread.json`, JSON.stringify(threadFile, null, 2));
            await fs.writeFile(`${root}/messages.json`, JSON.stringify(input.messages, null, 2));
        }
        await this.persist();
    }

    async deleteForgeConversationProjection(forgeProjectId: string, conversationId: string): Promise<void> {
        const projectId = forgeProjectId.trim();
        const key = conversationId.trim();
        if (!key) return;

        const roots = [
            chatWorkspaceRoot(key),
            projectId ? forgeThreadLocalRoot(projectId, key) : ''
        ].filter(Boolean);
        const fs = await this.getFileSystem();
        const paths = fs.getAllPaths()
            .map(normalizeLocalPath)
            .filter(path => roots.some(root => path === root || path.startsWith(`${root}/`)))
            .sort((left, right) => right.length - left.length);

        for (const path of paths) {
            await fs.rm(path).catch(() => undefined);
        }
        await this.persist();
    }

    async getForgeBinding(conversationId: string): Promise<ForgeProjectWorkspaceBinding | null> {
        const store = await this.loadBindingStore();
        return store.bindings[conversationId] ?? null;
    }

    async unbindForgeConversation(conversationId: string): Promise<void> {
        const key = conversationId.trim();
        if (!key) return;

        const store = await this.loadBindingStore();
        if (!store.bindings[key]) return;
        delete store.bindings[key];
        await this.writeJson(FORGE_BINDINGS_KEY, store);
    }

    async unbindForgeProject(forgeProjectId: string): Promise<void> {
        const projectId = forgeProjectId.trim();
        if (!projectId) return;

        const store = await this.loadBindingStore();
        let changed = false;
        Object.entries(store.bindings).forEach(([conversationId, binding]) => {
            if (binding.forgeProjectId === projectId) {
                delete store.bindings[conversationId];
                changed = true;
            }
        });
        if (changed) {
            await this.writeJson(FORGE_BINDINGS_KEY, store);
        }
    }

    async listForgeBindings(): Promise<ForgeProjectWorkspaceBinding[]> {
        const store = await this.loadBindingStore();
        return Object.values(store.bindings);
    }

    resetForTests(options: ShellWorkspaceResetOptions = {}): void {
        this.fs = null;
        this.loadPromise = null;
        this.bindingStore = null;
        this.seedQueue = Promise.resolve();
        if (options.clearStorage) {
            testFilesystemSerial += 1;
            const baseName = this.options.filesystemName ?? 'luminaweave-forge-workspace';
            this.testFilesystemName = `${baseName}.test.${testFilesystemSerial}`;
        }
    }

    private async load(): Promise<IFileSystem> {
        if (this.fs) return this.fs;
        if (this.loadPromise) return this.loadPromise;

        this.loadPromise = (async () => {
            const fs = new LightningBashFsAdapter({
                filesystemName: this.testFilesystemName ?? this.options.filesystemName
            });
            await fs.initialize();
            await this.ensureSeedDirectories(fs);
            this.fs = fs;
            return fs;
        })();

        return this.loadPromise;
    }

    private async ensureSeedDirectories(
        fs: IFileSystem,
        seed?: { projectId?: string; conversationId?: string }
    ): Promise<void> {
        await fs.mkdir('/forge', { recursive: true });
        await fs.mkdir('/chat', { recursive: true });
        if (seed?.projectId) {
            await fs.mkdir(`/forge/${encodeURIComponent(seed.projectId)}`, { recursive: true });
        }
        if (seed?.conversationId) {
            await fs.mkdir(`/chat/${encodeURIComponent(seed.conversationId)}`, { recursive: true });
            if (seed?.projectId) {
                await fs.mkdir(forgeThreadLocalRoot(seed.projectId, seed.conversationId), { recursive: true });
            }
        }
    }

    private async loadBindingStore(): Promise<ForgeProjectWorkspaceBindingStore> {
        if (this.bindingStore) return this.bindingStore;
        const stored = await this.readJson<ForgeProjectWorkspaceBindingStore>(FORGE_BINDINGS_KEY);
        this.bindingStore = stored?.version === 1
            ? { version: 1, bindings: { ...stored.bindings } }
            : { version: 1, bindings: {} };
        return this.bindingStore;
    }

    private async readJson<T>(key: string): Promise<T | null> {
        try {
            return await HALContext.instance.runtime.extensionStore.getJson(storageParams(key)) as T | null;
        } catch {
            return null;
        }
    }

    private async writeJson(key: string, value: unknown): Promise<void> {
        try {
            await HALContext.instance.runtime.extensionStore.setJson({
                ...storageParams(key),
                value
            });
        } catch {
            // Workspaces remain usable in-memory if the host store is temporarily unavailable.
        }
    }
}

export const shellWorkspaceService = new ShellWorkspaceService();
