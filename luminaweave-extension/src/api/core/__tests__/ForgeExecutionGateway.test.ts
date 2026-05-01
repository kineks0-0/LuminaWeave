import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ForgeRuntimeEvent } from '../../../types/ForgeRuntimeTypes';

const {
    resolveNodesFromPreset,
    createSession,
    cleanMessages,
    storageGet,
    runTask
} = vi.hoisted(() => ({
    resolveNodesFromPreset: vi.fn(() => [{ id: 'node-1', provider: 'openai', model: 'gpt-test' }]),
    createSession: vi.fn((options) => ({ options })),
    cleanMessages: vi.fn((messages) => messages),
    storageGet: vi.fn(() => 'global-chat-preset'),
    runTask: vi.fn(async (_messages, hooks?: { onDone?: (fullText: string) => void }) => {
        hooks?.onDone?.('最终回复');
    })
}));

vi.mock('../../llmEngine', () => ({
    llmEngine: {
        resolveNodesFromPreset,
        createSession,
        cleanMessages
    }
}));

vi.mock('../../storage', () => ({
    lwStorage: {
        get: storageGet
    }
}));

vi.mock('../LuminaGenerationTask', () => ({
    LuminaGenerationTask: vi.fn().mockImplementation(function MockLuminaGenerationTask(_session: unknown) {
        return {
            run: runTask
        };
    })
}));

import { ForgeExecutionGateway } from '../ForgeExecutionGateway';

describe('ForgeExecutionGateway', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        resolveNodesFromPreset.mockReturnValue([{ id: 'node-1', provider: 'openai', model: 'gpt-test' }]);
        createSession.mockImplementation((options) => ({ options }));
        cleanMessages.mockImplementation((messages) => messages);
        storageGet.mockReturnValue('global-chat-preset');
        runTask.mockImplementation(async (_messages, hooks?: { onDone?: (fullText: string) => void }) => {
            hooks?.onDone?.('最终回复');
        });
    });

    it('应优先使用 Forge 执行请求里的 presetId', async () => {
        const gateway = new ForgeExecutionGateway();
        const seenEvents: ForgeRuntimeEvent[] = [];

        await gateway.run({
            requestId: 'req_planner',
            traceSource: 'planner',
            contextSnapshot: {
                kind: 'forge-runtime',
                workspaceTitle: 'Forge Workspace',
                detailMode: 'quick',
                activeLayer: 'concept',
                sourceCommand: { type: 'send_user_input', input: '请继续' },
                workflowSnapshot: null,
                historyMessages: [],
                referenceChatSessionId: null,
                referenceChatSnapshotId: null,
                lorebookEntries: [],
                memorySnapshot: null,
                selectedPresetId: 'forge-preset-1',
                testChatPresetId: null,
                nexusPresetId: null
            },
            nodeSummary: [{ provider: 'openai', model: 'gpt-test', label: 'openai / gpt-test' }],
            generationSettings: { temperature: 0.7 },
            mode: 'planner',
            messages: [{ role: 'user', content: '请继续' }],
            sessionChatId: 'forge_session_1',
            charName: 'Forge Assistant',
            presetId: 'forge-preset-1',
            sourceCommand: { type: 'send_user_input', input: '请继续' }
        }, {
            onEvent: (event) => seenEvents.push(event)
        });

        expect(resolveNodesFromPreset).toHaveBeenCalledWith('forge-preset-1');
        // 允许用于诊断日志的 storageGet 调用，但不应影响最终解析出的预设 ID
        expect(storageGet).toHaveBeenCalledWith('lumina-forge.nexusPreset', '', 'Global');
        expect(seenEvents.map((event) => event.type)).toEqual([
            'request_started',
            'prompt_ready',
            'stream_done'
        ]);
    });

    it('在未提供 Forge 预设时才回退到全局聊天预设', async () => {
        const gateway = new ForgeExecutionGateway();

        await gateway.run({
            requestId: 'req_planner_fallback',
            traceSource: 'planner',
            contextSnapshot: {
                kind: 'forge-runtime',
                workspaceTitle: 'Forge Workspace',
                detailMode: 'quick',
                activeLayer: 'concept',
                sourceCommand: { type: 'send_user_input', input: '请继续' },
                workflowSnapshot: null,
                historyMessages: [],
                referenceChatSessionId: null,
                referenceChatSnapshotId: null,
                lorebookEntries: [],
                memorySnapshot: null,
                selectedPresetId: null,
                testChatPresetId: null,
                nexusPresetId: null
            },
            nodeSummary: [{ provider: 'openai', model: 'gpt-test', label: 'openai / gpt-test' }],
            generationSettings: {},
            mode: 'planner',
            messages: [{ role: 'user', content: '请继续' }],
            sessionChatId: 'forge_session_1',
            charName: 'Forge Assistant',
            sourceCommand: { type: 'send_user_input', input: '请继续' }
        });

        expect(storageGet).toHaveBeenCalledWith('lumina-chat.nexusPreset', 'Global', 'Global');
        expect(resolveNodesFromPreset).toHaveBeenCalledWith('global-chat-preset');
    });

    it('should emit request lifecycle in order and only mark first_response once', async () => {
        runTask.mockImplementationOnce(async (_messages, hooks?: {
            onChunk?: (chunk: string, fullText: string) => void;
            onDone?: (fullText: string) => void;
        }) => {
            hooks?.onChunk?.('a', 'a');
            hooks?.onChunk?.('b', 'ab');
            hooks?.onDone?.('ab');
        });

        const gateway = new ForgeExecutionGateway();
        const seenEvents: ForgeRuntimeEvent[] = [];

        await gateway.run({
            requestId: 'req_lifecycle',
            traceSource: 'planner',
            contextSnapshot: {
                kind: 'forge-runtime',
                workspaceTitle: 'Forge Workspace',
                detailMode: 'quick',
                activeLayer: 'concept',
                sourceCommand: { type: 'send_user_input', input: 'trace' },
                workflowSnapshot: null,
                historyMessages: [],
                referenceChatSessionId: null,
                referenceChatSnapshotId: null,
                lorebookEntries: [],
                memorySnapshot: null,
                selectedPresetId: 'forge-preset-1',
                testChatPresetId: null,
                nexusPresetId: null
            },
            nodeSummary: [{ provider: 'openai', model: 'gpt-test', label: 'openai / gpt-test' }],
            generationSettings: { temperature: 0.33, top_p: 0.95, top_k: 32 },
            mode: 'planner',
            messages: [{ role: 'user', content: 'trace' }],
            sessionChatId: 'forge_session_trace',
            charName: 'Forge Assistant',
            presetId: 'forge-preset-1',
            sourceCommand: { type: 'send_user_input', input: 'trace' }
        }, {
            onEvent: (event) => seenEvents.push(event)
        });

        expect(seenEvents.map((event) => event.type)).toEqual([
            'request_started',
            'prompt_ready',
            'first_response',
            'stream_chunk',
            'stream_chunk',
            'stream_done'
        ]);
        expect(seenEvents.filter((event) => event.type === 'first_response')).toHaveLength(1);
        expect(runTask).toHaveBeenCalledWith(
            [{ role: 'user', content: 'trace' }],
            expect.any(Object),
            { temperature: 0.33, top_p: 0.95, top_k: 32 }
        );
    });
});
