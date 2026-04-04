import { globalPromptRegistry, PromptSlot, PromptType, STIdentifier } from './PromptRegistry';
import { p } from './PromptUtils';
import { lwStorage } from '../storage';

import { viewComponentRegistry } from './ViewComponentRegistry';

/**
 * 系统级提示词提供者
 */
export class SystemPromptProvider {
    public static registerAll(): void {
        this.registerXMLMetadata();
        this.registerLuminaViewDSL();
    }

    /**
     * 注册核心 XML 标签元数据 (用于排序和协议生成)
     */
    private static registerXMLMetadata(): void {
        globalPromptRegistry.register({
            id: 'core-thinking-metadata',
            slot: PromptSlot.ST_MAIN,
            targetIdentifier: STIdentifier.MAIN,
            priority: 0,
            xmlTags: [{
                tag: 'thinking',
                description: '你的内心思考过程和对当前局势的分析。必须最先输出，且不会展示给用户',
                statusText: '思考中...',
                anchor: '__START__',
                priority: 1
            }],
            getFragment: () => null
        });

        /* globalPromptRegistry.register({
            id: 'core-character-action-metadata',
            slot: PromptSlot.ST_MAIN,
            targetIdentifier: STIdentifier.MAIN,
            priority: 0,
            xmlTags: [{
                tag: 'Character_Action',
                description: '[已弃用] 角色在当前回合采取的物理或环境动作。建议直接合并至 Chat_Reply 中输出，流式展示时将自动屏蔽此标签内容。',
                statusText: '行动中..',
                priority: 2
            }],
            getFragment: () => null
        }); */

        globalPromptRegistry.register({
            id: 'core-chat-reply-metadata',
            slot: PromptSlot.ST_MAIN,
            targetIdentifier: STIdentifier.MAIN,
            priority: 0,
            xmlTags: [{
                tag: 'Chat_Reply',
                description: '角色对话与旁白。这是用户将看到的核心剧情内容对话',
                statusText: '回复中..',
                priority: 50
            }],
            getFragment: () => null
        });

        globalPromptRegistry.register({
            id: 'core-luminaview-metadata',
            slot: PromptSlot.ST_MAIN,
            targetIdentifier: STIdentifier.MAIN,
            priority: 0,
            xmlTags: [{
                tag: 'V',
                aliases: ['View'],
                description: '视觉化组件容器。用于在对话中穿插展示属性条、进度、选项等 UI 元素。内容必须使用 LuminaView DSL 编写',
                statusText: '渲染界面..',
                anchor: 'Chat_Reply',
                position: 'before',
                priority: 10,
                parent: 'Chat_Reply'
            }],
            getFragment: () => null
        });
    }

    /**
     * 注册 LuminaView DSL 说明
     */
    private static registerLuminaViewDSL(): void {
        globalPromptRegistry.register({
            id: 'core-luminaview-dsl-docs',
            slot: PromptSlot.ST_MAIN,
            type: PromptType.CONSTRAINTS,
            targetIdentifier: STIdentifier.WORLD_INFO_BEFORE,
            label: 'UI 渲染指令',
            priority: 110,
            getFragment: () => {
                const dialogueUIFrequency = lwStorage?.get ? lwStorage.get('lumina-chat.dialogueUIFrequency', 1, 'Global') : 1;
                
                // 如果频率为 0，则不注入 UI 渲染协议
                if (dialogueUIFrequency === 0) return null;

                // 频率权重引导
                const frequencyPrompts: Record<number, string> = {
                    1: '仅在重大部分或关键抉择（如需用户进行关键抉择）时才使用 UI 组件。',
                    2: '适量使用 UI 组件展示关键数值变化（如 HP、亲密、任务），以增强沉浸感。',
                    3: '较积极地使用 UI 组件来增强剧情的互动性与视觉表现。',
                    4: '尽可能频繁地使用 UI 组件作为叙事手段的一环，使交互更加生动和结构化。'
                };
                
                const weightDesc = frequencyPrompts[dialogueUIFrequency] || frequencyPrompts[2];

                let output = '# [协议] LuminaView UI 交互渲染规范\n\n';
                output += `## 0. 活跃度配置 (Frequency: ${dialogueUIFrequency}/4)\n`;
                output += `**指令**: ${weightDesc}\n\n`;
                
                output += '## 1. 基础语法 (Basic Syntax)\n';
                output += '所有结构化 UI 必须且只能包裹在 `<V>` 标签内。支持以下两种调用方式：\n';
                output += '- **函数式 (推荐)**: `ComponentName("参数1", 123)` - 极其清晰，适合逻辑理解。\n';
                output += '- **管道式 (极致压缩)**: `Code|参数1|123` - 适合节省 Token。\n\n';
                
                output += '## 2. 混合输出示例 (Usage Example)\n';
                output += '如果发生了好感度变化，你可以这样输出：\n';
                output += '\"这一路上多亏了你，我不再是一个人。\"\n';
                output += '<V> Stat("好感度", 88, 100) </V>\n';
                output += '随后她露出了少见的羞涩微笑。\n\n';

                output += viewComponentRegistry.getDocumentation();
                return output;
            }
        });
    }
}
