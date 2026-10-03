import type {
    AgentWorkspaceBashExecutor,
    AgentWorkspaceFileSystem
} from '../workspace-tools/AgentWorkspaceTools.js';
import { AgentEnvError, type AgentEnvResult, type AgentExecutionEnv } from './AgentExecutionEnv.js';

// AgentWorkspaceFileSystem 的既有契约以抛错表达失败：在此把 Result 解包为抛出 AgentEnvError。
const unwrap = <T>(result: AgentEnvResult<T>): T => {
    if (!result.ok) throw result.error;
    return result.value;
};

const toRelativeWorkspacePath = (path: string): string =>
    path.replace(/\\/g, '/').replace(/^\.\//, '').replace(/^\/+/, '');

export const createEnvWorkspaceFileSystem = (env: AgentExecutionEnv, root: string): AgentWorkspaceFileSystem => {
    const resolveInRoot = async (path: string): Promise<string> => {
        const rootPath = unwrap(await env.absolutePath(root));
        const relative = toRelativeWorkspacePath(path);
        const resolved = unwrap(await env.absolutePath(relative ? `${rootPath}/${relative}` : rootPath));
        const rootPrefix = rootPath === '/' ? '/' : `${rootPath}/`;
        // 仅做词法层面的 ../ 逃逸拒绝，不解析符号链接，因此不构成安全边界；
        // session 隔离必须由挂载（每个 session 独立的 MountableFs 根）保证（见 A5）。
        if (resolved !== rootPath && !resolved.startsWith(rootPrefix)) {
            throw new AgentEnvError('permission_denied', `Path escapes workspace root: ${path}`, resolved);
        }
        return resolved;
    };

    const listFilesUnder = async (directory: string): Promise<string[]> => {
        const entries = await env.listDir(directory);
        if (!entries.ok) {
            if (entries.error.code === 'not_found') return [];
            throw entries.error;
        }
        const nested = await Promise.all(entries.value.map(entry => {
            if (entry.kind === 'directory') return listFilesUnder(entry.path);
            return Promise.resolve(entry.kind === 'file' ? [entry.path] : []);
        }));
        return nested.flat();
    };

    return {
        readFile: async path => unwrap(await env.readTextFile(await resolveInRoot(path))),
        writeFile: async (path, content) => {
            unwrap(await env.writeFile(await resolveInRoot(path), content));
        },
        deleteFile: async path => {
            unwrap(await env.remove(await resolveInRoot(path), { force: true }));
        },
        exists: async path => unwrap(await env.exists(await resolveInRoot(path))),
        listFiles: async () => {
            const rootPath = await resolveInRoot('');
            const rootPrefix = rootPath === '/' ? '/' : `${rootPath}/`;
            const files = await listFilesUnder(rootPath);
            return files.map(file => file.slice(rootPrefix.length)).sort();
        }
    };
};

export const createEnvWorkspaceBashExecutor = (env: AgentExecutionEnv): AgentWorkspaceBashExecutor =>
    async input => {
        const result = unwrap(await env.exec(input.command, {
            cwd: input.cwd,
            onStdout: text => input.onOutput({ type: 'stdout', text }),
            onStderr: text => input.onOutput({ type: 'stderr', text })
        }));
        return { stdout: result.stdout, stderr: result.stderr, exitCode: result.exitCode };
    };
