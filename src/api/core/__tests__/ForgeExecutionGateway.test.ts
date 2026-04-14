import { beforeEach, describe, expect, it, vi } from 'vitest';

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

        await gateway.run({
            mode: 'planner',
            messages: [{ role: 'user', content: '请继续' }],
            sessionChatId: 'forge_session_1',
            charName: 'Forge Assistant',
            presetId: 'forge-preset-1',
            sourceCommand: { type: 'send_user_input', input: '请继续' }
        });

        expect(resolveNodesFromPreset).toHaveBeenCalledWith('forge-preset-1');
        // 允许用于诊断日志的 storageGet 调用，但不应影响最终解析出的预设 ID
        expect(storageGet).toHaveBeenCalledWith('lumina-forge.nexusPreset', '', 'Global');
    });

    it('在未提供 Forge 预设时才回退到全局聊天预设', async () => {
        const gateway = new ForgeExecutionGateway();

        await gateway.run({
            mode: 'planner',
            messages: [{ role: 'user', content: '请继续' }],
            sessionChatId: 'forge_session_1',
            charName: 'Forge Assistant',
            sourceCommand: { type: 'send_user_input', input: '请继续' }
        });

        expect(storageGet).toHaveBeenCalledWith('lumina-chat.nexusPreset', 'Global', 'Global');
        expect(resolveNodesFromPreset).toHaveBeenCalledWith('global-chat-preset');
    });
});
