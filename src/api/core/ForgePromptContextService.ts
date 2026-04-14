import { PromptBuilder } from './PromptBuilder.js';
import { ForgePromptPayloadResolver } from './ForgePromptPayloadResolver.js';
import { buildAnalystContext, buildMainModelContext } from './ForgeContextBroker.js';
import { lwStorage } from '../storage.js';
import type { CleanedMessage } from '../../types/nexus.js';
import type { MemorySnapshot } from '../../types/MemorySnapshotTypes.js';
import type { ForgeDraftTree, ForgeStructuredState } from '../../types/ForgeStructuredTypes.js';
import type { ForgeExecutionRequest, ForgeRuntimeContext, StagingEntry } from '../../types/ForgeRuntimeTypes.js';
import type { ForgeWorkflowSnapshot } from '../../types/ForgeWorkflowTypes.js';
import type { ForgeMemoryTree } from '../../types/ForgeMemoryTypes.js';
import {
    FORGE_PLANNER_PROMPT,
    FORGE_CONVERSATION_PROMPT,
    FORGE_ANALYST_PROMPT,
    FORGE_EXECUTOR_SYSTEM_PROMPT,
    renderForgeExecutorUserPrompt,
} from '../../resources/prompts/forgePrompts.js';

type BackendPresetDetail = {
    preset?: {
        blob?: {
            prompts?: Array<{
                content?: string;
            }>;
        };
    };
};

interface BuildPlannerPromptOptions {
    presetData?: BackendPresetDetail | null;
    messages: CleanedMessage[];
    resolvedLorebookEntries: LuminaLorebookEntry[];
    memorySnapshot: MemorySnapshot;
    forgeMemoryTree: ForgeMemoryTree;
    structuredState: ForgeStructuredState;
    draftTree: ForgeDraftTree;
    workflowSnapshot: ForgeWorkflowSnapshot | null;
    /** 分析者角色专用：截断对话历史条数，默认 10。仅 buildAnalystPrompt 使用。 */
    maxRecentMessages?: number;
    /** Planner / Conversation 角色：截断对话历史条数。0 = 不限制。 */
    maxHistoryMessages?: number;
}

interface BuildExecutorPromptOptions {
    instruction: string;
    entryId: string;
    originalContent: string;
    sessionChatId: string;
    charName: string;
    presetId?: string;
    sourceCommand: ForgeExecutionRequest['sourceCommand'];
}

interface BuildPromptPreviewOptions extends BuildPlannerPromptOptions {
    mode?: 'planner' | 'conversation' | 'analyst';
}

export class ForgePromptContextService {
    /** 读取 Forge 对话历史截断设置，0 表示不限制。 */
    private static getForgeMaxHistoryMessages(): number {
        return Number(lwStorage.get('lumina-forge.maxHistoryMessages', 20, 'Global'));
    }

    /**
     * 按 maxHistoryMessages 截断消息列表。
     * 0 = 不截断；> 0 = 保留最近 N 条。
     */
    private static truncateHistory(messages: CleanedMessage[], max: number): CleanedMessage[] {
        if (max <= 0 || messages.length <= max) return messages;
        return messages.slice(-max);
    }

    private static buildEntryFormatNote(): string {
        const fmt = lwStorage.get('lumina-forge.entryContentFormat', 'json', 'Global');
        switch (fmt) {
            case 'yaml':
                return '### entry_update 内容格式约定\n- **必须**在 `<entry_update>` 标签内使用 **YAML** 格式输出条目正文，包裹在 ```yaml ... ``` 代码块中。\n- 示例：\n```yaml\ntitle: "角色名"\ncontent: "角色描述"\ntags:\n  - 标签1\n  - 标签2\n```';
            case 'toml':
                return '### entry_update 内容格式约定\n- **必须**在 `<entry_update>` 标签内使用 **TOML** 格式输出条目正文，包裹在 ```toml ... ``` 代码块中。\n- 示例：\n```toml\ntitle = "角色名"\ncontent = "角色描述"\ntags = ["标签1", "标签2"]\n```';
            case 'free':
                return '### entry_update 内容格式约定\n- `<entry_update>` 内容格式不限，可以是纯文本、Markdown 或任意结构。请确保 `description` 属性清晰描述该条目名称。';
            case 'json':
            default:
                return '### entry_update 内容格式约定\n- **必须**在 `<entry_update>` 标签内使用 **JSON** 格式输出条目正文，包裹在 ```json ... ``` 代码块中（或直接输出裸 JSON 对象）。\n- JSON 对象必须包含 `title` 字段作为条目名称，以及 `content` 字段作为正文内容。\n- 示例：\n```json\n{\n  "title": "角色名",\n  "content": "角色描述",\n  "tags": ["标签1", "标签2"]\n}\n```';
        }
    }

