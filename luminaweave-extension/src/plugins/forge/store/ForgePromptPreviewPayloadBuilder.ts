import type { LuminaChatMessage } from '@shared/LuminaMessage.js';
import type { ForgeAgentGraphResult } from '../../../api/core/forge/graph/ForgeAgentGraphRuntime.js';
import type { ForgeMemoryTree } from '../../../types/ForgeMemoryTypes.js';
import type {
    ForgePromptPreviewBundle,
    ForgePromptPreviewPiInput,
    ForgePromptPreviewPiResult
} from '../../../types/ForgePromptTypes.js';
import type { PromptAssemblyResult } from '../../../types/PromptAssemblyTypes.js';
import type { MemorySnapshot } from '../../../types/MemorySnapshotTypes.js';
import type { CleanedMessage } from '../../../types/nexus.js';
import type { ForgeDraftTree, ForgeStructuredState } from '../../../types/ForgeStructuredTypes.js';
import type { ForgeWorkflowIntent, ForgeWorkflowSnapshot } from '../../../types/ForgeWorkflowTypes.js';
import type {
    ForgeRequestContextSnapshot,
    ForgeRequestNodeSummaryItem,
    ForgeRuntimeContext,
    ForgeUserCommand,
    StagingEntry
} from '../../../types/ForgeRuntimeTypes.js';
import type { PromptPresetGenerationSettings } from '../../../types/PromptPresetTypes.js';
import type { ResolvedLorebookViewState } from '../../../types/LorebookViewTypes.js';
import { buildPromptPreviewAgentContext } from './forgePromptPreviewAgentContext.js';

interface ForgePromptPreviewContextService {
    buildPromptPreviewPayload(input: unknown): CleanedMessage[];
    buildPromptPreviewAssembly(input: unknown): PromptAssemblyResult;
    buildExecutorPreviewPayload(input: unknown): CleanedMessage[];
    buildExecutorPreviewAssembly(input: unknown): PromptAssemblyResult;
}

export interface ForgePromptPreviewPayloadBuilderDeps {
    getSelectedPresetId(): string | null;
    syncAutoChecklistToMemory(): void;
    fetchPresetDetail(presetId: string): Promise<unknown>;
    resolveActiveLorebookView(): ResolvedLorebookViewState;
    buildMemorySnapshot(): MemorySnapshot;
    getPrimaryIntent(): ForgeWorkflowIntent;
    getMessages(): LuminaChatMessage[];
    runAgentGraph(): Promise<ForgeAgentGraphResult | null>;
    getForgeMemoryTree(): ForgeMemoryTree;
    getStructuredState(): ForgeStructuredState;
    getDraftTree(): ForgeDraftTree;
    getWorkflowSnapshot(): ForgeWorkflowSnapshot | null;
    getCommitReadyEntries(): StagingEntry[];
    getStagingEntries(): StagingEntry[];
    resolveOriginalContent(targetEntryId: string | null): string;
    getSessionChatId(): string;
    getRuntimeContext(command: ForgeUserCommand, latestUserInput?: string): ForgeRuntimeContext;
    resolveRuntimePresetId(selectedPresetId?: string | null): string;
    buildRuntimeContextSnapshot(
        context: ForgeRuntimeContext,
        resolvedLorebookView: ResolvedLorebookViewState,
        memorySnapshot: MemorySnapshot,
        resolvedPresetId: string
    ): ForgeRequestContextSnapshot;
    summarizeRequestNodeSummary(presetId: string): ForgeRequestNodeSummaryItem[];
    resolvePromptPresetGenerationSettings(profileId: 'forge-agent'): PromptPresetGenerationSettings;
    generateRequestId(): string;
    previewPiPrompt(input: ForgePromptPreviewPiInput): Promise<ForgePromptPreviewPiResult>;
    promptContextService: ForgePromptPreviewContextService;
    logger?: Pick<Console, 'warn'>;
}

export class ForgePromptPreviewPayloadBuilder {
    private readonly logger: Pick<Console, 'warn'>;

    constructor(private readonly deps: ForgePromptPreviewPayloadBuilderDeps) {
        this.logger = deps.logger ?? console;
    }

