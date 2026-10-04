import {
    Type,
    type Static,
    type ToolResultMessage
} from '@earendil-works/pi-ai';
import type { AgentTool, AgentToolResult } from '@earendil-works/pi-agent-core';
import type { TSchema } from 'typebox';
import type {
    ShellPermissionGrant,
    ShellSessionRef
} from '@shared/resources/index.js';
import type { VirtualFileSystemService } from '../../../hal/resource/VirtualFileSystemService.js';
import { virtualFileSystemService } from '../../../hal/resource/index.js';
import {
    shellNetworkPolicyService,
    type ShellNetworkPolicyService
} from '../../../hal/shell/ShellNetworkPolicyService.js';
import {
    shellPermissionService,
    type ShellPermissionService
} from '../../../hal/shell/ShellPermissionService.js';
import {
    forgeThreadWorkspacePath,
    forgeWorkspacePath,
    shellWorkspaceService,
    type ShellWorkspaceService
} from '../../../hal/shell/ShellWorkspaceService.js';
import { settingsDomainService } from '../../../../services/SettingsDomainService.js';
import {
    forgeWorkspaceSearchShell,
    type ForgeShellAccessMode,
    type ForgeWorkspaceSearchShell
} from '../../shell/ForgeWorkspaceSearchShell.js';
import {
    forgeCapabilityRegistry,
    type ForgeCapabilityRegistry
} from '../../skills/ForgeCapabilityRegistry.js';
import {
    forgeSkillRegistry,
    type ForgeSkillRegistry
} from '../../skills/ForgeSkillRegistry.js';
import type {
    ForgeRuntimeContext,
    ForgeRuntimeEffect,
    ForgeRuntimeEvent,
    ForgeRuntimeEventSource,
    ForgeToolApprovalGrantMode,
    ForgeToolApprovalResolutionOptions
} from '../../../../../types/ForgeRuntimeTypes.js';
import {
    buildForgeStableThreadLabel,
    forgeSemanticVfsMapper,
    type ForgeSemanticPathResolution,
    type ForgeSemanticThreadEntry,
    type ForgeSemanticVfsMapper
} from '../vfs/ForgeSemanticVfsMapper.js';
import {
    ForgeSemanticVfsProvider,
    forgeSemanticVfsProvider,
    type ForgeSemanticVfsReader
} from '../vfs/ForgeSemanticVfsProvider.js';
import {
    listForgePresetSkillResources
} from '../../project/ForgeProjectSemanticVfsService.js';
import type {
    ForgeTurnWorkspaceWriteSummary
} from '@shared/ForgePiTypes.js';
import {
    ForgeWorkspaceWriteService,
    forgeWorkspaceWriteService
} from '../../project/ForgeWorkspaceWriteService.js';
import { AgentToolRegistry, type AgentRuntimeTool } from '../../../agent-runtime/tools/AgentToolRegistry.js';
import { toJsonValue } from '../../../agent-runtime/runtime/AgentJsonValue.js';
import {
    TavilyResearchProvider,
    createWebResearchTool,
    type AgentResearchProvider
} from '../../../agent-runtime/research/index.js';

export interface ForgePiToolContext {
    forgeProjectId: string;
    conversationId: string;
    cwd: string;
    runtimeContext: ForgeRuntimeContext;
}

export interface ForgePiToolCallInput {
    requestId: string;
    toolCallId: string;
    toolName: string;
    args: unknown;
    context: ForgeRuntimeContext;
    source: ForgeRuntimeEventSource;
    approvalKind?: 'network' | 'tool';
    displaySurface?: 'composer' | 'review';
    shellPermissionRequestId?: string | null;
    forgeProjectId?: string | null;
    conversationId?: string | null;
    sessionId?: string | null;
}

export interface ForgePiToolApprovalResolution {
    resolved: boolean;
    events: ForgeRuntimeEvent[];
    effects: ForgeRuntimeEffect[];
    toolResultMessage?: ToolResultMessage;
}

export interface ForgePendingToolApproval {
    approvalKind: 'network' | 'tool';
    displaySurface: 'composer' | 'review';
    toolCallId: string;
    toolName: string;
    args: unknown;
    shellPermissionRequestId?: string | null;
    reason: string;
    url?: string;
    urlPrefix?: string;
    method?: string;
    command?: string;
    localFileIo?: boolean;
}

export type ForgePiAgentTool<TParameters extends TSchema = TSchema> = AgentTool<TParameters> & {
    needsApproval?: boolean | ((args: Static<TParameters>) => boolean | Promise<boolean>);
};

export interface ForgePiToolBridgeDeps {
    vfs?: VirtualFileSystemService;
    shell?: ForgeWorkspaceSearchShell;
    capabilities?: Pick<ForgeCapabilityRegistry, 'search' | 'load' | 'listCapabilities'>;
    skills?: Pick<ForgeSkillRegistry, 'listProjectSkills' | 'listBuiltInSkills' | 'loadSkill'>;
    semanticVfs?: ForgeSemanticVfsMapper;
    projectVfs?: ForgeSemanticVfsReader;
    workspaces?: ShellWorkspaceService;
    workspaceWriter?: ForgeWorkspaceWriteService;
    research?: AgentResearchProvider;
    permissions?: ShellPermissionService;
    networkPolicy?: ShellNetworkPolicyService;
    getTavilyApiKey?: () => string | null | undefined;
    onEffects?: (effects: ForgeRuntimeEffect[]) => void;
}

interface PendingPiToolApproval {
    input: ForgePiToolCallInput;
    shellPermissionRequestId?: string | null;
}

interface ForgeBashNetworkApprovalRequirement {
    url: string;
    urlPrefix: string;
    method: string;
    command: string;
    localFileIo: boolean;
}

interface ForgeDirectWorkspaceChangeInput {
    toolCallId: string;
    path: string;
    contentAfter: string | null;
    command: string;
    ctx: ForgePiToolContext;
    emitEffects?: (effects: ForgeRuntimeEffect[]) => void;
}

interface ForgeDirectWorkspaceChangeResult {
    path: string;
    workspacePath?: string;
    applied: boolean;
    workspaceWriteSummary?: ForgeTurnWorkspaceWriteSummary;
    error?: string;
    command?: string;
}

type ForgeWritableProjectFileResult = {
    ok: true;
    path: string;
    workspacePath: string;
    content: string;
} | {
    ok: false;
    path: string;
    error: string;
}

const textResult = <TDetails>(text: string, details: TDetails): AgentToolResult<TDetails> => ({
    content: [{ type: 'text', text }],
    details
});

export class ForgePiToolBridge {
    private readonly pendingApprovals = new Map<string, PendingPiToolApproval>();
    private readonly legacyToolNameAliases = new Map<string, string>([
        ['readFile', 'read'],
        ['writeFile', 'write'],
        ['editFile', 'edit'],
        ['deleteFile', 'delete']
    ]);

