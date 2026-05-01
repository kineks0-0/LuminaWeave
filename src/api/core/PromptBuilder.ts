import { lwStorage } from '../storage';
import { STClient } from './st-adapter/STClient.js';
import { SystemPromptProvider } from './SystemPromptProvider';
import { pluginManager } from '../../core/PluginManager';
import { globalPromptRegistry, PromptType, type PromptContext } from './PromptRegistry';
import { CleanedMessage } from '../../types/nexus';
import type { MemorySnapshot } from '../../types/MemorySnapshotTypes';
import {
    renderForgeMemorySnapshot,
    renderForgeFileMemory,
    renderForgeStageSnapshot,
    renderForgeStructuredState,
    renderForgeDraftTree,
    renderForgeWorkflowSnapshot,
} from '../../resources/prompts/forgePrompts.js';
import { ForgePromptPayloadResolver } from './ForgePromptPayloadResolver.js';
import type { ForgeWorkflowSnapshot } from '../../types/ForgeWorkflowTypes.js';
import type { ForgeDraftTree, ForgeStructuredState } from '../../types/ForgeStructuredTypes.js';
import type { ForgeMemoryTree } from '../../types/ForgeMemoryTypes.js';
import { PromptPresetComposer } from './PromptPresetComposer.js';
import { getPromptPresetProfile } from './PromptPresetProfiles.js';
import { promptPresetRegistry } from './PromptPresetRegistry.js';
import type {
    PromptComposeSources,
    PromptPresetProfileId
} from '../../types/PromptPresetTypes.js';

interface BuildActiveMessagesOptions {
    systemPrompt: string;
    messages: CleanedMessage[];
    includeWorldInfo?: boolean;
    /**
     * 是否允许在没有传 entries 时回退到 ST 全局世界书。
     * 默认为 true。对于 Forge 制卡等需要严格隔离的场景，应设为 false。
     */
    allowSTWorldInfoFallback?: boolean;
    promptContext?: PromptContext;
    includeSystemProtocol?: boolean;
    resolvedLorebookEntries?: LuminaLorebookEntry[];
    memorySnapshot?: MemorySnapshot;
    forgeMemoryTree?: ForgeMemoryTree;
    structuredState?: ForgeStructuredState;
    draftTree?: ForgeDraftTree;
    workflowSnapshot?: ForgeWorkflowSnapshot | null;
}

/**
 * 宏注入引擎 (原提示词构建器)
 * 负责在前端合成最终的消息序列。
 * 包括系统协议挂载、宏替换、世界书集成以及上下文组装。
 */
export class PromptBuilder {
    constructor() {
        SystemPromptProvider.registerAll();
    }

    /**
     * 【核心】前端提示词合成引擎
     * 用于制卡、条目重写等不需要依赖全量聊天历史的场景，或者作为全量合成的准备工作。
     */
    public static buildActiveMessages(options: BuildActiveMessagesOptions): CleanedMessage[] {
        const {
            systemPrompt,
            messages,
            includeWorldInfo = true,
            allowSTWorldInfoFallback = true,
            promptContext = 'chat',
            includeSystemProtocol = false,
            resolvedLorebookEntries = [],
            memorySnapshot,
            forgeMemoryTree,
            structuredState,
            draftTree,
            workflowSnapshot
        } = options;

        let processedSystem = STClient.substituteMacros(systemPrompt);

        const normalizedLorebookEntries = resolvedLorebookEntries.length > 0
            ? resolvedLorebookEntries
            : (allowSTWorldInfoFallback && includeWorldInfo ? STClient.getActiveWorldInfoItems().map(item => ({
                uid: item.id,
                comment: item.id,
                key: [item.id],
                keysecondary: [],
                content: item.content,
                constant: false,
                selective: false,
                selectiveLogic: 0,
                disable: false,
                enabled: true,
                position: 0,
                depth: 0,
                order: 0,
                probability: 100,
                scan_depth: 0
            })) : []);

        const sources: PromptComposeSources = {
            lorebookEntries: includeWorldInfo ? normalizedLorebookEntries : [],
            memorySnapshot,
            forgeMemoryTree,
            structuredState,
            draftTree,
            workflowSnapshot,
            conversationHistory: messages,
            macroContext: {
                legacySystemPrompt: processedSystem
            },
            systemProtocolText: includeSystemProtocol
                ? this.buildCombinedProtocolBlock(promptContext)
                : null
        };

        const profileId: PromptPresetProfileId = promptContext === 'forge' ? 'forge-main' : 'forge-test-chat';
        const profile = getPromptPresetProfile(profileId);
        const preset = promptPresetRegistry.getActivePreset(profileId);

        if (preset.engine === 'st_preset') {
            return this.buildLegacySTMessages(sources, promptContext);
        }

        const result = PromptPresetComposer.compose(profile, preset, sources);
        return this.collapseLeadingSystemMessages(result.messages);
    }

