import { InMemoryFs, type BufferEncoding, type CpOptions, type FileContent, type FsStat, type IFileSystem, type MkdirOptions, type RmOptions } from 'just-bash';
import type { ShellSessionRef } from '@shared/resources/index.js';
import type { VirtualFileSystemService } from '../resource/VirtualFileSystemService.js';
import type { VFSDirEntry } from '@shared/resources/index.js';
import type { ShellPermissionService } from './ShellPermissionService.js';
import { shellWorkspaceService, type ShellWorkspaceService } from './ShellWorkspaceService.js';
import { cleanPath as normalizeLocalPath } from '@shared/resources/vfsPath.js';

const joinVirtualPath = (mountPoint: string, path: string): string => {
    const local = normalizeLocalPath(path);
    return local === '/' ? mountPoint : `${mountPoint}${local}`;
};

const WORKSPACE_MOUNT_POINT = '/workspaces';

const normalizeWorkspaceMountPath = (path: string): string => {
    const normalized = normalizeLocalPath(path);
    if (normalized === WORKSPACE_MOUNT_POINT) return '/';
    if (normalized.startsWith(`${WORKSPACE_MOUNT_POINT}/`)) {
        return normalizeLocalPath(normalized.slice(WORKSPACE_MOUNT_POINT.length));
    }
    return normalized;
};

const resolveWorkspaceMountPath = (base: string, path: string): string => {
    if (path.startsWith('/')) return normalizeWorkspaceMountPath(path);
    const normalizedBase = normalizeWorkspaceMountPath(base);
    return normalizeWorkspaceMountPath(`${normalizedBase}/${path}`);
};

const textContent = (content: FileContent): string =>
    content instanceof Uint8Array ? new TextDecoder().decode(content) : content;

const mode = (writable: boolean): number => writable ? 0o100666 : 0o100444;

type ResourceFsErrorCode = 'readonly' | 'requires_policy' | 'requires_grant' | 'unsupported_operation' | 'invalid_json';

class ResourceFsError extends Error {
    constructor(
        readonly code: ResourceFsErrorCode,
        message: string
    ) {
        super(`[${code}] ${message}`);
        this.name = 'ResourceFsError';
    }
}

interface DirentEntryLike {
    name: string;
    isFile: boolean;
    isDirectory: boolean;
    isSymbolicLink: boolean;
}

export class ResourceBackedBashFs implements IFileSystem {
    constructor(
        private readonly mountPoint: '/sources' | '/library',
        private readonly vfs: VirtualFileSystemService,
        private readonly permissions: ShellPermissionService,
        private readonly session: ShellSessionRef
    ) {}

    async readFile(path: string, _options?: unknown): Promise<string> {
        const virtualPath = this.toVirtual(path);
        this.assertPath('read', virtualPath);
        return this.vfs.readFile(virtualPath);
    }

    async readFileBuffer(path: string): Promise<Uint8Array> {
        return new TextEncoder().encode(await this.readFile(path));
    }

    async writeFile(path: string, content: FileContent, _options?: unknown): Promise<void> {
        const virtualPath = this.toVirtual(path);
        this.assertPath('write', virtualPath);
        const payload = this.parseJsonPayload(virtualPath, content);
        const result = await this.vfs.writeFile(virtualPath, payload, { policy: 'ask' });
        if (result.status !== 'saved' && result.status !== 'forked') {
            const message = result.diagnostics?.map((diagnostic: unknown) =>
                typeof diagnostic === 'object' && diagnostic !== null && 'message' in diagnostic
                    ? String(diagnostic.message)
                    : String(diagnostic)
            ).join(' ') || `Resource write ${result.status}: ${virtualPath}`;
            throw new ResourceFsError(result.status === 'requires_policy' ? 'requires_policy' : 'readonly', message);
        }
    }

    async appendFile(path: string, _content: FileContent, _options?: unknown): Promise<void> {
        throw new ResourceFsError(
            'unsupported_operation',
            `append redirection is not supported for resource files; write a complete JSON document with > or tee: ${this.toVirtual(path)}`
        );
    }

    async exists(path: string): Promise<boolean> {
        try {
            await this.stat(path);
            return true;
        } catch {
            return false;
        }
    }

    async stat(path: string): Promise<FsStat> {
        const virtualPath = this.toVirtual(path);
        this.assertPath('read', virtualPath);
        const stat = await this.vfs.stat(virtualPath);
        return {
            isFile: stat.type === 'file',
            isDirectory: stat.type === 'directory',
            isSymbolicLink: false,
            mode: stat.type === 'directory' ? 0o040555 : mode(stat.writable),
            size: stat.size ?? 0,
            mtime: new Date()
        };
    }

    lstat(path: string): Promise<FsStat> {
        return this.stat(path);
    }

    async mkdir(path: string, _options?: MkdirOptions): Promise<void> {
        throw new ResourceFsError('unsupported_operation', `cannot create resource directory: ${this.toVirtual(path)}`);
    }

    async readdir(path: string): Promise<string[]> {
        const virtualPath = this.toVirtual(path);
        this.assertPath('read', virtualPath);
        const entries = await this.vfs.listDir(virtualPath);
        return entries.map((entry: VFSDirEntry) => entry.name);
    }

