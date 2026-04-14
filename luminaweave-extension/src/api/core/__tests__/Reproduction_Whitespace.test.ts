import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NexusClient, StreamCallbacks } from '../NexusClient.js';
import { fetchEventSource } from '@microsoft/fetch-event-source';

// Mock fetchEventSource
vi.mock('@microsoft/fetch-event-source', () => ({
    fetchEventSource: vi.fn()
}));

vi.mock('../st-adapter/STClient.js', () => ({
    STClient: {
        getCsrfToken: vi.fn().mockResolvedValue('test-csrf-token')
    }
}));

describe('Reproduction: Whitespace Token Loss', () => {
    let client: NexusClient;

    beforeEach(() => {
        vi.clearAllMocks();
        client = new NexusClient();
    });

    it('Should NOT lose whitespace tokens (spaces and newlines)', async () => {
        const onChunk = vi.fn();
        const tokens = [
            { token: 'Hello' },
            { token: ' ' },       // <--- SPACE TOKEN
            { token: 'World' },
            { token: '\n' },      // <--- NEWLINE TOKEN
            { token: 'Next' }
        ];

        (fetchEventSource as any).mockImplementation(async (url: string, options: any) => {
            for (const t of tokens) {
                await options.onmessage({ 
                    event: 'token', 
                    data: JSON.stringify(t) 
                });
            }
            if (options.onclose) options.onclose();
        });

        await client.generateStream({
            chatId: 'test_ws',
            charName: 'Test',
            parentId: null,
            messages: [],
            nodes: []
        }, { onChunk });

        // 如果修复前：' ' 和 '\n' 会因为 trim() 变成 "" 然后被 if (!rawData) 过滤掉
        // 预期收到 5 次调用
        expect(onChunk).toHaveBeenCalledTimes(5);
        
        // 验证最终文本累加
        expect(onChunk).toHaveBeenNthCalledWith(1, 'Hello', 'Hello');
        expect(onChunk).toHaveBeenNthCalledWith(2, ' ', 'Hello ');
        expect(onChunk).toHaveBeenNthCalledWith(3, 'World', 'Hello World');
        expect(onChunk).toHaveBeenNthCalledWith(4, '\n', 'Hello World\n');
        expect(onChunk).toHaveBeenNthCalledWith(5, 'Next', 'Hello World\nNext');
    });

    it('Should fallback to raw text if JSON parsing fails but event is token-like', async () => {
        const onChunk = vi.fn();
        
        (fetchEventSource as any).mockImplementation(async (url: string, options: any) => {
            // 模拟非 JSON 的原始数据
            await options.onmessage({ event: 'token', data: 'RawToken' });
            if (options.onclose) options.onclose();
        });

        await client.generateStream({
            chatId: 'test_raw',
            charName: 'Test',
            parentId: null,
            messages: [],
            nodes: []
        }, { onChunk });

        expect(onChunk).toHaveBeenCalledWith('RawToken', 'RawToken');
    });
});
