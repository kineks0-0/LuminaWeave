import { type CpOptions, type FileContent, type FsStat, type IFileSystem, type MkdirOptions, type RmOptions } from 'just-bash';
import type { ForgeRuntimeContext } from '../../../../../types/ForgeRuntimeTypes.js';
import type { ForgeShellWriteLogEntry } from '../../shell/ForgeWorkspaceSearchShell.js';
import {
    ForgeProjectSemanticVfsService,
    type ForgeProjectSemanticVfsEntry,
    type ForgeProjectSemanticVfsServiceDeps
} from '../../project/ForgeProjectSemanticVfsService.js';

export interface ForgeSemanticVfsReader {
    readFile(context: ForgeRuntimeContext, path: string): Promise<string>;
    listEntries(context: ForgeRuntimeContext): Promise<ForgeProjectSemanticVfsEntry[]>;
}

export interface ForgeSemanticVfsProviderDeps extends ForgeProjectSemanticVfsServiceDeps {
    service?: ForgeProjectSemanticVfsService;
}

interface DirentEntryLike {
    name: string;
    isFile: boolean;
    isDirectory: boolean;
    isSymbolicLink: boolean;
}

const textContent = (content: FileContent): string =>
    content instanceof Uint8Array ? new TextDecoder().decode(content) : content;

const normalizeSemanticPath = (path: string): string => {
    const normalized = path.trim().replace(/\\/g, '/').replace(/\/+/g, '/').replace(/\/$/, '');
    if (!normalized || normalized === '.' || normalized === './' || normalized === '/') return './';
    if (normalized.startsWith('./')) return normalized;
    return `./${normalized.replace(/^\//, '')}`;
};

const normalizeDirectoryPath = (path: string): string => {
    const normalized = normalizeSemanticPath(path);
    return normalized === './' ? './' : `${normalized.replace(/\/$/, '')}/`;
};

const localPathToSemantic = (path: string): string =>
    normalizeSemanticPath(path);

const semanticToLocalPath = (path: string): string => {
    const normalized = normalizeSemanticPath(path);
    return normalized === './' ? '/' : `/${normalized.slice(2)}`;
};

const parentDirectories = (path: string): string[] => {
    const normalized = normalizeSemanticPath(path);
    if (normalized === './') return [];
    const segments = normalized.slice(2).split('/').filter(Boolean);
    const dirs: string[] = [];
    for (let index = 1; index < segments.length; index += 1) {
        dirs.push(`./${segments.slice(0, index).join('/')}/`);
    }
    return dirs;
};

const createStat = (input: { kind: 'file' | 'directory'; size?: number }): FsStat => ({
    isFile: input.kind === 'file',
    isDirectory: input.kind === 'directory',
    isSymbolicLink: false,
    mode: input.kind === 'file' ? 0o100644 : 0o040755,
    size: input.size ?? 0,
    mtime: new Date(0)
});

export class ForgeSemanticVfsProvider implements ForgeSemanticVfsReader {
    private readonly service: ForgeProjectSemanticVfsService;

    constructor(deps: ForgeSemanticVfsProviderDeps = {}) {
        this.service = deps.service ?? new ForgeProjectSemanticVfsService(deps);
    }

    async listEntries(context: ForgeRuntimeContext): Promise<ForgeProjectSemanticVfsEntry[]> {
        return this.withSyntheticDirectories(await this.service.listEntries(context));
    }

    async readFile(context: ForgeRuntimeContext, path: string): Promise<string> {
        const displayPath = normalizeSemanticPath(path);
        const entry = (await this.listEntries(context)).find(item => item.path === displayPath);
        if (!entry || entry.kind !== 'file') {
            throw new Error(`Forge semantic VFS file not found: ${displayPath}`);
        }
        return entry.content ?? '';
    }