    private static buildFormAssistanceSettingNote(): string {
        const mode = lwStorage.get('lumina-forge.formAssistanceMode', 'prefill', 'Global');
        
        switch (mode) {
            case 'prefill':
                return '### 当前 Forge 设置\n- form_assistance_mode=prefill：在 quick 模式且已有当前本地表单时，你可以使用 <form_prefill> 为空字段提供建议值。此模式下，你不必在组件内输出 suggestions 参数。';
            case 'suggestion':
                return '### 当前 Forge 设置\n- form_assistance_mode=suggestion：你不能输出 <form_prefill>。如需辅助用户填写，请务必在 ForgeInput 或 ForgeTextarea 组件中使用 `suggestions="建议1|建议2"` 参数提供 2-3 个预设选项供用户点击填入。';
            case 'off':
            default:
                return '### 当前 Forge 设置\n- form_assistance_mode=off：表单辅助已关闭。不要输出 <form_prefill>，也不要在组件中使用 suggestions 字段。完全依赖用户手动输入。';
        }
    }

    public static buildAutoChecklistNote(options: BuildPlannerPromptOptions): string {
        const virtualEntries = options.resolvedLorebookEntries || [];
        const staging = options.workflowSnapshot?.stagingEntries || [];
        const commitReady = options.workflowSnapshot?.commitReadyEntries || [];
        const memoryEntries = options.forgeMemoryTree?.entries || [];

        // 尝试从记忆中读取已有的清单（由模型维护）
        const memoChecklist = memoryEntries.find(e => e.path === 'AUTO/Checklist');
        
        // 统一检查函数（系统启发式）
        const hasSlot = (category: string, keywords: string[]): boolean => {
            const match = (entry: any): boolean => {
                if (!entry) return false;
                const cat = entry.category || '';
                if (cat === category) return true;
                const id = String(entry.id || entry.targetEntryId || '').toLowerCase();
                const comment = String(entry.comment || entry.description || '').toLowerCase();
                return keywords.some(k => id.includes(k.toLowerCase()) || comment.includes(k.toLowerCase()));
            };
            return virtualEntries.some((e: any) => match(e)) || 
                   staging.some((e: StagingEntry) => match(e)) || 
                   commitReady.some((e: StagingEntry) => match(e));
        };

        const slots = [
            { id: 'creation_blueprint', label: '创作蓝图', keywords: ['blueprint', '创作蓝图'] },
            { id: 'aesthetic_program', label: '世界美学与基调', keywords: ['aesthetic', '基调', '美学'] },
            { id: 'power_system', label: '力量与超凡', keywords: ['power', '力量', '超凡'] },
            { id: 'factions', label: '势力与组织', keywords: ['factions', '势力', '组织'] },
            { id: 'economy', label: '经济与资源', keywords: ['economy', '经济', '资源'] },
            { id: 'philosophy', label: '信仰与哲学', keywords: ['philosophy', '信仰', '哲学'] },
            { id: 'culture', label: '文化与习俗', keywords: ['culture', '文化', '习俗'] },
            { id: 'characters', label: '关键/功能角色', keywords: ['character', '角色'] },
            { id: 'plot', label: '剧情元数据', keywords: ['plot', '剧情'] }
        ];

        let note = '### A.U.T.O 制卡进度清单 (Checklist & Context)\n';
        
        if (memoChecklist) {
            note += `**[共享记忆版本 (AUTO/Checklist)]**:\n${memoChecklist.content}\n\n`;
        }

        note += '**[系统自动追踪 (System Heuristics)]**:\n';
        slots.forEach(slot => {
            const completed = hasSlot(slot.id, slot.keywords);
            note += `- [${completed ? 'x' : ' '}] ${slot.label} (${slot.id})\n`;
        });
        
        note += '\n**指令 (Shared Order)**：\n';
        note += '1. 所有模型共享上述进度。如果你是 Planner/Analyst，请在补全槽位后，务必使用 `<memory_update path="AUTO/Checklist">` 更新共享清单。\n';
        note += '2. 补全条目时请使用 `<entry_update type="slot_id">`，并输出 `<forge_auto_list>` 展示给用户。';

        return note;
    }

