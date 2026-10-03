import type { Bash, FsStat, IFileSystem } from 'just-bash';
import {
    AgentEnvError,
    envErr,
    envOk,
    type AgentEnvErrorCode,
    type AgentEnvResult,
    type AgentExecutionEnv,
    type AgentFileInfo,
    type AgentFileKind,
    type AgentShellExecOptions,
    type AgentShellExecResult
} from './AgentExecutionEnv.js';

export interface CreateJustBashExecutionEnvOptions {
    /** Agent 可见文件系统，通常是已组合挂载点的 MountableFs；必须与 bash 共享同一实例。 */
    fs: IFileSystem;
    bash: Pick<Bash, 'exec'>;
    cwd: string;
    /** 临时目录根，默认 /tmp。 */
    tempRoot?: string;
    /** 临时目录名的随机源，测试可注入固定值。 */
    createId?: () => string;
}

// just-bash 的错误不带 code 字段，errno 只出现在 message 前缀，例如 "ENOENT: no such file or directory, open '/x'"。
const ERRNO_PATTERN = /^(E[A-Z]+):/;
const ERRNO_CODES: Record<string, AgentEnvErrorCode> = {
    ENOENT: 'not_found',
    EEXIST: 'already_exists',
    EACCES: 'permission_denied',
    EPERM: 'permission_denied',
    EROFS: 'permission_denied',
    ENOTDIR: 'not_directory',
    EISDIR: 'is_directory',
    ENOTEMPTY: 'not_empty',
    EINVAL: 'invalid'
};

const toEnvError = (error: unknown, path?: string): AgentEnvError => {
    if (error instanceof AgentEnvError) return error;
    const message = error instanceof Error ? error.message : String(error);
    const errno = ERRNO_PATTERN.exec(message)?.[1];
    const code = errno ? ERRNO_CODES[errno] ?? 'unknown' : 'unknown';
    return new AgentEnvError(code, message, path, error);
};

const toFileKind = (stat: FsStat): AgentFileKind | undefined => {
    if (stat.isSymbolicLink) return 'symlink';
    if (stat.isDirectory) return 'directory';
    if (stat.isFile) return 'file';
    return undefined;
};

// setTimeout 的最大延迟（32 位有符号整数）；超过它会被立即触发，因此视为不限时。
const MAX_TIMER_MS = 2_147_483_647;

// crypto.randomUUID 在非安全上下文（如 HTTP 局域网访问）中不可用。
const defaultCreateId = (): string =>
    typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
        ? crypto.randomUUID()
        : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;

const baseName = (path: string): string => path.split('/').filter(Boolean).pop() ?? '/';

const parentDir = (path: string): string => path.slice(0, path.lastIndexOf('/')) || '/';

