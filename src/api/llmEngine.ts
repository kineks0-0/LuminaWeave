import OpenAI from 'openai';
import { lwStorage } from './storage.js';
import { STClient } from './core/st-adapter/STClient.js';
import { LuminaWeaveAPIBase } from './core/LuminaWeaveAPIBase.js';
import { 
    NexusNode, 
    NexusPreset, 
    NexusAPI, 
    GenerateOptions, 
    NexusStatusResponse, 
    STPresetManagerModule,
    CleanedMessage 
} from '../types/nexus';

let stPresetManager: STPresetManagerModule | null = null;

export type { NexusNode, NexusPreset };

export class LuminaWeaveLLMEngine extends LuminaWeaveAPIBase {
    private initialized: boolean = false;

    constructor() {
        super();
        this.init();
    }

    // 统一通过基类 ctx 访问

    async init(): Promise<void> {
        if (this.initialized) return;
        try {
            // 通过原生的动态 import 函数导入，避免被 vite 编译成 require
            // @ts-ignore
            stPresetManager = await new Function('return import("/scripts/preset-manager.js")')();
            this.initialized = true;
            console.log('[LuminaWeave LLM Engine] ST底层模块桥接成功！');
        } catch (e) {
            console.error('[LuminaWeave LLM Engine] 桥接 ST 核心模块失败:', e);
        }
    }

    /**
     * 根据 Nexus 节点信息创建 OpenAI 客户端
     */
    getClient(node: NexusNode): OpenAI {
        const customApis = lwStorage.get('nexus.apis', [], 'Global') as NexusAPI[];
        const apiDef = customApis.find((a: NexusAPI) => a.id === node.provider);

        let url = apiDef?.url || node.url || '';
        const key = apiDef?.key || node.key;

        // 规格化 URL
        if (url) {
            url = url.replace(/\/(chat\/completions|completions|models)($|\?)/, '');
            url = url.replace(/\/+$/, '');
        }

        return new OpenAI({
            apiKey: key || 'no-key',
            baseURL: url,
            dangerouslyAllowBrowser: true // 在扩展环境中通常需要此选项
        });
    }

    /**
     * 判断当前 ST 大脑是否运行在 Chat Completion 模式
     */
    isChatCompletion(): boolean {
        return this.ctx?.mainApi === 'openai';
    }

    getPresets(type: string): string[] {
        if (!this.initialized || !stPresetManager) return [];
        const manager = stPresetManager.getPresetManager(type);
        if (!manager) return [];
        return manager.getAllPresets();
    }

    getActivePresetName(type: string): string | null {
        if (!this.initialized || !stPresetManager) return null;
        const manager = stPresetManager.getPresetManager(type);
        if (!manager) return null;
        return manager.getSelectedPresetName();
    }

    selectPreset(type: string, name: string): void {
        if (!this.initialized || !stPresetManager) return;
        const manager = stPresetManager.getPresetManager(type);
        if (manager && typeof manager.selectPreset === 'function') {
            manager.selectPreset(name);
        }
    }

    async fetchCustomModelsApi(customUrl: string, customKey: string, apiName: string): Promise<Record<string, { value: string, text: string }[]>> {
        if (!customUrl) return {};
        try {
            const client = this.getClient({ provider: 'custom', model: 'unknown', url: customUrl, key: customKey });
            const response = await client.models.list();
            const models = response.data;
            if (Array.isArray(models)) {
                const groupKey = `${apiName} (OpenAI获取)`;
                const groupObj: Record<string, { value: string, text: string }[]> = { [groupKey]: [] };
                for (const m of models) {
                    const id = m.id || (typeof m === 'string' ? m : '');
                    if (id) groupObj[groupKey].push({ value: id, text: id });
                }
                return groupObj;
            }
            return {};
        } catch (e) {
            console.error('[LuminaWeave] fetchCustomModelsApi:', e);
            return {};
        }
    }

