import {
    renderForgeDraftTree,
    renderForgeFileMemory,
    renderForgeMemorySnapshot,
    renderForgeStageSnapshot,
    renderForgeStructuredState,
    renderForgeWorkflowSnapshot
} from '../../resources/prompts/forgePrompts.js';
import { ForgePromptPayloadResolver } from './ForgePromptPayloadResolver.js';
import type { CleanedMessage } from '../../types/nexus.js';
import type {
    PromptComposeSources,
    PromptPresetProfileId,
    PromptPresetSlotDefinition,
    PromptPresetSpecialDefinition
} from '../../types/PromptPresetTypes.js';

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

const formatLorebookEntries = (entries: LuminaLorebookEntry[], label: string): string | null => {
    const normalizedEntries = entries
        .filter(entry => !entry.disable && entry.enabled !== false)
        .map(entry => ({
            id: entry.uid ?? entry.comment ?? entry.key?.[0] ?? 'lorebook_entry',
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
    supportsRoleOverride = false
): PromptPresetSlotResolver => ({
    slot: {
        id,
        label,
        description,
        defaultRole,
        supportsRoleOverride
    },
    resolve
});

const forgeMainSlots: PromptPresetSlotResolver[] = [
    createSlot('base_system_prompt', '基础 System Prompt', 'system', (sources) => {
        const key = sources.baseSystemPromptKey;
        if (!key) return null;
        const content = trimText(sources.macroContext?.[key]);
        return content ? [{ role: 'system', content }] : null;
    }, '从当前预设的 special prompt 中选择主模型基础 system prompt。'),
    createSlot('workspace_lorebook', '工作区世界书', 'system', (sources) => {
        const content = formatLorebookEntries(sources.lorebookEntries || [], '参考设定 (Forge Workspace)');
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
    createSlot('chat_history', '对话历史', 'user', (sources) => {
        const history = (sources.conversationHistory || []).filter(message => trimText(message.content));
        return history.length > 0 ? history : null;
    }, '按当前工作流上下文传入的历史消息顺序拼接。')
];

const forgeExecutorSlots: PromptPresetSlotResolver[] = [
    createSlot('base_system_prompt', '基础 System Prompt', 'system', (sources) => {
        const key = sources.baseSystemPromptKey;
        if (!key) return null;
        const content = trimText(sources.macroContext?.[key]);
        return content ? [{ role: 'system', content }] : null;
    }),
    createSlot('executor_task', '执行任务', 'user', (sources) => {
        const instruction = trimText(sources.executorTask?.instruction);
        return instruction ? [{ role: 'user', content: `【修改指令】: ${instruction}` }] : null;
    }),
    createSlot('original_entry', '目标条目原文', 'user', (sources) => {
        const task = sources.executorTask;
        const originalContent = trimText(task?.originalContent);
        const entryId = trimText(task?.entryId);
        if (!originalContent || !entryId) return null;
        return [{
            role: 'user',
            content: `【原文】:\n${originalContent}\n\n直接输出修改后的完整条目内容，包含在 <entry_update id="${entryId}" description="..."> 标签中。`
        }];
    })
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
        const content = formatLorebookEntries(sources.lorebookEntries || [], '世界设定');
        return content ? [{ role: 'system', content }] : null;
    }),
    createSlot('chat_history', '对话历史', 'user', (sources) => {
        const history = (sources.conversationHistory || []).filter(message => trimText(message.content));
        return history.length > 0 ? history : null;
    })
];

const PROFILES: Record<PromptPresetProfileId, PromptPresetProfileDefinition> = {
    'forge-main': {
        id: 'forge-main',
        label: '主模型',
        defaultPresetId: 'built-in:forge-main-default',
        slots: forgeMainSlots,
        specials: [
            { key: 'plannerSystemPrompt', label: 'Planner 指令' },
            { key: 'conversationSystemPrompt', label: 'Conversation 指令' },
            { key: 'analystSystemPrompt', label: 'Analyst 指令' }
        ]
    },
    'forge-executor': {
        id: 'forge-executor',
        label: '执行模型',
        defaultPresetId: 'built-in:forge-executor-default',
        slots: forgeExecutorSlots,
        specials: [
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
