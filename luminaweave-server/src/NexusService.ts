import { streamText, type ModelMessage } from 'ai';
import { createOpenAI } from '@ai-sdk/openai';
import { createAnthropic } from '@ai-sdk/anthropic';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { NexusApiConfig, NexusProviderType } from './types.js';

export class NexusService {
    normalizeBaseUrl(url: string): string {
        let normalized = (url || '').trim();
        if (!normalized) return '';
        normalized = normalized.replace(/\/(chat\/completions|completions|models)($|\?)/, '');
        normalized = normalized.replace(/\/+$/, '');
        return normalized;
    }

    toModelMessages(messages: any): ModelMessage[] {
        if (!Array.isArray(messages)) return [];
        const out: ModelMessage[] = [];
        for (const m of messages) {
            if (!m || typeof m !== 'object') continue;
            const obj = m as Record<string, any>;
            const roleRaw = String(obj.role || '');
            const content = String(obj.content || '');
            if (!content) continue;
            
            if (roleRaw === 'system') out.push({ role: 'system', content });
            else if (roleRaw === 'assistant') out.push({ role: 'assistant', content });
            else out.push({ role: 'user', content });
        }
        return out;
    }

    getProviderType(node: any, api: NexusApiConfig | null): NexusProviderType {
        const configured = api?.type;
        if (configured === 'openai' || configured === 'openai_compatible' || configured === 'anthropic' || configured === 'google') {
            return configured;
        }
        return 'openai_compatible';
    }

    getModelForNode(node: any, api: NexusApiConfig | null): any {
        const providerType = this.getProviderType(node, api);
        const modelId = typeof node?.model === 'string' ? node.model : '';
        if (!modelId) throw new Error('missing_model');

        const apiKey = (api?.key || node?.key || '').trim();
        
        if (providerType === 'anthropic') {
            if (!apiKey) throw new Error('missing_api_key');
            return createAnthropic({ apiKey })(modelId);
        }
        if (providerType === 'google') {
            if (!apiKey) throw new Error('missing_api_key');
            return createGoogleGenerativeAI({ apiKey })(modelId);
        }

        const baseURL = this.normalizeBaseUrl(String(api?.url || node?.url || ''));
        if (!apiKey) throw new Error('missing_api_key');
        if (!baseURL) throw new Error('missing_base_url');

        const openai = createOpenAI({ apiKey, baseURL });
        if (providerType === 'openai') {
            return baseURL.includes('api.openai.com') ? openai(modelId) : openai.chat(modelId);
        }
        return openai.chat(modelId);
    }

    async listModelsForProvider(api: NexusApiConfig): Promise<string[]> {
        const providerType = api.type || 'openai_compatible';
        if (providerType !== 'openai' && providerType !== 'openai_compatible') return [];
        
        const apiKey = (api.key || '').trim();
        const baseURL = this.normalizeBaseUrl(String(api.url || ''));
        if (!apiKey || !baseURL) return [];

        try {
            const res = await fetch(`${baseURL}/models`, {
                headers: { Authorization: `Bearer ${apiKey}` }
            });
            if (!res.ok) return [];
            const json = await res.json() as any;
            if (!json || !Array.isArray(json.data)) return [];
            return json.data.map((item: any) => item.id).filter(Boolean);
        } catch (e) {
            return [];
        }
    }

    compilePromptFromPreset(presetBlob: any, sessionMessages: any): { messages: any[]; settings: Record<string, any> } {
        const blob = (presetBlob && typeof presetBlob === 'object') ? presetBlob : {};
        const settingsRaw = (blob.settings && typeof blob.settings === 'object') ? blob.settings : {};
        const promptsRaw = Array.isArray(blob.prompts) ? blob.prompts : [];
        const orderRaw = Array.isArray(blob.prompt_order) ? blob.prompt_order : [];

        const prompts = promptsRaw.filter((p: any) => p && p.identifier);
        const order = orderRaw.filter((o: any) => o && o.identifier);

        const promptById = new Map<string, any>();
        for (const p of prompts) promptById.set(p.identifier, p);

        const orderedPrompts = order.length > 0
            ? order.map((o: any) => ({ ...o, prompt: promptById.get(o.identifier) })).filter((o: any) => o.prompt && o.enabled).map((o: any) => o.prompt!)
            : prompts.filter((p: any) => p.enabled !== false);

        const compiledPrefix = orderedPrompts
            .map((p: any) => {
                const role = (typeof p.role === 'string' ? p.role : 'system');
                const content = (p.content || p.system_prompt || '').trim();
                if (!content) return null;
                const msg: any = { role, content };
                if (p.name) msg.name = p.name;
                return msg;
            })
            .filter(Boolean);

        const msgs = Array.isArray(sessionMessages) ? sessionMessages : [];
        return { messages: [...compiledPrefix, ...msgs], settings: settingsRaw };
    }
}
