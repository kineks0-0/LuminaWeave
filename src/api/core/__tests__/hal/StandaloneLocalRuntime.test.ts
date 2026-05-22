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

describe('StandaloneLocalRuntime generation', () => {
    beforeEach(() => {
        generateStreamMock.mockClear();
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
});
