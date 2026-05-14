import type { ShellExecResult, ShellSessionRef } from '@shared/resources/index.js';
import {
    BashTerminalRuntime,
    shellPermissionService,
    type ShellPermissionService,
    virtualFileSystemService,
    type VirtualFileSystemService
} from '../hal/shell/index.js';
import { forgeWorkspacePath } from '../hal/shell/ShellWorkspaceService.js';

export type ForgeShellAccessMode =
    | 'project-readonly'
    | 'project-write-request'
    | 'sandbox-write'
    | 'network-request';

export interface ForgeWorkspaceSearchShellInput {
    forgeProjectId: string;
    conversationId: string;
    command: string;
    reason: string;
    maxOutputBytes?: number;
}

export interface ForgeWorkspaceSearchShellResult {
    ok: boolean;
    command: string;
    cwd: string;
    mode: ForgeShellAccessMode;
    result: ShellExecResult;
    truncated: boolean;
    overflowResourceUri?: string;
    diagnostics: string[];
    trace: {
        shellSessionId: string;
        forgeProjectId: string;
        conversationId: string;
        reason: string;
        deniedReason?: string;
    };
}

const READ_ONLY_COMMANDS = new Set([
    'cat',
    'echo',
    'find',
    'grep',
    'jq',
    'ls',
    'pwd',
    'tree',
    'wc',
    'head',
    'tail'
]);

const WRITE_COMMANDS = new Set([
    'chmod',
    'cp',
    'curl',
    'eval',
    'export',
    'ln',
    'lw-permission',
    'mkdir',
    'mv',
    'rm',
    'source',
    'tee',
    'touch',
    'unset'
]);

const normalizePath = (path: string): string =>
    `/${path || ''}`.replace(/\\/g, '/').replace(/\/+/g, '/').replace(/\/$/, '') || '/';

const firstCommandWord = (segment: string): string | null => {
    const match = segment.trim().match(/^([A-Za-z0-9_.-]+)/);
    return match?.[1] ?? null;
};

const splitCommandSegments = (command: string): string[] =>
    command
        .split(/\|\||&&|[|;]/)
        .map(segment => segment.trim())
        .filter(Boolean);

const hasUnquotedRedirection = (command: string): boolean => {
    let quote: '"' | '\'' | null = null;
    let escaping = false;
    for (const char of command) {
        if (escaping) {
            escaping = false;
            continue;
        }
        if (char === '\\') {
            escaping = true;
            continue;
        }
        if (quote) {
            if (char === quote) quote = null;
            continue;
        }
        if (char === '"' || char === '\'') {
            quote = char;
            continue;
        }
        if (char === '>' || char === '<') return true;
    }
    return false;
};

const absoluteWorkspacePaths = (command: string): string[] =>
    Array.from(command.matchAll(/\/workspaces\/[^\s'"`|;&<>]+/g)).map(match => normalizePath(match[0]));

const truncate = (value: string, maxLength: number): { value: string; truncated: boolean } => {
    if (value.length <= maxLength) return { value, truncated: false };
    return {
        value: `${value.slice(0, maxLength)}\n\n[output truncated: ${value.length - maxLength} characters removed]`,
        truncated: true
    };
};

export class ForgeWorkspaceSearchShell {
    constructor(
        private readonly vfs: VirtualFileSystemService = virtualFileSystemService,
        private readonly permissions: ShellPermissionService = shellPermissionService
    ) {}

    async execute(input: ForgeWorkspaceSearchShellInput): Promise<ForgeWorkspaceSearchShellResult> {
        const cwd = forgeWorkspacePath(input.forgeProjectId);
        const session = this.createSession(input);
        const deniedReason = this.validateReadOnlyCommand(input.command, cwd);
        if (deniedReason) {
            return this.denied(input, session, cwd, deniedReason);
        }

        const runtime = new BashTerminalRuntime({
            session,
            vfs: this.vfs,
            permissions: this.permissions,
            cwd
        });
        const raw = await runtime.exec(input.command);
        const maxOutputBytes = input.maxOutputBytes ?? 8000;
        const stdout = truncate(raw.stdout, maxOutputBytes);
        const stderr = truncate(raw.stderr, maxOutputBytes);
        const truncated = stdout.truncated || stderr.truncated;
        const result: ShellExecResult = {
            ...raw,
            stdout: stdout.value,
            stderr: stderr.value
        };

        return {
            ok: raw.exitCode === 0,
            command: input.command,
            cwd,
            mode: 'project-readonly',
            result,
            truncated,
            overflowResourceUri: truncated
                ? `trace://forge/${encodeURIComponent(input.forgeProjectId)}/shell-output/${encodeURIComponent(session.shellSessionId)}`
                : undefined,
            diagnostics: truncated ? ['shell output truncated; full output should be kept in request trace'] : [],
            trace: {
                shellSessionId: session.shellSessionId,
                forgeProjectId: input.forgeProjectId,
                conversationId: input.conversationId,
                reason: input.reason
            }
        };
    }

    private validateReadOnlyCommand(command: string, cwd: string): string | null {
        const trimmed = command.trim();
        if (!trimmed) return 'empty shell command';
        if (trimmed.includes('$(') || trimmed.includes('`')) {
            return 'command substitution is blocked in project-readonly shell';
        }
        if (hasUnquotedRedirection(trimmed)) {
            return 'redirection is blocked in project-readonly shell; use forge.effect.apply for project writes';
        }

        for (const path of absoluteWorkspacePaths(trimmed)) {
            if (path !== cwd && !path.startsWith(`${cwd}/`)) {
                return `path outside current Forge project is blocked: ${path}`;
            }
        }

        for (const segment of splitCommandSegments(trimmed)) {
            const word = firstCommandWord(segment);
            if (!word) continue;
            if (WRITE_COMMANDS.has(word)) {
                return `${word} is blocked in project-readonly shell; use typed effects or request a narrower grant`;
            }
            if (!READ_ONLY_COMMANDS.has(word)) {
                return `${word} is not available in project-readonly shell`;
            }
        }

        return null;
    }

    private denied(
        input: ForgeWorkspaceSearchShellInput,
        session: ShellSessionRef,
        cwd: string,
        deniedReason: string
    ): ForgeWorkspaceSearchShellResult {
        return {
            ok: false,
            command: input.command,
            cwd,
            mode: 'project-readonly',
            result: {
                stdout: '',
                stderr: `${deniedReason}\n`,
                exitCode: 1
            },
            truncated: false,
            diagnostics: [deniedReason],
            trace: {
                shellSessionId: session.shellSessionId,
                forgeProjectId: input.forgeProjectId,
                conversationId: input.conversationId,
                reason: input.reason,
                deniedReason
            }
        };
    }

    private createSession(input: ForgeWorkspaceSearchShellInput): ShellSessionRef {
        return {
            shellSessionId: `forge-agent-${input.forgeProjectId}-${input.conversationId}`,
            kind: 'forge-agent',
            ownerType: 'forge',
            ownerId: input.forgeProjectId,
            projectId: input.forgeProjectId,
            conversationId: input.conversationId
        };
    }
}

export const forgeWorkspaceSearchShell = new ForgeWorkspaceSearchShell();