    constructor(private readonly deps: ForgePiToolBridgeDeps = {}) {}

    getTools(context: ForgeRuntimeContext, onEffects?: (effects: ForgeRuntimeEffect[]) => void): ForgePiAgentTool[] {
        const ctx: ForgePiToolContext = {
            forgeProjectId: context.workspaceSessionId,
            conversationId: context.sessionChatId,
            cwd: forgeWorkspacePath(context.workspaceSessionId),
            runtimeContext: context
        };
        const emitEffects = (effects: ForgeRuntimeEffect[]) => {
            if (effects.length === 0) return;
            onEffects?.(effects);
            this.deps.onEffects?.(effects);
        };

        const tools: ForgePiAgentTool[] = [
            this.createCapabilitySearchTool(ctx),
            this.createCapabilityLoadTool(ctx),
            this.createSkillListTool(ctx),
            this.createSkillLoadTool(ctx),
            this.createBashTool(ctx, emitEffects),
            this.createReadTool(ctx),
            this.createWriteTool(ctx, emitEffects),
            this.createEditTool(ctx, emitEffects),
            this.createDeleteTool(ctx, emitEffects)
        ];
        const researchTool = this.createResearchTool();
        if (researchTool) {
            tools.splice(4, 0, researchTool);
        }
        return tools;
    }

    createToolRegistry(context: ForgeRuntimeContext, onEffects?: (effects: ForgeRuntimeEffect[]) => void): AgentToolRegistry {
        const registry = new AgentToolRegistry();
        for (const tool of this.getTools(context, onEffects)) {
            registry.register(tool as unknown as AgentRuntimeTool);
        }
        return registry;
    }

    getToolSummary(context: ForgeRuntimeContext): Array<{ name: string; description: string; needsApproval: boolean | 'dynamic' }> {
        return this.getTools(context).map(tool => ({
            name: tool.name,
            description: tool.description,
            needsApproval: typeof tool.needsApproval === 'function' ? 'dynamic' : Boolean(tool.needsApproval)
        }));
    }

    async needsApproval(toolName: string, args: unknown, context: ForgeRuntimeContext): Promise<boolean> {
        const tool = this.findExecutableTool(context, toolName);
        if (!tool) return false;
        if (typeof tool.needsApproval === 'function') {
            return Boolean(await tool.needsApproval(args as never));
        }
        return Boolean(tool.needsApproval);
    }

    registerPendingApproval(input: ForgePiToolCallInput): void {
        const normalizedInput: ForgePiToolCallInput = {
            ...input,
            forgeProjectId: input.forgeProjectId ?? input.context.workspaceSessionId,
            conversationId: input.conversationId ?? input.context.sessionChatId,
            sessionId: input.sessionId ?? this.resolveSessionId(input.context)
        };
        this.pendingApprovals.set(input.toolCallId, {
            input: normalizedInput,
            shellPermissionRequestId: normalizedInput.shellPermissionRequestId ?? null
        });
    }

    requestToolApproval(input: ForgePiToolCallInput): ForgePendingToolApproval | null {
        const approval = this.prepareBashNetworkApproval(input);
        if (!approval) return null;

        this.registerPendingApproval({
            ...input,
            args: approval.args,
            approvalKind: approval.approvalKind,
            displaySurface: approval.displaySurface,
            shellPermissionRequestId: approval.shellPermissionRequestId ?? null,
            forgeProjectId: input.forgeProjectId ?? input.context.workspaceSessionId,
            conversationId: input.conversationId ?? input.context.sessionChatId,
            sessionId: input.sessionId ?? this.resolveSessionId(input.context)
        });
        return approval;
    }

    async resolveToolApproval(
        sessionId: string,
        requestId: string,
        toolCallId: string,
        approved: boolean,
        message?: string,
        options: ForgeToolApprovalResolutionOptions = {}
    ): Promise<ForgePiToolApprovalResolution> {
        const pending = this.pendingApprovals.get(toolCallId);
        if (!pending) return { resolved: false, events: [], effects: [] };
        if (pending.input.sessionId !== sessionId || pending.input.requestId !== requestId) {
            return { resolved: false, events: [], effects: [] };
        }
        this.pendingApprovals.delete(toolCallId);

        const { input } = pending;
        const events: ForgeRuntimeEvent[] = [{
            type: 'tool_approval_resolved',
            requestId: input.requestId,
            approvalId: `approval-${input.toolCallId}`,
            toolCallId: input.toolCallId,
            toolName: input.toolName,
            approved,
            message,
            source: input.source,
            approvalKind: input.approvalKind,
            displaySurface: input.displaySurface,
            shellPermissionRequestId: pending.shellPermissionRequestId ?? input.shellPermissionRequestId ?? null,
            forgeProjectId: input.forgeProjectId ?? input.context.workspaceSessionId ?? null,
            conversationId: input.conversationId ?? input.context.sessionChatId ?? null,
            sessionId: input.sessionId ?? this.resolveSessionId(input.context)
        }];
        const effects: ForgeRuntimeEffect[] = [];

        if (!approved) {
            if (pending.shellPermissionRequestId) {
                this.permissions.rejectRequest(pending.shellPermissionRequestId, message);
            }
            return { resolved: true, events, effects };
        }

        const approvedGrant = pending.shellPermissionRequestId
            ? this.permissions.approveRequest(pending.shellPermissionRequestId)
            : null;
        const grantMode = options.grantMode ?? 'domain';
        this.applyApprovedNetworkGrantScope(approvedGrant, grantMode);
        const expireApprovedGrant = (): void => {
            if (approvedGrant && grantMode === 'single_use') {
                this.permissions.expireGrant(approvedGrant.grantId);
            }
        };

        const tool = this.findExecutableTool(input.context, input.toolName, nextEffects => effects.push(...nextEffects));
        if (!tool) {
            expireApprovedGrant();
            const errorMessage = `Forge pi tool not found: ${input.toolName}`;
            return {
                resolved: true,
                events,
                effects,
                toolResultMessage: this.createToolResultMessage(input, {
                    content: [{ type: 'text', text: errorMessage }],
                    details: { error: errorMessage }
                }, true)
            };
        }

        try {
            const result = await tool.execute(input.toolCallId, input.args as never);
            expireApprovedGrant();
            return {
                resolved: true,
                events,
                effects,
                toolResultMessage: this.createToolResultMessage(input, result, false)
            };
        } catch (error: unknown) {
            expireApprovedGrant();
            const errorMessage = error instanceof Error ? error.message : String(error);
            return {
                resolved: true,
                events,
                effects,
                toolResultMessage: this.createToolResultMessage(input, {
                    content: [{ type: 'text', text: errorMessage }],
                    details: { error: errorMessage }
                }, true)
            };
        }
    }

    private get vfs(): VirtualFileSystemService {
        return this.deps.vfs ?? virtualFileSystemService;
    }

    private get shell(): ForgeWorkspaceSearchShell {
        return this.deps.shell ?? forgeWorkspaceSearchShell;
    }