    async readdirWithFileTypes(path: string): Promise<DirentEntryLike[]> {
        const virtualPath = this.toVirtual(path);
        this.assertPath('read', virtualPath);
        const entries = await this.vfs.listDir(virtualPath);
        return entries.map((entry: VFSDirEntry) => ({
            name: entry.name,
            isFile: entry.type === 'file',
            isDirectory: entry.type === 'directory',
            isSymbolicLink: false
        }));
    }

    async rm(path: string, _options?: RmOptions): Promise<void> {
        throw new ResourceFsError('unsupported_operation', `cannot remove resource path: ${this.toVirtual(path)}`);
    }

    async cp(src: string, dest: string, _options?: CpOptions): Promise<void> {
        await this.writeFile(dest, await this.readFile(src));
    }

    async mv(src: string, dest: string): Promise<void> {
        throw new ResourceFsError('unsupported_operation', `cannot move resource path without an explicit delete policy: ${this.toVirtual(src)} -> ${this.toVirtual(dest)}`);
    }

    resolvePath(base: string, path: string): string {
        if (path.startsWith('/')) return normalizeLocalPath(path);
        return normalizeLocalPath(`${base}/${path}`);
    }

    getAllPaths(): string[] {
        return [];
    }

    async chmod(_path: string, _mode: number): Promise<void> {}

    async symlink(_target: string, linkPath: string): Promise<void> {
        throw new ResourceFsError('unsupported_operation', `cannot create symlink in resource mount: ${this.toVirtual(linkPath)}`);
    }

    async link(_existingPath: string, newPath: string): Promise<void> {
        throw new ResourceFsError('unsupported_operation', `cannot create hard link in resource mount: ${this.toVirtual(newPath)}`);
    }

    async readlink(path: string): Promise<string> {
        throw new ResourceFsError('unsupported_operation', `not a symlink: ${this.toVirtual(path)}`);
    }

    realpath(path: string): Promise<string> {
        return Promise.resolve(normalizeLocalPath(path));
    }

    async utimes(_path: string, _atime: Date, _mtime: Date): Promise<void> {}

    private toVirtual(path: string): string {
        return joinVirtualPath(this.mountPoint, path);
    }

    private assertPath(operation: 'read' | 'write', virtualPath: string): void {
        const decision = this.permissions.checkPath(this.session, operation, virtualPath);
        if (!decision.allowed) throw new ResourceFsError('requires_grant', decision.reason ?? `permission denied: ${virtualPath}`);
    }

    private parseJsonPayload(virtualPath: string, content: FileContent): unknown {
        const text = textContent(content);
        try {
            return JSON.parse(text);
        } catch (error) {
            throw new ResourceFsError(
                'invalid_json',
                `resource writes require a complete JSON payload for ${virtualPath}: ${error instanceof Error ? error.message : String(error)}`
            );
        }
    }
}

export class WorkspaceBashFs implements IFileSystem {
    constructor(
        private readonly permissions: ShellPermissionService,
        private readonly session: ShellSessionRef,
        private readonly workspaces: ShellWorkspaceService = shellWorkspaceService
    ) {}

    async readFile(path: string, options?: unknown): Promise<string> {
        const workspacePath = normalizeWorkspaceMountPath(path);
        this.assertPath('read', workspacePath);
        const fs = await this.getFs();
        return fs.readFile(workspacePath, options as BufferEncoding | undefined);
    }

    async readFileBuffer(path: string): Promise<Uint8Array> {
        const workspacePath = normalizeWorkspaceMountPath(path);
        this.assertPath('read', workspacePath);
        const fs = await this.getFs();
        return fs.readFileBuffer(workspacePath);
    }

    async writeFile(path: string, content: FileContent, options?: unknown): Promise<void> {
        const workspacePath = normalizeWorkspaceMountPath(path);
        this.assertPath('write', workspacePath);
        const fs = await this.getFs();
        await fs.writeFile(workspacePath, content, options as BufferEncoding | undefined);
        await this.workspaces.persist();
    }

    async appendFile(path: string, content: FileContent, options?: unknown): Promise<void> {
        const workspacePath = normalizeWorkspaceMountPath(path);
        this.assertPath('write', workspacePath);
        const fs = await this.getFs();
        await fs.appendFile(workspacePath, content, options as BufferEncoding | undefined);
        await this.workspaces.persist();
    }

    async exists(path: string): Promise<boolean> {
        const fs = await this.getFs();
        return fs.exists(normalizeWorkspaceMountPath(path));
    }

    async stat(path: string): Promise<FsStat> {
        const workspacePath = normalizeWorkspaceMountPath(path);
        this.assertPath('read', workspacePath);
        const fs = await this.getFs();
        return fs.stat(workspacePath);
    }

    async lstat(path: string): Promise<FsStat> {
        const workspacePath = normalizeWorkspaceMountPath(path);
        this.assertPath('read', workspacePath);
        const fs = await this.getFs();
        return fs.lstat(workspacePath);
    }

