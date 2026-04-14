import {
    globalXMLTagRegistry,
    type LifecycleType,
    type PromptContext,
    type XMLTagDefinition
} from '../../../../shared/XMLTagRegistry.js';

export type { PromptContext } from '../../../../shared/XMLTagRegistry.js';

/**
 * 提示词插槽位置标记
 */
export enum PromptSlot {
    /** [ST 原生] 注入到角色背景描述块中 (Story String) */
    ST_STORY_STRING = 'ST_STORY_STRING',

    /** [ST 原生] 注入到主提示词 (Main Prompt) */
    ST_MAIN = 'ST_MAIN',
    /** [ST 原生] 注入到 NSFW 提示词 */
    ST_NSFW = 'ST_NSFW',
    /** [ST 原生] 注入到越狱提示词 (Jailbreak) */
    ST_JAILBREAK = 'ST_JAILBREAK',
    /** [ST 原生] 注入到作者附注 (Author\'s Note) */
    ST_AUTHOR_NOTE = 'ST_AUTHOR_NOTE'
}

/**
 * 提示词注入类型分类
 * 用于标记化替换和预设组装
 */
export enum PromptType {
    /** 背景 / 世界观 / 设定 */
    WORLD_VIEW = 'WORLD_VIEW',
    /** 角色设定 / 角色详情 / 关系网 */
    CHAR_DESCRIPTION = 'CHAR_DESCRIPTION',
    /** 剧情走向 / 当前场景 / 任务 */
    SCENARIO = 'SCENARIO',
    /** 指令约束 / 格式要求 / 用户输入 */
    CONSTRAINTS = 'CONSTRAINTS',
    /** 示例对话 */
    DIALOGUE_EXAMPLES = 'DIALOGUE_EXAMPLES'
}

/**
 * XML 标签信息说明 (用于自动生成提示词协议)
 */
export interface XMLTagInfo {
    /** 标签名，如 "Mutation" */
    tag: string;
    /** 标签别名，如 ["M"] */
    aliases?: string[];
    lifecycle?: LifecycleType;
    /** 对标签功能的简要说明 */
    description: string;
    /** 
     * 用于在前端流式展示中提示当前状态的文字
     * 例如 "思考中..."、"状态同步中..."
     */
    statusText?: string;
    /** 
     * 锚点标签名
     * 支持内置值：
     * - "__START__": 强制最头部
     * - "__END__": 强制最末尾
     * - 或指向其他已存在的 XML 标签名 (如 "Chat_Reply")
     */
    anchor?: string;
    /** 相对于锚点的位置，默认为 'after' */
    position?: 'before' | 'after';
    /** 同层级排序优先级/权重 (数字越小越靠前) */
    priority: number;
    uiHidden?: boolean;
    exposeInProtocol?: boolean;
    /** 
     * 父级标签名 (可选)
     * 设置后，该标签将在 System Protocol 列表中作为子项缩进显示，并采用嵌套编号 (如 3.1)
     */
    parent?: string;
    promptContexts?: PromptContext[];
}

/**
 * ST 预设标识符 (用于重组模式的精准对齐)
 */
export enum STIdentifier {
    MAIN = 'main',
    STORY_STRING = 'storyString',
    NSFW = 'nsfw',
    JAILBREAK = 'jailbreak',
    AUTHORS_NOTE = 'authorsNote',
    WORLD_INFO_BEFORE = 'worldInfoBefore',
    WORLD_INFO_AFTER = 'worldInfoAfter',
    DIALOGUE_EXAMPLES = 'dialogueExamples',
    CHAT_HISTORY = 'chatHistory',
    SYSTEM = 'system',
    SCENARIO = 'scenario',
    PERSONA = 'persona'
}

/**
 * 结构化提示词消息
 */
export interface PromptMessage {
    role: 'system' | 'user' | 'assistant';
    content: string;
}

/**
 * 提示词片段贡献者接口
 */