    async buildPromptPreviewPayload(): Promise<ForgePromptPreviewBundle> {
        const selectedPresetId = this.deps.getSelectedPresetId();
        if (!selectedPresetId) {
            return this.buildEmptyPreviewBundle();
        }

        this.deps.syncAutoChecklistToMemory();

        const presetData = await this.deps.fetchPresetDetail(selectedPresetId);
        const resolvedLorebookView = this.deps.resolveActiveLorebookView();
        const memorySnapshot = this.deps.buildMemorySnapshot();
        const primaryIntent = this.deps.getPrimaryIntent();
        const previewMessages = this.deps.getMessages().map((message) => ({
            role: message.role as CleanedMessage['role'],
            content: message.mesRaw || message.mes || '',
            name: message.name
        }));
        const agentGraph = await this.safeRunAgentGraph();
        const forgeAgentSourceUnits = agentGraph?.promptSourceUnits ?? [];
        const sharedPreviewInput = {
            presetData,
            messages: previewMessages,
            resolvedLorebookEntries: resolvedLorebookView.entries,
            memorySnapshot,
            forgeMemoryTree: this.deps.getForgeMemoryTree(),
            structuredState: this.deps.getStructuredState(),
            draftTree: this.deps.getDraftTree(),
            workflowSnapshot: this.deps.getWorkflowSnapshot(),
            forgeAgentSourceUnits,
            intent: primaryIntent
        };
        const primaryAssembly = this.deps.promptContextService.buildPromptPreviewAssembly(sharedPreviewInput);
        const primaryAgentContext = agentGraph
            ? buildPromptPreviewAgentContext(agentGraph, primaryAssembly)
            : null;
        const piPreview = await this.previewPrimaryPiPrompt({
            primaryIntent,
            previewMessages,
            resolvedLorebookView,
            memorySnapshot,
            selectedPresetId
        });

        const executorSeed = this.resolveExecutorSeed();
        const executorInput = this.buildExecutorPreviewInput(executorSeed, selectedPresetId);
        const executorPayload = this.deps.promptContextService.buildExecutorPreviewPayload(executorInput);
        const executorAssembly = this.deps.promptContextService.buildExecutorPreviewAssembly(executorInput);

        return {
            primary: {
                key: 'primary',
                intent: primaryIntent,
                title: this.resolvePrimaryTitle(primaryIntent),
                subtitle: this.resolvePrimarySubtitle(primaryIntent),
                payload: piPreview.prompt,
                assembly: primaryAssembly,
                agent: primaryAgentContext,
                pi: {
                    requestId: piPreview.requestId,
                    systemPrompt: piPreview.systemPrompt,
                    contextBundleSummary: piPreview.contextBundleSummary,
                    loadedExtensions: piPreview.loadedExtensions,
                    activeTools: piPreview.activeTools,
                    piSessionState: piPreview.piSessionState
                },
                sourceLabel: this.deps.getWorkflowSnapshot()?.reason || '当前工作流快照',
                targetEntryId: null
            },
            executor: {
                key: 'executor',
                intent: 'edit',
                title: '子模型 / Executor',
                subtitle: `展示执行模型的隔离重写载荷。来源：${executorSeed.sourceLabel}`,
                payload: executorPayload,
                assembly: executorAssembly,
                sourceLabel: executorSeed.sourceLabel,
                targetEntryId: executorSeed.entry?.targetEntryId || null
            }
        };
    }

    private buildEmptyPreviewBundle(): ForgePromptPreviewBundle {
        return {
            primary: {
                key: 'primary',
                intent: 'planning',
                title: '主模型 / Planner',
                subtitle: '当前未选择预设，无法生成主模型提示词预览',
                payload: [],
                sourceLabel: null,
                targetEntryId: null
            },
            executor: {
                key: 'executor',
                intent: 'edit',
                title: '子模型 / Executor',
                subtitle: '当前未选择预设，执行模型仅能显示空预览',
                payload: [],
                sourceLabel: null,
                targetEntryId: null
            }
        };
    }

