import { globalPromptRegistry } from './PromptRegistry';
import { lwStorage } from '../storage';
import { STBridge } from './STBridge';
import { SystemPromptProvider } from './SystemPromptProvider';
import { pluginManager } from '../../core/PluginManager';

export interface PayloadMessage {
    role: 'system' | 'user' | 'assistant';
    content: string;
    name?: string;
    is_example?: boolean;
    identifier?: string;
}

/**
 * 宏注入引擎 (原提示词构建器)
 * 不再强制接管 ST 发信序列，仅扫描 PromptArray 中的 {{lumina_xxx}} 并执行正则替换。
 */
export class PromptBuilder {
    constructor() {
        SystemPromptProvider.registerAll();
    }

    /**
     * 纯净的宏拦截入口，处理 {{lumina_xxx}}
     */
    public async build(originalPayload: PayloadMessage[]): Promise<{ messages: PayloadMessage[], settings?: any }> {
        // 根据“非侵入式”原则，废弃了直接拦截修改 ST prompt 序列的逻辑。
        // ST 原生的提示词系统配合我们的 PromptWorldInfoMount (挂载系统世界书) 即可生效。
        const preset = await STBridge.getPreset('in_use');
        return { messages: originalPayload, settings: preset?.settings };
    }

    /**
     * 构建所有符合规则的提示词片段，供挂载器写入世界书。
     */
    public buildWorldInfoPrompts(): any[] {
        const isGlobalEnabled = lwStorage.get('lumina-settings.isPromptInjectionEnabled', true, 'Global');
        if (!isGlobalEnabled) {
            return [];
        }

        const fragmentsToMount: any[] = [];

        for (const f of (globalPromptRegistry as any).fragments) {
            let pluginId = null;
            Object.keys(pluginManager.plugins).forEach(pid => {
                const shortId = pid.replace('lumina-', '');
                if (f.id.includes(pid) || f.id.includes(shortId)) {
                    pluginId = pid;
                }
            });

            if (pluginId && !pluginManager.isPluginPromptEnabled(pluginId)) {
                console.debug(`[PromptBuilder] 忽略被禁用的插件片段: ${f.id} (插件: ${pluginId})`);
                continue;
            }
            fragmentsToMount.push(f);
        }

        // 追加 XML System Protocol 约束
        const allTags = globalPromptRegistry.getAllXMLTags();
        if (allTags.length > 0) {
            const tagRules = allTags.map((t, index) => {
                const tagStr = t.aliases ? `<${t.tag}> (简写<${t.aliases.join('> <')}>)` : `<${t.tag}>`;
                return `${index + 1}. ${tagStr} : ${t.description}`;
            }).join('\n');

            const protocolText = `[System Protocol]\n你必须严格按以下顺序输出 XML 标签：\n${tagRules}`;

            fragmentsToMount.push({
                id: 'lumina-system-protocol',
                label: 'System Protocol',
                getFragment: () => protocolText,
                priority: 999
            });
        }

        return fragmentsToMount;
    }
}

export const promptBuilder = new PromptBuilder();
