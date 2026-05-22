import type { ForgeAgentGraphResult, ForgeAgentPromptSourceUnit } from '../../../api/core/forge/graph/ForgeAgentGraphRuntime.js';
import type {
    ForgeExecutionRequest,
    ForgeRequestContextSnapshot,
    ForgeRequestNodeSummaryItem,
    ForgeRuntimeContext,
    ForgeRuntimeEvent,
    ForgeUserCommand
} from '../../../types/ForgeRuntimeTypes.js';
import type { ForgeMemoryTree } from '../../../types/ForgeMemoryTypes.js';
import type { ForgeDraftTree, ForgeStructuredState } from '../../../types/ForgeStructuredTypes.js';
import type { ForgeWorkflowSnapshot } from '../../../types/ForgeWorkflowTypes.js';
import type { MemorySnapshot } from '../../../types/MemorySnapshotTypes.js';
import type { CleanedMessage } from '../../../types/nexus.js';
import type { PromptPresetGenerationSettings } from '../../../types/PromptPresetTypes.js';
import type { ResolvedLorebookViewState } from '../../../types/LorebookViewTypes.js';

export type ForgeAgentInspectorMode = 'planner' | 'executor' | 'analyst' | 'conversation';

export interface ForgeAgentInspectorActionsDeps {
    runAgentGraph(input: {
        session: unknown;
        userInput: string;
        workflowSnapshot: ForgeWorkflowSnapshot | null;
    }): Promise<ForgeAgentGraphResult>;
    setLastAgentGraphResult(graph: ForgeAgentGraphResult): void;
    getAgentInspectorInput(): string;
    getWorkflowSnapshot(): ForgeWorkflowSnapshot | null;
    serializeSession(): unknown;
    getRuntimeContext(input: string): ForgeRuntimeContext;
    buildExecutorExecutionRequest(input: Record<string, unknown>): { messages: CleanedMessage[] };
    fetchPresetDetail(presetId: string | null): Promise<unknown>;
    resolveActiveLorebookView(): ResolvedLorebookViewState;
    buildMemorySnapshot(): MemorySnapshot;
    getLastAgentGraphSourceUnits(): ForgeAgentPromptSourceUnit[];
    getForgeMemoryTree(): ForgeMemoryTree;
    getStructuredState(): ForgeStructuredState;
    getDraftTree(): ForgeDraftTree;
    buildPlannerPrompt(input: Record<string, unknown>): CleanedMessage[];
    buildAnalystPrompt(input: Record<string, unknown>): CleanedMessage[];
    buildConversationPrompt(input: Record<string, unknown>): CleanedMessage[];
    cleanMessages(messages: CleanedMessage[]): CleanedMessage[];
    resolvePromptPresetGenerationSettings(profileId: 'forge-main' | 'forge-executor'): PromptPresetGenerationSettings;
    resolveRuntimePresetId(selectedPresetId?: string | null): string;
    buildRuntimeContextSnapshot(
        context: ForgeRuntimeContext,
        resolvedLorebookView: ResolvedLorebookViewState,
        memorySnapshot: MemorySnapshot,
        resolvedPresetId: string
    ): ForgeRequestContextSnapshot;
    summarizeRequestNodeSummary(presetId: string): ForgeRequestNodeSummaryItem[];
    generateRequestId(): string;
    getSessionChatId(): string;
    runPiTurn(input: {
        command: ForgeUserCommand;
        commandInput?: string;
        context: ForgeRuntimeContext;
        request: ForgeExecutionRequest;
    }): Promise<{ events?: ForgeRuntimeEvent[] }>;
    logger?: Pick<Console, 'warn'>;
}

export class ForgeAgentInspectorActions {
    private readonly logger: Pick<Console, 'warn'>;

    constructor(private readonly deps: ForgeAgentInspectorActionsDeps) {
        this.logger = deps.logger ?? console;
    }