    private get permissions(): ShellPermissionService {
        return this.deps.permissions ?? shellPermissionService;
    }

    private get networkPolicy(): ShellNetworkPolicyService {
        return this.deps.networkPolicy ?? shellNetworkPolicyService;
    }

    private applyApprovedNetworkGrantScope(grant: ShellPermissionGrant | null, grantMode: ForgeToolApprovalGrantMode): void {
        if (!grant || grant.operation !== 'network') return;
        if (grantMode === 'all_network') {
            grant.scope = { allNetwork: true };
        }
    }

    private resolveSessionId(context: ForgeRuntimeContext): string {
        return `${context.workspaceSessionId}__${context.sessionChatId}`;
    }

    private get capabilities(): Pick<ForgeCapabilityRegistry, 'search' | 'load' | 'listCapabilities'> {
        return this.deps.capabilities ?? forgeCapabilityRegistry;
    }

    private get skills(): Pick<ForgeSkillRegistry, 'listProjectSkills' | 'listBuiltInSkills' | 'loadSkill'> {
        return this.deps.skills ?? forgeSkillRegistry;
    }

    private get semanticVfs(): ForgeSemanticVfsMapper {
        return this.deps.semanticVfs ?? forgeSemanticVfsMapper;
    }

    private get projectVfs(): ForgeSemanticVfsReader {
        return this.deps.projectVfs ?? (
            this.usesDefaultProjectVfsDeps()
                ? forgeSemanticVfsProvider
                : new ForgeSemanticVfsProvider({
                    workspaces: this.workspaces,
                    skills: this.skills
                })
        );
    }

    private usesDefaultProjectVfsDeps(): boolean {
        return !this.deps.workspaces && !this.deps.skills;
    }

    private createResearchTool(): ForgePiAgentTool | null {
        const apiKey = this.getTavilyApiKey();
        if (!apiKey) return null;
        const provider = this.deps.research ?? new TavilyResearchProvider({ apiKey });
        return createWebResearchTool({ provider }) as unknown as ForgePiAgentTool;
    }

    private getTavilyApiKey(): string {
        const configured = this.deps.getTavilyApiKey?.()
            ?? settingsDomainService.getEffectiveValue('lumina-forge.tavilyApiKey');
        return typeof configured === 'string' ? configured.trim() : '';
    }

    private resolveExecutableToolName(toolName: string): string {
        return this.legacyToolNameAliases.get(toolName) ?? toolName;
    }

    private findExecutableTool(
        context: ForgeRuntimeContext,
        toolName: string,
        onEffects?: (effects: ForgeRuntimeEffect[]) => void
    ): ForgePiAgentTool | undefined {
        const executableToolName = this.resolveExecutableToolName(toolName);
        return this.getTools(context, onEffects).find(item => item.name === executableToolName);
    }

    private get workspaces(): ShellWorkspaceService {
        return this.deps.workspaces ?? shellWorkspaceService;
    }

    private get workspaceWriter(): ForgeWorkspaceWriteService {
        return this.deps.workspaceWriter ?? (
            this.deps.workspaces
                ? new ForgeWorkspaceWriteService({ workspaces: this.deps.workspaces })
                : forgeWorkspaceWriteService
        );
    }

    private async readWritableProjectFile(path: string, ctx: ForgePiToolContext): Promise<ForgeWritableProjectFileResult> {
        const resolved = await this.resolvePath(path, ctx);
        const writableError = this.resolveDirectWriteError(resolved);
        if (writableError) {
            return {
                ok: false,
                path: resolved.displayPath,
                error: writableError
            };
        }
        if (resolved.kind !== 'workspace') {
            return {
                ok: false,
                path: resolved.displayPath,
                error: `read-only Forge semantic path: ${resolved.displayPath}`
            };
        }
        const fs = await this.workspaces.getFileSystem({
            projectId: ctx.forgeProjectId,
            conversationId: ctx.conversationId
        });
        try {
            return {
                ok: true,
                path: resolved.displayPath,
                workspacePath: resolved.workspacePath,
                content: String(await fs.readFile(this.workspaceLocalPath(resolved.workspacePath)) ?? '')
            };
        } catch {
            return {
                ok: false,
                path: resolved.displayPath,
                error: `File not found: ${resolved.displayPath}`
            };
        }
    }

    private async applyDirectWorkspaceChange(input: ForgeDirectWorkspaceChangeInput): Promise<ForgeDirectWorkspaceChangeResult> {
        const resolved = await this.resolvePath(input.path, input.ctx);
        const writableError = this.resolveDirectWriteError(resolved);
        if (writableError) {
            return {
                path: resolved.displayPath,
                applied: false,
                error: writableError,
                command: input.command
            };
        }
        if (resolved.kind !== 'workspace') {
            return {
                path: resolved.displayPath,
                applied: false,
                error: `read-only Forge semantic path: ${resolved.displayPath}`,
                command: input.command
            };
        }

        const result = await this.workspaceWriter.write({
            forgeProjectId: input.ctx.forgeProjectId,
            conversationId: input.ctx.conversationId,
            sourceToolCallId: input.toolCallId,
            displayPath: resolved.displayPath,
            workspacePath: resolved.workspacePath,
            contentAfter: input.contentAfter,
            command: input.command
        });
        const stateEffects = this.createDirectWriteStateEffects(resolved.displayPath, input.contentAfter, input.ctx);
        if (result.applied && stateEffects.length > 0) {
            input.emitEffects?.(stateEffects);
        }
        return {
            path: result.path,
            workspacePath: result.workspacePath,
            applied: result.applied,
            workspaceWriteSummary: result.workspaceWriteSummary,
            error: result.error,
            command: input.command
        };
    }

    private resolveDirectWriteError(resolved: ForgeSemanticPathResolution): string | null {
        if (resolved.kind === 'resource-vfs') {
            return 'resource VFS is read-only from Forge direct write tools; fork or import it into the project first.';
        }
        if (resolved.kind === 'virtual') {
            return 'virtual Forge runtime files are read-only from Forge direct write tools.';
        }
        if (resolved.displayPath === './' || resolved.displayPath.endsWith('/')) {
            return 'directory writes are not supported by Forge direct write tools.';
        }
        if (
            resolved.displayPath === './AGENTS.md'
            || resolved.displayPath.startsWith('./.forge/')
            || resolved.displayPath.startsWith('./agent/skills/')
            || resolved.displayPath.startsWith('./threads/')
            || resolved.displayPath.startsWith('./review/')
        ) {
            return `read-only Forge semantic path: ${resolved.displayPath}`;
        }
        return null;
    }

