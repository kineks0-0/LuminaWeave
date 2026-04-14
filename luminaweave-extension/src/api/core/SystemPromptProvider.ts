import { globalPromptRegistry, PromptSlot, PromptType, STIdentifier } from './PromptRegistry';
import { p } from './PromptUtils';
import { lwStorage } from '../storage';

import { viewComponentRegistry, type ViewSyntaxStyle } from './ViewComponentRegistry';

/**
 * 系统级提示词提供者
 */
export class SystemPromptProvider {
    public static registerAll(): void {
        this.registerXMLMetadata();
        this.registerLuminaViewDSL();
        this.registerForgeLuminaViewDSL();
    }

    /**
     * 注册核心 XML 标签元数据 (用于排序和协议生成)
     */
    private static registerXMLMetadata(): void {
        globalPromptRegistry.register({
            id: 'core-thinking-metadata',
            contexts: ['chat'],
            slot: PromptSlot.ST_MAIN,
            targetIdentifier: STIdentifier.MAIN,
            priority: 0,
            xmlTags: [{
                tag: 'thinking',
                description: '你的内心思考过程和对当前局势的分析。必须最先输出，且不会展示给用户',
                statusText: '思考中...',
                anchor: '__START__',
                priority: 1,
                promptContexts: ['shared']
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
            contexts: ['chat'],
            slot: PromptSlot.ST_MAIN,
            targetIdentifier: STIdentifier.MAIN,
            priority: 0,
            xmlTags: [{
                tag: 'Chat_Reply',
                description: '角色对话与旁白。这是用户将看到的核心剧情内容对话',
                statusText: '回复中..',
                priority: 50,
                promptContexts: ['chat']
            }],
            getFragment: () => null
        });

        globalPromptRegistry.register({
            id: 'core-luminaview-metadata',
            contexts: ['chat'],
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
                parent: 'Chat_Reply',
                promptContexts: ['shared']
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
            contexts: ['chat'],
            slot: PromptSlot.ST_MAIN,
            type: PromptType.CONSTRAINTS,
            targetIdentifier: STIdentifier.WORLD_INFO_BEFORE,
            label: 'UI 渲染指令',
            priority: 110,
            getFragment: () => {
                const dialogueUIFrequency = lwStorage?.get ? lwStorage.get('lumina-chat.dialogueUIFrequency', 1, 'Global') : 1;
                const syntaxStyle = this.getLuminaViewSyntaxStyle();
                
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
                output += '所有结构化 UI 必须且只能包裹在 `<V>` 标签内。\n';
                if (syntaxStyle === 'pipe') {
                    output += '- 当前设置为 **管道式**：`Code|参数1|123`\n';
                    output += '- 你只能输出管道式，不要再输出函数式。\n\n';
                } else {
                    output += '- 当前设置为 **函数式**：`ComponentName("参数1", 123)`\n';
                    output += '- 你只能输出函数式，不要再输出管道式。\n\n';
                }
                output += '注意：不要输出 `Component(key="value")` 这种属性式伪语法。\n\n';
                
                output += '## 2. 混合输出示例 (Usage Example)\n';
                output += '如果发生了好感度变化，你可以这样输出：\n';
                output += '\"这一路上多亏了你，我不再是一个人。\"\n';
                output += syntaxStyle === 'pipe'
                    ? '<V> S|好感度|88|100 </V>\n'
                    : '<V> Stat("好感度", 88, 100) </V>\n';
                output += '随后她露出了少见的羞涩微笑。\n\n';

                output += viewComponentRegistry.getDocumentation(syntaxStyle);
                return output;
            }
        });
    }

    /**
     * 注册 Forge 专属 LuminaView DSL 说明
     */
    private static registerForgeLuminaViewDSL(): void {
        globalPromptRegistry.register({
            id: 'forge-luminaview-dsl-docs',
            contexts: ['forge'],
            slot: PromptSlot.ST_MAIN,
            type: PromptType.CONSTRAINTS,
            targetIdentifier: STIdentifier.WORLD_INFO_BEFORE,
            label: 'Forge DSL 指令',
            priority: 115,
            getFragment: () => {
                const syntaxStyle = this.getLuminaViewSyntaxStyle();
                let output = '# [协议] Forge <V> DSL 结构化收集规范\n\n';
                output += '## 0. Forge 中的 <V> 不是装饰，而是工作流输入协议\n';
                output += '当你需要收集缺失字段、展示摘要、提示缺口或给出层导航时，优先输出 `<V> ... </V>`，而不是大段自然语言问卷。\n\n';

                output += '## 1. 基础语法\n';
                if (syntaxStyle === 'pipe') {
                    output += 'Forge 当前设置为管道式 DSL：`Code|参数1|参数2`。\n';
                    output += '不要输出函数式，也不要写成 XML 属性式伪语法。\n';
                    output += '例如：`FI|role_core_profile|name|角色姓名|例如：林雾`。\n\n';
                } else {
                    output += 'Forge 当前设置为函数式 DSL：`ComponentName("参数1", "参数2")`。\n';
                    output += '⚠️ 绝对禁止写成 XML 标签或属性式伪语法：\n';
                    output += '  ✗ 错误: `<ForgeMissingFields formId="power_system" fields="name,origin" />`\n';
                    output += '  ✗ 错误: `ForgeMissingFields(formId="power_system", fields="name,origin")`\n';
                    output += '  ✓ 正确: `ForgeMissingFields("power_system", "name,origin")`\n';
                    output += '参数按位置顺序传入，不得使用任何 key=value 写法。\n\n';
                }

                output += '## 2. Forge 组件使用原则\n';
                output += '- 以下示例只是语法示例，不是启动阶段固定模板；真实组件内容必须根据用户当前输入动态生成。\n';
                output += '- 启动阶段优先用 `ForgeChoiceGroup` + `ForgeFacetChecklist` + `ForgeMessageSubmit` 组成单消息双区块。\n';
                output += '- 信息不足时，优先 `ForgeForm` + 输入组件，而不是罗列待填清单。\n';
                output += '- `ForgeMissingFields` 用于明确还缺哪些关键字段。\n';
                output += '- `ForgeSummaryCard` 用于汇总当前已收集结果，不替代正式条目写回。\n';
                output += '- 如需引导层推进，可输出 `ForgeLayerNavigator`。\n\n';

                output += '## 3. Forge 推荐示例\n';
                output += '<V>\n';
                if (syntaxStyle === 'pipe') {
                    output += 'FSC|启动模式|我会先确认方向和偏好，再进入最小角色骨架。|细致共创\n';
                    output += 'FCG|kickoff_intent|direction|这次更想从哪种旅行感切入？|["邂逅人物","沿途风景","漫游治愈","未知冒险"]\n';
                    output += 'FFC|kickoff_intent|facets|你现在更在意哪些维度？|["人物关系","空间变化","情绪流动","节奏起伏"]\n';
                    output += 'FMS|kickoff_intent|提交启动偏好并继续\n';
                    output += 'FF|role_core_profile|角色基元采集|先补齐角色的最小可运行骨架。|concept\n';
                    output += 'FI|role_core_profile|name|角色姓名|例如：林雾\n';
                    output += 'FI|role_core_profile|identity|一句话核心设定|例如：失忆的教会审讯官\n';
                    output += 'FS|role_core_profile|faction|阵营 / 立场|["教会","帝国","雇佣兵","中立","未定"]\n';
                    output += 'FT|role_core_profile|background|背景故事|描述成长经历、重大创伤、当前处境\n';
                    output += 'FM|role_core_profile|name,identity,background\n';
                } else {
                    output += 'ForgeSummaryCard("启动模式", "我会先确认方向和偏好，再进入最小角色骨架。", "细致共创")\n';
                    output += 'ForgeChoiceGroup("kickoff_intent", "direction", "这次更想从哪种旅行感切入？", "邂逅人物|沿途风景|漫游治愈|未知冒险")\n';
                    output += 'ForgeFacetChecklist("kickoff_intent", "facets", "你现在更在意哪些维度？", "人物关系|空间变化|情绪流动|节奏起伏")\n';
                    output += 'ForgeMessageSubmit("kickoff_intent", "提交启动偏好并继续")\n';
                    output += 'ForgeForm("role_core_profile", "角色基元采集", "先补齐角色的最小可运行骨架。", "concept")\n';
                    output += 'ForgeInput("role_core_profile", "name", "角色姓名", "例如：林雾")\n';
                    output += 'ForgeInput("role_core_profile", "identity", "一句话核心设定", "例如：失忆的教会审讯官")\n';
                    output += 'ForgeSelect("role_core_profile", "faction", "阵营 / 立场", "教会|帝国|雇佣兵|中立|未定")\n';
                    output += 'ForgeTextarea("role_core_profile", "background", "背景故事", "描述成长经历、重大创伤、当前处境")\n';
                    output += 'ForgeMissingFields("role_core_profile", "name,identity,background")\n';
                }
                output += '</V>\n\n';

                output += viewComponentRegistry.getDocumentation(syntaxStyle);
                return output;
            }
        });
    }

    private static getLuminaViewSyntaxStyle(): ViewSyntaxStyle {
        const value = lwStorage?.get
            ? lwStorage.get('lumina-settings.luminaViewSyntaxStyle', 'functional', 'Global')
            : 'functional';
        return value === 'pipe' ? 'pipe' : 'functional';
    }
}
