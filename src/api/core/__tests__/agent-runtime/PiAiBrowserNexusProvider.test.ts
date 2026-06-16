import { describe, expect, it, vi } from 'vitest';
import {
    PiAiBrowserNexusProvider,
    type PiAiBrowserNexusProviderDeps
} from '@/api/core/agent-runtime/model/PiAiBrowserNexusProvider.js';
import type { NexusAPI, NexusNode } from '@/types/nexus.js';

const createProvider = (deps: Partial<PiAiBrowserNexusProviderDeps> = {}): PiAiBrowserNexusProvider => {
    const nodes: NexusNode[] = [{
        provider: 'api_openai_compatible',
        model: 'custom-model',
        url: 'https://node.example/v1',
        key: 'node-key'
    }];
    const apis: NexusAPI[] = [{
        id: 'api_openai_compatible',
        name: 'OpenAI Compatible',
        type: 'openai_compatible',
        url: 'https://api.example/v1',
        key: 'api-key'
    }];
    return new PiAiBrowserNexusProvider({
        resolveNodesFromPreset: deps.resolveNodesFromPreset ?? vi.fn(() => nodes),
        readApiConfigs: deps.readApiConfigs ?? vi.fn(() => apis),
        listProviderModels: deps.listProviderModels ?? vi.fn(async () => ['custom-model', 'other-model'])
    });
};

describe('PiAiBrowserNexusProvider', () => {
    it('resolves a Nexus preset into a pi-ai model and stream options without bundling request transport', () => {
        const provider = createProvider();

        const model = provider.getModel({
            presetId: 'forge-main',
            headers: { 'x-lumina-forge-request-id': 'req_1' }
        });
        const streamOptions = provider.getStreamOptions({
            presetId: 'forge-main',
            generationSettings: { temperature: 0.4, max_tokens: 768 }
        });

        expect(model).toMatchObject({
            id: 'custom-model',
            name: 'custom-model',
            api: 'openai-completions',
            provider: 'api_openai_compatible',
            baseUrl: 'https://api.example/v1',
            headers: { 'x-lumina-forge-request-id': 'req_1' }
        });
        expect(streamOptions).toMatchObject({
            apiKey: 'api-key',
            temperature: 0.4,
            maxTokens: 768
        });
        expect(Object.keys(provider)).not.toContain('transport');
    });

    it('maps Anthropic and Google API types to pi-ai API ids', () => {
        const anthropicProvider = createProvider({
            resolveNodesFromPreset: vi.fn(() => [{ provider: 'anthropic_api', model: 'claude-sonnet-4-20250514' }]),
            readApiConfigs: vi.fn<() => NexusAPI[]>(() => [{
                id: 'anthropic_api',
                name: 'Anthropic',
                type: 'anthropic',
                url: '',
                key: 'anthropic-key'
            }])
        });
        const googleProvider = createProvider({
            resolveNodesFromPreset: vi.fn(() => [{ provider: 'google_api', model: 'gemini-2.5-flash' }]),
            readApiConfigs: vi.fn<() => NexusAPI[]>(() => [{
                id: 'google_api',
                name: 'Google',
                type: 'google',
                url: 'https://generativelanguage.googleapis.com',
                key: 'google-key'
            }])
        });

        expect(anthropicProvider.getModel({ presetId: 'anthropic-preset' })).toMatchObject({
            api: 'anthropic-messages',
            provider: 'anthropic',
            baseUrl: 'https://api.anthropic.com'
        });
        expect(anthropicProvider.getStreamOptions({ presetId: 'anthropic-preset' })).toMatchObject({
            apiKey: 'anthropic-key'
        });
        expect(googleProvider.getModel({ presetId: 'google-preset' })).toMatchObject({
            api: 'google-generative-ai',
            provider: 'google',
            baseUrl: 'https://generativelanguage.googleapis.com'
        });
        expect(googleProvider.getStreamOptions({ presetId: 'google-preset' })).toMatchObject({
            apiKey: 'google-key'
        });
    });

    it('delegates available model discovery to the injected Nexus model source', async () => {
        const listProviderModels = vi.fn(async (providerId: string) =>
            providerId === 'api_openai_compatible' ? ['custom-model'] : []
        );
        const provider = createProvider({ listProviderModels });

        await expect(provider.listModels('api_openai_compatible')).resolves.toEqual(['custom-model']);
        expect(listProviderModels).toHaveBeenCalledWith('api_openai_compatible');
    });
});
