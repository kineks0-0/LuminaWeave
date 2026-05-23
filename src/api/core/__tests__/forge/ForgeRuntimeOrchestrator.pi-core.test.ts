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
    structuredState: {} as any,
    draftTree: { nodes: [], lastUpdatedAt: 1 },
    forgeMemoryTree: { entries: [], lastUpdatedAt: 1 },
    stagingEntries: [],
    commitReadyEntries: [],
    virtualLorebookEntries: [],
    latestUserInput: 'hello',
    latestUserCommand: { type: 'send_user_input', input: 'hello' }
});

const createRequest = (mode: ForgeExecutionRequest['mode']): ForgeExecutionRequest => ({
    requestId: `req_${mode}`,
    traceSource: mode === 'conversation' ? 'conversation' : 'planner',
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
    mode,
    messages: [{ role: 'user', content: 'hello' }],
    sessionChatId: 'conversation_alpha',
    charName: 'Forge',
    presetId: 'forge-main',
    sourceCommand: { type: 'send_user_input', input: 'hello' }
});

const createPort = () => {
    const effects: ForgeRuntimeEffect[][] = [];
    const events: ForgeRuntimeEvent[] = [];
    const port: ForgeRuntimePort = {
        getRuntimeContext: vi.fn(() => createContext()),
        applyRuntimeEffects: vi.fn(async (nextEffects) => {
            effects.push(nextEffects);
        }),
        buildPlannerExecutionRequest: vi.fn(async () => createRequest('planner')),
        buildAnalystExecutionRequest: vi.fn(async () => createRequest('analyst')),
        buildConversationExecutionRequest: vi.fn(async () => createRequest('conversation')),
        buildExecutorExecutionRequest: vi.fn(async () => createRequest('executor')),
        prepareAssistantStream: vi.fn(),
        handleRuntimeEvent: vi.fn((event) => {
            events.push(event);
        }),
        resolveOriginalContent: vi.fn(() => ''),
        resolveEntryComment: vi.fn(() => null)
    };
    return { port, effects, events };
};

