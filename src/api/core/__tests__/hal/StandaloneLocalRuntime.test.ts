import { beforeEach, describe, expect, it, vi } from 'vitest';

const generateStreamMock = vi.hoisted(() => vi.fn(async (..._args: unknown[]) => undefined));

vi.mock('@/api/storage.js', () => ({
    lwStorage: {
        get: vi.fn((key: string, fallback: unknown) => {
            if (key === 'nexus.apis') {
                return [{
                    id: 'deepseek',
                    url: 'https://api.deepseek.com/v1',
                    key: 'test-key'
                }];
            }
            return fallback;
        }),
        set: vi.fn()
    }
}));

vi.mock('@shared/api/llm/OpenAIProvider.js', () => ({
    OpenAIProvider: class {
        generateStream = generateStreamMock;
        abort = vi.fn();
        fetchModels = vi.fn();
    }
}));

import { StandaloneLocalRuntime } from '@/api/core/hal/adapters/standalone/StandaloneLocalRuntime.js';
import { lwStorage } from '@/api/storage.js';

describe('StandaloneLocalRuntime generation', () => {
    beforeEach(() => {
        generateStreamMock.mockClear();
        (lwStorage.set as unknown as ReturnType<typeof vi.fn>).mockClear();
    });

    it('passes Nexus cleaned messages to OpenAI provider as a message array', async () => {
        const runtime = new StandaloneLocalRuntime();

        runtime.generation.generateStream({
            chatId: 'lw_card_test',
            charName: 'Forge',
            parentId: null,
            messages: [
                { role: 'system', content: 'System prompt' },
                { role: 'user', content: 'User request' }
            ],
            nodes: [{ provider: 'deepseek', model: 'deepseek-chat' }],
            settings: {
                temperature: 0.2,
                maxTokens: 1024,
                topP: 0.9
            }
        });

        await vi.waitFor(() => expect(generateStreamMock).toHaveBeenCalledTimes(1));
        const [, , messages, options] = generateStreamMock.mock.calls[0];

        expect(Array.isArray(messages)).toBe(true);
        expect(messages).toEqual([
            { role: 'system', content: 'System prompt' },
            { role: 'user', content: 'User request' }
        ]);
        expect(options).toMatchObject({
            model: 'deepseek-chat',
            temperature: 0.2,
            maxTokens: 1024,
            topP: 0.9
        });
    });

    it('persists finalized nodes into the local conversation document', async () => {
        const runtime = new StandaloneLocalRuntime();
        generateStreamMock.mockImplementationOnce(async (...args: unknown[]) => {
            const callbacks = args[4] as { onToken: (token: string) => void; onDone: () => Promise<void> };
            callbacks.onToken('Hello');
            await callbacks.onDone();
        });

        const committed: any[] = [];
        runtime.generation.generateStream({
            chatId: 'lw_chat_test',
            charName: 'Alice',
            parentId: null,
            messages: [{ role: 'user', content: 'hi' }],
            nodes: [{ provider: 'deepseek', model: 'deepseek-chat' }]
        }).onCommitted((data: any) => {
            committed.push(data);
        });

        await vi.waitFor(() => expect(committed).toHaveLength(1));
        expect(committed[0]).toMatchObject({
            activeLeafId: expect.any(String),
            seq: expect.any(Number),
            node: expect.objectContaining({ role: 'assistant', mes: 'Hello' })
        });

        const documentCalls = (lwStorage.set as unknown as ReturnType<typeof vi.fn>).mock.calls
            .filter(([key]: unknown[]) => key === 'lumina_conversations');
        const savedDocument = documentCalls
            .map(([, documents]: any[]) => documents?.[0])
            .find((document: any) => document?.nodes?.length === 1);
        expect(savedDocument).toBeDefined();
        expect(savedDocument.activeLeafId).toBe(committed[0].node.id);
    });
});
