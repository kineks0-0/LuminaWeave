import LightningFS from '@isomorphic-git/lightning-fs';
import type {
    BufferEncoding,
    CpOptions,
    FileContent,
    FsStat,
    IFileSystem,
    MkdirOptions,
    RmOptions
} from 'just-bash';
import { cleanPath as normalizeLocalPath } from '@shared/resources/vfsPath.js';

type LightningPromisifiedFS = LightningFS['promises'];

interface ReadFileOptions {
    encoding?: BufferEncoding | null;
}

interface WriteFileOptions {
    encoding?: BufferEncoding;
}

interface DirentEntry {
    name: string;
    isFile: boolean;
    isDirectory: boolean;
    isSymbolicLink: boolean;
}

const parentPath = (path: string): string => {
    const normalized = normalizeLocalPath(path);
    const index = normalized.lastIndexOf('/');
    return index <= 0 ? '/' : normalized.slice(0, index);
};

const childPath = (parent: string, child: string): string =>
    normalizeLocalPath(parent === '/' ? `/${child}` : `${parent}/${child}`);

const bytesToText = (content: Uint8Array): string => new TextDecoder().decode(content);

const bytesToBinaryText = (content: Uint8Array): string => {
    let output = '';
    const chunkSize = 0x8000;
    for (let index = 0; index < content.length; index += chunkSize) {
        output += String.fromCharCode(...content.slice(index, index + chunkSize));
    }
    return output;
};

const binaryTextToBytes = (content: string): Uint8Array => {
    const bytes = new Uint8Array(content.length);
    for (let index = 0; index < content.length; index += 1) {
        bytes[index] = content.charCodeAt(index) & 0xff;
    }
    return bytes;
};

const normalizeEncoding = (options?: ReadFileOptions | WriteFileOptions | BufferEncoding): BufferEncoding | undefined =>
    typeof options === 'string' ? options : options?.encoding ?? undefined;

const assertSupportedEncoding = (encoding?: BufferEncoding): void => {
    if (encoding && encoding !== 'utf8' && encoding !== 'utf-8' && encoding !== 'binary') {
        throw new Error(`unsupported encoding: ${encoding}`);
    }
};

const encodeContent = (content: FileContent, encoding?: BufferEncoding): Uint8Array => {
    if (content instanceof Uint8Array) return content;
    const text = String(content);
    return encoding === 'binary' ? binaryTextToBytes(text) : new TextEncoder().encode(text);
};

export interface LightningBashFsAdapterOptions {
    filesystemName?: string;
    wipe?: boolean;
}

export class LightningBashFsAdapter implements IFileSystem {
    private readonly fs: LightningPromisifiedFS;
    private readonly paths = new Set<string>(['/']);

    constructor(options: LightningBashFsAdapterOptions = {}) {
        const filesystemName = options.filesystemName ?? 'luminaweave-forge-workspace';
        this.fs = new LightningFS(filesystemName, options.wipe ? { wipe: true } : undefined).promises;
    }

    async initialize(): Promise<void> {
        await this.rebuildPathIndex();
    }

    async readFile(path: string, options?: ReadFileOptions | BufferEncoding): Promise<string> {
        const normalized = normalizeLocalPath(path);
        const encoding = normalizeEncoding(options);
        assertSupportedEncoding(encoding);
        const content = await this.fs.readFile(normalized);
        return encoding === 'binary' ? bytesToBinaryText(content) : bytesToText(content);
    }

    async readFileBuffer(path: string): Promise<Uint8Array> {
        return await this.fs.readFile(normalizeLocalPath(path));
    }

    async writeFile(path: string, content: FileContent, options?: WriteFileOptions | BufferEncoding): Promise<void> {
        const normalized = normalizeLocalPath(path);
        const encoding = normalizeEncoding(options);
        assertSupportedEncoding(encoding);
        await this.mkdir(parentPath(normalized), { recursive: true });
        await this.fs.writeFile(normalized, encodeContent(content, encoding), { mode: 0o666 });
        this.paths.add(parentPath(normalized));
        this.paths.add(normalized);
        await this.fs.flush();
    }

    async appendFile(path: string, content: FileContent, options?: WriteFileOptions | BufferEncoding): Promise<void> {
        const normalized = normalizeLocalPath(path);
        const previous = await this.exists(normalized) ? await this.readFileBuffer(normalized) : new Uint8Array();
        const encoding = normalizeEncoding(options);
        assertSupportedEncoding(encoding);
        const contentBytes = encodeContent(content, encoding);
        const next = new Uint8Array(previous.byteLength + contentBytes.byteLength);
        next.set(previous, 0);
        next.set(contentBytes, previous.byteLength);
        await this.writeFile(normalized, next);
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
        const stat = await this.fs.stat(normalizeLocalPath(path));
        return this.toFsStat(stat);
    }

    async lstat(path: string): Promise<FsStat> {
        const stat = await this.fs.lstat(normalizeLocalPath(path));
        return this.toFsStat(stat);
    }

    async mkdir(path: string, options?: MkdirOptions): Promise<void> {
        const normalized = normalizeLocalPath(path);
        if (normalized === '/') return;
        if (options?.recursive) {
            const parts = normalized.split('/').filter(Boolean);
            let current = '';
            for (const part of parts) {
                current = `${current}/${part}`;
                if (!await this.exists(current)) {
                    await this.fs.mkdir(current, { mode: 0o777 });
                }
                this.paths.add(normalizeLocalPath(current));
            }
        } else {
            await this.fs.mkdir(normalized, { mode: 0o777 });
            this.paths.add(normalized);
        }
        await this.fs.flush();
    }

