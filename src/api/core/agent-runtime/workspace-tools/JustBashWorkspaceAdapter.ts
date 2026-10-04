import type { Bash, IFileSystem } from 'just-bash';
import type {
    AgentWorkspaceBashExecutor,
    AgentWorkspaceFileSystem
} from './AgentWorkspaceTools.js';
import { cleanPath as normalizeAbsolutePath } from '@shared/resources/vfsPath.js';

export interface CreateJustBashWorkspaceFileSystemOptions {
    fs: IFileSystem;
    root: string;
}

export interface CreateJustBashWorkspaceBashExecutorOptions {
    bash: Pick<Bash, 'exec'>;
}

export const createJustBashWorkspaceFileSystem = (
    options: CreateJustBashWorkspaceFileSystemOptions
): AgentWorkspaceFileSystem => {
    const root = normalizeAbsolutePath(options.root);
    return {
        readFile: path => options.fs.readFile(toFsPath(root, path)),
        writeFile: async (path, content) => {
            await options.fs.writeFile(toFsPath(root, path), content);
        },
        deleteFile: async path => {
            await options.fs.rm(toFsPath(root, path), { force: true });
        },
        exists: path => options.fs.exists(toFsPath(root, path)),
        listFiles: async () => {
            const files = await listFiles(options.fs, root);
            return files.map(path => toWorkspacePath(root, path)).sort();
        }
    };
};

export const createJustBashWorkspaceBashExecutor = (
    options: CreateJustBashWorkspaceBashExecutorOptions
): AgentWorkspaceBashExecutor => async input => {
    const result = await options.bash.exec(input.command, {
        cwd: input.cwd
    });
    if (result.stdout) {
        input.onOutput({ type: 'stdout', text: result.stdout });
    }
    if (result.stderr) {
        input.onOutput({ type: 'stderr', text: result.stderr });
    }
    return {
        stdout: result.stdout,
        stderr: result.stderr,
        exitCode: result.exitCode,
        details: {
            env: result.env,
            metadata: result.metadata
        }
    };
};

const listFiles = async (fs: IFileSystem, root: string): Promise<string[]> => {
    if (!await fs.exists(root)) return [];
    const stat = await fs.stat(root);
    if (stat.isFile) return [root];
    if (!stat.isDirectory) return [];
    const entries = fs.readdirWithFileTypes
        ? await fs.readdirWithFileTypes(root)
        : await readDirEntriesWithStats(fs, root);
    const nested = await Promise.all(entries.map(async entry => {
        const childPath = joinAbsolutePath(root, entry.name);
        if (entry.isDirectory) {
            return listFiles(fs, childPath);
        }
        if (entry.isFile) {
            return [childPath];
        }
        return [];
    }));
    return nested.flat();
};

const readDirEntriesWithStats = async (fs: IFileSystem, path: string) => {
    const names = await fs.readdir(path);
    return Promise.all(names.map(async name => {
        const childPath = joinAbsolutePath(path, name);
        const stat = await fs.stat(childPath);
        return {
            name,
            isFile: stat.isFile,
            isDirectory: stat.isDirectory,
            isSymbolicLink: stat.isSymbolicLink
        };
    }));
};

const toFsPath = (root: string, path: string): string =>
    joinAbsolutePath(root, normalizeWorkspacePath(path));

const toWorkspacePath = (root: string, path: string): string => {
    const normalizedPath = normalizeAbsolutePath(path);
    if (normalizedPath === root) return '';
    if (normalizedPath.startsWith(`${root}/`)) {
        return normalizedPath.slice(root.length + 1);
    }
    return normalizedPath.replace(/^\/+/, '');
};

const joinAbsolutePath = (root: string, child: string): string => {
    const normalizedChild = child.replace(/\\/g, '/').replace(/^\/+/, '');
    return normalizedChild
        ? `${root.replace(/\/$/, '')}/${normalizedChild}`.replace(/\/+/g, '/')
        : root;
};

const normalizeWorkspacePath = (path: string): string =>
    path
        .replace(/\\/g, '/')
        .replace(/\/+/g, '/')
        .replace(/^\.\//, '')
        .replace(/^\/+/, '');
