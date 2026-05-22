import type {
    ForgeVirtualLorebookEntry,
    ForgeWorkspaceSession
} from '../../../../types/SessionTypes.js';
import type { StagingEntry } from '../../../../types/ForgeRuntimeTypes.js';
import type {
    ForgeDraftTree,
    ForgeStructuredState
} from '../../../../types/ForgeStructuredTypes.js';
import type { ForgeMemoryTree } from '../../../../types/ForgeMemoryTypes.js';
import {
    cloneForgeMemoryTree,
    cloneDraftTree,
    cloneStructuredState,
    createEmptyForgeMemoryTree,
    createEmptyDraftTree,
    createEmptyStructuredState
} from '../../utils/forgeStateDefaults.js';
import {
    forgeThreadWorkspacePath,
    forgeWorkspacePath,
    resolveForgeConversationId,
    resolveForgeProjectId,
    shellWorkspaceService,
    type ShellWorkspaceService
} from '../../hal/shell/ShellWorkspaceService.js';

export interface ForgeProjectFile {
    version: 1;
    forgeProjectId: string;
    conversationId: string;
    workspaceSessionId: string;
    workspacePath: string;
    title: string;
    createdAt: number;
    updatedAt: number;
    selectedPresetId: string;
    selectedChatSessionId: string | null;
    selectedChatSnapshotId: string | null;
    importedLorebookId: string | null;
    detailMode: ForgeWorkspaceSession['detailMode'];
    entryMode: ForgeWorkspaceSession['entryMode'];
    activeLayer: ForgeWorkspaceSession['activeLayer'];
    completedLayers: NonNullable<ForgeWorkspaceSession['completedLayers']>;
    publishState: NonNullable<ForgeWorkspaceSession['publishState']>;
    activeAuxPanel: ForgeWorkspaceSession['activeAuxPanel'];
    auxPresentationMode: ForgeWorkspaceSession['auxPresentationMode'];
}

export interface ForgeProjectDraftFile {
    version: 1;
    updatedAt: number;
    structuredState: ForgeStructuredState;
    draftTree: ForgeDraftTree;
}

export interface ForgeProjectReviewFile {
    version: 1;
    updatedAt: number;
    stagingEntries: StagingEntry[];
    commitReadyEntries: StagingEntry[];
}

export interface ForgeProjectLoadResult {
    session: ForgeWorkspaceSession;
    migratedFromSession: boolean;
}

const normalizeLocalWorkspacePath = (workspacePath: string): string => (
    workspacePath.replace(/^\/workspaces(?=\/|$)/, '') || '/'
);

const cloneJson = <T>(value: T): T => JSON.parse(JSON.stringify(value));

const entryFileName = (entryId: string): string => `${encodeURIComponent(entryId)}.json`;

export class ForgeProjectDataService {
    constructor(private readonly workspaces: ShellWorkspaceService = shellWorkspaceService) {}

    normalizeSession(session: ForgeWorkspaceSession): ForgeWorkspaceSession {
        const forgeProjectId = resolveForgeProjectId(session);
        const conversationId = resolveForgeConversationId(session);
        return {
            ...session,
            forgeProjectId,
            conversationId,
            sessionChatId: session.sessionChatId || conversationId,
            workspacePath: session.workspacePath || forgeThreadWorkspacePath(forgeProjectId, conversationId)
        };
    }

