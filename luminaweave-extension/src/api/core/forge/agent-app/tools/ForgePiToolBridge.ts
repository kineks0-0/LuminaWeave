import {
    Type,
    type Static,
    type ToolResultMessage
} from '@earendil-works/pi-ai';
import type { AgentTool, AgentToolResult } from '@earendil-works/pi-agent-core';
import type { TSchema } from 'typebox';
import type { VirtualFileSystemService } from '../../../hal/resource/VirtualFileSystemService.js';
import { virtualFileSystemService } from '../../../hal/shell/index.js';
import {
    forgeThreadWorkspacePath,
    forgeWorkspacePath,
    shellWorkspaceService,
    type ShellWorkspaceService
} from '../../../hal/shell/ShellWorkspaceService.js';
import {
    forgeWorkspaceSearchShell,
    type ForgeShellAccessMode,
    type ForgeShellWriteLogEntry,
    type ForgeWorkspaceSearchShell
} from '../../shell/ForgeWorkspaceSearchShell.js';
import { forgeShellWriteInterceptor } from '../../effects/ForgeShellWriteInterceptor.js';
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
    ForgeRuntimeEventSource
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
}

export interface ForgePiToolApprovalResolution {
    resolved: boolean;
    events: ForgeRuntimeEvent[];
    effects: ForgeRuntimeEffect[];
    toolResultMessage?: ToolResultMessage;
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
    onEffects?: (effects: ForgeRuntimeEffect[]) => void;
}

interface PendingPiToolApproval {
    input: ForgePiToolCallInput;
}

const textResult = <TDetails>(text: string, details: TDetails): AgentToolResult<TDetails> => ({
    content: [{ type: 'text', text }],
    details
});

export class ForgePiToolBridge {
    private readonly pendingApprovals = new Map<string, PendingPiToolApproval>();

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

