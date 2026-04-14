import { describe, it, expect, vi, beforeEach } from 'vitest';
import { llmEngine } from '../llmEngine.js';
import { LuminaGenerationTask } from '../core/LuminaGenerationTask.js';

// 提前模拟 lwStorage 以免触发真正的存储访问
vi.mock('../storage.js', () => ({
    lwStorage: {
        get: vi.fn((key: string, defValue: any) => {
            if (key === 'nexus.useSSE') return true;
            return defValue;
        }),
        set: vi.fn(),
        _getContextIds: vi.fn().mockReturnValue({ chatId: 'chat_1' })
    }
}));

describe('LuminaWeave LLM Engine Refactored Verification', () => {
    let mockNexus: any;

    beforeEach(() => {
        vi.clearAllMocks();

        mockNexus = {
            generateStream: vi.fn(async (payload: any, callbacks: any) => {
                callbacks.onChunk?.(' line1', ' line1');
                callbacks.onChunk?.('    line2', ' line1    line2');
                callbacks.onDone?.({ status: 'success', fullText: ' line1    line2' });
            }),
            fetchModels: vi.fn().mockResolvedValue(['model-a', 'model-b']),
            fetchStatus: vi.fn()
        };
    });

    it('should run task and update session correctly', async () => {
        const session = llmEngine.createSession({
            chatId: 'chat_1',
            charName: 'TestBot',
            parentId: 'msg_123',
            nodes: []
        });

        const task = new LuminaGenerationTask(session);
        // 强制注入 Mock
        (task as any).nexus = mockNexus;

        const onChunk = vi.fn();
        const onDone = vi.fn();

        await task.run(
            [{ role: 'user', content: 'test' }],
            { onChunk, onDone }
        );

        // 验证 Mock 被正确调用
        expect(mockNexus.generateStream).toHaveBeenCalled();
        const [payload] = mockNexus.generateStream.mock.calls[0];
        expect(payload.chatId).toBe('chat_1');
        expect(payload.parentId).toBe('msg_123');

        // 验证 Session 状态更新
        expect(session.finalText).toBe(' line1    line2');
        expect(session.isCompleted).toBe(true);

        // 验证回调
        expect(onChunk).toHaveBeenCalledWith(' line1', ' line1');
        expect(onDone).toHaveBeenCalledWith(' line1    line2');
    });

    it('should handle fetchProviderModels correctly', async () => {
        // 由于 fetchProviderModels 内部 new 了 NexusClient，这里需要 mock 构造函数或注入
        (llmEngine as any).nexus = mockNexus; 
        const models = await llmEngine.fetchProviderModels('test-api', 'DeepSeek');
        expect(models['DeepSeek (后端获取)']).toHaveLength(2);
        expect(models['DeepSeek (后端获取)'][0].value).toBe('model-a');
    });

    it('should not have legacy methods after cleanup', () => {
        expect((llmEngine as any).stPresetManager).toBeUndefined();
        expect((llmEngine as any).getClient).toBeUndefined();
        expect((llmEngine as any).init).toBeUndefined();
        expect((llmEngine as any).generateCustomStream).toBeUndefined();
    });
});
