import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NexusClient } from '../NexusClient.js';
import { STClient } from '../st-adapter/STClient.js';

// Mock fetchEventSource
vi.mock('@microsoft/fetch-event-source', () => ({
    fetchEventSource: vi.fn(async (url, options) => {
        // 模拟流行为：手动调用 onmessage
        if (options.onmessage) {
            options.onmessage({
                event: 'delta',
                data: JSON.stringify({ delta: 'Hello' })
            });
            options.onmessage({
                event: 'delta',
                data: JSON.stringify({ delta: ' World' })
            });
            options.onmessage({
                event: 'done',
                data: JSON.stringify({ status: 'success', lastTransactionId: 'tx1' })
            });
        }
        if (options.onclose) options.onclose();
    })
}));

vi.mock('../st-adapter/STClient.js', () => ({
    STClient: {
        getCsrfToken: vi.fn(async () => 'mock-csrf-token')
    }
}));

describe('NexusClient', () => {
    let client: NexusClient;

    beforeEach(() => {
        client = new NexusClient();
        vi.restoreAllMocks();
        global.fetch = vi.fn();
    });

    it('fetchModels should return models from JSON response', async () => {
        (global.fetch as any).mockResolvedValue({
            ok: true,
            json: async () => ({ models: ['gpt-4', 'gpt-3.5-turbo'] })
        });

        const models = await client.fetchModels('provider-1');
        expect(models).toEqual(['gpt-4', 'gpt-3.5-turbo']);
    });

    it('generateStream should call fetchEventSource with correct parameters', async () => {
        const { fetchEventSource } = await import('@microsoft/fetch-event-source');
        
        const onChunk = vi.fn();
        const onDone = vi.fn();

        await client.generateStream({
            chatId: 'c2',
            charName: 'Alice',
            parentId: 'p1',
            messages: [],
            nodes: []
        }, { onChunk, onDone });

        expect(fetchEventSource).toHaveBeenCalledWith(
            expect.stringContaining('/api/plugins/luminaweave/nexus/generate-sse'),
            expect.objectContaining({
                method: 'POST',
                headers: expect.objectContaining({
                    'X-CSRF-Token': 'mock-csrf-token',
                    'Content-Type': 'application/json'
                })
            })
        );

        // 验证回调执行
        expect(onChunk).toHaveBeenCalledWith('Hello', 'Hello');
        expect(onChunk).toHaveBeenCalledWith(' World', 'Hello World');
        expect(onDone).toHaveBeenCalledWith(expect.objectContaining({
            status: 'success',
            lastTransactionId: 'tx1'
        }));
    });

    it('attachStream should use GET method and pass query params', async () => {
        const { fetchEventSource } = await import('@microsoft/fetch-event-source');
        
        await client.attachStream({
            chatId: 'c3',
            generationId: 'gen_123',
            from: 10
        }, {});

        expect(fetchEventSource).toHaveBeenCalledWith(
            expect.stringContaining('gid=gen_123'),
            expect.objectContaining({
                method: 'GET'
            })
        );
    });
});
