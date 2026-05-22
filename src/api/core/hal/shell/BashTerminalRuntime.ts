import {
    Bash,
    InMemoryFs,
    MountableFs,
    defineCommand,
    getCommandNames,
    type BashExecResult,
    type BashOptions,
    type Command,
    type IFileSystem,
    type NetworkConfig
} from 'just-bash';
import type { ShellExecResult, ShellSessionRef, VFSCompletionCandidate, VFSCompletionResult } from '@shared/resources/index.js';
import type { VirtualFileSystemService } from '../resource/VirtualFileSystemService.js';
import { ResourceBackedBashFs, WorkspaceBashFs } from './ResourceBackedBashFs.js';
import { ShellPermissionService } from './ShellPermissionService.js';
import { createShellCommandManual, renderShellCommandManual } from './ShellCommandManual.js';
import { shellNetworkPolicyService } from './ShellNetworkPolicyService.js';
import { forgeWorkspacePath } from './ShellWorkspaceService.js';

export interface BashTerminalRuntimeOptions {
    session: ShellSessionRef;
    vfs: VirtualFileSystemService;
    permissions: ShellPermissionService;
    networkAllowList?: string[];
    network?: NetworkConfig;
    cwd?: string;
    extraMounts?: BashRuntimeMount[];
}

export interface BashRuntimeMount {
    path: string;
    fs: IFileSystem;
}

export interface ShellSessionState {
    cwd: string;
    env: Record<string, string>;
}

export const createUserTerminalSession = (): ShellSessionRef => ({
    shellSessionId: 'user-terminal',
    kind: 'user-terminal',
    ownerType: 'user',
    ownerId: 'local-user'
});

