export type LifecycleType = 'transient' | 'ephemeral' | 'persistent' | 'presentational';
export type PromptContext = 'chat' | 'forge' | 'director' | 'shared';

const DEFAULT_PROMPT_CONTEXT: PromptContext = 'chat';

const matchesPromptContext = (
    promptContexts: PromptContext[] | undefined,
    context: PromptContext
): boolean => {
    const normalized = promptContexts && promptContexts.length > 0
        ? promptContexts
        : [DEFAULT_PROMPT_CONTEXT];

    return normalized.includes('shared') || normalized.includes(context);
};

export interface XMLTagDefinition {
    tag: string;
    aliases?: string[];
    lifecycle: LifecycleType;
    description?: string;
    statusText?: string;
    uiHidden?: boolean;
    exposeInProtocol?: boolean;
    anchor?: string;
    position?: 'before' | 'after';
    priority?: number;
    parent?: string;
    promptContexts?: PromptContext[];
    sourceId: string;
}

export const CoreXMLTagNames = {
    THINKING: 'thinking',
    CHARACTER_ACTION: 'Character_Action',
    CHAT_REPLY: 'Chat_Reply',
    VIEW: 'V',
    STORY_SUMMARY: 'Story_Summary',
    FORGE_SKILL: 'forge_skill',
    DRAFT_PLAN: 'draft_plan',
    ENTRY_UPDATE: 'entry_update',
    MEMORY_UPDATE: 'memory_update',
    CONTEXT_READ: 'context_read',
    ANALYSIS_HANDOFF: 'analysis_handoff',
    FORM_PREFILL: 'form_prefill',
    FORGE_AUTO_LIST: 'forge_auto_list'
} as const;

const normalizeTag = (tag: string): string => tag.trim().toLowerCase();

export class XMLTagRegistry {
    private readonly stacks = new Map<string, XMLTagDefinition[]>();

    register(definition: XMLTagDefinition): void {
        const canonicalTag = definition.tag.trim();
        const canonicalKey = normalizeTag(canonicalTag);
        const nextDefinition: XMLTagDefinition = {
            ...definition,
            tag: canonicalTag,
            aliases: Array.from(new Set((definition.aliases || []).map(alias => alias.trim()).filter(Boolean))),
            promptContexts: Array.from(new Set((definition.promptContexts || []).filter(Boolean)))
        };

        const stack = this.stacks.get(canonicalKey) || [];
        const deduped = stack.filter(item => item.sourceId !== definition.sourceId);
        deduped.push(nextDefinition);
        this.stacks.set(canonicalKey, deduped);
    }

    unregister(sourceId: string, tag?: string): void {
        const keys = tag ? [normalizeTag(tag)] : Array.from(this.stacks.keys());
        for (const key of keys) {
            const stack = this.stacks.get(key);
            if (!stack) continue;
            const filtered = stack.filter(item => item.sourceId !== sourceId);
            if (filtered.length > 0) {
                this.stacks.set(key, filtered);
            } else {
                this.stacks.delete(key);
            }
        }
    }

    resolveCanonical(tagOrAlias: string | null | undefined): string | null {
        if (!tagOrAlias) return null;
        const normalized = normalizeTag(tagOrAlias);

        if (this.stacks.has(normalized)) {
            return this.getDefinition(tagOrAlias)?.tag || tagOrAlias;
        }

        for (const definition of this.getAllDefinitions()) {
            if ((definition.aliases || []).some(alias => normalizeTag(alias) === normalized)) {
                return definition.tag;
            }
        }
        return null;
    }

    getDefinition(tagOrAlias: string | null | undefined): XMLTagDefinition | undefined {
        if (!tagOrAlias) return undefined;
        const normalized = normalizeTag(tagOrAlias);
        const direct = this.stacks.get(normalized);
        if (direct && direct.length > 0) {
            return direct[direct.length - 1];
        }

        for (const definition of this.getAllDefinitions()) {
            if ((definition.aliases || []).some(alias => normalizeTag(alias) === normalized)) {
                return definition;
            }
        }
        return undefined;
    }

    getAllDefinitions(): XMLTagDefinition[] {
        return Array.from(this.stacks.values())
            .map(stack => stack[stack.length - 1])
            .filter(Boolean);
    }

    getProtocolDefinitions(context: PromptContext = DEFAULT_PROMPT_CONTEXT): XMLTagDefinition[] {
        return this.getAllDefinitions().filter(definition => {
            if (definition.exposeInProtocol === false) return false;
            return matchesPromptContext(definition.promptContexts, context);
        });
    }
}

export const globalXMLTagRegistry = new XMLTagRegistry();