    async readdir(path: string): Promise<string[]> {
        return (await this.fs.readdir(normalizeLocalPath(path))).sort((left, right) => left.localeCompare(right));
    }

    async readdirWithFileTypes(path: string): Promise<DirentEntry[]> {
        const normalized = normalizeLocalPath(path);
        const names = await this.readdir(normalized);
        const entries = await Promise.all(names.map(async (name) => {
            const stat = await this.lstat(childPath(normalized, name));
            return {
                name,
                isFile: stat.isFile,
                isDirectory: stat.isDirectory,
                isSymbolicLink: stat.isSymbolicLink
            };
        }));
        return entries.sort((left, right) => left.name.localeCompare(right.name));
    }

    async rm(path: string, options?: RmOptions): Promise<void> {
        const normalized = normalizeLocalPath(path);
        try {
            const stat = await this.lstat(normalized);
            if (stat.isDirectory) {
                const entries = await this.readdir(normalized);
                if (entries.length > 0 && !options?.recursive) {
                    throw new Error(`directory is not empty: ${normalized}`);
                }
                for (const entry of entries) {
                    await this.rm(childPath(normalized, entry), { recursive: true, force: options?.force });
                }
                await this.fs.rmdir(normalized);
            } else {
                await this.fs.unlink(normalized);
            }
            this.removeIndexedSubtree(normalized);
            await this.fs.flush();
        } catch (error) {
            if (options?.force) return;
            throw error;
        }
    }

    async cp(src: string, dest: string, options?: CpOptions): Promise<void> {
        const from = normalizeLocalPath(src);
        const to = normalizeLocalPath(dest);
        const stat = await this.lstat(from);
        if (stat.isDirectory) {
            if (!options?.recursive) throw new Error(`cannot copy directory without recursive: ${from}`);
            await this.mkdir(to, { recursive: true });
            for (const entry of await this.readdir(from)) {
                await this.cp(childPath(from, entry), childPath(to, entry), options);
            }
            return;
        }
        await this.mkdir(parentPath(to), { recursive: true });
        await this.writeFile(to, await this.readFileBuffer(from));
    }

    async mv(src: string, dest: string): Promise<void> {
        const from = normalizeLocalPath(src);
        const to = normalizeLocalPath(dest);
        await this.mkdir(parentPath(to), { recursive: true });
        await this.fs.rename(from, to);
        this.moveIndexedSubtree(from, to);
        await this.fs.flush();
    }

    resolvePath(base: string, path: string): string {
        if (path.startsWith('/')) return normalizeLocalPath(path);
        return normalizeLocalPath(`${base}/${path}`);
    }

    getAllPaths(): string[] {
        return Array.from(this.paths).sort((left, right) => left.localeCompare(right));
    }

    async chmod(path: string, _mode: number): Promise<void> {
        if (!await this.exists(path)) throw new Error(`path does not exist: ${normalizeLocalPath(path)}`);
    }

    async symlink(target: string, linkPath: string): Promise<void> {
        const normalized = normalizeLocalPath(linkPath);
        await this.mkdir(parentPath(normalized), { recursive: true });
        await this.fs.symlink(target, normalized);
        this.paths.add(normalized);
        await this.fs.flush();
    }

    async link(existingPath: string, newPath: string): Promise<void> {
        await this.writeFile(newPath, await this.readFileBuffer(existingPath));
    }

    async readlink(path: string): Promise<string> {
        return await this.fs.readlink(normalizeLocalPath(path));
    }

    async realpath(path: string): Promise<string> {
        if (!await this.exists(path)) throw new Error(`path does not exist: ${normalizeLocalPath(path)}`);
        return normalizeLocalPath(path);
    }

    async utimes(path: string, _atime: Date, _mtime: Date): Promise<void> {
        if (!await this.exists(path)) throw new Error(`path does not exist: ${normalizeLocalPath(path)}`);
    }

    private async rebuildPathIndex(): Promise<void> {
        this.paths.clear();
        this.paths.add('/');
        await this.walk('/');
    }

    private async walk(path: string): Promise<void> {
        const normalized = normalizeLocalPath(path);
        this.paths.add(normalized);
        const stat = await this.stat(normalized).catch(() => null);
        if (!stat?.isDirectory) return;
        for (const entry of await this.readdir(normalized)) {
            await this.walk(childPath(normalized, entry));
        }
    }

    private toFsStat(stat: LightningFS.Stats): FsStat {
        return {
            isFile: stat.isFile(),
            isDirectory: stat.isDirectory(),
            isSymbolicLink: stat.isSymbolicLink(),
            mode: typeof stat.mode === 'number' ? stat.mode : 0,
            size: stat.size,
            mtime: new Date(typeof stat.mtimeMs === 'number' ? stat.mtimeMs : Date.now())
        };
    }

    private removeIndexedSubtree(path: string): void {
        const normalized = normalizeLocalPath(path);
        for (const item of Array.from(this.paths)) {
            if (item === normalized || item.startsWith(`${normalized}/`)) {
                this.paths.delete(item);
            }
        }
    }

    private moveIndexedSubtree(from: string, to: string): void {
        const source = normalizeLocalPath(from);
        const target = normalizeLocalPath(to);
        const moved = Array.from(this.paths)
            .filter(path => path === source || path.startsWith(`${source}/`))
            .map(path => ({
                from: path,
                to: `${target}${path.slice(source.length)}`
            }));
        for (const entry of moved) {
            this.paths.delete(entry.from);
            this.paths.add(normalizeLocalPath(entry.to));
        }
    }
}