export interface PromptFragment {
    /** 唯一标识，用于覆盖或调试 */
    id: string;
    /** 挂载插槽 (Legacy 注入模式) */
    slot: PromptSlot;
    /** 提示词注入类型 (v2 API) */
    type?: PromptType;
    /** 精准 ST 标识符 (v3 API - 重组模式) */
    targetIdentifier?: STIdentifier;
    /** 语义化标签 (用于显示和调试) */
    label?: string;
    /** 优先级：数字越大越靠前 (注入顺序控制) */
    priority: number;
    /**
     * 该片段生效的上下文。未声明时兼容视为 chat。
     */
    contexts?: PromptContext[];
    /** 
     * 该片段贡献的 XML 标签说明 (可选)
     */
    xmlTags?: XMLTagInfo[];
    /** 
     * 获取片段内容的回调函数
     */
    getFragment: () => string | PromptMessage | PromptMessage[] | null | Promise<string | PromptMessage | PromptMessage[] | null>;
}

/**
 * 全局提示词片段注册中心 (核心层)
 */
export class PromptRegistry {
    private fragments: PromptFragment[] = [];

    private normalizeContexts(contexts?: PromptContext[]): PromptContext[] {
        const fallback: PromptContext[] = ['chat'];
        return Array.from(new Set((contexts && contexts.length > 0 ? contexts : fallback).filter(Boolean)));
    }

    private matchesContext(contexts: PromptContext[] | undefined, context: PromptContext): boolean {
        const normalized = this.normalizeContexts(contexts);
        return normalized.includes('shared') || normalized.includes(context);
    }

    private syncFragmentXMLTags(fragment: PromptFragment): void {
        for (const xmlTag of fragment.xmlTags || []) {
            const existing = globalXMLTagRegistry.getDefinition(xmlTag.tag);
            const nextDefinition: XMLTagDefinition = {
                sourceId: fragment.id,
                tag: xmlTag.tag,
                aliases: xmlTag.aliases,
                lifecycle: xmlTag.lifecycle || existing?.lifecycle || 'persistent',
                description: xmlTag.description,
                statusText: xmlTag.statusText,
                uiHidden: xmlTag.uiHidden ?? existing?.uiHidden,
                exposeInProtocol: xmlTag.exposeInProtocol ?? true,
                anchor: xmlTag.anchor,
                position: xmlTag.position,
                priority: xmlTag.priority,
                parent: xmlTag.parent,
                promptContexts: this.normalizeContexts(xmlTag.promptContexts || fragment.contexts || existing?.promptContexts)
            };
            globalXMLTagRegistry.register(nextDefinition);
        }
    }

    /**
     * 注册一个新的提示词片段
     */
    public register(fragment: PromptFragment) {
        this.unregister(fragment.id);
        // 如果存在同名 ID，先移除旧的 (支持热更新/覆盖)
        this.fragments.push(fragment);
        this.syncFragmentXMLTags(fragment);

        // 按优先级降序排序，优先级高的在前面
        this.fragments.sort((a, b) => b.priority - a.priority);

        console.debug(`[PromptRegistry] Registered fragment: ${fragment.id} at ${fragment.slot} (priority: ${fragment.priority})`);
    }

    /**
     * 获取所有已注册的提示词片段 (用于 PromptBuilder 遍历)
     */
    public getAllFragments(): PromptFragment[] {
        return [...this.fragments];
    }

    public getFragmentsForContext(context: PromptContext): PromptFragment[] {
        return this.fragments.filter(fragment => this.matchesContext(fragment.contexts, context));
    }

    /**
     * 获取指定插槽的所有片段
     */
    public getSlotFragments(slot: PromptSlot): PromptFragment[] {
        return this.fragments.filter(f => f.slot === slot);
    }

    public getSlotFragmentsForContext(slot: PromptSlot, context: PromptContext): PromptFragment[] {
        return this.fragments.filter(f => f.slot === slot && this.matchesContext(f.contexts, context));
    }

    /**
     * 获取指定类型的所有片段
     */
    public getTypeFragments(type: PromptType): PromptFragment[] {
        return this.fragments.filter(f => f.type === type);
    }

    /**
     * 获取指定 ST 标识符的所有片段 (v3)
     */
    public getIdentifierFragments(id: STIdentifier): PromptFragment[] {
        return this.fragments.filter(f => f.targetIdentifier === id);
    }

    public getIdentifierFragmentsForContext(id: STIdentifier, context: PromptContext): PromptFragment[] {
        return this.fragments.filter(f => f.targetIdentifier === id && this.matchesContext(f.contexts, context));
    }

    /**
     * 手动移除某个片段
     */
    public unregister(id: string) {
        this.fragments = this.fragments.filter(f => f.id !== id);
        globalXMLTagRegistry.unregister(id);
    }