const defaultDefinitions: XMLTagDefinition[] = [
    {
        sourceId: 'core-default-thinking',
        tag: CoreXMLTagNames.THINKING,
        aliases: ['think'],
        lifecycle: 'transient',
        description: '内部思考链，不直接进入用户可见正文。',
        statusText: '思考中...',
        anchor: '__START__',
        priority: 1,
        exposeInProtocol: true,
        promptContexts: ['shared']
    },
    {
        sourceId: 'core-default-character-action',
        tag: CoreXMLTagNames.CHARACTER_ACTION,
        lifecycle: 'transient',
        description: '角色动作中间层标签。',
        statusText: '行动中...',
        priority: 20,
        exposeInProtocol: false,
        promptContexts: ['chat']
    },
    {
        sourceId: 'core-default-chat-reply',
        tag: CoreXMLTagNames.CHAT_REPLY,
        lifecycle: 'persistent',
        description: '用户可见正文。',
        statusText: '回复中...',
        priority: 50,
        exposeInProtocol: true,
        promptContexts: ['chat']
    },
    {
        sourceId: 'core-default-view',
        tag: CoreXMLTagNames.VIEW,
        aliases: ['View'],
        lifecycle: 'presentational',
        description: 'LuminaView 结构化 UI 容器。',
        statusText: '渲染界面..',
        anchor: CoreXMLTagNames.CHAT_REPLY,
        position: 'before',
        priority: 10,
        parent: CoreXMLTagNames.CHAT_REPLY,
        exposeInProtocol: true,
        promptContexts: ['shared']
    },
    {
        sourceId: 'core-default-story-summary',
        tag: CoreXMLTagNames.STORY_SUMMARY,
        lifecycle: 'persistent',
        description: '剧情概况标签。',
        statusText: 'Story_Summary处理中..',
        uiHidden: true,
        priority: 70,
        exposeInProtocol: false,
        promptContexts: ['shared']
    },
    {
        sourceId: 'core-default-mutation',
        tag: 'Mutation',
        aliases: ['M', 'm'],
        lifecycle: 'persistent',
        description: '状态增量更新指令。',
        statusText: '状态同步中...',
        uiHidden: true,
        priority: 75,
        exposeInProtocol: false,
        promptContexts: ['director']
    },
    {
        sourceId: 'core-default-forge-skill',
        tag: CoreXMLTagNames.FORGE_SKILL,
        lifecycle: 'transient',
        description: 'Forge 规划器的动作追踪标签，用于声明当前执行的分析或工具步骤。',
        statusText: 'Agent 正在执行技能...',
        uiHidden: true,
        exposeInProtocol: true,
        promptContexts: ['forge']
    },
    {
        sourceId: 'core-default-draft-plan',
        tag: CoreXMLTagNames.DRAFT_PLAN,
        lifecycle: 'ephemeral',
        description: 'Forge 规划方案标签，用于声明拟议的结构、条目范围和后续动作。',
        statusText: '正在规划方案...',
        uiHidden: true,
        exposeInProtocol: true,
        promptContexts: ['forge']
    },
    {
        sourceId: 'core-default-entry-update',
        tag: CoreXMLTagNames.ENTRY_UPDATE,
        lifecycle: 'persistent',
        description: 'Forge 工作区条目更新标签，用于提交本轮提案或重写结果。',
        statusText: '正在重写条目...',
        uiHidden: true,
        exposeInProtocol: true,
        promptContexts: ['forge']
    },
    {
        sourceId: 'core-default-memory-update',
        tag: CoreXMLTagNames.MEMORY_UPDATE,
        lifecycle: 'ephemeral',
        description: 'Forge 独立文件化记忆更新标签，用于写入偏好、约束和设定决议。',
        statusText: '正在更新 Forge 记忆...',
        uiHidden: true,
        exposeInProtocol: true,
        promptContexts: ['forge']
    },
    {
        sourceId: 'core-default-context-read',
        tag: CoreXMLTagNames.CONTEXT_READ,
        lifecycle: 'ephemeral',
        description: 'Forge 上下文读取标签，用于记录读取了记忆、历史或虚拟世界书的哪一部分。',
        statusText: '正在读取上下文...',
        uiHidden: true,
        exposeInProtocol: true,
        promptContexts: ['forge']
    },
    {
        sourceId: 'core-default-analysis-handoff',
        tag: CoreXMLTagNames.ANALYSIS_HANDOFF,
        lifecycle: 'ephemeral',
        description: 'Forge Analyst 回注给主模型的精简摘要，不直接展示给用户。',
        statusText: '正在整理分析回执...',
        uiHidden: true,
        exposeInProtocol: true,
    },
    {
        sourceId: 'core-default-forge-auto-list',
        tag: CoreXMLTagNames.FORGE_AUTO_LIST,
        aliases: ['auto_list'],
        lifecycle: 'persistent',
        description: 'Forge 状态清单标签，用于展示当前 A.U.T.O 制卡进度与未完成项。',
        statusText: '正在生成进度清单...',
        uiHidden: false,
        exposeInProtocol: true,
        promptContexts: ['forge']
    }
];

for (const definition of defaultDefinitions) {
    globalXMLTagRegistry.register(definition);
}
