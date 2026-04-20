import { type ModelMessage } from 'ai';
import { createOpenAI } from '@ai-sdk/openai';
import { createAnthropic } from '@ai-sdk/anthropic';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { NexusApiConfig, NexusProviderType } from './NexusTypes.js';

const ST_TO_AI_SDK_KEY_MAP: Record<string, string> = {
    top_p: 'topP',
    top_k: 'topK',
    top_a: 'topA',
    min_p: 'minP',
    frequency_penalty: 'frequencyPenalty',
    presence_penalty: 'presencePenalty',
    repetition_penalty: 'repetitionPenalty',
    max_completion_tokens: 'maxTokens',
    max_tokens: 'maxTokens',
};

const AI_SDK_KNOWN_KEYS = new Set([
    'temperature', 'topP', 'topK', 'topA', 'minP',
    'frequencyPenalty', 'presencePenalty', 'repetitionPenalty',
    'maxTokens', 'seed', 'stopSequences',
]);

/**
 * 将 SillyTavern 的生成设置映射为 AI SDK 的标准参数
 */
export function mapSTSettingsToAISdk(raw: Record<string, any>): Record<string, any> {
    const mapped: Record<string, any> = {};
    const usedSTKeys = new Set<string>();

    for (const [stKey, aiSdkKey] of Object.entries(ST_TO_AI_SDK_KEY_MAP)) {
        if (stKey in raw && raw[stKey] !== undefined && raw[stKey] !== null) {
            if (aiSdkKey in mapped) continue;
            mapped[aiSdkKey] = raw[stKey];
            usedSTKeys.add(stKey);
        }
    }

    for (const [key, value] of Object.entries(raw)) {
        if (usedSTKeys.has(key)) continue;
        if (AI_SDK_KNOWN_KEYS.has(key)) {
            mapped[key] = value;
        }
    }

    if (typeof mapped.seed === 'number' && mapped.seed < 0) {
        delete mapped.seed;
    }

    return mapped;
}

/**
 * NexusOrchestrator
 * 共享的生成编排器，负责跨平台的模型解析与消息组装
 */
export class NexusOrchestrator {
    
    /**
     * 规范化 Base URL，移除冗余路径后缀
     */
    normalizeBaseUrl(url: string): string {
        let normalized = (url || '').trim();
        if (!normalized) return '';
        normalized = normalized.replace(/\/(chat\/completions|completions|models)($|\?)/, '');
        normalized = normalized.replace(/\/+$/, '');
        return normalized;
    }

    /**
     * 将通用消息格式转换为 AI SDK 的 ModelMessage 格式
     */
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

    /**
     * 自动解析 Provider 类型
     */
    getProviderType(node: any, api: NexusApiConfig | null): NexusProviderType {
        const configured = api?.type;
        if (configured === 'openai' || configured === 'openai_compatible' || configured === 'anthropic' || configured === 'google') {
            return configured;
        }
        return 'openai_compatible';
    }

    /**
     * 获取 AI SDK 模型实例
     */
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

    /**
     * 拉取模型列表 (跨平台通用实现)
     */
    async listModelsForProvider(api: NexusApiConfig): Promise<string[]> {
        const providerType = api.type || 'openai_compatible';
        // 目前仅针对 OpenAI 兼容接口实现自动拉取列表
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
            console.error('[NexusOrchestrator] Failed to fetch models:', e);
            return [];
        }
    }

    /**
     * 从预设中编译最终提示词
     */
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

export const globalNexusOrchestrator = new NexusOrchestrator();
