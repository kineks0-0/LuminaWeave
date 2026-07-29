import {
    renderForgeDraftTree,
    renderForgeFileMemory,
    renderForgeMemorySnapshot,
    renderForgeStageSnapshot,
    renderForgeStructuredState,
    renderForgeWorkflowSnapshot
} from '../../../../resources/prompts/forgePrompts.js';
import { ForgePromptPayloadResolver } from '../../forge/prompt/ForgePromptPayloadResolver.js';
import type { CleanedMessage } from '../../../../types/nexus.js';
import type {
    PromptComposeSources,
    PromptWorldbookActivatedEntry,
    PromptPresetProfileId,
    PromptPresetSlotDefinition,
    PromptPresetSpecialDefinition
} from '../../../../types/PromptPresetTypes.js';
import {
    FORGE_AGENT_PRESET_SLOT_TO_FORGE_SLOTS,
    getForgePromptSlotPolicy
} from './ForgePromptSlotPolicies.js';

interface PromptPresetSlotResolver {
    slot: PromptPresetSlotDefinition;
    resolve: (sources: PromptComposeSources) => CleanedMessage[] | null;
}

export interface PromptPresetProfileDefinition {
    id: PromptPresetProfileId;
    label: string;
    defaultPresetId: string;
    slots: PromptPresetSlotResolver[];
    specials: PromptPresetSpecialDefinition[];
}

const trimText = (value: string | null | undefined): string | null => {
    const text = value?.trim();
    return text ? text : null;
};

const activeWorldbookEntriesFor = (sources: PromptComposeSources): PromptWorldbookActivatedEntry[] => {
    if (sources.worldbookActivation) {
        return [];
    }
    return (sources.lorebookEntries || [])
        .filter(entry => !entry.disable && entry.enabled !== false)
        .map(entry => ({
            uid: entry.uid ?? entry.comment ?? entry.key?.[0] ?? 'lorebook_entry',
            comment: entry.comment ?? String(entry.uid ?? entry.key?.[0] ?? 'lorebook_entry'),
            content: entry.content,
            role: 'system' as const,
            depth: Number(entry.depth ?? 0),
            order: Number(entry.order ?? 0),
            insertion: {
                position: 'after' as const,
                role: 'system' as const
            }
        }));
};

const worldbookMessageFor = (entry: PromptWorldbookActivatedEntry): CleanedMessage => ({
    role: entry.insertion.role ?? entry.role ?? 'system',
    content: `[World Info: ${entry.uid ?? entry.comment}]\n${entry.content}`
});

const historyWithAtDepthWorldbookEntries = (sources: PromptComposeSources): CleanedMessage[] => {
    const history = (sources.conversationHistory || []).filter(message => trimText(message.content));
    const atDepthEntries = sources.worldbookActivation?.insertionBuckets.at_depth ?? [];
    if (atDepthEntries.length === 0) {
        return history;
    }
    const result = [...history];
    const sorted = [...atDepthEntries].sort((a, b) => b.depth - a.depth || a.order - b.order);
    sorted.forEach(entry => {
        const depth = Math.max(0, Number(entry.insertion.depth ?? entry.depth ?? 0));
        const index = Math.max(0, result.length - depth);
        result.splice(index, 0, worldbookMessageFor(entry));
    });
    return result;
};

const formatLorebookEntries = (entries: PromptWorldbookActivatedEntry[], label: string): string | null => {
    const normalizedEntries = entries
        .map(entry => ({
            id: entry.uid ?? entry.comment ?? 'lorebook_entry',
            content: trimText(entry.content) ?? ''
        }))
        .filter(entry => entry.content);

    if (normalizedEntries.length === 0) {
        return null;
    }

    const worldString = normalizedEntries
        .map(item => `[World Info: ${item.id}]\n${item.content}`)
        .join('\n\n');

    return `【${label}】:\n${worldString}`;
};

