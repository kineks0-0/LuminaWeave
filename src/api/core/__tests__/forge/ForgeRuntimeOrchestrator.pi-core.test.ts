import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ForgeRuntimeOrchestrator, type ForgeRuntimePort } from '@/api/core/forge/runtime/ForgeRuntimeOrchestrator.js';
import { ForgeWorkflowGraph } from '@/api/core/forge/graph/ForgeWorkflowGraph.js';
import type {
    ForgeExecutionRequest,
    ForgeRuntimeContext,
    ForgeRuntimeDecision,
    ForgeRuntimeEffect,
    ForgeRuntimeEvent
} from '@/types/ForgeRuntimeTypes.js';

const createContext = (): ForgeRuntimeContext => ({
    workspaceSessionId: 'forge_project_alpha',
    sessionChatId: 'conversation_alpha',
    workspaceTitle: 'Forge Alpha',
    selectedPresetId: 'forge-main',
    selectedChatSessionId: null,
    selectedChatSnapshotId: null,
    detailMode: 'quick',
    collectionMode: 'conversation',
    entryMode: null,
    activeLayer: 'concept',
    completedLayers: [],
    workflowSnapshot: null,
    publishState: 'drafting',
    activeLeafId: 'leaf_1',
    worldlineNodes: [],
    messages: [],
    timelineItems: [],
    structuredState: {} as never,
    draftTree: { nodes: [], lastUpdatedAt: 1 },
    forgeMemoryTree: { entries: [], lastUpdatedAt: 1 },
    stagingEntries: [],
    commitReadyEntries: [],
    virtualLorebookEntries: [],
    latestUserInput: 'hello',
    latestUserCommand: { type: 'send_user_input', input: 'hello' }
});

type TestRequestSource = 'planner' | 'analyst' | 'conversation' | 'executor';

const resolveIntent = (source: TestRequestSource): ForgeExecutionRequest['intent'] => {
    if (source === 'conversation') return 'conversation';
    if (source === 'analyst') return 'analysis';
    if (source === 'executor') return 'edit';
    return 'planning';
};

const createRequest = (source: TestRequestSource): ForgeExecutionRequest => ({
    requestId: `req_${source}`,
    traceSource: source,
    contextSnapshot: {
        kind: 'forge-runtime',
        workspaceTitle: 'Forge Alpha',
        detailMode: 'quick',
        activeLayer: 'concept',
        sourceCommand: { type: 'send_user_input', input: 'hello' },
        workflowSnapshot: null,
        historyMessages: [],
        referenceChatSessionId: null,
        referenceChatSnapshotId: null,
        lorebookEntries: [],
        memorySnapshot: null,
        selectedPresetId: 'forge-main',
        testChatPresetId: null,
        nexusPresetId: null
    },
    nodeSummary: [],
    generationSettings: {},
    intent: resolveIntent(source),
    modelRoute: source === 'executor' ? 'executor' : 'main',
    messages: [{ role: 'user', content: 'hello' }],
    sessionChatId: 'conversation_alpha',
    charName: 'Forge',
    presetId: 'forge-main',
    sourceCommand: { type: 'send_user_input', input: 'hello' }
});

const createPort = () => {
    const effects: ForgeRuntimeEffect[][] = [];
    const port: ForgeRuntimePort = {
        getRuntimeContext: vi.fn(() => createContext()),
        applyRuntimeEffects: vi.fn(async nextEffects => {
            effects.push(nextEffects);
        }),
        buildPlannerExecutionRequest: vi.fn(async () => createRequest('planner')),
        buildAnalystExecutionRequest: vi.fn(async () => createRequest('analyst')),
        buildConversationExecutionRequest: vi.fn(async () => createRequest('conversation')),
        buildExecutorExecutionRequest: vi.fn(async () => createRequest('executor')),
        prepareAssistantStream: vi.fn(),
        resolveOriginalContent: vi.fn(() => ''),
        resolveEntryComment: vi.fn(() => null)
    };
    return { port, effects };
};

const createPiSessionState = () => ({
    tree: [],
    entries: [],
    activeNodeId: null,
    contextBundleSummary: { files: [], activeSkills: [], loadedExtensions: [] },
    loadedExtensions: []
});