const escapeShell = (value: string): string => value.replace(/'/g, "'\\''");

const normalizeCwd = (session: ShellSessionRef, cwd?: string): string => {
    if (cwd) return cwd;
    if (session.kind === 'forge-agent' && session.projectId) return forgeWorkspacePath(session.projectId);
    if (session.kind === 'chat-agent' && session.conversationId) return `/workspaces/chat/${encodeURIComponent(session.conversationId)}`;
    return '/home/user';
};

const execResult = (stdout = '', stderr = '', exitCode = 0): ShellExecResult => ({
    stdout,
    stderr,
    exitCode
});

const SHELL_BUILTINS = [
    'alias',
    'break',
    'cd',
    'continue',
    'declare',
    'dirs',
    'eval',
    'exit',
    'export',
    'getopts',
    'hash',
    'help',
    'let',
    'local',
    'mapfile',
    'read',
    'return',
    'set',
    'shift',
    'shopt',
    'source',
    'unalias',
    'unset'
];

interface CompletionToken {
    value: string;
    start: number;
    end: number;
}

export class BashTerminalRuntime {
    readonly bash: Bash;
    private readonly state: ShellSessionState;

    constructor(private readonly options: BashTerminalRuntimeOptions) {
        const cwd = normalizeCwd(options.session, options.cwd);
        this.state = {
            cwd,
            env: this.createInitialEnv(cwd)
        };
        const base = new InMemoryFs();
        const fs = new MountableFs({ base });
        fs.mount('/sources', new ResourceBackedBashFs('/sources', options.vfs, options.permissions, options.session));
        fs.mount('/library', new ResourceBackedBashFs('/library', options.vfs, options.permissions, options.session));
        fs.mount('/workspaces', new WorkspaceBashFs(options.permissions, options.session));
        for (const mount of options.extraMounts ?? []) {
            fs.mount(mount.path, mount.fs);
        }

        this.bash = new Bash({
            fs,
            cwd,
            env: this.state.env,
            ...this.resolveNetworkOptions(),
            executionLimits: {
                maxCommandCount: 10000,
                maxLoopIterations: 10000,
                maxCallDepth: 100
            },
            customCommands: [
                this.createPermissionCommand(),
                this.createHelpCommand()
            ]
        });
    }

    getCwd(): string {
        return this.state.cwd;
    }

    getEnv(): Record<string, string> {
        return { ...this.state.env };
    }

    getSession(): ShellSessionRef {
        return { ...this.options.session };
    }

    async completeLine(input: string): Promise<VFSCompletionResult> {
        const { token, isCommandPosition } = this.getCompletionToken(input);
        if (isCommandPosition) {
            return this.completeCommand(token);
        }
        return this.completePath(token);
    }

    async exec(commandLine: string, stdin?: string): Promise<ShellExecResult> {
        try {
            const result = await this.bash.exec(commandLine, {
                cwd: this.state.cwd,
                env: this.state.env,
                stdin
            });
            this.applySessionState(result);
            return this.toShellExecResult(result);
        } catch (error) {
            return execResult('', `${error instanceof Error ? error.message : String(error)}\n`, 1);
        }
    }

    private toShellExecResult(result: BashExecResult): ShellExecResult {
        return {
            stdout: result.stdout,
            stderr: result.stderr,
            exitCode: result.exitCode
        };
    }

    private createInitialEnv(cwd: string): Record<string, string> {
        return {
            SHELL: '/bin/bash',
            TERM: 'xterm-256color',
            PWD: cwd,
            OLDPWD: cwd,
            LW_SHELL_SESSION_ID: this.options.session.shellSessionId,
            LW_SHELL_SESSION_KIND: this.options.session.kind,
            ...(this.options.session.projectId ? { LW_PROJECT_ID: this.options.session.projectId } : {}),
            ...(this.options.session.conversationId ? { LW_CONVERSATION_ID: this.options.session.conversationId } : {})
        };
    }

    private getCompletionToken(input: string): { token: CompletionToken; isCommandPosition: boolean } {
        const segmentStart = Math.max(input.lastIndexOf('|') + 1, input.lastIndexOf(';') + 1, 0);
        const segment = input.slice(segmentStart);
        const leadingWhitespace = segment.match(/^\s*/)?.[0].length ?? 0;
        const baseOffset = segmentStart + leadingWhitespace;
        const commandSegment = segment.slice(leadingWhitespace);
        const tokens = this.tokenizeCompletionSegment(commandSegment, baseOffset);
        const trailingWhitespace = /\s$/.test(commandSegment);
        if (tokens.length === 0) {
            return {
                token: { value: '', start: baseOffset, end: baseOffset },
                isCommandPosition: true
            };
        }
        if (tokens.length === 1 && !trailingWhitespace) {
            return {
                token: tokens[0],
                isCommandPosition: true
            };
        }
        if (trailingWhitespace) {
            return {
                token: { value: '', start: input.length, end: input.length },
                isCommandPosition: false
            };
        }
        return {
            token: tokens[tokens.length - 1],
            isCommandPosition: false
        };
    }

    private tokenizeCompletionSegment(segment: string, offset: number): CompletionToken[] {
        const tokens: CompletionToken[] = [];
        let quote: '"' | '\'' | null = null;
        let escaping = false;
        let tokenStart: number | null = null;
        let value = '';

        const pushToken = (end: number) => {
            if (tokenStart === null) return;
            tokens.push({
                value,
                start: offset + tokenStart,
                end: offset + end
            });
            tokenStart = null;
            value = '';
        };

        for (let index = 0; index < segment.length; index += 1) {
            const char = segment[index];
            if (escaping) {
                if (tokenStart === null) tokenStart = index - 1;
                value += char;
                escaping = false;
                continue;
            }
            if (char === '\\') {
                if (tokenStart === null) tokenStart = index;
                escaping = true;
                continue;
            }
            if (quote) {
                if (char === quote) {
                    quote = null;
                } else {
                    value += char;
                }
                continue;
            }
            if (char === '"' || char === '\'') {
                if (tokenStart === null) tokenStart = index;
                quote = char;
                continue;
            }
            if (/\s/.test(char)) {
                pushToken(index);
                continue;
            }
            if (tokenStart === null) tokenStart = index;
            value += char;
        }

        pushToken(segment.length);
        return tokens;
    }

    private completeCommand(token: CompletionToken): VFSCompletionResult {
        const names = new Set([
            ...getCommandNames(),
            ...SHELL_BUILTINS,
            'lw-permission',
            'lw-help',
            ...(this.resolveNetworkOptions().network || this.resolveNetworkOptions().fetch ? ['curl'] : [])
        ]);
        const candidates = Array.from(names)
            .filter(name => name.startsWith(token.value))
            .sort((left, right) => left.localeCompare(right))
            .map(name => ({
                value: name,
                display: name,
                type: 'command' as const
            }));
        return this.completionFromCandidates(token.value, token.start, token.end, candidates, true);
    }

    private async completePath(token: CompletionToken): Promise<VFSCompletionResult> {
        const scope = this.pathCompletionScope(token.value);
        if (scope.absoluteParent === '/sources'
            || scope.absoluteParent.startsWith('/sources/')
            || scope.absoluteParent === '/library'
            || scope.absoluteParent.startsWith('/library/')) {
            return this.completeResourcePath(token, scope);
        }

        let names: string[];
        try {
            names = await this.bash.fs.readdir(scope.absoluteParent);
        } catch {
            return this.emptyCompletion(token.start, token.end);
        }

        const candidates: VFSCompletionCandidate[] = [];
        for (const name of names) {
            if (!name.startsWith(scope.prefix)) continue;
            const absolutePath = this.joinPath(scope.absoluteParent, name);
            const isDirectory = await this.bash.fs.stat(absolutePath)
                .then(stat => stat.isDirectory)
                .catch(() => false);
            const value = `${scope.visibleParent}${name}${isDirectory ? '/' : ''}`;
            candidates.push({
                value,
                display: value,
                type: 'path',
                isDirectory
            });
        }

        candidates.sort((left, right) => left.display.localeCompare(right.display));
        return this.completionFromCandidates(token.value, token.start, token.end, candidates, false);
    }

    private async completeResourcePath(
        token: CompletionToken,
        scope: { absoluteParent: string; visibleParent: string; prefix: string }
    ): Promise<VFSCompletionResult> {
        let entries;
        try {
            entries = await this.options.vfs.listDir(scope.absoluteParent);
        } catch {
            return this.emptyCompletion(token.start, token.end);
        }

        const candidates = entries
            .map(entry => {
                const absoluteValue = entry.type === 'directory'
                    ? `${this.decodePath(entry.path)}/`
                    : scope.absoluteParent.startsWith('/library/') && entry.ref
                        ? `${scope.absoluteParent}/${entry.ref.resourceId}`
                        : this.decodePath(entry.path);
                const value = token.value.startsWith('/')
                    ? absoluteValue
                    : absoluteValue.startsWith(this.state.cwd)
                        ? absoluteValue.slice(this.state.cwd.length).replace(/^\//, '')
                        : absoluteValue;
                return {
                    value: entry.type === 'file' ? value : value.replace(/\/?$/, '/'),
                    display: entry.type === 'file' ? value : value.replace(/\/?$/, '/'),
                    type: 'path' as const,
                    isDirectory: entry.type === 'directory'
                };
            })
            .filter(candidate => candidate.value.startsWith(token.value) || this.lastPathSegment(candidate.value).startsWith(scope.prefix))
            .sort((left, right) => left.display.localeCompare(right.display));

        return this.completionFromCandidates(token.value, token.start, token.end, candidates, false);
    }

    private pathCompletionScope(fragment: string): { absoluteParent: string; visibleParent: string; prefix: string } {
        const normalized = fragment.replace(/\\/g, '/');
        const slashIndex = normalized.lastIndexOf('/');
        const rawParent = slashIndex >= 0 ? normalized.slice(0, slashIndex + 1) : '';
        const prefix = slashIndex >= 0 ? normalized.slice(slashIndex + 1) : normalized;
        const visibleParent = rawParent;
        const absoluteParent = rawParent.startsWith('/')
            ? this.normalizePath(rawParent || '/')
            : this.normalizePath(`${this.state.cwd}/${rawParent}`);
        return {
            absoluteParent,
            visibleParent,
            prefix
        };
    }

    private completionFromCandidates(
        fragment: string,
        start: number,
        end: number,
        candidates: VFSCompletionCandidate[],
        appendSpaceForSingle: boolean
    ): VFSCompletionResult {
        if (candidates.length === 0) {
            return this.emptyCompletion(start, end);
        }

        const values = candidates.map(candidate => candidate.value);
        const commonPrefix = this.commonPrefix(values);
        const single = candidates.length === 1 ? candidates[0] : null;
        const replacement = single
            ? `${single.value}${appendSpaceForSingle || single.type === 'path' && !single.isDirectory ? ' ' : ''}`
            : commonPrefix.length > fragment.length ? commonPrefix : fragment;

        return {
            replacement,
            replacementStart: start,
            replacementEnd: end,
            candidates,
            completed: replacement !== fragment
        };
    }

    private commonPrefix(values: string[]): string {
        if (values.length === 0) return '';
        let prefix = values[0];
        for (const value of values.slice(1)) {
            while (!value.startsWith(prefix) && prefix.length > 0) {
                prefix = prefix.slice(0, -1);
            }
        }
        return prefix;
    }

    private emptyCompletion(start: number, end = start): VFSCompletionResult {
        return {
            replacement: '',
            replacementStart: start,
            replacementEnd: end,
            candidates: [],
            completed: false
        };
    }

    private joinPath(parent: string, child: string): string {
        return this.normalizePath(`${parent}/${child}`);
    }

    private lastPathSegment(path: string): string {
        const trimmed = path.endsWith('/') && path.length > 1 ? path.slice(0, -1) : path;
        return trimmed.slice(trimmed.lastIndexOf('/') + 1);
    }

    private decodePath(path: string): string {
        return path.split('/').map(segment => {
            try {
                return decodeURIComponent(segment);
            } catch {
                return segment;
            }
        }).join('/');
    }

    private normalizePath(path: string): string {
        const normalized = `/${path || ''}`.replace(/\\/g, '/').replace(/\/+/g, '/');
        return normalized.length > 1 ? normalized.replace(/\/$/, '') : normalized;
    }

    private applySessionState(result: BashExecResult): void {
        this.state.env = { ...result.env };
        this.state.cwd = result.env.PWD || this.state.cwd;
    }

    private resolveNetworkOptions(): Pick<BashOptions, 'fetch' | 'network'> {
        const network = shellNetworkPolicyService.createNetworkConfig(this.options);
        if (!network) return {};
        if (this.options.session.kind === 'user-terminal') {
            return { network };
        }
        return { fetch: shellNetworkPolicyService.createPermissionedFetch(this.options.permissions, this.options.session, network) };
    }

    private createPermissionCommand(): Command {
        return defineCommand('lw-permission', async (args) => {
            const action = args[0] ?? 'status';
            if (action === 'status' || action === 'list') {
                const grants = this.options.permissions.listGrants(this.options.session);
                const requests = this.options.permissions.listRequests()
                    .filter(request => request.session.shellSessionId === this.options.session.shellSessionId);
                return {
                    stdout: JSON.stringify({ session: this.options.session, grants, requests }, null, 2) + '\n',
                    stderr: '',
                    exitCode: 0
                };
            }

            if (action === 'request') {
                const operation = args[1] as 'read' | 'write' | 'import' | 'export' | 'network' | undefined;
                const target = args[2];
                if (!operation || !target) {
                    return {
                        stdout: '',
                        stderr: 'Usage: lw-permission request <read|write|import|export|network> <path-or-url> --reason "..."\n',
                        exitCode: 2
                    };
                }
                if (operation === 'write' && target === '*') {
                    return {
                        stdout: '',
                        stderr: 'Agent sessions cannot request global write permission.\n',
                        exitCode: 2
                    };
                }
                if (operation === 'network') {
                    const network = shellNetworkPolicyService.createNetworkConfig(this.options);
                    const decision = shellNetworkPolicyService.checkAllowList(network, target);
                    if (!decision.allowed) {
                        return {
                            stdout: '',
                            stderr: `${decision.reason}\n`,
                            exitCode: 2
                        };
                    }
                }
                const reason = this.readOption(args, '--reason') ?? 'Requested from shell';
                const request = this.options.permissions.requestPermission({
                    session: this.options.session,
                    operation,
                    scope: operation === 'network' ? { urlPrefix: target } : { pathPrefix: target },
                    reason,
                    expiresAt: null
                });
                return {
                    stdout: `permission request pending: ${request.requestId}\n`,
                    stderr: '',
                    exitCode: 0
                };
            }

            if (action === 'revoke') {
                const grantId = args[1];
                if (!grantId) {
                    return { stdout: '', stderr: 'Usage: lw-permission revoke <grantId>\n', exitCode: 2 };
                }
                const grant = this.options.permissions.revokeGrant(grantId, this.options.session);
                return {
                    stdout: `permission grant revoked: ${grant.grantId}\n`,
                    stderr: '',
                    exitCode: 0
                };
            }

            return {
                stdout: '',
                stderr: `Unsupported lw-permission action: ${escapeShell(action)}\n`,
                exitCode: 2
            };
        });
    }

    private createHelpCommand(): Command {
        return defineCommand('lw-help', async () => ({
            stdout: `${renderShellCommandManual(createShellCommandManual({
                session: this.options.session,
                cwd: this.state.cwd,
                networkEnabled: shellNetworkPolicyService.isConfigured(shellNetworkPolicyService.createNetworkConfig(this.options))
            }))}\n`,
            stderr: '',
            exitCode: 0
        }));
    }

    private readOption(args: string[], name: string): string | null {
        const index = args.indexOf(name);
        return index >= 0 ? args[index + 1] ?? null : null;
    }
}