    async saveFromSession(session: ForgeWorkspaceSession): Promise<void> {
        const normalized = this.normalizeSession(session);
        const root = this.projectRoot(normalized);
        const existingProject = await this.readJson<ForgeProjectFile>(`${root}/project.json`);
        const fs = await this.workspaces.getFileSystem({
            projectId: normalized.forgeProjectId,
            conversationId: normalized.conversationId
        });
        await fs.mkdir(`${root}/lorebook/entries`, { recursive: true });
        await fs.mkdir(`${root}/memory`, { recursive: true });
        await fs.mkdir(`${root}/drafts`, { recursive: true });
        await fs.mkdir(`${root}/review`, { recursive: true });

        const projectFile: ForgeProjectFile = {
            version: 1,
            forgeProjectId: normalized.forgeProjectId!,
            conversationId: normalized.conversationId!,
            workspaceSessionId: normalized.id,
            workspacePath: forgeWorkspacePath(normalized.forgeProjectId!),
            title: normalized.projectTitle || existingProject?.title || normalized.title || 'Forge Project',
            createdAt: normalized.createdAt || Date.now(),
            updatedAt: normalized.updatedAt || Date.now(),
            selectedPresetId: normalized.presetId || '',
            selectedChatSessionId: normalized.selectedChatSessionId || null,
            selectedChatSnapshotId: normalized.selectedChatSnapshotId || null,
            importedLorebookId: normalized.importedLorebookId || null,
            detailMode: normalized.detailMode || null,
            entryMode: normalized.entryMode || null,
            activeLayer: normalized.activeLayer || 'concept',
            completedLayers: normalized.completedLayers || [],
            publishState: normalized.publishState || 'drafting',
            activeAuxPanel: normalized.activeAuxPanel || 'lorebook',
            auxPresentationMode: normalized.auxPresentationMode || 'detached'
        };

        await this.writeJson(`${root}/project.json`, projectFile);
        await this.writeJson(`${root}/memory/tree.json`, {
            ...cloneForgeMemoryTree(normalized.forgeMemoryTree || createEmptyForgeMemoryTree())
        });
        await this.writeJson(`${root}/drafts/tree.json`, {
            version: 1,
            updatedAt: Date.now(),
            structuredState: cloneStructuredState(normalized.structuredState || createEmptyStructuredState()),
            draftTree: cloneDraftTree(normalized.draftTree || createEmptyDraftTree())
        } satisfies ForgeProjectDraftFile);
        await this.writeJson(`${root}/review/staging.json`, {
            version: 1,
            updatedAt: Date.now(),
            stagingEntries: (normalized.stagingEntries || []).map(entry => ({ ...entry })),
            commitReadyEntries: (normalized.commitReadyEntries || []).map(entry => ({ ...entry }))
        } satisfies ForgeProjectReviewFile);
        await this.writeLorebookEntries(root, normalized.virtualLorebookEntries || []);
        await this.workspaces.persist();
    }

    async loadOrCreateFromSession(session: ForgeWorkspaceSession): Promise<ForgeProjectLoadResult> {
        const normalized = this.normalizeSession(session);
        const existing = await this.loadForSession(normalized);
        if (existing) {
            return {
                session: existing,
                migratedFromSession: false
            };
        }
        await this.saveFromSession(normalized);
        return {
            session: normalized,
            migratedFromSession: true
        };
    }

    async loadForSession(session: ForgeWorkspaceSession): Promise<ForgeWorkspaceSession | null> {
        const normalized = this.normalizeSession(session);
        const root = this.projectRoot(normalized);
        const project = await this.readJson<ForgeProjectFile>(`${root}/project.json`);
        if (!project || project.version !== 1) return null;

        const memoryTree = await this.readJson<ForgeMemoryTree>(`${root}/memory/tree.json`);
        const drafts = await this.readJson<ForgeProjectDraftFile>(`${root}/drafts/tree.json`);
        const review = await this.readJson<ForgeProjectReviewFile>(`${root}/review/staging.json`);
        const virtualLorebookEntries = await this.readLorebookEntries(root);

        return {
            ...normalized,
            forgeProjectId: project.forgeProjectId,
            conversationId: project.conversationId,
            workspacePath: project.workspacePath,
            projectTitle: project.title,
            title: project.title,
            createdAt: project.createdAt,
            updatedAt: Math.max(project.updatedAt || 0, normalized.updatedAt || 0),
            presetId: project.selectedPresetId || normalized.presetId || '',
            selectedChatSessionId: project.selectedChatSessionId ?? normalized.selectedChatSessionId ?? null,
            selectedChatSnapshotId: project.selectedChatSnapshotId ?? normalized.selectedChatSnapshotId ?? null,
            importedLorebookId: project.importedLorebookId ?? normalized.importedLorebookId ?? null,
            detailMode: project.detailMode ?? normalized.detailMode ?? null,
            entryMode: project.entryMode ?? normalized.entryMode ?? null,
            activeLayer: project.activeLayer || normalized.activeLayer || 'concept',
            completedLayers: project.completedLayers || normalized.completedLayers || [],
            publishState: project.publishState || normalized.publishState || 'drafting',
            activeAuxPanel: project.activeAuxPanel || normalized.activeAuxPanel || 'lorebook',
            auxPresentationMode: project.auxPresentationMode || normalized.auxPresentationMode || 'detached',
            forgeMemoryTree: cloneForgeMemoryTree(memoryTree || normalized.forgeMemoryTree || createEmptyForgeMemoryTree()),
            structuredState: cloneStructuredState(drafts?.structuredState || normalized.structuredState || createEmptyStructuredState()),
            draftTree: cloneDraftTree(drafts?.draftTree || normalized.draftTree || createEmptyDraftTree()),
            stagingEntries: (review?.stagingEntries || normalized.stagingEntries || []).map(entry => ({ ...entry })),
            commitReadyEntries: (review?.commitReadyEntries || normalized.commitReadyEntries || []).map(entry => ({ ...entry })),
            virtualLorebookEntries: virtualLorebookEntries.length > 0
                ? virtualLorebookEntries
                : (normalized.virtualLorebookEntries || []).map(entry => cloneJson(entry))
        };
    }