    private static buildLegacySTMessages(sources: PromptComposeSources, promptContext: PromptContext): CleanedMessage[] {
        let processedSystem = sources.macroContext?.legacySystemPrompt || '';

        if (sources.lorebookEntries && sources.lorebookEntries.length > 0) {
            const worldItems = sources.lorebookEntries
                .filter(entry => !entry.disable && entry.enabled !== false)
                .map(entry => ({
                    id: entry.uid ?? entry.comment ?? entry.key?.[0] ?? 'lorebook_entry',
                    content: entry.content || ''
                }));
            
            if (worldItems.length > 0) {
                const worldString = worldItems
                    .map(item => `[World Info: ${item.id}]\n${item.content}`)
                    .join('\n\n');
                
                const label = promptContext === 'forge' ? '参考设定 (Forge Workspace)' : '补充设定 (World Info)';
                processedSystem += `\n\n【${label}】:\n${worldString}`;
            }
        }

        if (sources.memorySnapshot) {
            processedSystem += `\n\n${renderForgeMemorySnapshot(
                ForgePromptPayloadResolver.buildMemorySnapshotTemplateInput(sources.memorySnapshot)
            )}`;
        }

        if (sources.forgeMemoryTree) {
            processedSystem += `\n\n${renderForgeFileMemory(
                ForgePromptPayloadResolver.buildForgeMemoryTreeTemplateInput(sources.forgeMemoryTree)
            )}`;
        }

        if (sources.structuredState) {
            processedSystem += `\n\n${renderForgeStructuredState(
                ForgePromptPayloadResolver.buildStructuredStateTemplateInput(sources.structuredState)
            )}`;
        }

        if (sources.draftTree) {
            processedSystem += `\n\n${renderForgeDraftTree(
                ForgePromptPayloadResolver.buildDraftTreeTemplateInput(sources.draftTree)
            )}`;
        }

        if (sources.workflowSnapshot) {
            processedSystem += `\n\n${renderForgeStageSnapshot(
                ForgePromptPayloadResolver.buildStageTemplateInput(sources.workflowSnapshot)
            )}\n\n${renderForgeWorkflowSnapshot(
                ForgePromptPayloadResolver.buildWorkflowTemplateInput(sources.workflowSnapshot)
            )}`;
        }

        if (sources.systemProtocolText) {
            processedSystem += `\n\n${sources.systemProtocolText}`;
        }

        return [
            { role: 'system', content: processedSystem },
            ...(sources.conversationHistory || [])
        ];
    }

    public static buildForContext(
        context: PromptContext,
        options: Omit<BuildActiveMessagesOptions, 'promptContext'>
    ): CleanedMessage[] {
        return this.buildActiveMessages({
            ...options,
            promptContext: context
        });
    }

    public static buildChatPrompt(options: Omit<BuildActiveMessagesOptions, 'promptContext'>): CleanedMessage[] {
        return this.buildForContext('chat', options);
    }

    public static buildForgePrompt(options: Omit<BuildActiveMessagesOptions, 'promptContext'>): CleanedMessage[] {
        return this.buildForContext('forge', options);
    }

    /**
     * 保持兼容：旧版 build 拦截逻辑
     */
    public async build(originalPayload: any[]): Promise<{ messages: any[], settings?: any }> {
        const preset = await STClient.getPreset('in_use');
        return { messages: originalPayload, settings: preset?.settings };
    }

