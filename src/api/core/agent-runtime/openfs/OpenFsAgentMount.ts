import { createGrepCommand, createSearchCommand, type Vfs } from '@open-fs/just-bash';
import type {
    BufferEncoding,
    CpOptions,
    FileContent,
    FsStat,
    IFileSystem,
    MkdirOptions,
    RmOptions
} from 'just-bash';

export type AgentOpenFsOperationKind = 'read' | 'write' | 'append' | 'delete' | 'copy' | 'move' | 'mkdir' | 'stat' | 'list';
export type AgentOpenFsAuditStage = 'preflight' | 'commit' | 'result';

interface AgentReadFileOptions {
    encoding?: BufferEncoding | null;
}

interface AgentWriteFileOptions {
    encoding?: BufferEncoding;
}

interface AgentDirentEntry {
    name: string;
    isFile: boolean;
    isDirectory: boolean;
    isSymbolicLink: boolean;
}

export interface AgentOpenFsMountMetadata {
    id: string;
    mountPoint: string;
    writable: boolean;
}

export interface AgentOpenFsPhaseState {
    id: string;
    canWrite: boolean;
}

export interface AgentOpenFsOperation {
    kind: AgentOpenFsOperationKind;
    path: string;
    mount: AgentOpenFsMountMetadata;
    phase: AgentOpenFsPhaseState;
}

export interface AgentOpenFsApprovalResult {
    approved: boolean;
    message?: string;
}

export interface AgentOpenFsAuditEvent {
    stage: AgentOpenFsAuditStage;
    kind: AgentOpenFsOperationKind;
    path: string;
    mount: AgentOpenFsMountMetadata;
    phase: AgentOpenFsPhaseState;
    error?: string;
}

export interface AgentOpenFsTraceEvent {
    type: AgentOpenFsAuditStage;
    operation: AgentOpenFsOperation;
    error?: string;
}

export interface CreateAuditedOpenFsMountOptions {
    filesystem: IFileSystem;
    mount: AgentOpenFsMountMetadata;
    phase: AgentOpenFsPhaseState;
    approval?: (operation: AgentOpenFsOperation) => Promise<AgentOpenFsApprovalResult>;
    audit?: (event: AgentOpenFsAuditEvent) => Promise<void> | void;
    trace?: (event: AgentOpenFsTraceEvent) => void;
}

const textContent = (content: FileContent): string | Uint8Array => content;

export class AuditedOpenFsMount implements IFileSystem {
    constructor(private readonly options: CreateAuditedOpenFsMountOptions) {}

    async readFile(path: string, options?: BufferEncoding | AgentReadFileOptions): Promise<string> {
        await this.preflight('read', path);
        try {
            const result = await this.options.filesystem.readFile(this.toLocal(path), options);
            await this.result('read', path);
            return result;
        } catch (error) {
            await this.result('read', path, error);
            throw error;
        }
    }

    async readFileBuffer(path: string): Promise<Uint8Array> {
        await this.preflight('read', path);
        try {
            const result = await this.options.filesystem.readFileBuffer(this.toLocal(path));
            await this.result('read', path);
            return result;
        } catch (error) {
            await this.result('read', path, error);
            throw error;
        }
    }

    async writeFile(path: string, content: FileContent, options?: BufferEncoding | AgentWriteFileOptions): Promise<void> {
        await this.preflight('write', path);
        try {
            await this.commit('write', path);
            await this.options.filesystem.writeFile(this.toLocal(path), textContent(content), options);
            await this.result('write', path);
        } catch (error) {
            await this.result('write', path, error);
            throw error;
        }
    }

    async appendFile(path: string, content: FileContent, options?: BufferEncoding | AgentWriteFileOptions): Promise<void> {
        await this.preflight('append', path);
        try {
            await this.commit('append', path);
            await this.options.filesystem.appendFile(this.toLocal(path), textContent(content), options);
            await this.result('append', path);
        } catch (error) {
            await this.result('append', path, error);
            throw error;
        }
    }

    async exists(path: string): Promise<boolean> {
        return this.options.filesystem.exists(this.toLocal(path));
    }

    async stat(path: string): Promise<FsStat> {
        await this.preflight('stat', path);
        try {
            const result = await this.options.filesystem.stat(this.toLocal(path));
            await this.result('stat', path);
            return result;
        } catch (error) {
            await this.result('stat', path, error);
            throw error;
        }
    }

    lstat(path: string): Promise<FsStat> {
        return this.stat(path);
    }

    async mkdir(path: string, options?: MkdirOptions): Promise<void> {
        await this.preflight('mkdir', path);
        try {
            await this.commit('mkdir', path);
            await this.options.filesystem.mkdir(this.toLocal(path), options);
            await this.result('mkdir', path);
        } catch (error) {
            await this.result('mkdir', path, error);
            throw error;
        }
    }

    async readdir(path: string): Promise<string[]> {
        await this.preflight('list', path);
        try {
            const result = await this.options.filesystem.readdir(this.toLocal(path));
            await this.result('list', path);
            return result;
        } catch (error) {
            await this.result('list', path, error);
            throw error;
        }
    }

    async readdirWithFileTypes(path: string): Promise<AgentDirentEntry[]> {
        await this.preflight('list', path);
        try {
            const localPath = this.toLocal(path);
            const result = this.options.filesystem.readdirWithFileTypes
                ? await this.options.filesystem.readdirWithFileTypes(localPath)
                : await this.readDirWithStats(localPath);
            await this.result('list', path);
            return result;
        } catch (error) {
            await this.result('list', path, error);
            throw error;
        }
    }