const createSlot = (
    id: string,
    label: string,
    defaultRole: CleanedMessage['role'],
    resolve: (sources: PromptComposeSources) => CleanedMessage[] | null,
    description?: string,
    supportsRoleOverride = false,
    forgeSlotPolicy = id === 'base_system_prompt'
        ? getForgePromptSlotPolicy('system_static')
        : undefined
): PromptPresetSlotResolver => ({
    slot: {
        id,
        label,
        description,
        defaultRole,
        supportsRoleOverride,
        forgeSlotPolicy
    },
    resolve
});

const agentSourceMessagesFor = (
    sources: PromptComposeSources,
    slotId: keyof typeof FORGE_AGENT_PRESET_SLOT_TO_FORGE_SLOTS
): CleanedMessage[] | null => {
    const forgeSlots = FORGE_AGENT_PRESET_SLOT_TO_FORGE_SLOTS[slotId];
    const messages = (sources.forgeAgentSourceUnits ?? [])
        .filter(unit => unit.forgeSlot && forgeSlots.includes(unit.forgeSlot))
        .map(unit => ({
            role: unit.roleHint,
            content: unit.content
        }));
    return messages.length > 0 ? messages : null;
};

const forgeMainSlots: PromptPresetSlotResolver[] = [
    createSlot('base_system_prompt', '基础 System Prompt', 'system', (sources) => {
        const key = sources.baseSystemPromptKey;
        if (!key) return null;
        const content = trimText(sources.macroContext?.[key]);
        return content ? [{ role: 'system', content }] : null;
    }, '从当前预设的 agentSystemPrompt 中选择主模型基础 system prompt。'),
    createSlot('agent_runtime_contract', 'Agent 运行契约', 'system', (sources) =>
        agentSourceMessagesFor(sources, 'agent_runtime_contract'), 'Agent 框架注入的稳定运行契约。', false, getForgePromptSlotPolicy('runtime_contract')),
    createSlot('agent_skill_context', 'Agent Skill 上下文', 'system', (sources) =>
        agentSourceMessagesFor(sources, 'agent_skill_context'), '按能力加载进入提示词的 skill 全文或摘要。', false, getForgePromptSlotPolicy('skill_full')),
    createSlot('agent_project_resources', 'Agent 项目资源摘要', 'system', (sources) =>
        agentSourceMessagesFor(sources, 'agent_project_resources'), '由 Forge Agent 图读取的项目资源摘要。', false, getForgePromptSlotPolicy('project_resources')),
    createSlot('agent_review_state', 'Agent 审阅状态', 'system', (sources) =>
        agentSourceMessagesFor(sources, 'agent_review_state'), '由 Forge Agent 图读取的审阅暂存状态。', false, getForgePromptSlotPolicy('review_state')),
    createSlot('workspace_lorebook', '工作区世界书', 'system', (sources) => {
        const content = formatLorebookEntries(activeWorldbookEntriesFor(sources), '参考设定 (Forge Workspace)');
        return content ? [{ role: 'system', content }] : null;
    }),
    createSlot('memory_snapshot', '会话记忆快照', 'system', (sources) => {
        if (!sources.memorySnapshot) return null;
        return [{
            role: 'system',
            content: renderForgeMemorySnapshot(
                ForgePromptPayloadResolver.buildMemorySnapshotTemplateInput(sources.memorySnapshot)
            )
        }];
    }),
    createSlot('forge_memory_tree', 'Forge 文件记忆', 'system', (sources) => {
        if (!sources.forgeMemoryTree) return null;
        return [{
            role: 'system',
            content: renderForgeFileMemory(
                ForgePromptPayloadResolver.buildForgeMemoryTreeTemplateInput(sources.forgeMemoryTree)
            )
        }];
    }),
    createSlot('structured_state', '结构化状态', 'system', (sources) => {
        if (!sources.structuredState) return null;
        return [{
            role: 'system',
            content: renderForgeStructuredState(
                ForgePromptPayloadResolver.buildStructuredStateTemplateInput(sources.structuredState)
            )
        }];
    }),
    createSlot('draft_tree', 'Draft 树', 'system', (sources) => {
        if (!sources.draftTree) return null;
        return [{
            role: 'system',
            content: renderForgeDraftTree(
                ForgePromptPayloadResolver.buildDraftTreeTemplateInput(sources.draftTree)
            )
        }];
    }),
    createSlot('workflow_snapshot', '工作流快照', 'system', (sources) => {
        if (!sources.workflowSnapshot) return null;
        return [{
            role: 'system',
            content: `${renderForgeStageSnapshot(
                ForgePromptPayloadResolver.buildStageTemplateInput(sources.workflowSnapshot)
            )}\n\n${renderForgeWorkflowSnapshot(
                ForgePromptPayloadResolver.buildWorkflowTemplateInput(sources.workflowSnapshot)
            )}`
        }];
    }),
    createSlot('system_protocol', '系统协议', 'system', (sources) => {
        const content = trimText(sources.systemProtocolText);
        return content ? [{ role: 'system', content }] : null;
    }),
    createSlot('agent_working_statement', 'Agent 当前工作声明', 'system', (sources) =>
        agentSourceMessagesFor(sources, 'agent_working_statement'), '固定放在尾部重述当前项目、工作区和权限边界。', false, getForgePromptSlotPolicy('working_statement')),
    createSlot('chat_history', '对话历史', 'user', (sources) => {
        const history = historyWithAtDepthWorldbookEntries(sources);
        return history.length > 0 ? history : null;
    }, '按当前工作流上下文传入的历史消息顺序拼接。'),
    createSlot('agent_user_input', 'Agent 当前用户输入', 'user', (sources) =>
        agentSourceMessagesFor(sources, 'agent_user_input'), '当前轮用户请求，固定进入 live input 区。', false, getForgePromptSlotPolicy('user_input'))
];

