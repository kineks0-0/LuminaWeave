import { describe, expect, it, vi } from 'vitest';
import { GenerationDomainService } from '../GenerationDomainService.js';

describe('GenerationDomainService', () => {
    it('delegates message sending to the runtime generation port', async () => {
        const runtime = {
            sendMessage: vi.fn(async () => true),
            regenerateLast: vi.fn(async () => undefined),
            runEditedPrompt: vi.fn(async () => undefined),
            isGenerating: vi.fn(() => false),
            isSyncing: vi.fn(() => false),
            getLastStreamState: vi.fn(() => null)
        };
        const service = new GenerationDomainService(runtime);

        const options = {
            chatType: 'plugin' as const,
            promptAssembly: {
                engine: 'lumina' as const,
                sessionBinding: {
                    kind: 'plugin-session' as const,
                    sessionId: 'plugin_chat_1',
                    sourceId: 'chat'
                }
            }
        };

        await expect(service.sendMessage('hello', options)).resolves.toBe(true);

        expect(runtime.sendMessage).toHaveBeenCalledWith('hello', options);
    });

    it('delegates regeneration to the runtime generation port', async () => {
        const runtime = {
            sendMessage: vi.fn(async () => true),
            regenerateLast: vi.fn(async () => 'ok'),
            runEditedPrompt: vi.fn(async () => undefined),
            isGenerating: vi.fn(() => false),
            isSyncing: vi.fn(() => false),
            getLastStreamState: vi.fn(() => null)
        };
        const service = new GenerationDomainService(runtime);

        await expect(service.regenerateLast()).resolves.toBe('ok');

        expect(runtime.regenerateLast).toHaveBeenCalledTimes(1);
    });

    it('delegates edited prompt runs to the runtime generation port', async () => {
        const runtime = {
            sendMessage: vi.fn(async () => true),
            regenerateLast: vi.fn(async () => undefined),
            runEditedPrompt: vi.fn(async () => undefined),
            isGenerating: vi.fn(() => false),
            isSyncing: vi.fn(() => false),
            getLastStreamState: vi.fn(() => null)
        };
        const service = new GenerationDomainService(runtime);

        await service.runEditedPrompt('custom prompt');

        expect(runtime.runEditedPrompt).toHaveBeenCalledWith('custom prompt');
    });

    it('reads generation status from the runtime generation port', () => {
        const runtime = {
            sendMessage: vi.fn(async () => true),
            regenerateLast: vi.fn(async () => undefined),
            runEditedPrompt: vi.fn(async () => undefined),
            isGenerating: vi.fn(() => true),
            isSyncing: vi.fn(() => true),
            getLastStreamState: vi.fn(() => ({ processed: 'p', text: 't', filteredCount: 1 }))
        };
        const service = new GenerationDomainService(runtime);

        expect(service.isGenerating()).toBe(true);
        expect(service.isSyncing()).toBe(true);
        expect(service.getLastStreamState()).toEqual({ processed: 'p', text: 't', filteredCount: 1 });
    });
});