    private createDirectWriteStateEffects(
        displayPath: string,
        contentAfter: string | null,
        ctx: ForgePiToolContext
    ): ForgeRuntimeEffect[] {
        const memoryPath = this.resolveMemorySemanticPath(displayPath, ctx);
        if (memoryPath) {
            if (contentAfter === null) {
                return [{ type: 'memory_remove', path: memoryPath }];
            }
            const parsed = this.parseMarkdownDocument(contentAfter);
            return [{
                type: 'memory_upsert',
                path: memoryPath,
                title: parsed.title || memoryPath,
                content: parsed.body,
                summary: parsed.body.slice(0, 120),
                source: 'planner'
            }];
        }

        const lorebookId = this.resolveLorebookEntryId(displayPath, ctx);
        if (lorebookId) {
            if (contentAfter === null) {
                return [{ type: 'virtual_lorebook_remove', id: lorebookId }];
            }
            return [{
                type: 'virtual_lorebook_upsert',
                id: lorebookId,
                entry: this.buildLorebookEntryFromMarkdown(lorebookId, contentAfter, ctx)
            }];
        }

        return [];
    }

    private resolveMemorySemanticPath(displayPath: string, ctx: ForgePiToolContext): string | null {
        const match = displayPath.match(/^\.\/memory\/(.+)\.md$/);
        if (!match) return null;
        const resolvedPath = match[1].replace(/\\/g, '/').replace(/\/+/g, '/').replace(/\/$/, '');
        const existing = ctx.runtimeContext.forgeMemoryTree.entries.find(entry =>
            entry.path === resolvedPath || this.safePathSegment(entry.path) === resolvedPath
        );
        return existing?.path ?? resolvedPath;
    }

    private resolveLorebookEntryId(displayPath: string, ctx: ForgePiToolContext): string | null {
        const match = displayPath.match(/^\.\/lorebook\/entries\/([^/]+)\.md$/);
        if (!match) return null;
        const resolvedId = match[1];
        const existing = ctx.runtimeContext.virtualLorebookEntries.find(entry =>
            entry.id === resolvedId || this.safePathSegment(entry.id) === resolvedId
        );
        return existing?.id ?? resolvedId;
    }