const forgeTestChatSlots: PromptPresetSlotResolver[] = [
    createSlot('char_system_prompt', '角色 System Prompt', 'system', (sources) => {
        const content = trimText(sources.charCard?.systemPrompt);
        return content ? [{ role: 'system', content }] : null;
    }),
    createSlot('char_description', '角色描述', 'system', (sources) => {
        const content = trimText(sources.charCard?.description);
        return content ? [{ role: 'system', content }] : null;
    }),
    createSlot('char_personality', '角色性格', 'system', (sources) => {
        const content = trimText(sources.charCard?.personality);
        return content ? [{ role: 'system', content }] : null;
    }),
    createSlot('scenario', '场景设定', 'system', (sources) => {
        const content = trimText(sources.charCard?.scenario);
        return content ? [{ role: 'system', content }] : null;
    }),
    createSlot('world_info', '世界书', 'system', (sources) => {
        const content = formatLorebookEntries(activeWorldbookEntriesFor(sources), '世界设定');
        return content ? [{ role: 'system', content }] : null;
    }),
    createSlot('chat_history', '对话历史', 'user', (sources) => {
        const history = historyWithAtDepthWorldbookEntries(sources);
        return history.length > 0 ? history : null;
    })
];

const PROFILES: Record<PromptPresetProfileId, PromptPresetProfileDefinition> = {
    'forge-agent': {
        id: 'forge-agent',
        label: 'Agent',
        defaultPresetId: 'built-in:forge-agent-default',
        slots: forgeMainSlots,
        specials: [
            { key: 'agentSystemPrompt', label: '主模型指令' },
            { key: 'executorSystemPrompt', label: 'Executor 指令' }
        ]
    },
    'forge-test-chat': {
        id: 'forge-test-chat',
        label: '测试聊天',
        defaultPresetId: 'built-in:forge-test-chat-st-preset',
        slots: forgeTestChatSlots,
        specials: []
    }
};

export const getPromptPresetProfile = (profileId: PromptPresetProfileId): PromptPresetProfileDefinition => PROFILES[profileId];

export const listPromptPresetProfiles = (): PromptPresetProfileDefinition[] => Object.values(PROFILES);