    static buildPlannerPrompt(options: BuildPlannerPromptOptions): CleanedMessage[] {
        const basePrompt = options.presetData?.preset?.blob?.prompts?.[0]?.content || FORGE_PLANNER_PROMPT;
        const baseSystemPrompt = `${basePrompt}\n\n${this.buildFormAssistanceSettingNote()}\n\n${this.buildEntryFormatNote()}\n\n${this.buildAutoChecklistNote(options)}`;

        // Planner 角色通过 buildMainModelContext 截断历史，减少无关 token 消耗。
        const maxHistory = options.maxHistoryMessages ?? this.getForgeMaxHistoryMessages();
        return this.buildWorkspacePrompt(baseSystemPrompt, {
            ...options,
            messages: this.truncateHistory(options.messages, maxHistory)
        });
    }

    static buildConversationPrompt(options: BuildPlannerPromptOptions): CleanedMessage[] {
        const presetSystemPrompt = options.presetData?.preset?.blob?.prompts?.[0]?.content?.trim();
        const systemPrompt = presetSystemPrompt
            ? `${FORGE_CONVERSATION_PROMPT}\n\n### 当前预设约束\n${presetSystemPrompt}`
            : FORGE_CONVERSATION_PROMPT;
        const resolvedSystemPrompt = `${systemPrompt}\n\n${this.buildFormAssistanceSettingNote()}\n\n${this.buildEntryFormatNote()}\n\n${this.buildAutoChecklistNote(options)}`;

        // Conversation 角色同样受 maxHistoryMessages 约束。
        const maxHistory = options.maxHistoryMessages ?? this.getForgeMaxHistoryMessages();
        return this.buildWorkspacePrompt(resolvedSystemPrompt, {
            ...options,
            messages: this.truncateHistory(options.messages, maxHistory)
        });
    }

    static buildAnalystPrompt(options: BuildPlannerPromptOptions): CleanedMessage[] {
        const presetSystemPrompt = options.presetData?.preset?.blob?.prompts?.[0]?.content?.trim();
        const systemPrompt = presetSystemPrompt
            ? `${FORGE_ANALYST_PROMPT}\n\n### 当前预设约束\n${presetSystemPrompt}`
            : FORGE_ANALYST_PROMPT;

        // 分析者角色通过 ForgeContextBroker.buildAnalystContext 截断历史，
        // 避免将完整对话传给仅需近期上下文的 analyst 模型。
        const analystCtx = buildAnalystContext({
            memoryTree: options.forgeMemoryTree,
            recentHistory: options.messages,
            requestedEntries: [],
            handoffTarget: 'planner',
            maxRecentMessages: options.maxRecentMessages ?? 10
        });

        return this.buildWorkspacePrompt(systemPrompt, {
            ...options,
            messages: analystCtx.recentHistory
        });
    }

    private static buildWorkspacePrompt(systemPrompt: string, options: BuildPlannerPromptOptions): CleanedMessage[] {
        const payload = ForgePromptPayloadResolver.buildPlannerPromptPayload({
            systemPrompt,
            messages: options.messages,
            resolvedLorebookEntries: options.resolvedLorebookEntries,
            memorySnapshot: options.memorySnapshot,
            forgeMemoryTree: options.forgeMemoryTree,
            structuredState: options.structuredState,
            draftTree: options.draftTree,
            workflowSnapshot: options.workflowSnapshot
        });

        return PromptBuilder.buildForgePrompt({
            ...payload,
            includeSystemProtocol: true,
            allowSTWorldInfoFallback: false
        });
    }

    static buildPromptPreviewPayload(options: BuildPromptPreviewOptions): CleanedMessage[] {
        if (options.mode === 'analyst') {
            return this.buildAnalystPrompt(options);
        }
        if (options.mode === 'conversation') {
            return this.buildConversationPrompt(options);
        }
        return this.buildPlannerPrompt(options);
    }

    static buildPlannerExecutionRequest(params: {
        context: ForgeRuntimeContext;
        presetData?: BackendPresetDetail | null;
        memorySnapshot: MemorySnapshot;
        resolvedLorebookEntries: LuminaLorebookEntry[];
        charName?: string;
        /** 覆盖默认的历史截断窗口（默认读取 lumina-forge.maxHistoryMessages）。0 = 不限制。 */
        maxHistoryMessages?: number;
    }): ForgeExecutionRequest {
        const buildSharedOptions = {
            presetData: params.presetData,
            // 优先使用 mes（已清洗，剥离 XML 标签），减少 Forge 消息中已处理标签的 token 浪费
            // 过滤内容为空的消息（如流式占位节点 prepareAssistantStream 创建的空 assistant 消息）
            messages: params.context.messages
                .filter((m) => (m.mes || m.mesRaw || '').trim() !== '')
                .map((message) => ({
                    role: message.role as CleanedMessage['role'],
                    content: message.mes || message.mesRaw || '',
                    name: message.name
                })),
            maxHistoryMessages: params.maxHistoryMessages,
            resolvedLorebookEntries: params.resolvedLorebookEntries,
            memorySnapshot: params.memorySnapshot,
            forgeMemoryTree: params.context.forgeMemoryTree,
            structuredState: params.context.structuredState,
            draftTree: params.context.draftTree,
            workflowSnapshot: params.context.workflowSnapshot
        };
        const messages = this.buildPlannerPrompt(buildSharedOptions);

        return {
            mode: 'planner',
            messages,
            sessionChatId: params.context.sessionChatId,
            charName: params.charName || 'Forge Assistant',
            presetId: params.context.selectedPresetId,
            sourceCommand: params.context.latestUserCommand
        };
    }

