import { PromptBuilder } from '../hal/prompt/PromptBuilder.js';
import { PromptAssemblyRouter } from '../hal/prompt/PromptAssemblyRouter.js';
import { PromptPresetComposer } from '../hal/prompt/PromptPresetComposer.js';
import { promptPresetRegistry } from '../hal/prompt/PromptPresetRegistry.js';
import { HALContext } from '../hal/HALContext.js';
import { buildAnalystContext } from './ForgeContextBroker.js';
import { lwStorage } from '../../storage.js';
import type { CleanedMessage } from '../../../types/nexus.js';
import type { MemorySnapshot } from '../../../types/MemorySnapshotTypes.js';
import type { ForgeDraftTree, ForgeStructuredState } from '../../../types/ForgeStructuredTypes.js';
import type { ForgeExecutionRequest, ForgeRuntimeContext, StagingEntry } from '../../../types/ForgeRuntimeTypes.js';
import type { ForgeWorkflowSnapshot } from '../../../types/ForgeWorkflowTypes.js';
import type { ForgeMemoryTree } from '../../../types/ForgeMemoryTypes.js';
import type {
    PromptAssemblyResult,
    PromptAssemblyTarget,
    PromptSessionBinding,
    PromptSourceUnit
} from '../../../types/PromptAssemblyTypes.js';
import {
    FORGE_PLANNER_PROMPT,
    FORGE_CONVERSATION_PROMPT,
    FORGE_ANALYST_PROMPT,
    FORGE_EXECUTOR_SYSTEM_PROMPT,
} from '../../../resources/prompts/forgePrompts.js';
import type { PromptComposeSources, PromptPresetSpecialKey } from '../../../types/PromptPresetTypes.js';

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
    forgeAgentSourceUnits?: PromptSourceUnit[];
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

type ForgeExecutionRequestBase = Omit<ForgeExecutionRequest, 'requestId' | 'traceSource' | 'contextSnapshot' | 'nodeSummary' | 'generationSettings'>;

