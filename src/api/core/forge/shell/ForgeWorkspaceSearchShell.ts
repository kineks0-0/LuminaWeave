import type { ShellExecResult, ShellSessionRef } from '@shared/resources/index.js';
import { createGit } from 'just-git';
import type { ForgeRuntimeContext } from '../../../../types/ForgeRuntimeTypes.js';
import { BashTerminalRuntime } from '../../hal/shell/BashTerminalRuntime.js';
import {
    shellPermissionService,
    type ShellPermissionService
} from '../../hal/shell/ShellPermissionService.js';
import {
    virtualFileSystemService,
    type VirtualFileSystemService
} from '../../hal/resource/index.js';
import { forgeWorkspacePath } from '../../hal/shell/ShellWorkspaceService.js';
import {
    forgeThreadWorkspacePath,
    shellWorkspaceService
} from '../../hal/shell/ShellWorkspaceService.js';
import {
    buildForgeStableThreadLabel,
    forgeSemanticVfsMapper,
    type ForgeSemanticThreadEntry
} from '../agent-app/vfs/ForgeSemanticVfsMapper.js';
import { ForgeSemanticBashFs } from '../agent-app/vfs/ForgeSemanticVfsProvider.js';
import { cleanPath as normalizePath } from '@shared/resources/vfsPath.js';

export type ForgeShellAccessMode =
    | 'project-readonly'
    | 'project-write-request'
    | 'sandbox-write'
    | 'network-request';

export interface ForgeShellWriteLogEntry {
    command: string;
    path: string;
    contentBefore: string;
    contentAfter: string;
}