    async rm(path: string, options?: RmOptions): Promise<void> {
        await this.preflight('delete', path);
        try {
            await this.commit('delete', path);
            await this.options.filesystem.rm(this.toLocal(path), options);
            await this.result('delete', path);
        } catch (error) {
            await this.result('delete', path, error);
            throw error;
        }
    }

    async cp(src: string, dest: string, options?: CpOptions): Promise<void> {
        await this.preflight('copy', dest);
        try {
            await this.commit('copy', dest);
            await this.options.filesystem.cp(this.toLocal(src), this.toLocal(dest), options);
            await this.result('copy', dest);
        } catch (error) {
            await this.result('copy', dest, error);
            throw error;
        }
    }

    async mv(src: string, dest: string): Promise<void> {
        await this.preflight('move', dest);
        try {
            await this.commit('move', dest);
            await this.options.filesystem.mv(this.toLocal(src), this.toLocal(dest));
            await this.result('move', dest);
        } catch (error) {
            await this.result('move', dest, error);
            throw error;
        }
    }

    resolvePath(base: string, path: string): string {
        return this.options.filesystem.resolvePath(base, path);
    }

    getAllPaths(): string[] {
        return this.options.filesystem.getAllPaths();
    }

    chmod(path: string, mode: number): Promise<void> {
        return this.options.filesystem.chmod(this.toLocal(path), mode);
    }

    symlink(target: string, linkPath: string): Promise<void> {
        return this.options.filesystem.symlink(target, this.toLocal(linkPath));
    }

    link(existingPath: string, newPath: string): Promise<void> {
        return this.options.filesystem.link(this.toLocal(existingPath), this.toLocal(newPath));
    }

    readlink(path: string): Promise<string> {
        return this.options.filesystem.readlink(this.toLocal(path));
    }

    realpath(path: string): Promise<string> {
        return this.options.filesystem.realpath(this.toLocal(path));
    }

    utimes(path: string, atime: Date, mtime: Date): Promise<void> {
        return this.options.filesystem.utimes(this.toLocal(path), atime, mtime);
    }

    private async preflight(kind: AgentOpenFsOperationKind, path: string): Promise<void> {
        const operation = this.operation(kind, path);
        await this.emit('preflight', operation);
        if (this.isWrite(kind)) {
            if (!this.options.mount.writable) {
                throw new Error(`Agent mount ${this.options.mount.mountPoint} is read-only.`);
            }
            if (!this.options.phase.canWrite) {
                throw new Error(`Agent phase ${this.options.phase.id} cannot write to ${this.options.mount.mountPoint}.`);
            }
            const approval = await this.options.approval?.(operation);
            if (approval && !approval.approved) {
                throw new Error(approval.message ?? `Agent write was denied: ${path}`);
            }
        }
    }

    private async commit(kind: AgentOpenFsOperationKind, path: string): Promise<void> {
        await this.emit('commit', this.operation(kind, path));
    }

    private async result(kind: AgentOpenFsOperationKind, path: string, error?: unknown): Promise<void> {
        await this.emit('result', this.operation(kind, path), error);
    }

    private async emit(stage: AgentOpenFsAuditStage, operation: AgentOpenFsOperation, error?: unknown): Promise<void> {
        const message = error instanceof Error ? error.message : error ? String(error) : undefined;
        this.options.trace?.({
            type: stage,
            operation,
            error: message
        });
        await this.options.audit?.({
            stage,
            kind: operation.kind,
            path: operation.path,
            mount: operation.mount,
            phase: operation.phase,
            error: message
        });
    }

    private operation(kind: AgentOpenFsOperationKind, path: string): AgentOpenFsOperation {
        return {
            kind,
            path: this.toLocal(path),
            mount: this.options.mount,
            phase: this.options.phase
        };
    }

    private isWrite(kind: AgentOpenFsOperationKind): boolean {
        return kind === 'write' || kind === 'append' || kind === 'delete' || kind === 'copy' || kind === 'move' || kind === 'mkdir';
    }

    private async readDirWithStats(path: string): Promise<AgentDirentEntry[]> {
        const names = await this.options.filesystem.readdir(path);
        return Promise.all(names.map(async name => {
            const childPath = `${path.replace(/\/$/, '')}/${name}`.replace(/\/+/g, '/');
            const stat = await this.options.filesystem.stat(childPath);
            return {
                name,
                isFile: stat.isFile,
                isDirectory: stat.isDirectory,
                isSymbolicLink: stat.isSymbolicLink
            };
        }));
    }

    private toLocal(path: string): string {
        const normalized = `/${path || ''}`.replace(/\\/g, '/').replace(/\/+/g, '/');
        if (normalized === this.options.mount.mountPoint) return '/';
        if (normalized.startsWith(`${this.options.mount.mountPoint}/`)) {
            return normalized.slice(this.options.mount.mountPoint.length) || '/';
        }
        return normalized.replace(/\/$/, '') || '/';
    }
}

export const createAuditedOpenFsMount = (options: CreateAuditedOpenFsMountOptions): IFileSystem =>
    new AuditedOpenFsMount(options);

export const createOpenFsBashCommandSet = (input: { vfs: Vfs; mountPoint: string }) => [
    createGrepCommand(input.vfs),
    createSearchCommand(input.vfs)
];
