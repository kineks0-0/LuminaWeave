export type AgentEnvErrorCode =
    | 'aborted'
    | 'not_found'
    | 'already_exists'
    | 'permission_denied'
    | 'not_directory'
    | 'is_directory'
    | 'not_empty'
    | 'invalid'
    | 'timeout'
    | 'callback_error'
    | 'unknown';

export class AgentEnvError extends Error {
    readonly code: AgentEnvErrorCode;
    readonly path: string | undefined;

    constructor(code: AgentEnvErrorCode, message: string, path?: string, cause?: unknown) {
        super(message, cause === undefined ? undefined : { cause });
        this.name = 'AgentEnvError';
        this.code = code;
        this.path = path;
    }
}

export type AgentEnvResult<T> =
    | { ok: true; value: T }
    | { ok: false; error: AgentEnvError };

export const envOk = <T>(value: T): AgentEnvResult<T> => ({ ok: true, value });

export const envErr = <T>(error: AgentEnvError): AgentEnvResult<T> => ({ ok: false, error });

export type AgentFileKind = 'file' | 'directory' | 'symlink';

export interface AgentFileInfo {
    name: string;
    path: string;
    kind: AgentFileKind;
    size: number;
    mtimeMs: number;
}

export interface AgentEnvOperationOptions {
    abortSignal?: AbortSignal;
}

export interface AgentShellExecOptions extends AgentEnvOperationOptions {
    cwd?: string;
    env?: Record<string, string>;
    timeoutMs?: number;
    onStdout?: (chunk: string) => void;
    onStderr?: (chunk: string) => void;
}

export interface AgentShellExecResult {
    stdout: string;
    stderr: string;
    exitCode: number;
}

/**
 * SDK 自有的 Agent 执行环境：文件系统 + Shell。
 * 形状参考 pi 0.80 的 ExecutionEnv（pi 1.0 已移除）；所有操作返回 Result，实现不得抛出或 reject。
 * 路径可为绝对路径或相对 cwd 的路径；返回的路径均为规范化后的绝对路径。
 *
 * 契约细节：
 * - writeFile / appendFile 隐式创建父目录；直接父路径是文件时返回 not_directory（just-bash 对更深层的父路径为文件不报错，可能写出不可见的孤儿文件）。
 * - createDir 默认 recursive: true；remove 默认 recursive: false、force: false。
 * - fileInfo / listDir / exists 不跟随符号链接（悬空链接的 exists 为 true）。
 * - exec 的 env 在默认环境上合并；每次 exec 是独立 shell（cd / export 不跨调用保留）。
 * - exec 的 cwd 不校验是否存在；中止或超时不返回部分输出。
 * - exec 的 timeoutMs 必须 > 0（否则 invalid）；undefined 或超过最大定时值（2_147_483_647）表示不限时。
 * - onStdout / onStderr 是否逐块流式由实现决定（just-bash 实现在命令结束后整块回调一次）。
 * - cleanup 是否回收临时目录由实现决定（just-bash 实现不回收）。
 */
export interface AgentExecutionEnv {
    readonly cwd: string;
    absolutePath(path: string): Promise<AgentEnvResult<string>>;
    readTextFile(path: string, options?: AgentEnvOperationOptions): Promise<AgentEnvResult<string>>;
    readBinaryFile(path: string, options?: AgentEnvOperationOptions): Promise<AgentEnvResult<Uint8Array>>;
    writeFile(path: string, content: string | Uint8Array, options?: AgentEnvOperationOptions): Promise<AgentEnvResult<void>>;
    appendFile(path: string, content: string | Uint8Array, options?: AgentEnvOperationOptions): Promise<AgentEnvResult<void>>;
    fileInfo(path: string, options?: AgentEnvOperationOptions): Promise<AgentEnvResult<AgentFileInfo>>;
    listDir(path: string, options?: AgentEnvOperationOptions): Promise<AgentEnvResult<AgentFileInfo[]>>;
    exists(path: string, options?: AgentEnvOperationOptions): Promise<AgentEnvResult<boolean>>;
    createDir(path: string, options?: AgentEnvOperationOptions & { recursive?: boolean }): Promise<AgentEnvResult<void>>;
    remove(
        path: string,
        options?: AgentEnvOperationOptions & { recursive?: boolean; force?: boolean }
    ): Promise<AgentEnvResult<void>>;
    createTempDir(prefix?: string): Promise<AgentEnvResult<string>>;
    exec(command: string, options?: AgentShellExecOptions): Promise<AgentEnvResult<AgentShellExecResult>>;
    cleanup(): Promise<void>;
}