    private parseMarkdownDocument(content: string): { title: string; body: string } {
        const lines = content.replace(/\r\n/g, '\n').split('\n');
        let title = '';
        if (lines[0]?.startsWith('# ')) {
            title = lines.shift()?.replace(/^#\s+/, '').trim() ?? '';
            if (lines[0] === '') lines.shift();
        }
        const footerIndex = lines.findIndex(line => line.startsWith('> 来源：'));
        const bodyLines = footerIndex >= 0 ? lines.slice(0, footerIndex) : lines;
        return {
            title,
            body: bodyLines.join('\n').trim()
        };
    }

    private buildLorebookEntryFromMarkdown(
        id: string,
        content: string,
        ctx: ForgePiToolContext
    ): LuminaLorebookEntry {
        const parsed = this.parseMarkdownDocument(content);
        const existing = ctx.runtimeContext.virtualLorebookEntries.find(entry => entry.id === id)?.entry;
        return {
            ...(existing ?? {}),
            uid: existing?.uid ?? id,
            comment: parsed.title || existing?.comment || id,
            key: existing?.key ?? [],
            keysecondary: existing?.keysecondary ?? [],
            content: parsed.body,
            constant: existing?.constant ?? false,
            selective: existing?.selective ?? false,
            selectiveLogic: existing?.selectiveLogic ?? 0,
            disable: existing?.disable ?? false,
            enabled: existing?.enabled ?? true,
            position: existing?.position ?? 0,
            role: existing?.role,
            depth: existing?.depth ?? 4,
            order: existing?.order ?? 100,
            probability: existing?.probability ?? 100,
            useProbability: existing?.useProbability ?? false,
            scan_depth: existing?.scan_depth ?? 4,
            caseSensitive: existing?.caseSensitive ?? false,
            matchWholeWords: existing?.matchWholeWords ?? false,
            useRegex: existing?.useRegex ?? false,
            excludeRecursion: existing?.excludeRecursion ?? false,
            preventRecursion: existing?.preventRecursion ?? false,
            delayUntilRecursion: existing?.delayUntilRecursion ?? false
        };
    }

    private safePathSegment(value: string): string {
        const normalized = value
            .trim()
            .replace(/[\\/:*?"<>|]/g, '-')
            .replace(/\s+/g, '-')
            .replace(/-+/g, '-')
            .replace(/^-|-$/g, '');
        return normalized || 'untitled';
    }

    private async resolvePath(path: string, ctx: ForgePiToolContext): Promise<ForgeSemanticPathResolution> {
        return this.semanticVfs.resolveAgentPath({
            path,
            forgeProjectId: ctx.forgeProjectId,
            conversationId: ctx.conversationId,
            threadTitle: ctx.runtimeContext.workspaceTitle,
            stableThreads: await this.listStableThreads(ctx)
        });
    }

    private toDisplayPath(path: string, ctx: ForgePiToolContext): string {
        return this.semanticVfs.toAgentDisplayPath({
            path,
            forgeProjectId: ctx.forgeProjectId,
            conversationId: ctx.conversationId,
            threadTitle: ctx.runtimeContext.workspaceTitle
        });
    }

    private workspaceLocalPath(workspacePath: string): string {
        return workspacePath.replace(/^\/workspaces(?=\/|$)/, '') || '/';
    }

    private async listStableThreads(ctx: ForgePiToolContext): Promise<ForgeSemanticThreadEntry[]> {
        const bindings = await this.workspaces.listForgeBindings()
            .then(items => items.filter(item => item.forgeProjectId === ctx.forgeProjectId))
            .catch(() => []);
        const fs = await this.workspaces.getFileSystem({
            projectId: ctx.forgeProjectId,
            conversationId: ctx.conversationId
        });
        const threads = await Promise.all(bindings
            .sort((left, right) => left.createdAt - right.createdAt || left.conversationId.localeCompare(right.conversationId))
            .map(async (binding, index): Promise<ForgeSemanticThreadEntry> => {
                const threadPath = this.workspaceLocalPath(forgeThreadWorkspacePath(ctx.forgeProjectId, binding.conversationId));
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
        return threads;
    }

    private createCapabilitySearchTool(ctx: ForgePiToolContext): ForgePiAgentTool {
        const parameters = Type.Object({
            query: Type.String({ description: '能力搜索词或用户意图' })
        });
        return {
            name: 'capabilitySearch',
            label: '搜索能力',
            description: '按当前意图搜索 Forge 能力。只返回短摘要、风险和加载方式；需要细节时再调用 capabilityLoad 或 skillLoad。',
            parameters,
            execute: async (_toolCallId, params: any) => {
                const { query } = params;
                const details = {
                    capabilities: this.capabilities.search(query).map(item => ({
                        id: item.id,
                        title: item.title,
                        summary: item.summary,
                        triggers: item.triggers,
                        loadAs: item.loadAs,
                        namespace: item.namespace,
                        skillName: item.skillName,
                        shellProfile: item.shellProfile,
                        risk: item.risk
                    }))
                };
                return textResult(`找到 ${details.capabilities.length} 个候选能力。`, details);
            }
        };
    }

    private createCapabilityLoadTool(ctx: ForgePiToolContext): ForgePiAgentTool {
        const parameters = Type.Object({
            capabilityId: Type.String({ description: 'capabilitySearch 返回的能力 id' }),
            reason: Type.String({ description: '本轮为什么需要该能力' })
        });
        return {
            name: 'capabilityLoad',
            label: '加载能力',
            description: '加载 Forge 能力，并返回风险、namespace、shell profile 与关联技能引用。',
            parameters,
            execute: async (_toolCallId, params: any) => {
                const { capabilityId, reason } = params;
                const loaded = await this.capabilities.load({
                    capabilityId,
                    forgeProjectId: ctx.forgeProjectId,
                    conversationId: ctx.conversationId,
                    reason
                });
                const details = {
                    capability: {
                        id: loaded.capability.id,
                        title: loaded.capability.title,
                        summary: loaded.capability.summary,
                        loadAs: loaded.capability.loadAs,
                        namespace: loaded.namespace,
                        shellProfile: loaded.shellProfile,
                        risk: loaded.capability.risk
                    },
                    skillRef: loaded.skill ? {
                        name: loaded.skill.skill.name,
                        description: loaded.skill.skill.description,
                        source: loaded.skill.source,
                        path: loaded.skill.path
                    } : null,
                    trace: loaded.trace
                };
                return textResult(`已加载能力：${loaded.capability.title}`, details);
            }
        };
    }

    private createSkillListTool(ctx: ForgePiToolContext): ForgePiAgentTool {
        const parameters = Type.Object({});
        return {
            name: 'skillList',
            label: '列出技能',
            description: '列出当前项目技能和可回退的内置中文技能。',
            parameters,
            execute: async () => {
                const projectSkills = await this.skills.listProjectSkills(ctx.forgeProjectId, ctx.conversationId);
                const presetSkills = listForgePresetSkillResources(ctx.runtimeContext);
                const details = {
                    projectSkills: projectSkills.map(item => ({
                        name: item.skill.name,
                        description: item.skill.description,
                        source: item.source,
                        path: item.path
                    })),
                    presetSkills: presetSkills.map(item => ({
                        name: item.name,
                        title: item.title ?? item.name,
                        description: item.description ?? item.title ?? item.name,
                        loadPolicy: item.loadPolicy ?? 'on_demand',
                        path: item.path
                    })),
                    builtInSkills: this.skills.listBuiltInSkills().map(item => ({
                        name: item.name,
                        title: item.title,
                        description: item.description,
                        defaultWriteScope: item.defaultWriteScope,
                        path: `./agent/skills/${item.name}/SKILL.md`
                    }))
                };
                return textResult(
                    `项目技能 ${details.projectSkills.length} 个，预设技能 ${details.presetSkills.length} 个，内置技能 ${details.builtInSkills.length} 个。`,
                    details
                );
            }
        };
    }

    private createSkillLoadTool(ctx: ForgePiToolContext): ForgePiAgentTool {
        const parameters = Type.Object({
            skillName: Type.String({ description: '要加载的技能 name。优先使用 skillList 返回的 canonical slug，也可传入标题或 ./agent/skills/<skill-name>/SKILL.md 路径。' })
        });
        return {
            name: 'skillLoad',
            label: '加载技能',
            description: '加载 Forge 技能完整内容。优先读取项目 skill，缺失时回退 preset / 内置中文 skill；支持中文标题解析到 canonical skillName。',
            parameters,
            execute: async (_toolCallId, params: any) => {
                const requestedSkillName = String(params?.skillName ?? '');
                const skillName = await this.resolveSkillNameAlias(requestedSkillName, ctx);
                const displayPath = `./agent/skills/${skillName}/SKILL.md`;
                const semanticContent = await this.projectVfs.readFile(ctx.runtimeContext, displayPath).catch(() => null);
                if (semanticContent !== null) {
                    return textResult(`已加载技能：${skillName}`, {
                        name: skillName,
                        requestedName: requestedSkillName,
                        description: skillName,
                        source: 'semantic-vfs',
                        path: displayPath,
                        files: [{
                            path: 'SKILL.md',
                            content: semanticContent
                        }]
                    });
                }
                const loaded = await this.skills.loadSkill({
                    forgeProjectId: ctx.forgeProjectId,
                    conversationId: ctx.conversationId,
                    skillName
                }).catch(() => null);
                if (!loaded) {
                    return textResult(`未找到技能：${skillName}`, { name: skillName, error: `Forge skill not found: ${skillName}` });
                }
                const details = {
                    name: loaded.skill.name,
                    requestedName: requestedSkillName,
                    description: loaded.skill.description,
                    source: loaded.source,
                    path: loaded.path,
                    files: loaded.skill.files.map(file => ({
                        path: file.path,
                        content: file.content
                    }))
                };
                return textResult(`已加载技能：${loaded.skill.description || loaded.skill.name}`, details);
            }
        };
    }

    private createBashTool(ctx: ForgePiToolContext, _emitEffects: (effects: ForgeRuntimeEffect[]) => void): ForgePiAgentTool {
        const parameters = Type.Object({
            command: Type.String({ description: '要执行的 bash 命令' }),
            accessMode: Type.Optional(Type.Union([
                Type.Literal('project-readonly'),
                Type.Literal('project-write-request'),
                Type.Literal('network-request')
            ]))
        });
        return {
            name: 'bash',
            label: '项目 Shell',
            description: [
                '在 Forge 项目沙箱中执行 bash 命令。',
                '默认 project-readonly；写入模式必须显式请求，并会直接写入项目 VFS 与生成本轮文件变更摘要。',
                '联网 curl 必须使用 network-request；缺少 grant 时 Forge 会在输入区请求用户授权。',
                //'network-request 允许 curl 的 -o/-O/-c/-T/-F 文件参数，文件读写会通过项目语义 VFS 和本轮写入摘要记录。',
                '禁止：命令替换 $()、反引号、eval、chmod。',
                '当前工作目录：./'
            ].join('\n'),
            parameters,
            execute: async (toolCallId, params: unknown) => {
                const { command, accessMode } = params as Static<typeof parameters>;
                const mode = (accessMode ?? 'project-readonly') as ForgeShellAccessMode;
                const stableThreads = await this.listStableThreads(ctx);
                const result = await this.shell.execute({
                    forgeProjectId: ctx.forgeProjectId,
                    conversationId: ctx.conversationId,
                    command,
                    reason: 'agent tool call',
                    accessMode: mode,
                    runtimeContext: ctx.runtimeContext
                });
                const workspaceWrites = await Promise.all(result.writeLog.map(entry =>
                    this.applyDirectWorkspaceChange({
                        toolCallId,
                        path: entry.path,
                        contentAfter: entry.contentAfter,
                        command: entry.command,
                        ctx,
                        emitEffects: _emitEffects
                    })
                ));
                const details = {
                    stdout: this.semanticVfs.rewriteTextToAgentDisplay({
                        text: result.result.stdout,
                        forgeProjectId: ctx.forgeProjectId,
                        conversationId: ctx.conversationId,
                        stableThreads
                    }),
                    stderr: this.semanticVfs.rewriteTextToAgentDisplay({
                        text: result.result.stderr,
                        forgeProjectId: ctx.forgeProjectId,
                        conversationId: ctx.conversationId,
                        stableThreads
                    }),
                    exitCode: result.result.exitCode,
                    diagnostics: result.diagnostics,
                    writeCount: workspaceWrites.filter(write => write.applied).length,
                    workspaceWriteSummary: this.workspaceWriter.mergeSummaries(toolCallId, workspaceWrites.map(write => ({
                        path: write.path,
                        workspacePath: write.workspacePath ?? write.path,
                        applied: write.applied,
                        changedFiles: write.workspaceWriteSummary?.changedFiles ?? [],
                        workspaceWriteSummary: write.workspaceWriteSummary ?? {
                            sourceToolCallId: toolCallId,
                            changedFiles: [],
                            writeCount: 0,
                            errors: write.error ? [{ path: write.path, error: write.error }] : [],
                            gitCommitHash: null,
                            gitParentHash: null
                        },
                        gitCommitHash: write.workspaceWriteSummary?.gitCommitHash ?? null,
                        gitParentHash: write.workspaceWriteSummary?.gitParentHash ?? null,
                        command: write.command,
                        error: write.error
                    }))),
                    writeErrors: workspaceWrites
                        .filter(write => !write.applied)
                        .map(write => ({ path: write.path, error: write.error }))
                };
                return textResult(details.stdout || details.stderr || `exitCode=${result.result.exitCode}`, details);
            }
        };
    }

    private prepareBashNetworkApproval(input: ForgePiToolCallInput): ForgePendingToolApproval | null {
        if (this.resolveExecutableToolName(input.toolName) !== 'bash') return null;
        const args = this.resolveBashNetworkArgs(input.args);
        if (!args || args.accessMode !== 'network-request') return null;
        const requirement = this.resolveBashNetworkApprovalRequirement(args.command);
        if (!requirement) return null;
        const session = this.createShellSession({
            forgeProjectId: input.context.workspaceSessionId,
            conversationId: input.context.sessionChatId,
            cwd: forgeWorkspacePath(input.context.workspaceSessionId),
            runtimeContext: input.context
        });
        const decision = this.networkPolicy.checkAgentGrant(
            this.permissions,
            session,
            { dangerouslyAllowFullInternetAccess: true },
            requirement.url,
            requirement.method
        );
        if (decision.allowed) return null;
        if (decision.failureReason !== 'grant_required') {
            return null;
        }

        const permissionRequest = this.permissions.requestPermission({
            session,
            operation: 'network',
            scope: { urlPrefix: requirement.urlPrefix },
            reason: `Forge Agent 请求访问 ${requirement.urlPrefix}`,
            expiresAt: null
        });
        return {
            approvalKind: 'network',
            displaySurface: 'composer',
            toolCallId: input.toolCallId,
            toolName: 'bash',
            args: {
                command: args.command,
                accessMode: 'network-request'
            },
            shellPermissionRequestId: permissionRequest.requestId,
            url: requirement.url,
            urlPrefix: requirement.urlPrefix,
            method: requirement.method,
            command: requirement.command,
            localFileIo: requirement.localFileIo,
            reason: permissionRequest.reason
        };
    }

    private resolveBashNetworkArgs(args: unknown): {
        command: string;
        accessMode: ForgeShellAccessMode;
    } | null {
        if (!args || typeof args !== 'object' || Array.isArray(args)) return null;
        const record = args as Record<string, unknown>;
        if (typeof record.command !== 'string') return null;
        const accessMode = typeof record.accessMode === 'string'
            ? record.accessMode as ForgeShellAccessMode
            : 'project-readonly';
        return {
            command: record.command,
            accessMode
        };
    }

    private createShellSession(ctx: ForgePiToolContext): ShellSessionRef {
        return {
            shellSessionId: `forge-agent-${ctx.forgeProjectId}-${ctx.conversationId}`,
            kind: 'forge-agent',
            ownerType: 'forge',
            ownerId: ctx.forgeProjectId,
            projectId: ctx.forgeProjectId,
            conversationId: ctx.conversationId
        };
    }

    private resolveBashNetworkApprovalRequirement(command: string): ForgeBashNetworkApprovalRequirement | null {
        for (const segment of this.splitCommandSegments(command)) {
            const tokens = this.tokenizeCommandSegment(segment);
            if (tokens[0] !== 'curl') continue;
            const url = this.resolveCurlUrl(tokens);
            if (!url) continue;
            const normalizedUrl = this.normalizeCurlUrl(url);
            return {
                url: normalizedUrl,
                urlPrefix: this.urlPrefix(normalizedUrl),
                method: this.resolveCurlMethod(tokens),
                command,
                localFileIo: this.hasCurlLocalFileIo(tokens)
            };
        }
        return null;
    }

    private splitCommandSegments(command: string): string[] {
        return command
            .split(/\|\||&&|[|;]/)
            .map(segment => segment.trim())
            .filter(Boolean);
    }

    private tokenizeCommandSegment(segment: string): string[] {
        const tokens: string[] = [];
        let current = '';
        let quote: '"' | '\'' | null = null;
        let escaping = false;
        for (const char of segment.trim()) {
            if (escaping) {
                current += char;
                escaping = false;
                continue;
            }
            if (char === '\\') {
                escaping = true;
                continue;
            }
            if (quote) {
                if (char === quote) {
                    quote = null;
                } else {
                    current += char;
                }
                continue;
            }
            if (char === '"' || char === '\'') {
                quote = char;
                continue;
            }
            if (/\s/.test(char)) {
                if (current) {
                    tokens.push(current);
                    current = '';
                }
                continue;
            }
            current += char;
        }
        if (current) tokens.push(current);
        return tokens;
    }

    private resolveCurlUrl(tokens: string[]): string | null {
        for (let index = 1; index < tokens.length; index += 1) {
            const token = tokens[index];
            if (this.isCurlOptionWithValue(token)) {
                index += 1;
                continue;
            }
            if (this.isCurlInlineOptionWithValue(token)) continue;
            if (token.startsWith('-')) continue;
            return token;
        }
        return null;
    }

    private isCurlOptionWithValue(token: string): boolean {
        return [
            '-X',
            '--request',
            '-H',
            '--header',
            '-d',
            '--data',
            '--data-raw',
            '--data-binary',
            '--data-urlencode',
            '-F',
            '--form',
            '-u',
            '--user',
            '-A',
            '--user-agent',
            '-e',
            '--referer',
            '-b',
            '--cookie',
            '-c',
            '--cookie-jar',
            '-T',
            '--upload-file',
            '-m',
            '--max-time',
            '--connect-timeout',
            '--max-redirs',
            '-w',
            '--write-out',
            '-o',
            '--output'
        ].includes(token);
    }

    private isCurlInlineOptionWithValue(token: string): boolean {
        return token.startsWith('--request=')
            || token.startsWith('--header=')
            || token.startsWith('--data=')
            || token.startsWith('--data-raw=')
            || token.startsWith('--data-binary=')
            || token.startsWith('--data-urlencode=')
            || token.startsWith('--form=')
            || token.startsWith('--user=')
            || token.startsWith('--user-agent=')
            || token.startsWith('--referer=')
            || token.startsWith('--cookie=')
            || token.startsWith('--cookie-jar=')
            || token.startsWith('--upload-file=')
            || token.startsWith('--max-time=')
            || token.startsWith('--connect-timeout=')
            || token.startsWith('--max-redirs=')
            || token.startsWith('--write-out=')
            || token.startsWith('--output=');
    }

    private normalizeCurlUrl(url: string): string {
        return /^https?:\/\//i.test(url) ? url : `https://${url}`;
    }

    private urlPrefix(url: string): string {
        try {
            const parsed = new URL(url);
            return `${parsed.origin}/`;
        } catch {
            return url;
        }
    }

    private resolveCurlMethod(tokens: string[]): string {
        for (let index = 1; index < tokens.length; index += 1) {
            const token = tokens[index];
            if (token === '-X' || token === '--request') return (tokens[index + 1] ?? 'GET').toUpperCase();
            if (token.startsWith('-X') && token.length > 2) return token.slice(2).toUpperCase();
            if (token.startsWith('--request=')) return token.slice('--request='.length).toUpperCase();
            if (token === '-T' || token === '--upload-file' || token.startsWith('--upload-file=')) return 'PUT';
            if (
                token === '-d'
                || token === '--data'
                || token === '--data-raw'
                || token === '--data-binary'
                || token === '--data-urlencode'
                || token === '-F'
                || token === '--form'
                || token.startsWith('-d')
                || token.startsWith('--data=')
                || token.startsWith('--data-raw=')
                || token.startsWith('--data-binary=')
                || token.startsWith('--data-urlencode=')
                || token.startsWith('--form=')
            ) {
                return 'POST';
            }
        }
        return 'GET';
    }

    private hasCurlLocalFileIo(tokens: string[]): boolean {
        for (let index = 1; index < tokens.length; index += 1) {
            const token = tokens[index];
            if (
                token === '-o'
                || token === '--output'
                || token === '-O'
                || token === '--remote-name'
                || token === '-c'
                || token === '--cookie-jar'
                || token === '-T'
                || token === '--upload-file'
                || token.startsWith('--output=')
                || token.startsWith('--cookie-jar=')
                || token.startsWith('--upload-file=')
            ) {
                return true;
            }
            if (token.startsWith('-') && !token.startsWith('--') && token.length > 2 && token.slice(1).includes('O')) {
                return true;
            }
            if ((token === '-F' || token === '--form') && this.isCurlFormFileArgument(tokens[index + 1])) {
                return true;
            }
            if (token.startsWith('--form=') && this.isCurlFormFileArgument(token.slice('--form='.length))) {
                return true;
            }
        }
        return false;
    }

    private isCurlFormFileArgument(value: string | undefined): boolean {
        if (!value) return false;
        const separatorIndex = value.indexOf('=');
        if (separatorIndex < 0) return false;
        const formValue = value.slice(separatorIndex + 1);
        return formValue.startsWith('@') || formValue.startsWith('<');
    }

    private createReadTool(ctx: ForgePiToolContext): ForgePiAgentTool {
        const parameters = Type.Object({
            path: Type.String({ description: '文件的绝对路径或相对路径' })
        });
        return {
            name: 'read',
            label: '读取文件',
            description: '读取 Forge 项目文件系统中的文件内容。',
            parameters,
            execute: async (_toolCallId, params: any) => {
                const { path } = params;
                const resolved = await this.resolvePath(path, ctx);
                try {
                    if (resolved.kind !== 'resource-vfs') {
                        const content = await this.projectVfs.readFile(ctx.runtimeContext, resolved.displayPath);
                        return textResult(content, { path: resolved.displayPath, content });
                    }
                    const content = await this.vfs.readFile(resolved.resourcePath);
                    if (content === null) {
                        throw new Error(`Virtual Forge file not found: ${resolved.displayPath}`);
                    }
                    return textResult(content ?? '', { path: resolved.displayPath, content: content ?? '' });
                } catch {
                    const directory = resolved.kind !== 'resource-vfs'
                        ? await this.resolveSemanticDirectory(ctx, resolved.displayPath)
                        : null;
                    if (directory) {
                        const body = [
                            `Path is a directory: ${directory.path}`,
                            '',
                            ...directory.entries.map(entry => `- ${entry.kind}: ${entry.path}`)
                        ].join('\n');
                        return textResult(body, {
                            path: directory.path,
                            content: '',
                            directory: true,
                            entries: directory.entries
                        });
                    }
                    const skillName = this.skillNameFromDisplayPath(resolved.displayPath);
                    if (skillName) {
                        const loaded = await this.skills.loadSkill({
                            forgeProjectId: ctx.forgeProjectId,
                            conversationId: ctx.conversationId,
                            skillName
                        }).catch(() => null);
                        const skillFile = loaded?.skill.files.find(file => file.path === 'SKILL.md');
                        if (loaded && skillFile) {
                            return textResult(skillFile.content, {
                                path: resolved.displayPath,
                                content: skillFile.content,
                                source: loaded.source
                            });
                        }
                    }
                    return textResult(`File not found: ${resolved.displayPath}`, {
                        path: resolved.displayPath,
                        content: '',
                        error: `File not found: ${resolved.displayPath}`
                    });
                }
            }
        };
    }

    private createWriteTool(ctx: ForgePiToolContext, emitEffects: (effects: ForgeRuntimeEffect[]) => void): ForgePiAgentTool {
        const parameters = Type.Object({
            path: Type.String({ description: '相对项目工作区的文件路径' }),
            content: Type.String({ description: '要直接写入 Forge 项目 VFS 的完整内容。' })
        });
        return {
            name: 'write',
            label: '写入文件',
            description: '直接写入 Forge 项目 VFS，并返回本轮文件变更摘要；不会发布或改写真实 ST 世界书。',
            parameters,
            execute: async (toolCallId, params: any) => {
                const { path, content } = params;
                const applied = await this.applyDirectWorkspaceChange({
                    toolCallId,
                    path,
                    contentAfter: String(content ?? ''),
                    command: `write ${path}`,
                    ctx,
                    emitEffects
                });
                return textResult(applied.applied
                    ? `已写入项目文件：${applied.path}`
                    : `无法写入项目文件：${applied.path}`,
                applied);
            }
        };
    }

    private createEditTool(ctx: ForgePiToolContext, emitEffects: (effects: ForgeRuntimeEffect[]) => void): ForgePiAgentTool {
        const parameters = Type.Object({
            path: Type.String({ description: '相对项目工作区的文件路径' }),
            old_string: Type.String({ description: '要替换的精确文本' }),
            new_string: Type.String({ description: '替换后的文本' })
        });
        return {
            name: 'edit',
            label: '编辑文件',
            description: '对 Forge 项目 VFS 文件执行精确替换，并返回本轮文件变更摘要。',
            parameters,
            execute: async (toolCallId, params: any) => {
                const { path, old_string, new_string } = params;
                const before = await this.readWritableProjectFile(path, ctx);
                if (!before.ok) {
                    return textResult(before.error, {
                        path: before.path,
                        applied: false,
                        replaced: false,
                        error: before.error
                    });
                }
                if (!before.content.includes(old_string)) {
                    return textResult('old_string not found in file', {
                        path: before.path,
                        applied: false,
                        replaced: false,
                        error: 'old_string not found in file'
                    });
                }
                const applied = await this.applyDirectWorkspaceChange({
                    toolCallId,
                    path,
                    contentAfter: before.content.replace(old_string, new_string),
                    command: `edit ${path}`,
                    ctx,
                    emitEffects
                });
                return textResult(applied.applied
                    ? `已编辑项目文件：${applied.path}`
                    : `无法编辑项目文件：${applied.path}`,
                { ...applied, replaced: applied.applied });
            }
        };
    }

    private createDeleteTool(ctx: ForgePiToolContext, emitEffects: (effects: ForgeRuntimeEffect[]) => void): ForgePiAgentTool {
        const parameters = Type.Object({
            path: Type.String({ description: '相对项目工作区的文件路径' })
        });
        return {
            name: 'delete',
            label: '删除文件',
            description: '删除 Forge 项目 VFS 文件，并返回本轮文件变更摘要。',
            parameters,
            execute: async (toolCallId, params: any) => {
                const { path } = params;
                const applied = await this.applyDirectWorkspaceChange({
                    toolCallId,
                    path,
                    contentAfter: null,
                    command: `delete ${path}`,
                    ctx,
                    emitEffects
                });
                return textResult(applied.applied
                    ? `已删除项目文件：${applied.path}`
                    : `无法删除项目文件：${applied.path}`,
                applied);
            }
        };
    }

    private async resolveSkillNameAlias(skillName: string, ctx: ForgePiToolContext): Promise<string> {
        const requested = skillName.trim();
        const skillPathName = this.skillNameFromDisplayPath(this.normalizeSkillPathInput(requested));
        if (skillPathName) return skillPathName;
        if (this.isCanonicalSkillName(requested)) return requested.toLowerCase();

        const skillOptions: Array<{
            name: string;
            aliases: string[];
        }> = [];
        const projectSkills = await this.skills.listProjectSkills(ctx.forgeProjectId, ctx.conversationId).catch(() => []);
        for (const item of projectSkills) {
            skillOptions.push({
                name: item.skill.name,
                aliases: [
                    item.skill.name,
                    item.skill.description,
                    item.path,
                    `./agent/skills/${item.skill.name}/SKILL.md`
                ].filter(Boolean)
            });
        }
        for (const item of listForgePresetSkillResources(ctx.runtimeContext)) {
            skillOptions.push({
                name: item.name,
                aliases: [
                    item.name,
                    item.title ?? '',
                    item.description ?? '',
                    item.path,
                    `./agent/skills/${item.name}/SKILL.md`
                ].filter(Boolean)
            });
        }
        for (const item of this.skills.listBuiltInSkills()) {
            skillOptions.push({
                name: item.name,
                aliases: [
                    item.name,
                    item.title,
                    item.description,
                    `./agent/skills/${item.name}/SKILL.md`
                ].filter(Boolean)
            });
        }

        const normalizedRequested = this.normalizeSkillAlias(requested);
        const matched = skillOptions.find(option =>
            option.aliases.some(alias => this.normalizeSkillAlias(alias) === normalizedRequested)
        );
        return matched?.name ?? requested;
    }

    private normalizeSkillPathInput(value: string): string {
        const normalized = value.trim().replace(/\\/g, '/').replace(/\/+/g, '/');
        if (normalized.startsWith('./')) return normalized;
        if (normalized.startsWith('agent/')) return `./${normalized}`;
        return normalized;
    }

    private normalizeSkillAlias(value: string): string {
        return this.normalizeSkillPathInput(value).toLowerCase();
    }

    private isCanonicalSkillName(value: string): boolean {
        return /^[a-z0-9][a-z0-9-]*$/.test(value.trim().toLowerCase());
    }

    private skillNameFromDisplayPath(displayPath: string): string | null {
        return this.normalizeSkillPathInput(displayPath).match(/^\.\/agent\/skills\/([^/]+)\/SKILL\.md$/)?.[1] ?? null;
    }

    private async resolveSemanticDirectory(
        ctx: ForgePiToolContext,
        displayPath: string
    ): Promise<{
        path: string;
        entries: Array<{ path: string; kind: string; title?: string | null }>;
    } | null> {
        const directoryPath = this.normalizeDirectoryDisplayPath(displayPath);
        const entries = await this.projectVfs.listEntries(ctx.runtimeContext).catch(() => []);
        const exists = entries.some(entry => entry.path === directoryPath && entry.kind === 'directory');
        const children = entries
            .filter(entry => entry.path !== directoryPath && entry.path.startsWith(directoryPath))
            .filter(entry => {
                const rest = entry.path.slice(directoryPath.length);
                return rest.length > 0 && !rest.replace(/\/$/, '').includes('/');
            })
            .map(entry => ({
                path: entry.path,
                kind: entry.kind
            }));
        if (!exists && children.length === 0) return null;
        return {
            path: directoryPath,
            entries: children
        };
    }

    private normalizeDirectoryDisplayPath(path: string): string {
        const normalized = path.trim().replace(/\\/g, '/').replace(/\/+/g, '/').replace(/\/$/, '');
        if (!normalized || normalized === '.' || normalized === './') return './';
        const prefixed = normalized.startsWith('./') ? normalized : `./${normalized.replace(/^\//, '')}`;
        return prefixed === './' ? './' : `${prefixed}/`;
    }

    private createToolResultMessage(
        input: ForgePiToolCallInput,
        result: Pick<AgentToolResult<unknown>, 'content' | 'details'>,
        isError: boolean
    ): ToolResultMessage {
        return {
            role: 'toolResult',
            toolCallId: input.toolCallId,
            toolName: input.toolName,
            content: result.content,
            details: toJsonValue(result.details),
            isError,
            timestamp: Date.now()
        };
    }

}

export const forgePiToolBridge = new ForgePiToolBridge();
