import { describe, expect, it, vi } from 'vitest';
import { ForgeAgentInspectorActions } from '../store/ForgeAgentInspectorActions.js';
import { AgentRuntimeEventBus } from '@/api/core/agent-runtime/events/AgentRuntimeEventBus.js';

const createActions = (overrides: Partial<ConstructorParameters<typeof ForgeAgentInspectorActions>[0]> = {}) => {
    const events = new AgentRuntimeEventBus();
    const runPiTurn = vi.fn(async () => {
        events.emit({ type: 'agent_start', sessionId: 'session-1__session-1', turnId: 'req-1' });
        events.emit({ type: 'turn_start', sessionId: 'session-1__session-1', turnId: 'req-1' });
        events.emit({
            type: 'message_start',
            sessionId: 'session-1__session-1',
            turnId: 'req-1',
            message: { id: 'agent-message:session-1__session-1:req-1:1', turnId: 'req-1', role: 'assistant', blocks: [] }
        });
        events.emit({
            type: 'message_update',
            sessionId: 'session-1__session-1',
            turnId: 'req-1',
            messageId: 'agent-message:session-1__session-1:req-1:1',
            block: { type: 'text', contentIndex: 0, text: 'partial' }
        });
        events.emit({
            type: 'message_update',
            sessionId: 'session-1__session-1',
            turnId: 'req-1',
            messageId: 'agent-message:session-1__session-1:req-1:1',
            block: { type: 'text', contentIndex: 0, text: 'done' }
        });
        events.emit({
            type: 'message_end',
            sessionId: 'session-1__session-1',
            turnId: 'req-1',
            messageId: 'agent-message:session-1__session-1:req-1:1'
        });
        events.emit({ type: 'turn_end', sessionId: 'session-1__session-1', turnId: 'req-1' });
        events.emit({ type: 'agent_end', sessionId: 'session-1__session-1', turnId: 'req-1' });
        return { events: [] };
    });
    const setLastAgentGraphResult = vi.fn();
    const actions = new ForgeAgentInspectorActions({
        runAgentGraph: vi.fn().mockResolvedValue({ promptSourceUnits: [{ id: 'unit-1' }] }),
        setLastAgentGraphResult,
        getAgentInspectorInput: () => 'inspect',
        getWorkflowSnapshot: () => ({ recommendedAction: 'next' } as any),
        serializeSession: () => ({ id: 'session' } as any),
        getRuntimeContext: (input) => ({
            workspaceSessionId: 'session-1',
            sessionChatId: 'session-1',
            selectedPresetId: 'preset-1',
            latestUserCommand: { type: 'send_user_input', input },
            latestUserInput: input
        } as any),
        buildExecutorExecutionRequest: vi.fn().mockReturnValue({ messages: [{ role: 'user', content: 'executor' }] }),
        fetchPresetDetail: vi.fn().mockResolvedValue({ preset: {} }),
        resolveActiveLorebookView: () => ({ entries: [] } as any),
        buildMemorySnapshot: () => ({ sourceId: 'forge' } as any),
        getLastAgentGraphSourceUnits: () => [{ id: 'unit-1' }] as any,
        getForgeMemoryTree: () => ({ entries: [] } as any),
        getStructuredState: () => ({ forms: {} } as any),
        getDraftTree: () => ({ nodes: [] } as any),
        buildPlannerPrompt: vi.fn().mockReturnValue([{ role: 'user', content: 'planner' }]),
        buildAnalystPrompt: vi.fn().mockReturnValue([{ role: 'user', content: 'analyst' }]),
        buildConversationPrompt: vi.fn().mockReturnValue([{ role: 'user', content: 'conversation' }]),
        cleanMessages: (messages) => messages as any,
        resolvePromptPresetGenerationSettings: vi.fn().mockReturnValue({ temperature: 0.7 } as any),
        resolveRuntimePresetId: () => 'preset-1',
        buildRuntimeContextSnapshot: vi.fn().mockReturnValue({ kind: 'forge-runtime' } as any),
        summarizeRequestNodeSummary: vi.fn().mockReturnValue([{ provider: 'test', model: null, label: 'test' }]),
        generateRequestId: () => 'req-1',
        getSessionChatId: () => 'session-1',
        runPiTurn,
        subscribeAgentRuntimeEvents: (filter, listener) => events.subscribe(filter, listener),
        getAgentRuntimeSnapshot: sessionId => events.getSnapshot(sessionId),
        logger: { warn: vi.fn() },
        ...overrides
    });
    return { actions, runPiTurn, setLastAgentGraphResult };
};

describe('ForgeAgentInspectorActions', () => {
    it('captures agent graph snapshot for inspector panel', async () => {
        const { actions, setLastAgentGraphResult } = createActions();

        await actions.captureAgentGraphSnapshot();

        expect(setLastAgentGraphResult).toHaveBeenCalledWith({ promptSourceUnits: [{ id: 'unit-1' }] });
    });

    it('runs planner agent test through pi runtime and streams chunks', async () => {
        const onChunk = vi.fn();
        const { actions, runPiTurn } = createActions();

        const result = await actions.runAgentTest('planner', '测试输入', onChunk);

        expect(runPiTurn).toHaveBeenCalledWith(expect.objectContaining({
            command: { type: 'send_user_input', input: '测试输入' },
            commandInput: '测试输入',
            request: expect.objectContaining({
                requestId: 'req-1',
                traceSource: 'planner',
                messages: [{ role: 'user', content: 'planner' }],
                presetId: 'preset-1'
            })
        }));
        expect(onChunk).toHaveBeenCalledWith('', 'partial');
        expect(result).toEqual({ rawText: 'done' });
    });
});