export class ForgePromptContextService {
    private static resolveMacros(content: string): string {
        try {
            return HALContext.instance.macroResolver.resolve(content);
        } catch {
            return content;
        }
    }

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
        if (mode === 'off') {
            return '### 当前 Forge 设置\n- form_assistance_mode=off：表单辅助已关闭。请根据用户描述直接在对话中回复建议，无需输出 FFA 辅助函数。';
        }
        return '### 当前 Forge 设置\n- form_assistance_mode=active：你可以使用 `ForgeFormAssist`（FFA）函数为表单字段提供建议值。前端将根据用户偏好决定是直接填入还是作为建议显示。';
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
        const maxHistory = options.maxHistoryMessages ?? this.getForgeMaxHistoryMessages();
        return this.composeForgeMainPrompt('plannerSystemPrompt', {
            ...options,
            messages: this.truncateHistory(options.messages, maxHistory)
        });
    }

    static buildConversationPrompt(options: BuildPlannerPromptOptions): CleanedMessage[] {
        const maxHistory = options.maxHistoryMessages ?? this.getForgeMaxHistoryMessages();
        return this.composeForgeMainPrompt('conversationSystemPrompt', {
            ...options,
            messages: this.truncateHistory(options.messages, maxHistory)
        });
    }

    static buildAnalystPrompt(options: BuildPlannerPromptOptions): CleanedMessage[] {
        // 分析者角色通过 ForgeContextBroker.buildAnalystContext 截断历史，
        // 避免将完整对话传给仅需近期上下文的 analyst 模型。
        const analystCtx = buildAnalystContext({
            memoryTree: options.forgeMemoryTree,
            recentHistory: options.messages,
            requestedEntries: [],
            handoffTarget: 'planner',
            maxRecentMessages: options.maxRecentMessages ?? 10
        });

        return this.composeForgeMainPrompt('analystSystemPrompt', {
            ...options,
            messages: analystCtx.recentHistory
        });
    }

    private static composeForgeMainPrompt(
        specialKey: Extract<PromptPresetSpecialKey, 'plannerSystemPrompt' | 'conversationSystemPrompt' | 'analystSystemPrompt'>,
        options: BuildPlannerPromptOptions
    ): CleanedMessage[] {
        return this.composeForgeMainPromptAssembly(specialKey, options).messages;
    }

    private static composeForgeMainPromptAssembly(
        specialKey: Extract<PromptPresetSpecialKey, 'plannerSystemPrompt' | 'conversationSystemPrompt' | 'analystSystemPrompt'>,
        options: BuildPlannerPromptOptions
    ): PromptAssemblyResult {
        const sources: PromptComposeSources = {
            baseSystemPromptKey: specialKey,
            lorebookEntries: options.resolvedLorebookEntries,
            conversationHistory: options.messages,
            memorySnapshot: options.memorySnapshot,
            forgeMemoryTree: options.forgeMemoryTree,
            structuredState: options.structuredState,
            draftTree: options.draftTree,
            workflowSnapshot: options.workflowSnapshot,
            forgeAgentSourceUnits: options.forgeAgentSourceUnits,
            systemProtocolText: PromptBuilder.buildCombinedProtocolBlock('forge'),
            macroContext: {
                [specialKey]: this.resolveForgeMainSystemPrompt(specialKey, options)
            }
        };

        const target = this.resolveForgeMainTarget(specialKey);
        const route = PromptAssemblyRouter.route({
            target,
            sessionBinding: this.resolveForgeSessionBinding(options),
            policy: { engine: 'lumina', sourceMode: 'project' },
            presetId: promptPresetRegistry.getActivePresetId('forge-main'),
            inputs: {
                mode: target,
                messageCount: options.messages.length
            }
        });

        const assembly = PromptPresetComposer.composeWithTrace(
            'forge-main',
            promptPresetRegistry.getActivePresetId('forge-main'),
            sources,
            { mergeLeadingSystemMessages: true }
        );
        return PromptAssemblyRouter.attachRoute(assembly, route);
    }

    private static resolveForgeMainTarget(
        specialKey: Extract<PromptPresetSpecialKey, 'plannerSystemPrompt' | 'conversationSystemPrompt' | 'analystSystemPrompt'>
    ): PromptAssemblyTarget {
        if (specialKey === 'conversationSystemPrompt') return 'forge.conversation';
        if (specialKey === 'analystSystemPrompt') return 'forge.analyst';
        return 'forge.planner';
    }

    private static resolveForgeSessionBinding(options: BuildPlannerPromptOptions): PromptSessionBinding {
        const selectedChatSessionId = options.memorySnapshot.selectedChatSessionId;
        const sessionId = options.memorySnapshot.sessionId || 'forge-session';
        if (selectedChatSessionId) {
            return {
                kind: 'st-chat',
                chatId: selectedChatSessionId,
                conversationId: sessionId,
                sourceId: 'forge'
            };
        }

        return {
            kind: 'plugin-session',
            sessionId,
            conversationId: sessionId,
            sourceId: 'forge'
        };
    }

    private static resolveForgeMainSystemPrompt(
        specialKey: Extract<PromptPresetSpecialKey, 'plannerSystemPrompt' | 'conversationSystemPrompt' | 'analystSystemPrompt'>,
        options: BuildPlannerPromptOptions
    ): string {
        const backendPrompt = options.presetData?.preset?.blob?.prompts?.[0]?.content?.trim();
        const basePrompt = specialKey === 'plannerSystemPrompt'
            ? FORGE_PLANNER_PROMPT
            : specialKey === 'conversationSystemPrompt'
                ? FORGE_CONVERSATION_PROMPT
                : FORGE_ANALYST_PROMPT;

        const promptParts = [
            basePrompt,
            backendPrompt ? `### 当前预设约束\n${backendPrompt}` : null,
            this.buildFormAssistanceSettingNote(),
            this.buildEntryFormatNote(),
            this.buildAutoChecklistNote(options)
        ].filter((part): part is string => Boolean(part && part.trim()));

        return this.resolveMacros(promptParts.join('\n\n'));
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

    static buildPromptPreviewAssembly(options: BuildPromptPreviewOptions): PromptAssemblyResult {
        if (options.mode === 'analyst') {
            const analystCtx = buildAnalystContext({
                memoryTree: options.forgeMemoryTree,
                recentHistory: options.messages,
                requestedEntries: [],
                handoffTarget: 'planner',
                maxRecentMessages: options.maxRecentMessages ?? 10
            });
            return this.composeForgeMainPromptAssembly('analystSystemPrompt', {
                ...options,
                messages: analystCtx.recentHistory
            });
        }
        if (options.mode === 'conversation') {
            const maxHistory = options.maxHistoryMessages ?? this.getForgeMaxHistoryMessages();
            return this.composeForgeMainPromptAssembly('conversationSystemPrompt', {
                ...options,
                messages: this.truncateHistory(options.messages, maxHistory)
            });
        }
        const maxHistory = options.maxHistoryMessages ?? this.getForgeMaxHistoryMessages();
        return this.composeForgeMainPromptAssembly('plannerSystemPrompt', {
            ...options,
            messages: this.truncateHistory(options.messages, maxHistory)
        });
    }

    static buildPlannerExecutionRequest(params: {
        context: ForgeRuntimeContext;
        presetData?: BackendPresetDetail | null;
        memorySnapshot: MemorySnapshot;
        resolvedLorebookEntries: LuminaLorebookEntry[];
        charName?: string;
        /** 覆盖默认的历史截断窗口（默认读取 lumina-forge.maxHistoryMessages）。0 = 不限制。 */
        maxHistoryMessages?: number;
    }): ForgeExecutionRequestBase {
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
    }): ForgeExecutionRequestBase {
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
    }): ForgeExecutionRequestBase {
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

    static buildExecutorExecutionRequest(options: BuildExecutorPromptOptions): ForgeExecutionRequestBase {
        const messages = PromptPresetComposer.compose(
            'forge-executor',
            promptPresetRegistry.getActivePresetId('forge-executor'),
            {
                baseSystemPromptKey: 'executorSystemPrompt',
                executorTask: {
                    instruction: options.instruction,
                    entryId: options.entryId,
                    originalContent: options.originalContent
                },
                macroContext: {
                    executorSystemPrompt: this.resolveMacros(FORGE_EXECUTOR_SYSTEM_PROMPT)
                }
            }
        ).messages;

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

    static buildExecutorPreviewAssembly(options: BuildExecutorPromptOptions): PromptAssemblyResult {
        const route = PromptAssemblyRouter.route({
            target: 'forge.executor',
            sessionBinding: {
                kind: 'plugin-session',
                sessionId: options.sessionChatId,
                conversationId: options.sessionChatId,
                sourceId: 'forge'
            },
            policy: { engine: 'lumina', sourceMode: 'project' },
            presetId: options.presetId ?? promptPresetRegistry.getActivePresetId('forge-executor'),
            inputs: {
                entryId: options.entryId,
                sourceCommandType: options.sourceCommand.type
            }
        });

        const assembly = PromptPresetComposer.composeWithTrace(
            'forge-executor',
            promptPresetRegistry.getActivePresetId('forge-executor'),
            {
                baseSystemPromptKey: 'executorSystemPrompt',
                executorTask: {
                    instruction: options.instruction,
                    entryId: options.entryId,
                    originalContent: options.originalContent
                },
                macroContext: {
                    executorSystemPrompt: this.resolveMacros(FORGE_EXECUTOR_SYSTEM_PROMPT)
                }
            },
            { mergeLeadingSystemMessages: true }
        );
        return PromptAssemblyRouter.attachRoute(assembly, route);
    }
}