    static buildConversationExecutionRequest(params: {
        context: ForgeRuntimeContext;
        presetData?: BackendPresetDetail | null;
        memorySnapshot: MemorySnapshot;
        resolvedLorebookEntries: LuminaLorebookEntry[];
        charName?: string;
        /** 覆盖默认的历史截断窗口（默认读取 lumina-forge.maxHistoryMessages）。0 = 不限制。 */
        maxHistoryMessages?: number;
    }): ForgeExecutionRequest {
        const messages = this.buildConversationPrompt({
            presetData: params.presetData,
            messages: params.context.messages
                .filter((m) => (m.mes || m.mesRaw || '').trim() !== '')
                .map((message) => ({
                    role: message.role as CleanedMessage['role'],
                    content: message.mes || message.mesRaw || '',
                    name: message.name
                })),
            resolvedLorebookEntries: params.resolvedLorebookEntries,
            memorySnapshot: params.memorySnapshot,
            forgeMemoryTree: params.context.forgeMemoryTree,
            structuredState: params.context.structuredState,
            draftTree: params.context.draftTree,
            workflowSnapshot: params.context.workflowSnapshot,
            maxHistoryMessages: params.maxHistoryMessages
        });

        return {
            mode: 'conversation',
            messages,
            sessionChatId: params.context.sessionChatId,
            charName: params.charName || 'Forge Assistant',
            presetId: params.context.selectedPresetId,
            sourceCommand: params.context.latestUserCommand
        };
    }

    static buildAnalystExecutionRequest(params: {
        context: ForgeRuntimeContext;
        presetData?: BackendPresetDetail | null;
        memorySnapshot: MemorySnapshot;
        resolvedLorebookEntries: LuminaLorebookEntry[];
        charName?: string;
        /** 覆盖默认的历史截断窗口（默认 10）。 */
        maxRecentMessages?: number;
    }): ForgeExecutionRequest {
        const messages = this.buildAnalystPrompt({
            presetData: params.presetData,
            messages: params.context.messages
                .filter((m) => (m.mes || m.mesRaw || '').trim() !== '')
                .map((message) => ({
                    role: message.role as CleanedMessage['role'],
                    content: message.mes || message.mesRaw || '',
                    name: message.name
                })),
            resolvedLorebookEntries: params.resolvedLorebookEntries,
            memorySnapshot: params.memorySnapshot,
            forgeMemoryTree: params.context.forgeMemoryTree,
            structuredState: params.context.structuredState,
            draftTree: params.context.draftTree,
            workflowSnapshot: params.context.workflowSnapshot,
            maxRecentMessages: params.maxRecentMessages
        });

        return {
            mode: 'analyst',
            messages,
            sessionChatId: params.context.sessionChatId,
            charName: params.charName || 'Forge Assistant',
            presetId: params.context.selectedPresetId,
            sourceCommand: params.context.latestUserCommand
        };
    }

    static buildExecutorExecutionRequest(options: BuildExecutorPromptOptions): ForgeExecutionRequest {
        const messages: CleanedMessage[] = [
            {
                role: 'system',
                content: FORGE_EXECUTOR_SYSTEM_PROMPT
            },
            {
                role: 'user',
                content: renderForgeExecutorUserPrompt({
                    instruction: options.instruction,
                    originalContent: options.originalContent,
                    entryId: options.entryId,
                })
            }
        ];

        return {
            mode: 'executor',
            messages,
            sessionChatId: options.sessionChatId,
            charName: options.charName,
            presetId: options.presetId,
            sourceCommand: options.sourceCommand
        };
    }

    static buildExecutorPreviewPayload(options: BuildExecutorPromptOptions): CleanedMessage[] {
        return this.buildExecutorExecutionRequest(options).messages;
    }
}