    projectVfsPath(projectId: string, relativePath = ''): string {
        const suffix = relativePath.replace(/^\/+/, '');
        const root = forgeWorkspacePath(projectId);
        return suffix ? `${root}/${suffix}` : root;
    }

    async renameProject(projectId: string, title: string): Promise<boolean> {
        const normalizedProjectId = projectId.trim();
        const nextTitle = title.trim();
        if (!normalizedProjectId || !nextTitle) return false;

        const root = normalizeLocalWorkspacePath(forgeWorkspacePath(normalizedProjectId));
        const project = await this.readJson<ForgeProjectFile>(`${root}/project.json`);
        if (!project || project.version !== 1) return false;

        await this.writeJson(`${root}/project.json`, {
            ...project,
            title: nextTitle,
            updatedAt: Date.now()
        } satisfies ForgeProjectFile);
        await this.workspaces.persist();
        return true;
    }

    async deleteProject(projectId: string): Promise<void> {
        const normalizedProjectId = projectId.trim();
        if (!normalizedProjectId) return;

        const root = normalizeLocalWorkspacePath(forgeWorkspacePath(normalizedProjectId));
        const fs = await this.workspaces.getFileSystem({ projectId: normalizedProjectId });
        const paths = fs.getAllPaths()
            .map(normalizeLocalWorkspacePath)
            .filter((path: string) => path === root || path.startsWith(`${root}/`))
            .sort((left: string, right: string) => right.length - left.length);

        for (const path of paths) {
            await fs.rm(path).catch(() => undefined);
        }
        await this.workspaces.persist();
    }

    private projectRoot(session: ForgeWorkspaceSession): string {
        return normalizeLocalWorkspacePath(forgeWorkspacePath(resolveForgeProjectId(session)));
    }

    private async readLorebookEntries(root: string): Promise<ForgeVirtualLorebookEntry[]> {
        const directory = `${root}/lorebook/entries`;
        const fs = await this.workspaces.getFileSystem();
        const names = await fs.readdir(directory).catch(() => []);
        const entries = await Promise.all(
            names
                .filter(name => name.endsWith('.json'))
                .map(name => this.readJson<ForgeVirtualLorebookEntry>(`${directory}/${name}`))
        );
        return entries
            .filter((entry): entry is ForgeVirtualLorebookEntry => Boolean(entry?.id && entry.entry))
            .sort((left, right) => (right.updatedAt || 0) - (left.updatedAt || 0))
            .map((entry: ForgeVirtualLorebookEntry) => cloneJson(entry));
    }

    private async writeLorebookEntries(root: string, entries: ForgeVirtualLorebookEntry[]): Promise<void> {
        const directory = `${root}/lorebook/entries`;
        const fs = await this.workspaces.getFileSystem();
        const expected = new Set(entries.map(entry => entryFileName(entry.id)));
        const existing = await fs.readdir(directory).catch(() => []);
        await Promise.all(existing
            .filter((name: string) => name.endsWith('.json') && !expected.has(name))
            .map((name: string) => fs.rm(`${directory}/${name}`).catch(() => undefined)));
        for (const entry of entries) {
            await this.writeJson(`${directory}/${entryFileName(entry.id)}`, cloneJson(entry));
        }
    }

    private async readJson<T>(path: string): Promise<T | null> {
        try {
            const fs = await this.workspaces.getFileSystem();
            return JSON.parse(await fs.readFile(path)) as T;
        } catch {
            return null;
        }
    }

    private async writeJson(path: string, value: unknown): Promise<void> {
        const fs = await this.workspaces.getFileSystem();
        const parent = path.slice(0, path.lastIndexOf('/')) || '/';
        await fs.mkdir(parent, { recursive: true });
        await fs.writeFile(path, JSON.stringify(value, null, 2));
    }
}

export const forgeProjectDataService = new ForgeProjectDataService();