export interface ForgeWorkspaceSearchShellInput {
    forgeProjectId: string;
    conversationId: string;
    command: string;
    reason: string;
    accessMode?: ForgeShellAccessMode;
    maxOutputBytes?: number;
    runtimeContext?: ForgeRuntimeContext;
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
    writeLog: ForgeShellWriteLogEntry[];
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

const NETWORK_ALLOWED_COMMANDS = new Set([
    ...READ_ONLY_COMMANDS,
    'curl',
    'lw-permission'
]);

const WRITE_ALLOWED_COMMANDS = new Set([
    'cp',
    'git',
    'mkdir',
    'mv',
    'rm',
    'tee',
    'touch',
    'echo'
]);

const DANGEROUS_COMMANDS = new Set([
    'chmod',
    'eval',
    'export',
    'ln',
    'source',
    'unset'
]);

const WRITE_COMMANDS = new Set([
    ...WRITE_ALLOWED_COMMANDS,
    ...DANGEROUS_COMMANDS
]);

const firstCommandWord = (segment: string): string | null => {
    const match = segment.trim().match(/^([A-Za-z0-9_.-]+)/);
    return match?.[1] ?? null;
};

const splitCommandSegments = (command: string): string[] =>
    command
        .split(/\|\||&&|[|;]/)
        .map(segment => segment.trim())
        .filter(Boolean);

const isFileDescriptorDuplication = (command: string, index: number): boolean => {
    if (command[index + 1] !== '&') return false;
    return /\d/.test(command[index + 2] ?? '');
};

const hasUnquotedFileRedirection = (command: string): boolean => {
    let quote: '"' | '\'' | null = null;
    let escaping = false;
    for (let index = 0; index < command.length; index += 1) {
        const char = command[index];
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
        if (char === '>' || char === '<') {
            if (isFileDescriptorDuplication(command, index)) {
                index += 2;
                continue;
            }
            return true;
        }
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

const FORGE_SEMANTIC_SHELL_ROOT = '/forge-semantic';

const createFallbackRuntimeContext = (input: ForgeWorkspaceSearchShellInput): ForgeRuntimeContext => ({
    workspaceSessionId: input.forgeProjectId,
    sessionChatId: input.conversationId,
    workspaceTitle: 'Forge Project',
    selectedPresetId: 'forge-agent',
    selectedChatSessionId: null,
    selectedChatSnapshotId: null,
    detailMode: 'quick',
    collectionMode: 'conversation',
    entryMode: null,
    activeLayer: 'concept',
    completedLayers: [],
    workflowSnapshot: null,
    publishState: 'drafting',
    activeLeafId: null,
    worldlineNodes: [],
    messages: [],
    timelineItems: [],
    structuredState: {
        activeFormId: null,
        forms: {},
        activeMessageFormId: null,
        submitConfigs: {},
        submittedScopes: {},
        lastUpdatedAt: Date.now()
    },
    draftTree: { nodes: [], lastUpdatedAt: Date.now() },
    forgeMemoryTree: { entries: [], lastUpdatedAt: Date.now() },
    stagingEntries: [],
    commitReadyEntries: [],
    virtualLorebookEntries: [],
    latestUserInput: '',
    latestUserCommand: { type: 'noop' }
});

export class ForgeWorkspaceSearchShell {
    constructor(
        private readonly vfs: VirtualFileSystemService = virtualFileSystemService,
        private readonly permissions: ShellPermissionService = shellPermissionService
    ) {}

    async execute(input: ForgeWorkspaceSearchShellInput): Promise<ForgeWorkspaceSearchShellResult> {
        const workspaceCwd = forgeWorkspacePath(input.forgeProjectId);
        const cwd = FORGE_SEMANTIC_SHELL_ROOT;
        const mode = input.accessMode ?? 'project-readonly';
        const session = this.createSession(input);
        const stableThreads = await this.listStableThreads(input.forgeProjectId, input.conversationId);
        const command = input.command;
        const deniedReason = this.validateCommand(command, workspaceCwd, mode);
        if (deniedReason) {
            return this.denied(input, session, './', mode, deniedReason);
        }

        const writeLog: ForgeShellWriteLogEntry[] = [];
        const semanticFs = new ForgeSemanticBashFs({
            context: input.runtimeContext ?? createFallbackRuntimeContext(input),
            command: input.command,
            onWrite: entry => writeLog.push(entry)
        });

        const runtime = new BashTerminalRuntime({
            session,
            vfs: this.vfs,
            permissions: this.permissions,
            network: mode === 'network-request' ? { dangerouslyAllowFullInternetAccess: true } : undefined,
            cwd,
            extraMounts: [{
                path: FORGE_SEMANTIC_SHELL_ROOT,
                fs: semanticFs
            }],
            customCommands: [
                createGit({
                    identity: {
                        name: 'LuminaWeave Forge',
                        email: 'forge@luminaweave.local'
                    },
                    network: false
                })
            ]
        });
        const raw = await runtime.exec(command);
        const maxOutputBytes = input.maxOutputBytes ?? 8000;
        const stdout = truncate(raw.stdout, maxOutputBytes);
        const stderr = truncate(raw.stderr, maxOutputBytes);
        const truncated = stdout.truncated || stderr.truncated;

        const result: ShellExecResult = {
            ...raw,
            stdout: this.toAgentDisplayText(forgeSemanticVfsMapper.rewriteTextToAgentDisplay({
                text: stdout.value,
                forgeProjectId: input.forgeProjectId,
                conversationId: input.conversationId,
                stableThreads
            })),
            stderr: this.toAgentDisplayText(forgeSemanticVfsMapper.rewriteTextToAgentDisplay({
                text: stderr.value,
                forgeProjectId: input.forgeProjectId,
                conversationId: input.conversationId,
                stableThreads
            }))
        };

        return {
            ok: raw.exitCode === 0,
            command: input.command,
            cwd: './',
            mode,
            result,
            truncated,
            overflowResourceUri: truncated
                ? `trace://forge/${encodeURIComponent(input.forgeProjectId)}/shell-output/${encodeURIComponent(session.shellSessionId)}`
                : undefined,
            diagnostics: truncated ? ['shell output truncated; full output should be kept in request trace'] : [],
            writeLog,
            trace: {
                shellSessionId: session.shellSessionId,
                forgeProjectId: input.forgeProjectId,
                conversationId: input.conversationId,
                reason: input.reason
            }
        };
    }

    private toAgentDisplayText(text: string): string {
        return text
            .split(FORGE_SEMANTIC_SHELL_ROOT).join('.')
            .replace(/(^|[\s"'(])\.\//g, '$1./')
            .replace(/(^|[\s"'(])\.(?=\s|$)/g, '$1.');
    }

    private validateCommand(command: string, cwd: string, mode: ForgeShellAccessMode): string | null {
        const trimmed = command.trim();
        if (!trimmed) return 'empty shell command';
        if (trimmed.includes('$(') || trimmed.includes('`')) {
            return `command substitution is blocked in ${mode} shell`;
        }

        const hasRedirect = hasUnquotedFileRedirection(trimmed);
        if (mode === 'project-readonly' && hasRedirect) {
            return 'redirection is blocked in project-readonly shell; use project-write-request mode for writes';
        }
        if (mode === 'network-request' && hasRedirect) {
            return 'redirection is blocked in network-request shell; use project-write-request mode for writes';
        }

        for (const path of absoluteWorkspacePaths(trimmed)) {
            if (path !== cwd && !path.startsWith(`${cwd}/`)) {
                return `path outside current Forge project is blocked: ${path}`;
            }
        }

        for (const segment of splitCommandSegments(trimmed)) {
            const word = firstCommandWord(segment);
            if (!word) continue;
            if (DANGEROUS_COMMANDS.has(word)) {
                return `${word} is blocked in all Forge shell modes (security restriction)`;
            }
            if (mode === 'project-readonly') {
                if (WRITE_ALLOWED_COMMANDS.has(word)) {
                    return `${word} is blocked in project-readonly shell; switch to project-write-request mode for writes`;
                }
                if (!READ_ONLY_COMMANDS.has(word)) {
                    return `${word} is not available in project-readonly shell`;
                }
            }
            if (mode === 'network-request') {
                if (!NETWORK_ALLOWED_COMMANDS.has(word)) {
                    return `${word} is not available in network-request shell`;
                }
            }
            // project-write-request: allow READ_ONLY + WRITE_ALLOWED, block everything else
            if (mode === 'project-write-request') {
                if (!READ_ONLY_COMMANDS.has(word) && !WRITE_ALLOWED_COMMANDS.has(word)) {
                    return `${word} is not available in project-write-request shell`;
                }
            }
        }

        return null;
    }

    private denied(
        input: ForgeWorkspaceSearchShellInput,
        session: ShellSessionRef,
        cwd: string,
        mode: ForgeShellAccessMode,
        deniedReason: string
    ): ForgeWorkspaceSearchShellResult {
        return {
            ok: false,
            command: input.command,
            cwd,
            mode,
            result: {
                stdout: '',
                stderr: `${deniedReason}\n`,
                exitCode: 1
            },
            truncated: false,
            diagnostics: [deniedReason],
            writeLog: [],
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

    private async listStableThreads(forgeProjectId: string, conversationId: string): Promise<ForgeSemanticThreadEntry[]> {
        const bindings = await shellWorkspaceService.listForgeBindings()
            .then(items => items.filter(item => item.forgeProjectId === forgeProjectId))
            .catch(() => []);
        const fs = await shellWorkspaceService.getFileSystem({ projectId: forgeProjectId, conversationId });
        return Promise.all(bindings
            .sort((left, right) => left.createdAt - right.createdAt || left.conversationId.localeCompare(right.conversationId))
            .map(async (binding, index): Promise<ForgeSemanticThreadEntry> => {
                const threadPath = forgeThreadWorkspacePath(forgeProjectId, binding.conversationId)
                    .replace(/^\/workspaces(?=\/|$)/, '') || '/';
                const title = await fs.readFile(`${threadPath}/thread.json`)
                    .then(content => {
                        const parsed = JSON.parse(content) as { title?: unknown };
                        return typeof parsed.title === 'string' ? parsed.title : '协作线程';
                    })
                    .catch(() => '协作线程');
                return {
                    label: buildForgeStableThreadLabel(index, title),
                    conversationId: binding.conversationId
                };
            }));
    }
}

export const forgeWorkspaceSearchShell = new ForgeWorkspaceSearchShell();
