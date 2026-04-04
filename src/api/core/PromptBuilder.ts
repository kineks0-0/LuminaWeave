import { globalPromptRegistry } from './PromptRegistry';
import { lwStorage } from '../storage';
import { STClient } from './st-adapter/STClient.js';
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
        const preset = await STClient.getPreset('in_use');
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
        const dialogueUIFrequency = lwStorage.get('lumina-chat.dialogueUIFrequency', 1, 'Global');

        for (const f of globalPromptRegistry.getAllFragments()) {
            // 物理隔离：如果对话 UI 频率设置为 0 (关闭)，则彻底不挂载 DSL 文档与元数据定义
            if (dialogueUIFrequency === 0) {
                if (f.id === 'core-luminaview-dsl-docs' || f.id === 'core-luminaview-metadata') {
                    console.debug(`[PromptBuilder] 因为互动 UI 频率为 0，跳过挂载核心 UI 片段: ${f.id}`);
                    continue;
                }
            }

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
        let allTags = globalPromptRegistry.getAllXMLTags();
        
        // 物理隔离：如果频率为 0，从协议列表中也剔除 V 标签 (交互 UI)
        if (dialogueUIFrequency === 0) {
            allTags = allTags.filter(t => t.tag !== 'V');
        }

        if (allTags.length > 0) {
            // 分层渲染逻辑：基于 parent 构建树并生成嵌套编号
            const tagMap = new Map<string, any>(allTags.map(t => [t.tag, { ...t, children: [] }]));
            const rootTags: any[] = [];

            allTags.forEach(t => {
                const node = tagMap.get(t.tag);
                if (t.parent && tagMap.has(t.parent)) {
                    tagMap.get(t.parent).children.push(node);
                } else {
                    rootTags.push(node);
                }
            });

            const renderNode = (node: any, prefix: string, depth: number): string => {
                const indent = '  '.repeat(depth);
                const tagStr = (node.aliases && node.aliases.length > 0)
                    ? `<${node.tag}> (简写 <${node.aliases.join('> <')}>)`
                    : `<${node.tag}>`;
                let line = `${indent}${prefix}. ${tagStr} : ${node.description}`;

                if (node.children.length > 0) {
                    const childLines = node.children.map((c: any, i: number) => renderNode(c, `${prefix}.${i + 1}`, depth + 1));
                    line += '\n' + childLines.join('\n');
                }
                return line;
            };

            const tagRules = rootTags.map((t, i) => renderNode(t, (i + 1).toString(), 0)).join('\n');

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