    private withSyntheticDirectories(entries: ForgeProjectSemanticVfsEntry[]): ForgeProjectSemanticVfsEntry[] {
        const byPath = new Map<string, ForgeProjectSemanticVfsEntry>();
        byPath.set('./', {
            path: './',
            kind: 'directory',
            content: null,
            source: 'virtual',
            writePolicy: 'direct-write'
        });

        for (const entry of entries) {
            for (const directory of parentDirectories(entry.path)) {
                if (!byPath.has(directory)) {
                    byPath.set(directory, {
                        path: directory,
                        kind: 'directory',
                        content: null,
                        source: entry.source,
                        writePolicy: entry.writePolicy
                    });
                }
            }
            byPath.set(entry.kind === 'directory' ? normalizeDirectoryPath(entry.path) : normalizeSemanticPath(entry.path), entry);
        }

        return [...byPath.values()].sort((left, right) =>
            left.path.localeCompare(right.path, 'zh-Hans-CN')
            || left.kind.localeCompare(right.kind)
        );
    }
}

export interface ForgeSemanticBashFsOptions {
    context: ForgeRuntimeContext;
    provider?: ForgeSemanticVfsReader;
    command?: string;
    onWrite?: (entry: ForgeShellWriteLogEntry) => void;
}

export class ForgeSemanticBashFs implements IFileSystem {
    private readonly provider: ForgeSemanticVfsReader;
    private readonly overlay = new Map<string, string>();
    private readonly overlayDirectories = new Set<string>(['./']);

    constructor(private readonly options: ForgeSemanticBashFsOptions) {
        this.provider = options.provider ?? forgeSemanticVfsProvider;
    }

    async readFile(path: string, _options?: unknown): Promise<string> {
        const semanticPath = localPathToSemantic(path);
        const overlayContent = this.overlay.get(semanticPath);
        if (typeof overlayContent === 'string') return overlayContent;
        return this.provider.readFile(this.options.context, semanticPath);
    }

    async readFileBuffer(path: string): Promise<Uint8Array> {
        return new TextEncoder().encode(await this.readFile(path));
    }

    async writeFile(path: string, content: FileContent, _options?: unknown): Promise<void> {
        const semanticPath = localPathToSemantic(path);
        const before = await this.readFile(semanticPath).catch(() => '');
        const after = textContent(content);
        this.overlay.set(semanticPath, after);
        parentDirectories(semanticPath).forEach(directory => this.overlayDirectories.add(directory));
        this.options.onWrite?.({
            command: this.options.command ?? 'semantic-vfs-write',
            path: semanticPath,
            contentBefore: before,
            contentAfter: after
        });
    }

    async appendFile(path: string, content: FileContent, _options?: unknown): Promise<void> {
        const semanticPath = localPathToSemantic(path);
        const before = await this.readFile(semanticPath).catch(() => '');
        await this.writeFile(semanticPath, `${before}${textContent(content)}`);
    }

    async exists(path: string): Promise<boolean> {
        const semanticPath = localPathToSemantic(path);
        if (this.overlay.has(semanticPath) || this.overlayDirectories.has(normalizeDirectoryPath(semanticPath))) return true;
        return (await this.findEntry(semanticPath)) !== null;
    }

    async stat(path: string): Promise<FsStat> {
        const semanticPath = localPathToSemantic(path);
        const overlay = this.overlay.get(semanticPath);
        if (typeof overlay === 'string') return createStat({ kind: 'file', size: overlay.length });
        if (this.overlayDirectories.has(normalizeDirectoryPath(semanticPath))) return createStat({ kind: 'directory' });
        const entry = await this.findEntry(semanticPath);
        if (!entry) throw new Error(`ENOENT: ${path}`);
        return createStat({
            kind: entry.kind,
            size: entry.kind === 'file' ? (entry.content ?? '').length : 0
        });
    }

    async lstat(path: string): Promise<FsStat> {
        return this.stat(path);
    }

    async mkdir(path: string, _options?: MkdirOptions): Promise<void> {
        this.overlayDirectories.add(normalizeDirectoryPath(localPathToSemantic(path)));
    }

    async readdir(path: string): Promise<string[]> {
        return (await this.readDirectoryEntries(path)).map(entry => entry.name);
    }

    async readdirWithFileTypes(path: string): Promise<DirentEntryLike[]> {
        return this.readDirectoryEntries(path);
    }

