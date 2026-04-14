import { lwStorage } from './storage.js';
import { NexusNode, NexusAPI, NexusPreset, CleanedMessage } from '../types/nexus.js';
import { NexusClient } from './core/NexusClient.js';
import { LuminaWeaveAPIBase } from './core/LuminaWeaveAPIBase.js';
import { GenerationSession, GenerationSessionOptions } from './core/GenerationSession.js';

/**
 * 幻光流式引擎工厂 (LuminaWeaveLLMEngine)
 * 统一处理大模型生成流。通过 Nexus 获取编排后的模型输出。
 */
export class LuminaWeaveLLMEngine extends LuminaWeaveAPIBase {
    private nexus: NexusClient;

    constructor() {
        super();
        this.nexus = new NexusClient();
    }

    /**
     * 创建一个新的生成会话 (数据容器)
     */
    createSession(options: GenerationSessionOptions): GenerationSession {
        return new GenerationSession(options);
    }

    /**
     * 根据 Nexus 节点信息获取模型列表
     * 被 NexusPresetManager.vue 引用
     */
    async fetchProviderModels(providerId: string, apiName: string): Promise<Record<string, { value: string, text: string }[]>> {
        if (!providerId) return {};
        const models = await this.nexus.fetchModels(providerId);
        const groupKey = `${apiName} (后端获取)`;
        const groupObj: Record<string, { value: string, text: string }[]> = { [groupKey]: [] };
        for (const id of models) {
            if (id) groupObj[groupKey].push({ value: id, text: id });
        }
        return groupObj;
    }

    /**
     * 处理消息清理逻辑 (下沉到类中供 Task 或其他模块使用)
     */
    cleanMessages(messages: any[]): CleanedMessage[] {
        if (!Array.isArray(messages)) return [];
        return messages.map(m => {
            const role = m.role || (m.is_user ? 'user' : (m.is_system ? 'system' : 'assistant'));
            const content = m.content || m.mes || '';
            const cleaned: CleanedMessage = {
                role: role as any,
                content: content
            };
            if (m.name) cleaned.name = m.name;
            return cleaned;
        }).filter(m => m.content);
    }

    /**
     * 解析预设中的节点
     * 为多对话/Session 机制提供统一的节点预览与解析逻辑
     */
    resolveNodesFromPreset(presetId?: string): NexusNode[] {
        const presets = lwStorage.get('nexus.presets', [], 'Global') as NexusPreset[];
        
        // 核心修正：尝试寻找目标预设。如果未指定 ID 或指定的 ID 不存在，则默认寻找首个可用预设。
        let targetPreset = presets.find((p: NexusPreset) => p.id === presetId);
        
        if (!targetPreset && presets.length > 0) {
            targetPreset = presets[0];
            console.log(`[LuminaWeave] Preset "${presetId}" not found, falling back to first available: ${targetPreset.name}`);
        }

        let nodesToTry: NexusNode[] = [];
        if (targetPreset?.nodes?.length && targetPreset.nodes.length > 0) {
            nodesToTry = targetPreset.nodes.map((node: NexusNode) => {
                // st_current 类型的节点需要动态获取 ST 当前模型配置
                if (node.provider === 'st_current') {
                    const settings = (this.stMain as any)?.chatCompletionSettings;
                    return {
                        ...node,
                        model: settings?.model || node.model
                    };
                }
                return node;
            });
        }

        // 移除原有的空模型节点保底，改为返回空数组，交由调用方拦截提示
        if (nodesToTry.length === 0) {
            return [];
        }
        return nodesToTry;
    }
}

export const llmEngine = new LuminaWeaveLLMEngine();