        return [
            this.createCapabilitySearchTool(ctx),
            this.createCapabilityLoadTool(ctx),
            this.createSkillListTool(ctx),
            this.createSkillLoadTool(ctx),
            this.createBashTool(ctx, emitEffects),
            this.createReadFileTool(ctx),
            this.createWriteProposalTool(ctx, emitEffects),
            this.createEditProposalTool(ctx, emitEffects),
            this.createStageEntryTool(ctx, emitEffects)
        ];
    }

    getToolSummary(context: ForgeRuntimeContext): Array<{ name: string; description: string; needsApproval: boolean | 'dynamic' }> {
        return this.getTools(context).map(tool => ({
            name: tool.name,
            description: tool.description,
            needsApproval: typeof tool.needsApproval === 'function' ? 'dynamic' : Boolean(tool.needsApproval)
        }));
    }

    async needsApproval(toolName: string, args: unknown, context: ForgeRuntimeContext): Promise<boolean> {
        const tool = this.getTools(context).find(item => item.name === toolName);
        if (!tool) return false;
        if (typeof tool.needsApproval === 'function') {
            return Boolean(await tool.needsApproval(args as never));
        }
        return Boolean(tool.needsApproval);
    }

    registerPendingApproval(input: ForgePiToolCallInput): void {
        this.pendingApprovals.set(input.toolCallId, { input });
    }

    async resolveToolApproval(toolCallId: string, approved: boolean, message?: string): Promise<ForgePiToolApprovalResolution> {
        const pending = this.pendingApprovals.get(toolCallId);
        if (!pending) return { resolved: false, events: [], effects: [] };
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
            source: input.source
        }];
        const effects: ForgeRuntimeEffect[] = [];

        if (!approved) return { resolved: true, events, effects };

        const tool = this.getTools(input.context, nextEffects => effects.push(...nextEffects))
            .find(item => item.name === input.toolName);
        if (!tool) {
            const errorMessage = `Forge pi tool not found: ${input.toolName}`;
            events.push(this.createToolErrorEvent(input, errorMessage));
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
            events.push({
                type: 'tool_result',
                requestId: input.requestId,
                toolCallId: input.toolCallId,
                toolName: input.toolName,
                result: result.details,
                source: input.source
            });
            return {
                resolved: true,
                events,
                effects,
                toolResultMessage: this.createToolResultMessage(input, result, false)
            };
        } catch (error: any) {
            const errorMessage = error?.message || String(error);
            events.push(this.createToolErrorEvent(input, errorMessage));
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

    private get workspaces(): ShellWorkspaceService {
        return this.deps.workspaces ?? shellWorkspaceService;
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

    private emitWriteLog(writeLog: ForgeShellWriteLogEntry[], emitEffects: (effects: ForgeRuntimeEffect[]) => void): ForgeRuntimeEffect[] {
        const intercepted = forgeShellWriteInterceptor.intercept(writeLog);
        emitEffects(intercepted.effects);
        return intercepted.effects;
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
            skillName: Type.String({ description: '要加载的技能 name' })
        });
        return {
            name: 'skillLoad',
            label: '加载技能',
            description: '加载 Forge 技能完整内容。优先读取项目 skill，缺失时回退内置中文 skill。',
            parameters,
            execute: async (_toolCallId, params: any) => {
                const { skillName } = params;
                const displayPath = `./agent/skills/${skillName}/SKILL.md`;
                const semanticContent = await this.projectVfs.readFile(ctx.runtimeContext, displayPath).catch(() => null);
                if (semanticContent !== null) {
                    return textResult(`已加载技能：${skillName}`, {
                        name: skillName,
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
                });
                if (!loaded) {
                    return textResult(`未找到技能：${skillName}`, { name: skillName, error: `Forge skill not found: ${skillName}` });
                }
                const details = {
                    name: loaded.skill.name,
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

    private createBashTool(ctx: ForgePiToolContext, emitEffects: (effects: ForgeRuntimeEffect[]) => void): ForgePiAgentTool {
        const parameters = Type.Object({
            command: Type.String({ description: '要执行的 bash 命令' }),
            accessMode: Type.Optional(Type.Union([
                Type.Literal('project-readonly'),
                Type.Literal('project-write-request')
            ]))
        });
        return {
            name: 'bash',
            label: '项目 Shell',
            description: [
                '在 Forge 项目沙箱中执行 bash 命令。',
                '默认 project-readonly；写入模式必须显式请求，并且只会创建审阅暂存。',
                '禁止：命令替换 $()、反引号、curl、eval、chmod。',
                '当前工作目录：./'
            ].join('\n'),
            parameters,
            needsApproval: (params: any) => params?.accessMode === 'project-write-request',
            execute: async (_toolCallId, params: any) => {
                const { command, accessMode } = params;
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
                if (result.writeLog.length > 0) {
                    this.emitWriteLog(result.writeLog, emitEffects);
                }
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
                    writeCount: result.writeLog.length
                };
                return textResult(details.stdout || details.stderr || `exitCode=${result.result.exitCode}`, details);
            }
        };
    }

    private createReadFileTool(ctx: ForgePiToolContext): ForgePiAgentTool {
        const parameters = Type.Object({
            path: Type.String({ description: '文件的绝对路径或相对路径' })
        });
        return {
            name: 'readFile',
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
                    const skillName = this.skillNameFromDisplayPath(resolved.displayPath);
                    if (skillName) {
                        const loaded = await this.skills.loadSkill({
                            forgeProjectId: ctx.forgeProjectId,
                            conversationId: ctx.conversationId,
                            skillName
                        });
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

    private createWriteProposalTool(ctx: ForgePiToolContext, emitEffects: (effects: ForgeRuntimeEffect[]) => void): ForgePiAgentTool {
        const parameters = Type.Object({
            path: Type.String({ description: '相对项目工作区的文件路径' }),
            content: Type.String({ description: '要写入的内容。结构化条目请使用 JSON。' })
        });
        return {
            name: 'writeProposal',
            label: '写入建议',
            description: '生成文件写入建议。变更只进入人工审阅暂存，不直接发布或写真实 ST 世界书。',
            parameters,
            needsApproval: true,
            execute: async (_toolCallId, params: any) => {
                const { path, content } = params;
                const resolved = await this.resolvePath(path, ctx);
                if (resolved.kind === 'virtual') {
                    const patchPath = this.skillOverridePatchPath(resolved.displayPath);
                    return textResult(`已生成内置/运行时文件增量覆盖建议：${patchPath}`, {
                        path: resolved.displayPath,
                        patchPath,
                        staged: true,
                        effectCount: 0,
                        overlay: true
                    });
                }
                if (resolved.kind !== 'workspace') {
                    return textResult('resource VFS writes must be forked or imported through a dedicated workflow', {
                        path: resolved.displayPath,
                        staged: false,
                        error: 'resource VFS writes are not supported by writeProposal'
                    });
                }
                let before = '';
                let fileExists = true;
                try {
                    before = await (await this.workspaces.getFileSystem({
                        projectId: ctx.forgeProjectId,
                        conversationId: ctx.conversationId
                    })).readFile(this.workspaceLocalPath(resolved.workspacePath)) ?? '';
                } catch {
                    fileExists = false;
                }
                const skillName = this.skillNameFromDisplayPath(resolved.displayPath);
                if (skillName && !fileExists) {
                    const patchPath = this.skillOverridePatchPath(resolved.displayPath);
                    return textResult(`已生成内置技能增量覆盖建议：${patchPath}`, {
                        path: resolved.displayPath,
                        patchPath,
                        staged: true,
                        effectCount: 0,
                        overlay: true
                    });
                }
                const effects = this.emitWriteLog([{
                    command: `writeProposal ${path}`,
                    path: resolved.workspacePath,
                    contentBefore: before,
                    contentAfter: content
                }], emitEffects);
                return textResult(`已生成写入审阅建议：${resolved.displayPath}`, {
                    path: resolved.displayPath,
                    staged: true,
                    effectCount: effects.length
                });
            }
        };
    }

    private createEditProposalTool(ctx: ForgePiToolContext, emitEffects: (effects: ForgeRuntimeEffect[]) => void): ForgePiAgentTool {
        const parameters = Type.Object({
            path: Type.String({ description: '相对项目工作区的文件路径' }),
            old_string: Type.String({ description: '要替换的精确文本' }),
            new_string: Type.String({ description: '替换后的文本' })
        });
        return {
            name: 'editProposal',
            label: '编辑建议',
            description: '生成精准替换建议。变更只进入人工审阅暂存，不直接发布或写真实 ST 世界书。',
            parameters,
            needsApproval: true,
            execute: async (_toolCallId, params: any) => {
                const { path, old_string, new_string } = params;
                const resolved = await this.resolvePath(path, ctx);
                if (resolved.kind === 'virtual') {
                    const patchPath = this.skillOverridePatchPath(resolved.displayPath);
                    return textResult(`已生成内置/运行时文件增量覆盖建议：${patchPath}`, {
                        path: resolved.displayPath,
                        patchPath,
                        replaced: true,
                        staged: true,
                        effectCount: 0,
                        overlay: true
                    });
                }
                if (resolved.kind !== 'workspace') {
                    return textResult('resource VFS edits must be forked or imported through a dedicated workflow', {
                        path: resolved.displayPath,
                        replaced: false,
                        error: 'resource VFS edits are not supported by editProposal'
                    });
                }
                let before: string;
                try {
                    before = await (await this.workspaces.getFileSystem({
                        projectId: ctx.forgeProjectId,
                        conversationId: ctx.conversationId
                    })).readFile(this.workspaceLocalPath(resolved.workspacePath)) ?? '';
                } catch {
                    const skillName = this.skillNameFromDisplayPath(resolved.displayPath);
                    if (skillName) {
                        const patchPath = this.skillOverridePatchPath(resolved.displayPath);
                        return textResult(`已生成内置技能增量覆盖建议：${patchPath}`, {
                            path: resolved.displayPath,
                            patchPath,
                            replaced: true,
                            staged: true,
                            effectCount: 0,
                            overlay: true
                        });
                    }
                    throw new Error(`File not found: ${resolved.displayPath}`);
                }
                if (!before.includes(old_string)) {
                    return textResult('old_string not found in file', { path: resolved.displayPath, replaced: false, error: 'old_string not found in file' });
                }
                const after = before.replace(old_string, new_string);
                const effects = this.emitWriteLog([{
                    command: `editProposal ${path}`,
                    path: resolved.workspacePath,
                    contentBefore: before,
                    contentAfter: after
                }], emitEffects);
                return textResult(`已生成编辑审阅建议：${resolved.displayPath}`, {
                    path: resolved.displayPath,
                    replaced: true,
                    staged: true,
                    effectCount: effects.length
                });
            }
        };
    }

    private skillOverridePatchPath(displayPath: string): string {
        const skillName = this.skillNameFromDisplayPath(displayPath);
        if (!skillName) return './.pi/agent/overrides/patch.diff';
        return `./.pi/agent/skill-overrides/${skillName}/SKILL.patch`;
    }

    private skillNameFromDisplayPath(displayPath: string): string | null {
        return displayPath.match(/^\.\/agent\/skills\/([^/]+)\/SKILL\.md$/)?.[1] ?? null;
    }

    private createStageEntryTool(ctx: ForgePiToolContext, emitEffects: (effects: ForgeRuntimeEffect[]) => void): ForgePiAgentTool {
        const parameters = Type.Object({
            targetEntryId: Type.String({ description: '要暂存的条目 ID，例如 "character.concept"' }),
            title: Type.String({ description: '变更的中文可读标题' }),
            content: Type.String({ description: '候选内容' })
        });
        return {
            name: 'stageEntry',
            label: '暂存条目',
            description: '直接把内容送入 Forge Review 面板等待人工审阅。',
            parameters,
            needsApproval: true,
            execute: async (_toolCallId, params: any) => {
                const { targetEntryId, title, content } = params;
                emitEffects([{
                    type: 'upsert_staging_entry',
                    entry: {
                        targetEntryId,
                        proposedContent: content,
                        description: title,
                        originalContent: '',
                        layer: null,
                        sourceTag: 'tool:stageEntry',
                        sourceMessageId: null,
                        sourceSessionId: ctx.conversationId
                    }
                }]);
                return textResult(`已进入审阅暂存：${targetEntryId}`, { staged: true, targetEntryId, title });
            }
        };
    }

    private createToolErrorEvent(input: ForgePiToolCallInput, message: string): ForgeRuntimeEvent {
        return {
            type: 'tool_result',
            requestId: input.requestId,
            toolCallId: input.toolCallId,
            toolName: input.toolName,
            result: { error: message },
            isError: true,
            source: input.source
        };
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
            details: result.details,
            isError,
            timestamp: Date.now()
        };
    }
}

export const forgePiToolBridge = new ForgePiToolBridge();
