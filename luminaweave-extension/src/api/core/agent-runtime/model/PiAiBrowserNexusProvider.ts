import type {
    Api,
    Model,
    SimpleStreamOptions
} from '@earendil-works/pi-ai';
import { llmEngine } from '../../../llmEngine.js';
import { lwStorage } from '../../../storage.js';
import type { NexusAPI, NexusNode } from '../../../../types/nexus.js';
import type {
    AgentRuntimeModelGenerationSettings,
    AgentRuntimeModelProvider,
    AgentRuntimeModelRequest
} from './AgentRuntimeModelProvider.js';

type PiAiProviderId = Model<Api>['provider'];

export interface PiAiBrowserNexusProviderDeps {
    resolveNodesFromPreset?: (presetId?: string) => NexusNode[];
    readApiConfigs?: () => NexusAPI[];
    listProviderModels?: (providerId: string) => Promise<string[]>;
}

interface ResolvedPiAiNexusConfig {
    node: NexusNode;
    apiConfig: NexusAPI | null;
    api: Api;
    provider: PiAiProviderId;
    baseUrl: string;
    apiKey?: string;
}

export class PiAiBrowserNexusProvider implements AgentRuntimeModelProvider {
    private readonly resolveNodesFromPreset: (presetId?: string) => NexusNode[];
    private readonly readApiConfigs: () => NexusAPI[];
    private readonly listProviderModels: (providerId: string) => Promise<string[]>;

    constructor(deps: PiAiBrowserNexusProviderDeps = {}) {
        this.resolveNodesFromPreset = deps.resolveNodesFromPreset ?? ((presetId) => llmEngine.resolveNodesFromPreset(presetId));
        this.readApiConfigs = deps.readApiConfigs ?? (() => {
            const value = lwStorage.get('nexus.apis', [], 'Global');
            return Array.isArray(value) ? value as NexusAPI[] : [];
        });
        this.listProviderModels = deps.listProviderModels ?? (async (providerId) => {
            const groupedModels = await llmEngine.fetchProviderModels(providerId, providerId);
            return Object.values(groupedModels)
                .flat()
                .map(item => item.value)
                .filter((modelId): modelId is string => Boolean(modelId));
        });
    }

    getModel(input: AgentRuntimeModelRequest = {}): Model<Api> {
        const resolved = this.resolveConfig(input.presetId);
        return {
            id: resolved.node.model || input.presetId || 'lumina-nexus',
            name: resolved.node.model || 'Lumina Nexus',
            api: resolved.api,
            provider: resolved.provider,
            baseUrl: resolved.baseUrl,
            reasoning: false,
            input: ['text'],
            cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
            contextWindow: 0,
            maxTokens: 0,
            headers: input.headers
        };
    }

    getStreamOptions(input: AgentRuntimeModelRequest = {}): SimpleStreamOptions {
        const resolved = this.resolveConfig(input.presetId);
        return {
            ...this.mapGenerationSettings(input.generationSettings),
            apiKey: resolved.apiKey
        };
    }

    listModels(providerId: string): Promise<string[]> {
        return this.listProviderModels(providerId);
    }

    private resolveConfig(presetId?: string): ResolvedPiAiNexusConfig {
        const node = this.resolveNodesFromPreset(presetId)[0];
        if (!node) {
            throw new Error(`Agent Runtime 无法解析 Nexus 预设节点：${presetId || '未指定'}`);
        }
        const apiConfig = this.readApiConfigs().find(item => item.id === node.provider) ?? null;
        const type = apiConfig?.type;
        const baseUrl = apiConfig?.url || node.url || '';
        const apiKey = apiConfig?.key || node.key || undefined;
        if (type === 'anthropic') {
            return {
                node,
                apiConfig,
                api: 'anthropic-messages',
                provider: 'anthropic',
                baseUrl: baseUrl || 'https://api.anthropic.com',
                apiKey
            };
        }
        if (type === 'google') {
            return {
                node,
                apiConfig,
                api: 'google-generative-ai',
                provider: 'google',
                baseUrl,
                apiKey
            };
        }
        return {
            node,
            apiConfig,
            api: 'openai-completions',
            provider: this.resolveOpenAiProvider(node, apiConfig),
            baseUrl: baseUrl || 'https://api.openai.com/v1',
            apiKey
        };
    }

    private resolveOpenAiProvider(node: NexusNode, apiConfig: NexusAPI | null): PiAiProviderId {
        if (apiConfig?.type === 'openai') return 'openai';
        if (node.provider === 'openai' || node.provider === 'openai_compatible') return 'openai';
        return node.provider || 'openai';
    }

    private mapGenerationSettings(settings?: AgentRuntimeModelGenerationSettings): SimpleStreamOptions {
        return {
            temperature: typeof settings?.temperature === 'number' ? settings.temperature : undefined,
            maxTokens: typeof settings?.max_tokens === 'number' ? settings.max_tokens : undefined
        };
    }
}

export const piAiBrowserNexusProvider = new PiAiBrowserNexusProvider();