    async captureAgentGraphSnapshot(): Promise<void> {
        try {
            const graph = await this.deps.runAgentGraph({
                session: this.deps.serializeSession(),
                userInput: this.deps.getAgentInspectorInput().trim()
                    || this.deps.getWorkflowSnapshot()?.recommendedAction
                    || 'Agent inspector refresh',
                workflowSnapshot: this.deps.getWorkflowSnapshot()
            });
            this.deps.setLastAgentGraphResult(graph);
        } catch (error) {
            this.logger.warn('[Forge-AgentInspector] Agent graph capture failed:', error);
        }
    }

    async runAgentTest(
        mode: ForgeAgentInspectorMode,
        testInput: string,
        onChunk?: (chunk: string, fullText: string) => void
    ): Promise<{ rawText: string }> {
        const contextSnapshot = this.deps.getRuntimeContext(testInput);
        const messages = await this.buildMessages(mode, testInput, contextSnapshot);
        const cleanedMessages = this.deps.cleanMessages(messages);
        const generationSettings = this.deps.resolvePromptPresetGenerationSettings(
            mode === 'executor' ? 'forge-executor' : 'forge-main'
        );
        const resolvedLorebookView = this.deps.resolveActiveLorebookView();
        const memorySnapshot = this.deps.buildMemorySnapshot();
        const resolvedPresetId = this.deps.resolveRuntimePresetId(contextSnapshot.selectedPresetId);
        const request: ForgeExecutionRequest = {
            requestId: this.deps.generateRequestId(),
            traceSource: mode,
            contextSnapshot: this.deps.buildRuntimeContextSnapshot(contextSnapshot, resolvedLorebookView, memorySnapshot, resolvedPresetId),
            nodeSummary: this.deps.summarizeRequestNodeSummary(resolvedPresetId),
            generationSettings,
            mode,
            messages: cleanedMessages,
            sessionChatId: this.deps.getSessionChatId(),
            charName: 'Forge Assistant',
            presetId: resolvedPresetId,
            sourceCommand: { type: 'send_user_input', input: testInput }
        };
        const result = await this.deps.runPiTurn({
            command: { type: 'send_user_input', input: testInput },
            commandInput: testInput,
            context: contextSnapshot,
            request
        });
        for (const event of result.events ?? []) {
            if (event.type === 'stream_chunk') {
                onChunk?.('', event.displayText);
            }
        }
        const done = (result.events ?? []).find(event => event.type === 'stream_done');
        return { rawText: done?.rawText ?? '' };
    }

    private async buildMessages(
        mode: ForgeAgentInspectorMode,
        testInput: string,
        contextSnapshot: ForgeRuntimeContext
    ): Promise<CleanedMessage[]> {
        if (mode === 'executor') {
            return this.deps.buildExecutorExecutionRequest({
                instruction: testInput,
                entryId: 'agent_test_entry',
                originalContent: '(测试用空内容)',
                sessionChatId: this.deps.getSessionChatId(),
                charName: 'Forge Assistant',
                presetId: this.deps.resolveRuntimePresetId(contextSnapshot.selectedPresetId),
                sourceCommand: { type: 'send_user_input', input: testInput }
            }).messages;
        }

        const presetData = await this.deps.fetchPresetDetail(contextSnapshot.selectedPresetId);
        const resolvedLorebookView = this.deps.resolveActiveLorebookView();
        const memorySnapshot = this.deps.buildMemorySnapshot();
        const buildShared = {
            presetData,
            messages: [{ role: 'user' as const, content: testInput, name: 'You' }],
            resolvedLorebookEntries: resolvedLorebookView.entries,
            memorySnapshot,
            forgeMemoryTree: this.deps.getForgeMemoryTree(),
            structuredState: this.deps.getStructuredState(),
            draftTree: this.deps.getDraftTree(),
            workflowSnapshot: this.deps.getWorkflowSnapshot(),
            forgeAgentSourceUnits: this.deps.getLastAgentGraphSourceUnits(),
            maxRecentMessages: 0,
            maxHistoryMessages: 0
        };

        if (mode === 'analyst') return this.deps.buildAnalystPrompt(buildShared);
        if (mode === 'conversation') return this.deps.buildConversationPrompt(buildShared);
        return this.deps.buildPlannerPrompt(buildShared);
    }
}
