import { describe, expect, it, vi } from 'vitest';
import { ForgeAgentInspectorActions } from '../store/ForgeAgentInspectorActions.js';

const createActions = (overrides: Partial<ConstructorParameters<typeof ForgeAgentInspectorActions>[0]> = {}) => {
    const runPiTurn = vi.fn().mockResolvedValue({
        events: [
            { type: 'stream_chunk', requestId: 'req-1', displayText: 'partial', thinkingText: '', rawText: 'partial' },
            { type: 'stream_done', requestId: 'req-1', displayText: 'done', thinkingText: '', rawText: 'done', completedAt: 1 }
        ]
    });
    const setLastAgentGraphResult = vi.fn();
    const actions = new ForgeAgentInspectorActions({
        runAgentGraph: vi.fn().mockResolvedValue({ promptSourceUnits: [{ id: 'unit-1' }] }),
        setLastAgentGraphResult,
        getAgentInspectorInput: () => 'inspect',
        getWorkflowSnapshot: () => ({ recommendedAction: 'next' } as any),
        serializeSession: () => ({ id: 'session' } as any),
        getRuntimeContext: (input) => ({
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