    /**
     * 构建所有符合规则的提示词片段，供挂载器写入世界书。
     * 这部分逻辑保持兼容，用于 Lumina 系统的元协议注入。
     */
    public buildWorldInfoPrompts(context: PromptContext = 'chat'): any[] {
        const isGlobalEnabled = lwStorage.get('lumina-settings.isPromptInjectionEnabled', true, 'Global');
        if (!isGlobalEnabled) {
            return [];
        }

        const fragmentsToMount: any[] = [];
        const dialogueUIFrequency = lwStorage.get('lumina-chat.dialogueUIFrequency', 1, 'Global');

        for (const f of globalPromptRegistry.getFragmentsForContext(context)) {
            // 物理隔离：如果对话 UI 频率设置为 0 (关闭)，则彻底不挂载 DSL 文档与元数据定义
            if (dialogueUIFrequency === 0) {
                if (f.id === 'core-luminaview-dsl-docs' || f.id === 'core-luminaview-metadata') {
                    console.debug(`[PromptBuilder] 因为互动 UI 频率为 0，跳过挂载核心 UI 片段: ${f.id}`);
                    continue;
                }
            }

            let pluginId: string | null = null;
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
        let allTags = globalPromptRegistry.getAllXMLTags(context);
        
        // 物理隔离：如果频率为 0，从协议列表中也剔除 V 标签 (交互 UI)
        if (dialogueUIFrequency === 0) {
            allTags = allTags.filter(t => t.tag !== 'V');
        }

        if (allTags.length > 0) {
            // 分层渲染逻辑：基于 parent 构建树并生成嵌套编号
            const tagMap = new Map<string, any>(allTags.map(t => [t.tag, { ...t, children: [] }]));
            const rootTags: any[] = [];

            allTags.forEach((t: any) => {
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

    public static buildSystemProtocolText(context: PromptContext = 'chat'): string | null {
        let allTags = globalPromptRegistry.getAllXMLTags(context);
        if (context === 'chat') {
            const dialogueUIFrequency = lwStorage.get('lumina-chat.dialogueUIFrequency', 1, 'Global');
            if (dialogueUIFrequency === 0) {
                allTags = allTags.filter(tag => tag.tag !== 'V');
            }
        }

        if (allTags.length === 0) return null;

        const tagMap = new Map<string, any>(allTags.map(tag => [tag.tag, { ...tag, children: [] }]));
        const rootTags: any[] = [];

        allTags.forEach((tag: any) => {
            const node = tagMap.get(tag.tag);
            if (tag.parent && tagMap.has(tag.parent)) {
                tagMap.get(tag.parent).children.push(node);
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
                const childLines = node.children.map((child: any, index: number) => renderNode(child, `${prefix}.${index + 1}`, depth + 1));
                line += '\n' + childLines.join('\n');
            }
            return line;
        };

        const tagRules = rootTags.map((tag, index) => renderNode(tag, String(index + 1), 0)).join('\n');
        return `[System Protocol]\n你必须严格按以下顺序输出 XML 标签：\n${tagRules}`;
    }

    public static buildCombinedProtocolBlock(context: PromptContext): string | null {
        const blocks = [
            this.buildInlineConstraintText(context),
            this.buildSystemProtocolText(context)
        ].filter((block): block is string => Boolean(block && block.trim()));

        if (blocks.length === 0) {
            return null;
        }

        return blocks.join('\n\n');
    }

    private static buildInlineConstraintText(context: PromptContext): string | null {
        const blocks = globalPromptRegistry.getFragmentsForContext(context)
            .filter(fragment => fragment.type === PromptType.CONSTRAINTS)
            .map(fragment => {
                const content = fragment.getFragment();
                if (!content || this.isPromiseLike(content)) {
                    return null;
                }

                if (typeof content === 'string') {
                    return content.trim() || null;
                }

                if (Array.isArray(content)) {
                    const combined = content
                        .map(message => message.content?.trim())
                        .filter(Boolean)
                        .join('\n\n');
                    return combined || null;
                }

                return content.content?.trim() || null;
            })
            .filter((block): block is string => Boolean(block));

        if (blocks.length === 0) {
            return null;
        }

        return blocks.join('\n\n');
    }

    private static isPromiseLike<T>(value: T | Promise<T>): value is Promise<T> {
        return typeof value === 'object'
            && value !== null
            && 'then' in value
            && typeof value.then === 'function';
    }

    private static collapseLeadingSystemMessages(messages: CleanedMessage[]): CleanedMessage[] {
        if (messages.length <= 1 || messages[0]?.role !== 'system') {
            return messages;
        }

        let systemEnd = 0;
        while (systemEnd < messages.length && messages[systemEnd]?.role === 'system') {
            systemEnd += 1;
        }

        if (systemEnd <= 1) {
            return messages;
        }

        const mergedSystemContent = messages
            .slice(0, systemEnd)
            .map(message => message.content?.trim())
            .filter(Boolean)
            .join('\n\n');

        return [
            { role: 'system', content: mergedSystemContent },
            ...messages.slice(systemEnd)
        ];
    }
}

export const promptBuilder = new PromptBuilder();