describe('ForgeRuntimeOrchestrator pi runtime', () => {
    beforeEach(() => {
        vi.restoreAllMocks();
    });

    it('applies Forge-only runtime events and persists the pi session state', async () => {
        vi.spyOn(ForgeWorkflowGraph, 'resolveDecision').mockResolvedValue({
            workflowSnapshot: {} as never,
            executionRequest: createRequest('conversation'),
            effects: [],
            requiresGeneration: true,
            requiresUserDecision: false
        } satisfies ForgeRuntimeDecision);
        const { port, effects } = createPort();
        const requestStarted: ForgeRuntimeEvent = {
            type: 'request_started',
            requestId: 'req_conversation',
            requestedAt: 1,
            nodeSummary: []
        };
        const runPiTurn = vi.fn(async (input: { onRuntimeEvent?: (event: ForgeRuntimeEvent) => void }) => {
            input.onRuntimeEvent?.(requestStarted);
            return {
                events: [requestStarted],
                piSessionState: createPiSessionState()
            };
        });

        const orchestrator = new ForgeRuntimeOrchestrator(port, undefined, undefined, { runPiTurn });
        await orchestrator.dispatch({ type: 'send_user_input', input: 'hello' });

        expect(runPiTurn).toHaveBeenCalledOnce();
        expect(effects.flat()).toEqual(expect.arrayContaining([
            expect.objectContaining({ type: 'set_active_model_request', requestId: 'req_conversation' }),
            expect.objectContaining({ type: 'set_forge_pi_session_state' }),
            expect.objectContaining({ type: 'refresh_workflow' }),
            expect.objectContaining({ type: 'persist_session' })
        ]));
        expect(effects.flat()).not.toEqual(expect.arrayContaining([
            expect.objectContaining({ type: 'project_agent_message' }),
            expect.objectContaining({ type: 'append_message' })
        ]));
    });

    it('applies a Forge approval event while leaving Agent Runtime message projection to the event bus', async () => {
        const { port, effects } = createPort();
        const resolvePiToolApproval = vi.fn(async () => ({
            resolved: true,
            events: [{
                type: 'tool_approval_resolved' as const,
                requestId: 'req_conversation',
                approvalId: 'approval-call_write',
                toolCallId: 'call_write',
                toolName: 'stageEntry',
                approved: false,
                message: '已拒绝',
                source: 'conversation' as const,
                sessionId: 'forge_project_alpha__conversation_alpha'
            }],
            effects: [],
            piSessionState: createPiSessionState()
        }));
        const orchestrator = new ForgeRuntimeOrchestrator(port, undefined, undefined, {
            resolvePiToolApproval
        });

        const handled = await orchestrator.resolveToolApproval(
            'forge_project_alpha__conversation_alpha',
            'req_conversation',
            'call_write',
            false,
            '已拒绝'
        );

        expect(handled).toBe(true);
        expect(resolvePiToolApproval).toHaveBeenCalledWith(
            'forge_project_alpha__conversation_alpha',
            'req_conversation',
            'call_write',
            false,
            '已拒绝'
        );
        expect(effects.flat()).toEqual(expect.arrayContaining([
            expect.objectContaining({ type: 'resolve_tool_approval', toolCallId: 'call_write', approved: false }),
            expect.objectContaining({ type: 'persist_session' })
        ]));
    });

    it('projects Forge approval-needed events without reintroducing legacy stream or tool transport events', async () => {
        vi.spyOn(ForgeWorkflowGraph, 'resolveDecision').mockResolvedValue({
            workflowSnapshot: {} as never,
            executionRequest: createRequest('conversation'),
            effects: [],
            requiresGeneration: true,
            requiresUserDecision: false
        } satisfies ForgeRuntimeDecision);
        const { port, effects } = createPort();
        const approvalNeeded: ForgeRuntimeEvent = {
            type: 'tool_approval_needed',
            requestId: 'req_conversation',
            approvalId: 'approval-call_network',
            toolCallId: 'call_network',
            toolName: 'bash',
            args: { command: 'curl https://example.com' },
            reason: '需要授权',
            source: 'conversation',
            sessionId: 'forge_project_alpha__conversation_alpha'
        };
        const runPiTurn = vi.fn(async (input: { onRuntimeEvent?: (event: ForgeRuntimeEvent) => void }) => {
            input.onRuntimeEvent?.(approvalNeeded);
            return { events: [], piSessionState: createPiSessionState() };
        });

        const orchestrator = new ForgeRuntimeOrchestrator(port, undefined, undefined, { runPiTurn });
        await orchestrator.dispatch({ type: 'send_user_input', input: 'hello' });

        expect(effects.flat()).toEqual(expect.arrayContaining([
            expect.objectContaining({ type: 'upsert_tool_approval' }),
            expect.objectContaining({ type: 'add_operation', status: 'blocked' })
        ]));
        expect(effects.flat()).not.toEqual(expect.arrayContaining([
            expect.objectContaining({ type: 'project_agent_message' }),
            expect.objectContaining({ type: 'append_model_request_tool_event', event: expect.objectContaining({ type: 'tool_call' }) })
        ]));
    });
});