describe('ForgeRuntimeOrchestrator pi runtime', () => {
    beforeEach(() => {
        vi.restoreAllMocks();
    });

    it('always sends runtime requests to the pi runtime client', async () => {
        vi.spyOn(ForgeWorkflowGraph, 'resolveDecision').mockResolvedValue({
            workflowSnapshot: {} as any,
            executionRequest: createRequest('conversation'),
            effects: [],
            requiresGeneration: true,
            requiresUserDecision: false
        } satisfies ForgeRuntimeDecision);
        const { port, effects } = createPort();
        const runPiTurn = vi.fn(async () => ({
            events: [{
                type: 'stream_done' as const,
                requestId: 'req_conversation',
                rawText: 'pi reply',
                displayText: 'pi reply',
                thinkingText: '',
                completedAt: 1
            }],
            piSessionState: {
                tree: [{
                    id: 'pi_node_1',
                    sessionId: 'forge_project_alpha__conversation_alpha',
                    parentId: null,
                    kind: 'metadata' as const,
                    title: 'Forge pi session',
                    summary: 'metadata',
                    createdAt: 1,
                    payload: {},
                    children: []
                }],
                activeNodeId: 'pi_node_1',
                contextBundleSummary: {
                    files: [],
                    activeSkills: ['虚拟世界书编辑'],
                    loadedExtensions: ['@luminaweave/pi-forge-browser']
                },
                loadedExtensions: ['@luminaweave/pi-forge-browser']
            }
        }));

        const orchestrator = new ForgeRuntimeOrchestrator(port, undefined, undefined, { runPiTurn });

        await orchestrator.dispatch({ type: 'send_user_input', input: 'hello' });

        expect(runPiTurn).toHaveBeenCalledOnce();
        expect(effects.flat()).toEqual(expect.arrayContaining([
            expect.objectContaining({ type: 'set_forge_pi_session_state' }),
            expect.objectContaining({ type: 'complete_model_request', requestId: 'req_conversation' })
        ]));
    });

    it('forwards pi stream chunks to the UI before the turn completes', async () => {
        vi.spyOn(ForgeWorkflowGraph, 'resolveDecision').mockResolvedValue({
            workflowSnapshot: {} as any,
            executionRequest: createRequest('conversation'),
            effects: [],
            requiresGeneration: true,
            requiresUserDecision: false
        } satisfies ForgeRuntimeDecision);
        const { port, events } = createPort();
        const turnGate: { resolve: () => void } = { resolve: () => {} };
        const turnCanFinish = new Promise<void>((resolve) => {
            turnGate.resolve = resolve;
        });
        const runPiTurn = vi.fn(async (input: any) => {
            input.onRuntimeEvent?.({
                type: 'stream_chunk',
                requestId: 'req_conversation',
                rawText: 'partial',
                displayText: 'partial',
                thinkingText: ''
            });
            await turnCanFinish;
            return {
                events: [{
                    type: 'stream_done' as const,
                    requestId: 'req_conversation',
                    rawText: 'final',
                    displayText: 'final',
                    thinkingText: '',
                    completedAt: 1
                }],
                piSessionState: {
                    tree: [],
                    entries: [],
                    activeNodeId: null,
                    contextBundleSummary: {
                        files: [],
                        activeSkills: [],
                        loadedExtensions: []
                    },
                    loadedExtensions: []
                }
            };
        });

        const orchestrator = new ForgeRuntimeOrchestrator(port, undefined, undefined, { runPiTurn });
        const dispatchPromise = orchestrator.dispatch({ type: 'send_user_input', input: 'hello' });

        await vi.waitFor(() => expect(runPiTurn).toHaveBeenCalledOnce());
        expect(events).toEqual([expect.objectContaining({
            type: 'stream_chunk',
            displayText: 'partial'
        })]);

        turnGate.resolve();
        await dispatchPromise;
    });

    it('applies pi tool-call effects before the turn completes', async () => {
        vi.spyOn(ForgeWorkflowGraph, 'resolveDecision').mockResolvedValue({
            workflowSnapshot: {} as any,
            executionRequest: createRequest('conversation'),
            effects: [],
            requiresGeneration: true,
            requiresUserDecision: false
        } satisfies ForgeRuntimeDecision);
        const { port, effects } = createPort();
        const turnGate: { resolve: () => void } = { resolve: () => {} };
        const turnCanFinish = new Promise<void>((resolve) => {
            turnGate.resolve = resolve;
        });
        const runPiTurn = vi.fn(async (input: any) => {
            input.onRuntimeEvent?.({
                type: 'tool_call',
                requestId: 'req_conversation',
                toolCallId: 'call_read',
                toolName: 'readFile',
                args: { path: './AGENTS.md' },
                source: 'conversation'
            });
            await turnCanFinish;
            return {
                events: [{
                    type: 'tool_result' as const,
                    requestId: 'req_conversation',
                    toolCallId: 'call_read',
                    toolName: 'readFile',
                    result: { content: 'ok' },
                    isError: false,
                    source: 'conversation' as const
                }],
                piSessionState: {
                    tree: [],
                    entries: [],
                    activeNodeId: null,
                    contextBundleSummary: {
                        files: [],
                        activeSkills: [],
                        loadedExtensions: []
                    },
                    loadedExtensions: []
                }
            };
        });

        const orchestrator = new ForgeRuntimeOrchestrator(port, undefined, undefined, { runPiTurn });
        const dispatchPromise = orchestrator.dispatch({ type: 'send_user_input', input: 'hello' });

        await vi.waitFor(() => expect(effects.flat()).toEqual(expect.arrayContaining([
            expect.objectContaining({
                type: 'upsert_running_operation',
                dedupeKey: 'forge-operation:tool:call_read',
                title: '正在调用工具 · readFile'
            })
        ])));
        expect(effects.flat()).not.toEqual(expect.arrayContaining([
            expect.objectContaining({ type: 'complete_operation', dedupeKey: 'forge-operation:tool:call_read' })
        ]));

        turnGate.resolve();
        await dispatchPromise;
    });

    it('resolves tool approvals through the pi runtime and applies returned events/effects', async () => {
        const { port, effects, events } = createPort();
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
                source: 'conversation' as const
            }],
            effects: []
        }));

        const orchestrator = new ForgeRuntimeOrchestrator(port, undefined, undefined, {
            resolvePiToolApproval
        });

        const handled = await orchestrator.resolveToolApproval('call_write', false, '已拒绝');

        expect(handled).toBe(true);
        expect(resolvePiToolApproval).toHaveBeenCalledWith('call_write', false, '已拒绝');
        expect(events).toEqual([expect.objectContaining({
            type: 'tool_approval_resolved',
            toolCallId: 'call_write',
            approved: false
        })]);
        expect(effects.flat()).toEqual(expect.arrayContaining([
            expect.objectContaining({ type: 'resolve_tool_approval', toolCallId: 'call_write', approved: false }),
            expect.objectContaining({ type: 'persist_session' })
        ]));
        expect(effects.flat()).not.toEqual(expect.arrayContaining([
            expect.objectContaining({ type: 'upsert_staging_entry' })
        ]));
    });
});