    async mkdir(path: string, options?: MkdirOptions): Promise<void> {
        const workspacePath = normalizeWorkspaceMountPath(path);
        this.assertPath('write', workspacePath);
        const fs = await this.getFs();
        await fs.mkdir(workspacePath, options);
        await this.workspaces.persist();
    }

    async readdir(path: string): Promise<string[]> {
        const workspacePath = normalizeWorkspaceMountPath(path);
        this.assertPath('read', workspacePath);
        const fs = await this.getFs();
        return fs.readdir(workspacePath);
    }

    async readdirWithFileTypes(path: string): Promise<DirentEntryLike[]> {
        const workspacePath = normalizeWorkspaceMountPath(path);
        this.assertPath('read', workspacePath);
        const fs = await this.getFs();
        if (fs.readdirWithFileTypes) {
            return fs.readdirWithFileTypes(workspacePath);
        }
        const names = await fs.readdir(workspacePath);
        return Promise.all(names.map(async (name): Promise<DirentEntryLike> => {
            const stat = await fs.stat(resolveWorkspaceMountPath(workspacePath, name));
            return {
                name,
                isFile: stat.isFile,
                isDirectory: stat.isDirectory,
                isSymbolicLink: stat.isSymbolicLink
            };
        }));
    }

    async rm(path: string, options?: RmOptions): Promise<void> {
        const workspacePath = normalizeWorkspaceMountPath(path);
        this.assertPath('write', workspacePath);
        const fs = await this.getFs();
        await fs.rm(workspacePath, options);
        await this.workspaces.persist();
    }

    async cp(src: string, dest: string, options?: CpOptions): Promise<void> {
        const workspaceSrc = normalizeWorkspaceMountPath(src);
        const workspaceDest = normalizeWorkspaceMountPath(dest);
        this.assertPath('read', workspaceSrc);
        this.assertPath('write', workspaceDest);
        const fs = await this.getFs();
        await fs.cp(workspaceSrc, workspaceDest, options);
        await this.workspaces.persist();
    }

    async mv(src: string, dest: string): Promise<void> {
        const workspaceSrc = normalizeWorkspaceMountPath(src);
        const workspaceDest = normalizeWorkspaceMountPath(dest);
        this.assertPath('write', workspaceSrc);
        this.assertPath('write', workspaceDest);
        const fs = await this.getFs();
        await fs.mv(workspaceSrc, workspaceDest);
        await this.workspaces.persist();
    }

    resolvePath(base: string, path: string): string {
        return resolveWorkspaceMountPath(base, path);
    }

    getAllPaths(): string[] {
        return [];
    }

    async chmod(path: string, fileMode: number): Promise<void> {
        const workspacePath = normalizeWorkspaceMountPath(path);
        this.assertPath('write', workspacePath);
        const fs = await this.getFs();
        await fs.chmod(workspacePath, fileMode);
        await this.workspaces.persist();
    }

    async symlink(target: string, linkPath: string): Promise<void> {
        const workspaceLinkPath = normalizeWorkspaceMountPath(linkPath);
        this.assertPath('write', workspaceLinkPath);
        const fs = await this.getFs();
        await fs.symlink(target, workspaceLinkPath);
        await this.workspaces.persist();
    }

    async link(existingPath: string, newPath: string): Promise<void> {
        const workspaceExistingPath = normalizeWorkspaceMountPath(existingPath);
        const workspaceNewPath = normalizeWorkspaceMountPath(newPath);
        this.assertPath('read', workspaceExistingPath);
        this.assertPath('write', workspaceNewPath);
        const fs = await this.getFs();
        await fs.link(workspaceExistingPath, workspaceNewPath);
        await this.workspaces.persist();
    }

    async readlink(path: string): Promise<string> {
        const workspacePath = normalizeWorkspaceMountPath(path);
        this.assertPath('read', workspacePath);
        const fs = await this.getFs();
        return fs.readlink(workspacePath);
    }

    async realpath(path: string): Promise<string> {
        const workspacePath = normalizeWorkspaceMountPath(path);
        this.assertPath('read', workspacePath);
        const fs = await this.getFs();
        const resolvedPath = await fs.realpath(workspacePath);
        return normalizeWorkspaceMountPath(resolvedPath);
    }

    async utimes(path: string, atime: Date, mtime: Date): Promise<void> {
        const workspacePath = normalizeWorkspaceMountPath(path);
        this.assertPath('write', workspacePath);
        const fs = await this.getFs();
        await fs.utimes(workspacePath, atime, mtime);
        await this.workspaces.persist();
    }

    private assertPath(operation: 'read' | 'write', path: string): void {
        const workspacePath = `${WORKSPACE_MOUNT_POINT}${normalizeWorkspaceMountPath(path)}`;
        const decision = this.permissions.checkPath(this.session, operation, workspacePath);
        if (!decision.allowed) throw new Error(decision.reason ?? `permission denied: ${workspacePath}`);
    }

    private getFs(): Promise<IFileSystem> {
        return this.workspaces.getFileSystem({
            projectId: this.session.projectId,
            conversationId: this.session.conversationId
        });
    }
}