export const createJustBashExecutionEnv = (options: CreateJustBashExecutionEnvOptions): AgentExecutionEnv => {
    const { fs, bash } = options;
    const cwd = fs.resolvePath('/', options.cwd);
    const tempRoot = fs.resolvePath('/', options.tempRoot ?? '/tmp');
    const createId = options.createId ?? defaultCreateId;
    const resolve = (path: string): string => fs.resolvePath(cwd, path);

    const run = async <T>(
        path: string,
        abortSignal: AbortSignal | undefined,
        operation: (resolved: string) => Promise<T>
    ): Promise<AgentEnvResult<T>> => {
        let resolved = path;
        try {
            resolved = resolve(path);
            if (abortSignal?.aborted) return envErr(new AgentEnvError('aborted', 'aborted', resolved));
            return envOk(await operation(resolved));
        } catch (error) {
            return envErr(toEnvError(error, resolved));
        }
    };

    // 父路径是文件时 mkdir 会报 EEXIST，对调用方而言应是 not_directory。
    const ensureParentDir = async (resolved: string): Promise<void> => {
        try {
            await fs.mkdir(parentDir(resolved), { recursive: true });
        } catch (error) {
            const envError = toEnvError(error, resolved);
            if (envError.code === 'already_exists') {
                throw new AgentEnvError('not_directory', envError.message, resolved, error);
            }
            throw envError;
        }
    };

    const fileInfoAt = async (resolved: string): Promise<AgentFileInfo> => {
        const stat = await fs.lstat(resolved);
        const kind = toFileKind(stat);
        if (!kind) throw new AgentEnvError('invalid', 'Unsupported file type', resolved);
        return { name: baseName(resolved), path: resolved, kind, size: stat.size, mtimeMs: stat.mtime.getTime() };
    };

    const execute = async (
        command: string,
        execOptions: AgentShellExecOptions = {}
    ): Promise<AgentEnvResult<AgentShellExecResult>> => {
        const { timeoutMs } = execOptions;
        if (timeoutMs !== undefined && !(timeoutMs > 0)) {
            return envErr(new AgentEnvError('invalid', `timeoutMs must be greater than 0: ${timeoutMs}`));
        }
        if (execOptions.abortSignal?.aborted) return envErr(new AgentEnvError('aborted', 'aborted'));
        // just-bash 只接受单个 signal：把调用方中止与超时合并到同一个 controller。
        const controller = new AbortController();
        const forwardAbort = () => controller.abort();
        execOptions.abortSignal?.addEventListener('abort', forwardAbort, { once: true });
        let timedOut = false;
        const timeoutId = timeoutMs === undefined || timeoutMs > MAX_TIMER_MS
            ? undefined
            : setTimeout(() => {
                if (controller.signal.aborted) return;
                timedOut = true;
                controller.abort();
            }, timeoutMs);
        try {
            const result = await bash.exec(command, {
                cwd: execOptions.cwd === undefined ? cwd : resolve(execOptions.cwd),
                env: execOptions.env,
                signal: controller.signal
            });
            const abortedDuringRun = controller.signal.aborted && !timedOut;
            if (timedOut) {
                return envErr(new AgentEnvError('timeout', `Command timed out after ${timeoutMs}ms`));
            }
            if (abortedDuringRun) return envErr(new AgentEnvError('aborted', 'aborted'));
            // just-bash 在命令结束后一次性返回输出，这里按整块回调，不提供逐行流式。
            try {
                if (result.stdout) execOptions.onStdout?.(result.stdout);
                if (result.stderr) execOptions.onStderr?.(result.stderr);
            } catch (error) {
                const message = error instanceof Error ? error.message : String(error);
                return envErr(new AgentEnvError('callback_error', message, undefined, error));
            }
            return envOk({ stdout: result.stdout, stderr: result.stderr, exitCode: result.exitCode });
        } catch (error) {
            // bash 因我们触发的中止而 reject 时，按中止原因归类，而不是泛化为 unknown。
            if (timedOut) {
                return envErr(new AgentEnvError('timeout', `Command timed out after ${timeoutMs}ms`, undefined, error));
            }
            if (controller.signal.aborted) {
                return envErr(new AgentEnvError('aborted', 'aborted', undefined, error));
            }
            return envErr(toEnvError(error));
        } finally {
            if (timeoutId !== undefined) clearTimeout(timeoutId);
            execOptions.abortSignal?.removeEventListener('abort', forwardAbort);
        }
    };

    return {
        cwd,
        absolutePath: path => run(path, undefined, async resolved => resolved),
        readTextFile: (path, operationOptions) =>
            run(path, operationOptions?.abortSignal, resolved => fs.readFile(resolved)),
        readBinaryFile: (path, operationOptions) =>
            run(path, operationOptions?.abortSignal, resolved => fs.readFileBuffer(resolved)),
        writeFile: (path, content, operationOptions) =>
            run(path, operationOptions?.abortSignal, async resolved => {
                await ensureParentDir(resolved);
                await fs.writeFile(resolved, content);
            }),
        appendFile: (path, content, operationOptions) =>
            run(path, operationOptions?.abortSignal, async resolved => {
                await ensureParentDir(resolved);
                await fs.appendFile(resolved, content);
            }),
        fileInfo: (path, operationOptions) => run(path, operationOptions?.abortSignal, fileInfoAt),
        listDir: (path, operationOptions) =>
            run(path, operationOptions?.abortSignal, async resolved => {
                const names = await fs.readdir(resolved);
                const infos: AgentFileInfo[] = [];
                for (const name of names) {
                    if (operationOptions?.abortSignal?.aborted) {
                        throw new AgentEnvError('aborted', 'aborted', resolved);
                    }
                    infos.push(await fileInfoAt(fs.resolvePath(resolved, name)));
                }
                return infos;
            }),
        exists: async (path, operationOptions) => {
            const info = await run(path, operationOptions?.abortSignal, fileInfoAt);
            if (info.ok) return envOk(true);
            return info.error.code === 'not_found' ? envOk(false) : envErr<boolean>(info.error);
        },
        createDir: (path, operationOptions) =>
            run(path, operationOptions?.abortSignal, resolved =>
                fs.mkdir(resolved, { recursive: operationOptions?.recursive ?? true })),
        remove: (path, operationOptions) =>
            run(path, operationOptions?.abortSignal, resolved =>
                fs.rm(resolved, {
                    recursive: operationOptions?.recursive ?? false,
                    force: operationOptions?.force ?? false
                })),
        createTempDir: async (prefix = 'tmp-') => {
            if (prefix.includes('/') || prefix.includes('\\') || prefix.includes('..')) {
                return envErr(new AgentEnvError('invalid', `Invalid temp dir prefix: ${prefix}`));
            }
            let id: string;
            try {
                id = createId();
            } catch (error) {
                return envErr(toEnvError(error));
            }
            return run(`${tempRoot}/${prefix}${id}`, undefined, async resolved => {
                await fs.mkdir(resolved, { recursive: true });
                return resolved;
            });
        },
        exec: execute,
        cleanup: async () => undefined
    };
};
