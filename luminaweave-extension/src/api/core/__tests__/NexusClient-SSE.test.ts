import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NexusClient, StreamCallbacks } from '../NexusClient.js';
import { STClient } from '../st-adapter/STClient.js';
import { fetchEventSource } from '@microsoft/fetch-event-source';

// Mock 外部依赖
vi.mock('@microsoft/fetch-event-source', () => ({
    fetchEventSource: vi.fn()
}));

vi.mock('../st-adapter/STClient.js', () => ({
    STClient: {
        getCsrfToken: vi.fn().mockResolvedValue('test-csrf-token')
    }
}));

describe('NexusClient SSE 拆分单元测试 (Scheme 3)', () => {
    let client: NexusClient;

    beforeEach(() => {
        vi.clearAllMocks();
        client = new NexusClient();
    });

    it('Case 1: 多段 Token 累加测试 - 应正确维护 localFullText', async () => {
        const onChunk = vi.fn();
        const onDelta = vi.fn();
        const callbacks: StreamCallbacks = { onChunk, onDelta };

        // 模拟 fetchEventSource 的行为
        (fetchEventSource as any).mockImplementation(async (url: string, options: any) => {
            // 模拟发送三个 token 事件
            await options.onmessage({ event: 'token', data: JSON.stringify({ token: 'H' }) });
            await options.onmessage({ event: 'token', data: JSON.stringify({ token: 'e' }) });
            await options.onmessage({ event: 'token', data: JSON.stringify({ token: 'l' }) });
            
            if (options.onclose) options.onclose();
        });

        await client.generateStream({
            chatId: 'test_chat',
            charName: 'TestBot',
            parentId: null,
            messages: [],
            nodes: []
        }, callbacks);

        // 验证累加逻辑
        expect(onChunk).toHaveBeenCalledTimes(3);
        expect(onChunk).toHaveBeenNthCalledWith(1, 'H', 'H');
        expect(onChunk).toHaveBeenNthCalledWith(2, 'e', 'He');
        expect(onChunk).toHaveBeenNthCalledWith(3, 'l', 'Hel');
        
        expect(onDelta).toHaveBeenCalledTimes(3);
        expect(onDelta).toHaveBeenCalledWith('l');
    });

    it('Case 2: 事务提交 (committed) 路由测试', async () => {
        const onBackendCommitted = vi.fn();
        const callbacks: StreamCallbacks = { onBackendCommitted };

        (fetchEventSource as any).mockImplementation(async (url: string, options: any) => {
            await options.onmessage({ 
                event: 'committed', 
                data: JSON.stringify({ 
                    lastTransactionId: 'tx_sse_123',
                    activeLeafId: 'leaf_456'
                }) 
            });
        });

        await client.generateStream({
            chatId: 'test_chat',
            charName: 'TestBot',
            parentId: null,
            messages: [],
            nodes: []
        }, callbacks);

        expect(onBackendCommitted).toHaveBeenCalledWith({
            lastTransactionId: 'tx_sse_123',
            activeLeafId: 'leaf_456',
            generationId: undefined
        });
    });

    it('Case 3: 生成结束 (done) 路由与全量兜底测试', async () => {
        const onDone = vi.fn();
        const callbacks: StreamCallbacks = { onDone };

        (fetchEventSource as any).mockImplementation(async (url: string, options: any) => {
            // 先传一段 delta
            await options.onmessage({ event: 'delta', data: JSON.stringify({ delta: 'Part1' }) });
            // 再传 done，但不带 fullText（测试 localFullText 兜底）
            await options.onmessage({ event: 'done', data: JSON.stringify({}) });
        });

        await client.generateStream({
            chatId: 'test_chat',
            charName: 'TestBot',
            parentId: null,
            messages: [],
            nodes: []
        }, callbacks);

        expect(onDone).toHaveBeenCalledWith(expect.objectContaining({
            fullText: 'Part1',
            status: 'success'
        }));
    });

    it('Case 4: 异常边界测试 - onerror 应触发回调并中断', async () => {
        const onError = vi.fn();
        const callbacks: StreamCallbacks = { onError };
        const testError = new Error('SSE Connection Failed');

        (fetchEventSource as any).mockImplementation(async (url: string, options: any) => {
            try {
                options.onerror(testError);
            } catch (e) {
                // onerror 内部 throw 是为了停止重连
            }
        });

        await client.generateStream({
            chatId: 'test_chat',
            charName: 'TestBot',
            parentId: null,
            messages: [],
            nodes: []
        }, callbacks);

        expect(onError).toHaveBeenCalledWith(testError);
    });

    it('Case 5: 中断信号透传测试', async () => {
        const controller = new AbortController();
        
        await client.generateStream({
            chatId: 'test_chat',
            charName: 'TestBot',
            parentId: null,
            messages: [],
            nodes: []
        }, {}, controller.signal);

        expect(fetchEventSource).toHaveBeenCalledWith(
            expect.any(String),
            expect.objectContaining({
                signal: controller.signal,
                openWhenHidden: true
            })
        );
    });
});