    async rm(path: string, _options?: RmOptions): Promise<void> {
        const semanticPath = localPathToSemantic(path);
        this.overlay.delete(semanticPath);
        this.overlayDirectories.delete(normalizeDirectoryPath(semanticPath));
    }

    async cp(src: string, dest: string, _options?: CpOptions): Promise<void> {
        await this.writeFile(dest, await this.readFile(src));
    }

    async mv(src: string, dest: string): Promise<void> {
        await this.cp(src, dest);
        await this.rm(src);
    }

    resolvePath(base: string, path: string): string {
        if (path.startsWith('/')) return path.replace(/\\/g, '/').replace(/\/+/g, '/');
        return `${base.replace(/\/$/, '')}/${path}`.replace(/\\/g, '/').replace(/\/+/g, '/');
    }

    getAllPaths(): string[] {
        return [
            ...Array.from(this.overlayDirectories).map(semanticToLocalPath),
            ...Array.from(this.overlay.keys()).map(semanticToLocalPath)
        ];
    }

    async chmod(_path: string, _mode: number): Promise<void> {}

    async symlink(_target: string, _linkPath: string): Promise<void> {
        throw new Error('symlink is not supported in Forge semantic VFS');
    }

    async link(_existingPath: string, _newPath: string): Promise<void> {
        throw new Error('hard link is not supported in Forge semantic VFS');
    }

    async readlink(_path: string): Promise<string> {
        throw new Error('readlink is not supported in Forge semantic VFS');
    }

    async realpath(path: string): Promise<string> {
        return this.resolvePath('/', path);
    }

    async utimes(_path: string, _atime: Date, _mtime: Date): Promise<void> {}

    private async findEntry(path: string): Promise<ForgeProjectSemanticVfsEntry | null> {
        const semanticPath = normalizeSemanticPath(path);
        const directoryPath = normalizeDirectoryPath(semanticPath);
        return (await this.listEntries())
            .find(entry => entry.path === semanticPath || entry.path === directoryPath)
            ?? null;
    }

    private async listEntries(): Promise<ForgeProjectSemanticVfsEntry[]> {
        const entries = await this.provider.listEntries(this.options.context);
        const overlayEntries: ForgeProjectSemanticVfsEntry[] = [];
        for (const directory of this.overlayDirectories) {
            overlayEntries.push({
                path: normalizeDirectoryPath(directory),
                kind: 'directory',
                content: null,
                source: 'workspace',
                writePolicy: 'direct-write'
            });
        }
        for (const [path, content] of this.overlay) {
            overlayEntries.push({
                path,
                kind: 'file',
                content,
                source: 'workspace',
                writePolicy: 'direct-write'
            });
        }
        const byPath = new Map<string, ForgeProjectSemanticVfsEntry>();
        [...entries, ...overlayEntries].forEach(entry => byPath.set(entry.path, entry));
        return [...byPath.values()];
    }

    private async readDirectoryEntries(path: string): Promise<DirentEntryLike[]> {
        const directoryPath = normalizeDirectoryPath(localPathToSemantic(path));
        const children = new Map<string, DirentEntryLike>();
        for (const entry of await this.listEntries()) {
            if (entry.path === directoryPath) continue;
            if (!entry.path.startsWith(directoryPath)) continue;
            const rest = entry.path.slice(directoryPath.length);
            if (!rest) continue;
            const [firstSegment] = rest.split('/').filter(Boolean);
            if (!firstSegment) continue;
            const directPath = `${directoryPath}${firstSegment}`;
            const isDirectory = rest.includes('/') || entry.kind === 'directory';
            children.set(firstSegment, {
                name: firstSegment,
                isFile: !isDirectory && entry.kind === 'file',
                isDirectory,
                isSymbolicLink: false
            });
            if (isDirectory) this.overlayDirectories.add(normalizeDirectoryPath(directPath));
        }
        if (children.size === 0 && directoryPath !== './') {
            const exists = await this.exists(directoryPath);
            if (!exists) throw new Error(`ENOENT: ${path}`);
        }
        return [...children.values()].sort((left, right) => left.name.localeCompare(right.name, 'zh-Hans-CN'));
    }
}

export const forgeSemanticVfsProvider = new ForgeSemanticVfsProvider();