    /**
     * 清理并规格化消息列表
     */
    _cleanMessages(messages: any[]): CleanedMessage[] {
        if (!Array.isArray(messages)) return [];
        return messages.map(m => {
            const role = (m.role || (m.is_user ? 'user' : (m.is_system ? 'system' : 'assistant'))) as OpenAI.Chat.ChatCompletionRole;
            const content = m.content || m.mes || '';
            
            const cleaned: CleanedMessage = { role, content };
            if (m.name) cleaned.name = m.name; 
            return cleaned;
        }).filter(m => m.content);
    }

    /**
     * 触发后端 Nexus 生成流
     */
    async generateCustomStream(promptMessages: any[], options: GenerateOptions = {}): Promise<void> {
        let cleanedMessages = this._cleanMessages(promptMessages);
        
        let nodesToTry: NexusNode[] = [];
        if (options.nexusPresetId) {
            const presets = lwStorage.get('nexus.presets', [], 'Global') as NexusPreset[];
            const targetPreset = presets.find((p: NexusPreset) => p.id === options.nexusPresetId);
            if (targetPreset?.nodes?.length && targetPreset.nodes.length > 0) {
                // 仅发送 Provider ID 和 Model，让后端进行解析
                nodesToTry = targetPreset.nodes.map((node: NexusNode) => {
                    if (node.provider === 'st_current') {
                        const settings = this.ctx?.chatCompletionSettings;
                        return {
                            provider: 'st_current_compatibility',
                            model: settings?.model || 'gpt-4o',
                            url: settings?.api_url,
                            key: settings?.api_key,
                        };
                    }
                    return {
                        provider: node.provider,
                        model: node.model
                    } as NexusNode;
                });
            }
        }

        if (nodesToTry.length === 0) {
            const settings = this.ctx?.chatCompletionSettings;
            nodesToTry.push({
                provider: 'st_current_compatibility',
                model: settings?.model || 'gpt-4o',
                url: settings?.api_url,
                key: settings?.api_key,
            });
        }

        const { chatId: contextChatId } = lwStorage._getContextIds();
        const chatId = options.chatId || contextChatId;

        try {
            console.log(`[Lumina LLM Engine] 请求后端开始生成 (chatId: ${chatId})`);
            
            const csrfToken = await STClient.getCsrfToken();
            const charName = this.ctx?.characterId ? this.ctx.characters?.[Number(this.ctx.characterId)]?.name : 'Assistant';

            // 1. 发起后端生成请求
            const startRes = await fetch('/api/plugins/luminaweave/nexus/generate', {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    'X-CSRF-Token': csrfToken
                },
                body: JSON.stringify({
                    chatId,
                    charName: charName || 'Assistant',
                    parentId: options.parentId || null,
                    messages: cleanedMessages,
                    nodes: nodesToTry,
                    settings: options.settings
                })
            });

            if (!startRes.ok) throw new Error('后端生成启动失败');

            // 2. 开始轮询状态
            let isDone = false;
            const poll = async () => {
                if (isDone || options.signal?.aborted) return;
                
                try {
                    const statusRes = await fetch(`/api/plugins/luminaweave/nexus/status/${chatId}`);
                    const state: NexusStatusResponse = await statusRes.json();
                    
                    const currentBuffer = state.rawBuffer !== undefined ? state.rawBuffer : state.buffer;
                    if (currentBuffer) {
                        options.onChunk?.(currentBuffer);
                    }

                    if (!state.isGenerating) {
                        isDone = true;
                        const status = state.status || 'success';
                        if (status === 'error' || status === 'aborted') {
                            const message = state.errorMessage || (status === 'aborted' ? '已停止生成' : '后端生成失败');
                            options.onError?.(new Error(message), state);
                        } else {
                            if (options.onDone) {
                                await options.onDone(currentBuffer);
                            }
                        }
                    } else {
                        setTimeout(poll, 500); 
                    }
                } catch (e: any) {
                    console.error('[Lumina LLM Engine] 轮询异常:', e);
                    setTimeout(poll, 1000);
                }
            };
            
            poll();

        } catch (err: any) {
            console.error('[Lumina LLM Engine] 生成初始化异常:', err);
            options.onError?.(err);
        }
    }
}

export const llmEngine = new LuminaWeaveLLMEngine();