    /**
     * 获取所有已注册的 XML 标签信息汇总，并执行基于锚点的排序逻辑
     */
    public getAllXMLTags(context: PromptContext = 'chat'): XMLTagInfo[] {
        const rawTags: XMLTagInfo[] = globalXMLTagRegistry.getProtocolDefinitions(context).map(definition => ({
            tag: definition.tag,
            aliases: definition.aliases,
            lifecycle: definition.lifecycle,
            description: definition.description || '',
            statusText: definition.statusText,
            anchor: definition.anchor,
            position: definition.position,
            priority: definition.priority || 0,
            parent: definition.parent,
            uiHidden: definition.uiHidden,
            exposeInProtocol: definition.exposeInProtocol,
            promptContexts: definition.promptContexts
        }));

        // 1. 初始化排序列表
        // 规则：
        // - __START__ 组 (始终排在最前)
        // - 普通组 (分布在各锚点周围)
        // - __END__ 组 (始终排在最后)

        const startGroup: XMLTagInfo[] = [];
        const endGroup: XMLTagInfo[] = [];
        const middleMap = new Map<string, XMLTagInfo[]>(); // anchor -> tags
        const anchors = new Set<string>();

        rawTags.forEach(t => {
            if (t.anchor === '__START__') {
                startGroup.push(t);
            } else if (t.anchor === '__END__') {
                endGroup.push(t);
            } else {
                const targetAnchor = t.anchor || 'Chat_Reply'; // 默认锚点
                if (!middleMap.has(targetAnchor)) middleMap.set(targetAnchor, []);
                middleMap.get(targetAnchor)!.push(t);
                anchors.add(targetAnchor);
            }
        });

        // 2. 组内排序 (按 priority)
        const sortByPriority = (arr: XMLTagInfo[]) => arr.sort((a, b) => a.priority - b.priority);
        sortByPriority(startGroup);
        sortByPriority(endGroup);
        middleMap.forEach(arr => sortByPriority(arr));

        // 3. 构建结果集
        // 这是一个简化的线性排序算法：
        // START -> [BEFORE anchors] -> anchors themselves -> [AFTER anchors] -> END
        const result: XMLTagInfo[] = [...startGroup];

        // 我们以 anchor 本身为中心进行扩散组合
        // 注意：这里为了简单起见，暂不处理深层嵌套递归关系 (如 A before B, B before C)
        // 核心锚点列表（去重后包含 Chat_Reply 等已知锚点）
        const processedAnchors = new Set<string>();

        const insertAnchorGroup = (anchorName: string) => {
            if (processedAnchors.has(anchorName)) return;
            processedAnchors.add(anchorName);

            const group = middleMap.get(anchorName) || [];
            const before = group.filter(t => t.position === 'before');
            const after = group.filter(t => t.position !== 'before');

            // 1. 插入该锚点下的 'before' 成员
            result.push(...before);

            // 2. 如果当前锚点指向的是另一个普通标签且该标签未被处理，先行处理它（简单递归尝试）。
            // 如果该锚点直接是 rawTags 里的某项，且它是核心标签
            const anchorTag = rawTags.find(rt => rt.tag === anchorName);
            if (anchorTag && !processedAnchors.has(anchorTag.tag)) {
                // 如果锚点本身也是个待排标签，递归插入
                // 注意：Chat_Reply 等内置核心由 PromptBuilder 提供，这里由于 PromptBuilder 注册晚，
                // 暂时假设核心标签已由 Core 预先静态占位或外部传入
            }

            // 3. 插入该锚点下的 'after' 成员
            result.push(...after);
        };

        // 处理所有已知锚点
        // 优先处理 Chat_Reply
        if (anchors.has('Chat_Reply')) insertAnchorGroup('Chat_Reply');
        anchors.forEach(a => insertAnchorGroup(a));

        result.push(...endGroup);

        // 4. 彻底去重（保护性）并返回
        // 某些标签可能即是锚点又是标签，或者被多次注册
        const finalResult: XMLTagInfo[] = [];
        const seen = new Set<string>();
        result.forEach(t => {
            if (!seen.has(t.tag)) {
                seen.add(t.tag);
                finalResult.push(t);
            }
        });

        return finalResult;
    }
}

/**
 * 全局单例注册中心 (核心层)
 */
export const globalPromptRegistry = new PromptRegistry();
