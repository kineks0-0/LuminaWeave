import { describe, it, expect, vi, beforeEach } from 'vitest';
import { OpenAIProvider } from '@shared/api/llm/OpenAIProvider';
import { LuminaFetch } from '@shared/api/llm/LuminaFetch';

describe('OpenAIProvider', () => {
    let provider: OpenAIProvider;

    beforeEach(() => {
        provider = new OpenAIProvider();
    });

    it('should parse simple SSE tokens correctly', async () => {
        const mockStream = {
            getReader: () => ({
                read: vi.fn()
                    .mockResolvedValueOnce({ 
                        done: false, 
                        value: new TextEncoder().encode('data: {"choices": [{"delta": {"content": "Hello"}}]}\n\n') 
                    })
                    .mockResolvedValueOnce({ 
                        done: false, 
                        value: new TextEncoder().encode('data: {"choices": [{"delta": {"content": "!"}}]}\n\n') 
                    })
                    .mockResolvedValueOnce({ done: true })
            })
        };

        vi.spyOn(LuminaFetch, 'stream').mockResolvedValue(mockStream as any);

        const onToken = vi.fn();
        const onDone = vi.fn();

        await provider.generateStream(
            'http://api.test',
            'key-123',
            [{ role: 'user', content: 'hi' }],
            { model: 'gpt-4' },
            {
                onToken,
                onDone,
                onError: vi.fn()
            }
        );

        expect(onToken).toHaveBeenCalledWith('Hello');
        expect(onToken).toHaveBeenCalledWith('!');
        expect(onDone).toHaveBeenCalled();
    });

    it('should handle multi-line chunks and buffer them correctly', async () => {
        const mockStream = {
            getReader: () => ({
                read: vi.fn()
                    .mockResolvedValueOnce({ 
                        done: false, 
                        // 一个分块中包含多个 data 行
                        value: new TextEncoder().encode('data: {"choices": [{"delta": {"content": "Thinking..."}}]}\n\ndata: {"choices": [{"delta": {"content": "Ready."}}]}\n\n') 
                    })
                    .mockResolvedValueOnce({ done: true })
            })
        };

        vi.spyOn(LuminaFetch, 'stream').mockResolvedValue(mockStream as any);

        const onToken = vi.fn();
        await provider.generateStream('url', 'key', [], { model: 'm' }, { onToken, onDone: vi.fn(), onError: vi.fn() } as any);

        expect(onToken).toHaveBeenCalledWith('Thinking...');
        expect(onToken).toHaveBeenCalledWith('Ready.');
    });

    it('should filter model names correctly in fetchModels', async () => {
        // Mock 全局 fetch
        global.fetch = vi.fn().mockResolvedValue({
            ok: true,
            json: async () => ({
                data: [
                    { id: 'gpt-4' },
                    { id: 'gpt-3.5-turbo' },
                    { id: 'claude-3' }
                ]
            })
        } as any);

        const models = await provider.fetchModels('http://api.test', 'key');
        
        expect(models).toContain('gpt-4');
        expect(models).toContain('claude-3');
        expect(models.length).toBe(3);
    });
});