    private async previewPrimaryPiPrompt(input: {
        primaryIntent: ForgeWorkflowIntent;
        previewMessages: CleanedMessage[];
        resolvedLorebookView: ResolvedLorebookViewState;
        memorySnapshot: MemorySnapshot;
        selectedPresetId: string;
    }): Promise<Omit<ForgePromptPreviewPiResult, 'prompt'> & { prompt: CleanedMessage[] }> {
        const commandInput = this.resolvePreviewUserInput(input.previewMessages);
        const command = { type: 'send_user_input' as const, input: commandInput };
        const context = this.deps.getRuntimeContext(command, commandInput);
        const resolvedPresetId = this.deps.resolveRuntimePresetId(context.selectedPresetId ?? input.selectedPresetId);
        const request = {
            requestId: this.deps.generateRequestId(),
            traceSource: this.resolveTraceSource(input.primaryIntent),
            contextSnapshot: this.deps.buildRuntimeContextSnapshot(
                context,
                input.resolvedLorebookView,
                input.memorySnapshot,
                resolvedPresetId
            ),
            nodeSummary: this.deps.summarizeRequestNodeSummary(resolvedPresetId),
            generationSettings: this.deps.resolvePromptPresetGenerationSettings('forge-agent'),
            intent: input.primaryIntent,
            modelRoute: 'main' as const,
            messages: [],
            sessionChatId: this.deps.getSessionChatId(),
            charName: 'Forge Assistant',
            presetId: resolvedPresetId,
            sourceCommand: command
        };
        const preview = await this.deps.previewPiPrompt({
            command,
            commandInput,
            context,
            request
        });
        return {
            ...preview,
            prompt: this.coercePreviewPrompt(preview.prompt)
        };
    }

    private resolvePreviewUserInput(messages: CleanedMessage[]): string {
        const latestUser = [...messages].reverse().find(message => message.role === 'user');
        return latestUser?.content?.trim()
            || this.deps.getWorkflowSnapshot()?.recommendedAction
            || 'Prompt preview';
    }

    private coercePreviewPrompt(prompt: ForgePromptPreviewPiResult['prompt']): CleanedMessage[] {
        return prompt.map(message => ({
            role: message.role as CleanedMessage['role'],
            content: typeof message.content === 'string'
                ? message.content
                : JSON.stringify(message.content, null, 2),
            name: message.name
        }));
    }

    private resolveTraceSource(intent: ForgeWorkflowIntent): 'planner' | 'conversation' | 'analyst' {
        if (intent === 'conversation') return 'conversation';
        if (intent === 'analysis') return 'analyst';
        return 'planner';
    }

    private async safeRunAgentGraph(): Promise<ForgeAgentGraphResult | null> {
        try {
            return await this.deps.runAgentGraph();
        } catch (error) {
            this.logger.warn('[Forge-PromptPreview] Agent graph preview context failed:', error);
            return null;
        }
    }

    private resolveExecutorSeed(): { entry: StagingEntry | null; sourceLabel: string } {
        const latestCommitReady = this.deps.getCommitReadyEntries()[this.deps.getCommitReadyEntries().length - 1] || null;
        const latestStaging = this.deps.getStagingEntries()[this.deps.getStagingEntries().length - 1] || null;
        if (latestCommitReady) return { entry: latestCommitReady, sourceLabel: '写回准备条目' };
        if (latestStaging) return { entry: latestStaging, sourceLabel: '待审修改条目' };
        return { entry: null, sourceLabel: '模板示例' };
    }

    private buildExecutorPreviewInput(
        seed: { entry: StagingEntry | null },
        selectedPresetId: string
    ): Record<string, unknown> {
        const executorInstruction = seed.entry?.description?.trim()
            || '根据已批准的局部任务重写该条目，保持当前层目标一致。';
        const executorEntryId = seed.entry?.targetEntryId || 'preview.entry';
        const executorOriginalContent = seed.entry?.originalContent?.trim()
            || this.deps.resolveOriginalContent(seed.entry?.targetEntryId || null)
            || '当前还没有待执行的真实条目。这里展示的是执行模型模板，实际运行时会替换为目标条目原文。';
        return {
            instruction: executorInstruction,
            entryId: executorEntryId,
            originalContent: executorOriginalContent,
            sessionChatId: this.deps.getSessionChatId(),
            charName: 'Forge Assistant',
            presetId: selectedPresetId,
            sourceCommand: { type: 'noop' }
        };
    }

    private resolvePrimaryTitle(intent: ForgeWorkflowIntent): string {
        if (intent === 'conversation') return '主模型 / Conversation';
        if (intent === 'analysis') return '主模型 / Analysis';
        return '主模型 / Planner';
    }

    private resolvePrimarySubtitle(intent: ForgeWorkflowIntent): string {
        if (intent === 'conversation') {
            return '展示当前协作对话模式下 pi agent 实际合成后的完整消息载荷';
        }
        if (intent === 'analysis') {
            return '展示当前中间态分析模型经 pi agent 合成后的隔离上下文载荷';
        }
        return '展示当前规划模式下 pi agent 实际合成后的完整消息载荷';
    }
}
