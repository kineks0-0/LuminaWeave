import { PromptAssemblyRouter } from '../../hal/prompt/PromptAssemblyRouter.js';
import { PromptPresetComposer } from '../../hal/prompt/PromptPresetComposer.js';
import { promptPresetRegistry } from '../../hal/prompt/PromptPresetRegistry.js';
import { HALContext } from '../../hal/HALContext.js';
import { buildAnalystContext } from '../project/ForgeContextBroker.js';
import { lwStorage } from '../../../storage.js';
import type { CleanedMessage } from '../../../../types/nexus.js';
import type { MemorySnapshot } from '../../../../types/MemorySnapshotTypes.js';
import type { ForgeDraftTree, ForgeStructuredState } from '../../../../types/ForgeStructuredTypes.js';
import type { ForgeExecutionRequest, ForgeRuntimeContext, StagingEntry } from '../../../../types/ForgeRuntimeTypes.js';
import type { ForgeWorkflowIntent, ForgeWorkflowSnapshot } from '../../../../types/ForgeWorkflowTypes.js';
import type { ForgeMemoryTree } from '../../../../types/ForgeMemoryTypes.js';
import type {
    PromptAssemblyResult,
    PromptAssemblyTarget,
    PromptPlannedUnit,
    PromptSessionBinding,
    PromptSourceTrace,
    PromptSourceUnit
} from '../../../../types/PromptAssemblyTypes.js';
import {
    FORGE_AGENT_SYSTEM_PROMPT,
    FORGE_EXECUTOR_SYSTEM_PROMPT,
} from '../../../../resources/prompts/forgePrompts.js';
import type { PromptComposeSources, PromptPresetDefinition, PromptPresetSpecialKey } from '../../../../types/PromptPresetTypes.js';

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
    intent?: Extract<ForgeWorkflowIntent, 'planning' | 'conversation' | 'analysis'>;
}

type ForgeExecutionRequestBase = Omit<ForgeExecutionRequest, 'requestId' | 'traceSource' | 'contextSnapshot' | 'nodeSummary' | 'generationSettings'>;
type ForgeChecklistCandidate = {
    category?: string | null;
    id?: string | number | null;
    targetEntryId?: string | number | null;
    comment?: string | null;
    description?: string | null;
};

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

    private static resolveExecutorPreset(presetId?: string): PromptPresetDefinition {
        const requestedPresetId = presetId ?? promptPresetRegistry.getActivePresetId('forge-agent');
        return (
            promptPresetRegistry.getPreset('forge-agent', requestedPresetId)
            ?? promptPresetRegistry.getActivePreset('forge-agent')
        );
    }

    private static buildExecutorResourceMessages(
        options: BuildExecutorPromptOptions,
        preset: PromptPresetDefinition
    ): CleanedMessage[] {
        const resources = preset.forgeAgentResources;
        const executorPrompt = resources?.executor;
        if (!resources || !executorPrompt) {
            return [];
        }

        const systemContent = [
            `<!-- ${resources.contract.path} -->\n${this.resolveMacros(resources.contract.content)}`,
            `<!-- ${resources.system.path} -->\n${this.resolveMacros(resources.system.content)}`,
            `<!-- ${executorPrompt.path} -->\n${this.resolveMacros(executorPrompt.content)}`
        ].join('\n\n');

        const taskContent = [
            '## Executor rewrite request',
            `instruction: ${options.instruction}`,
            `targetEntryId: "${options.entryId}"`
        ].join('\n');

        const stagingContent = [
            '## Forge project write target',
            'Use write / edit / delete for Forge project VFS writes. Do not publish or overwrite the real ST lorebook directly.',
            `targetEntryId: "${options.entryId}"`,
            'originalContent:',
            options.originalContent
        ].join('\n');

        return [
            { role: 'system', content: systemContent },
            { role: 'user', content: taskContent },
            { role: 'user', content: stagingContent }
        ];
    }

    private static buildExecutorResourceAssembly(
        options: BuildExecutorPromptOptions,
        preset: PromptPresetDefinition
    ): PromptAssemblyResult | null {
        const messages = this.buildExecutorResourceMessages(options, preset);
        const resources = preset.forgeAgentResources;
        const executorPrompt = resources?.executor;
        if (!resources || !executorPrompt || messages.length === 0) {
            return null;
        }

        const sourceUnits: PromptSourceUnit[] = [
            {
                id: 'forge-executor-contract',
                kind: 'control',
                sourceKind: 'forge',
                sourcePath: resources.contract.path,
                label: resources.contract.title ?? 'Forge Agent 工作契约',
                roleHint: 'system',
                priority: 100,
                rawContent: resources.contract.content,
                content: this.resolveMacros(resources.contract.content),
                budgetPolicy: 'pinned',
                forgeSlot: 'runtime_contract',
                forgeRegion: 'static_system'
            },
            {
                id: 'forge-executor-system',
                kind: 'control',
                sourceKind: 'forge',
                sourcePath: resources.system.path,
                label: resources.system.title ?? '默认系统提示词',
                roleHint: 'system',
                priority: 100,
                rawContent: resources.system.content,
                content: this.resolveMacros(resources.system.content),
                budgetPolicy: 'pinned',
                forgeSlot: 'system_static',
                forgeRegion: 'static_system'
            },
            {
                id: 'forge-executor-mode',
                kind: 'control',
                sourceKind: 'forge',
                sourcePath: executorPrompt.path,
                label: executorPrompt.title ?? 'Executor 模式提示词',
                roleHint: 'system',
                priority: 95,
                rawContent: executorPrompt.content,
                content: this.resolveMacros(executorPrompt.content),
                budgetPolicy: 'pinned',
                forgeSlot: 'system_static',
                forgeRegion: 'static_system'
            },
            {
                id: 'forge-executor-task',
                kind: 'control',
                sourceKind: 'forge',
                sourcePath: './review/executor-task.md',
                label: 'Executor rewrite request',
                roleHint: 'user',
                priority: 90,
                rawContent: messages[1]?.content ?? '',
                content: messages[1]?.content ?? '',
                budgetPolicy: 'pinned',
                forgeSlot: 'user_input',
                forgeRegion: 'live_input'
            },
            {
                id: 'forge-executor-staging',
                kind: 'control',
                sourceKind: 'forge',
                sourcePath: './lorebook/entries/target.md',
                label: 'Forge project write target',
                roleHint: 'user',
                priority: 90,
                rawContent: messages[2]?.content ?? '',
                content: messages[2]?.content ?? '',
                budgetPolicy: 'pinned',
                forgeSlot: 'working_statement',
                forgeRegion: 'tail_restatement'
            }
        ];

        const plannedUnits: PromptPlannedUnit[] = sourceUnits.map((unit) => ({
            ...unit,
            inclusion: 'full',
            finalContent: unit.content,
            transforms: [],
            sourceSpans: []
        }));

        const outputMessageIndexFor = (unit: PromptSourceUnit): number => {
            if (unit.roleHint === 'system') return 0;
            return unit.id === 'forge-executor-task' ? 1 : 2;
        };

        const trace: PromptSourceTrace[] = sourceUnits.map((unit) => ({
            traceId: `${unit.id}:trace`,
            unitId: unit.id,
            kind: unit.kind,
            sourceKind: unit.sourceKind,
            resourceRef: unit.resourceRef,
            sourcePath: unit.sourcePath,
            label: unit.label,
            role: unit.roleHint,
            inclusion: 'full',
            outputMessageIndex: outputMessageIndexFor(unit),
            outputStart: null,
            outputEnd: null,
            rawLength: unit.rawContent.length,
            finalLength: unit.content.length,
            transforms: [],
            forgeSlot: unit.forgeSlot,
            forgeRegion: unit.forgeRegion,
            slotPolicy: unit.slotPolicy,
            sourceSpans: []
        }));

        return {
            messages,
            sourceUnits,
            plannedUnits,
            trace,
            diagnostics: [],
            tokenUsage: {
                estimatedTotal: messages.reduce((total, message) => total + Math.ceil(message.content.length / 4), 0),
                bySourceKind: {
                    forge: messages.reduce((total, message) => total + message.content.length, 0)
                }
            }
        };
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
                return '### 项目写入内容格式约定\n- 通过 `write` / `edit` 写入条目时，正文建议使用 **YAML** 格式。\n- 示例：\n```yaml\ntitle: "角色名"\ncontent: "角色描述"\ntags:\n  - 标签1\n  - 标签2\n```';
            case 'toml':
                return '### 项目写入内容格式约定\n- 通过 `write` / `edit` 写入条目时，正文建议使用 **TOML** 格式。\n- 示例：\n```toml\ntitle = "角色名"\ncontent = "角色描述"\ntags = ["标签1", "标签2"]\n```';
            case 'free':
                return '### 项目写入内容格式约定\n- 写入内容格式不限，可以是纯文本、Markdown 或任意结构。请确保文件标题清晰描述该条目名称。';
            case 'json':
            default:
                return '### 项目写入内容格式约定\n- 通过 `write` / `edit` 写入条目时，正文建议使用 **JSON** 格式。\n- JSON 对象必须包含 `title` 字段作为条目名称，以及 `content` 字段作为正文内容。\n- 示例：\n```json\n{\n  "title": "角色名",\n  "content": "角色描述",\n  "tags": ["标签1", "标签2"]\n}\n```';
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
            const match = (entry: ForgeChecklistCandidate): boolean => {
                if (!entry) return false;
                const cat = entry.category || '';
                if (cat === category) return true;
                const id = String(entry.id || entry.targetEntryId || '').toLowerCase();
                const comment = String(entry.comment || entry.description || '').toLowerCase();
                return keywords.some(k => id.includes(k.toLowerCase()) || comment.includes(k.toLowerCase()));
            };
            return virtualEntries.some(e => match(e)) ||
                   staging.some(e => match(e)) ||
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
        note += '1. 所有模型共享上述进度。如果你是 Planner/Analyst，请在补全槽位后，通过能力/技能加载与 `write` / `edit` 更新 `./memory/AUTO/Checklist.md`。\n';
        note += '2. 补全条目时请在文件路径、标题或内容中标明 slot_id；展示进度优先用自然语言摘要或 `<V>` 组件。';

        return note;
    }

    static buildPlannerPrompt(options: BuildPlannerPromptOptions): CleanedMessage[] {
        const maxHistory = options.maxHistoryMessages ?? this.getForgeMaxHistoryMessages();
        return this.composeForgeMainPrompt('agentSystemPrompt', {
            ...options,
            messages: this.truncateHistory(options.messages, maxHistory)
        });
    }

    static buildConversationPrompt(options: BuildPlannerPromptOptions): CleanedMessage[] {
        const maxHistory = options.maxHistoryMessages ?? this.getForgeMaxHistoryMessages();
        return this.composeForgeMainPrompt('agentSystemPrompt', {
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

        return this.composeForgeMainPrompt('agentSystemPrompt', {
            ...options,
            messages: analystCtx.recentHistory
        });
    }

    private static composeForgeMainPrompt(
        specialKey: Extract<PromptPresetSpecialKey, 'agentSystemPrompt'>,
        options: BuildPlannerPromptOptions
    ): CleanedMessage[] {
        return this.composeForgeMainPromptAssembly(specialKey, options).messages;
    }

    private static composeForgeMainPromptAssembly(
        specialKey: Extract<PromptPresetSpecialKey, 'agentSystemPrompt'>,
        options: BuildPlannerPromptOptions
    ): PromptAssemblyResult {
        const presetId = promptPresetRegistry.getActivePresetId('forge-agent');
        const activePreset = promptPresetRegistry.getPreset('forge-agent', presetId) ?? promptPresetRegistry.getActivePreset('forge-agent');
        const target = this.resolveForgeMainTarget(specialKey);
        const route = PromptAssemblyRouter.route({
            target,
            sessionBinding: this.resolveForgeSessionBinding(options),
            policy: { engine: 'lumina', sourceMode: 'project' },
            presetId,
            inputs: {
                mode: target,
                messageCount: options.messages.length
            }
        });

        const resourceAssembly = this.buildForgeMainResourceAssembly(specialKey, options, activePreset);
        if (resourceAssembly) {
            return PromptAssemblyRouter.attachRoute(resourceAssembly, route);
        }

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
            systemProtocolText: null,
            macroContext: {
                [specialKey]: this.resolveForgeMainSystemPrompt(specialKey, options)
            }
        };

        const assembly = PromptPresetComposer.composeWithTrace(
            'forge-agent',
            presetId,
            sources,
            { mergeLeadingSystemMessages: true }
        );
        return PromptAssemblyRouter.attachRoute(assembly, route);
    }

    private static buildForgeMainResourceAssembly(
        specialKey: Extract<PromptPresetSpecialKey, 'agentSystemPrompt'>,
        options: BuildPlannerPromptOptions,
        preset: PromptPresetDefinition
    ): PromptAssemblyResult | null {
        const resources = preset.forgeAgentResources;
        if (!resources) return null;

        const protocolBlock = '';
        const sourceUnits: PromptSourceUnit[] = [
            {
                id: 'forge-main-contract',
                kind: 'control',
                sourceKind: 'forge',
                sourcePath: resources.contract.path,
                label: resources.contract.title ?? 'Forge Agent 工作契约',
                roleHint: 'system',
                priority: 100,
                rawContent: resources.contract.content,
                content: this.resolveMacros(resources.contract.content),
                budgetPolicy: 'pinned',
                forgeSlot: 'runtime_contract',
                forgeRegion: 'static_system'
            },
            {
                id: 'forge-main-system',
                kind: 'control',
                sourceKind: 'forge',
                sourcePath: resources.system.path,
                label: resources.system.title ?? '默认系统提示词',
                roleHint: 'system',
                priority: 100,
                rawContent: resources.system.content,
                content: this.resolveMacros(resources.system.content),
                budgetPolicy: 'pinned',
                forgeSlot: 'system_static',
                forgeRegion: 'static_system'
            },
            {
                id: 'forge-main-protocol',
                kind: 'control',
                sourceKind: 'system_protocol',
                sourcePath: './.forge/agent/protocol.md',
                label: 'Forge protocol block',
                roleHint: 'system',
                priority: 90,
                rawContent: protocolBlock,
                content: protocolBlock,
                budgetPolicy: 'pinned',
                forgeRegion: 'static_system'
            },
            ...(options.forgeAgentSourceUnits ?? []).map((unit) => ({ ...unit })),
            ...options.resolvedLorebookEntries.map((entry, index): PromptSourceUnit => ({
                id: `worldbook:${entry.uid ?? index}`,
                kind: 'information',
                sourceKind: 'worldbook',
                sourcePath: `./lorebook/entries/${entry.uid ?? index}.md`,
                label: entry.comment || `Worldbook entry ${index + 1}`,
                roleHint: 'system',
                priority: 70,
                rawContent: entry.content,
                content: `[World Info: ${entry.comment || (entry.uid ?? index)}]\n${entry.content}`,
                budgetPolicy: 'full'
            })),
            ...options.messages.map((message, index): PromptSourceUnit => ({
                id: `history:${index}`,
                kind: 'information',
                sourceKind: 'history',
                sourcePath: `./threads/目前/messages/${index + 1}.md`,
                label: `History ${index + 1}`,
                roleHint: message.role,
                priority: 50,
                rawContent: message.content,
                content: message.content,
                budgetPolicy: 'full'
            }))
        ];

        const messages: CleanedMessage[] = [];
        const outputIndexByUnitId = new Map<string, number>();

        sourceUnits.forEach((unit) => {
            const role = unit.roleHint ?? 'system';
            if (role === 'system' && messages.length > 0 && messages[messages.length - 1]?.role === 'system') {
                messages[messages.length - 1].content += `\n\n${unit.content}`;
                outputIndexByUnitId.set(unit.id, messages.length - 1);
                return;
            }
            messages.push({
                role,
                content: unit.content
            });
            outputIndexByUnitId.set(unit.id, messages.length - 1);
        });

        const plannedUnits: PromptPlannedUnit[] = sourceUnits.map((unit) => ({
            ...unit,
            inclusion: 'full',
            finalContent: unit.content,
            transforms: [],
            sourceSpans: []
        }));

        const trace: PromptSourceTrace[] = sourceUnits.map((unit) => ({
            traceId: `${unit.id}:trace`,
            unitId: unit.id,
            kind: unit.kind,
            sourceKind: unit.sourceKind,
            resourceRef: unit.resourceRef,
            sourcePath: unit.sourcePath,
            label: unit.label,
            role: unit.roleHint,
            inclusion: 'full',
            outputMessageIndex: outputIndexByUnitId.get(unit.id) ?? null,
            outputStart: null,
            outputEnd: null,
            rawLength: unit.rawContent.length,
            finalLength: unit.content.length,
            transforms: [],
            forgeSlot: unit.forgeSlot,
            forgeRegion: unit.forgeRegion,
            slotPolicy: unit.slotPolicy,
            sourceSpans: []
        }));

        return {
            messages,
            sourceUnits,
            plannedUnits,
            trace,
            diagnostics: [],
            tokenUsage: {
                estimatedTotal: messages.reduce((total, message) => total + Math.ceil(message.content.length / 4), 0),
                bySourceKind: {
                    forge: sourceUnits
                        .filter((unit) => unit.sourceKind === 'forge')
                        .reduce((total, unit) => total + unit.content.length, 0),
                    worldbook: sourceUnits
                        .filter((unit) => unit.sourceKind === 'worldbook')
                        .reduce((total, unit) => total + unit.content.length, 0),
                    history: sourceUnits
                        .filter((unit) => unit.sourceKind === 'history')
                        .reduce((total, unit) => total + unit.content.length, 0)
                }
            }
        };
    }

    private static resolveForgeMainTarget(
        _specialKey: Extract<PromptPresetSpecialKey, 'agentSystemPrompt'>
    ): PromptAssemblyTarget {
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
        _specialKey: Extract<PromptPresetSpecialKey, 'agentSystemPrompt'>,
        options: BuildPlannerPromptOptions
    ): string {
        const backendPrompt = options.presetData?.preset?.blob?.prompts?.[0]?.content?.trim();
        const basePrompt = FORGE_AGENT_SYSTEM_PROMPT;

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
        if (options.intent === 'analysis') {
            return this.buildAnalystPrompt(options);
        }
        if (options.intent === 'conversation') {
            return this.buildConversationPrompt(options);
        }
        return this.buildPlannerPrompt(options);
    }

    static buildPromptPreviewAssembly(options: BuildPromptPreviewOptions): PromptAssemblyResult {
        if (options.intent === 'analysis') {
            const analystCtx = buildAnalystContext({
                memoryTree: options.forgeMemoryTree,
                recentHistory: options.messages,
                requestedEntries: [],
                handoffTarget: 'planner',
                maxRecentMessages: options.maxRecentMessages ?? 10
            });
            return this.composeForgeMainPromptAssembly('agentSystemPrompt', {
                ...options,
                messages: analystCtx.recentHistory
            });
        }
        if (options.intent === 'conversation') {
            const maxHistory = options.maxHistoryMessages ?? this.getForgeMaxHistoryMessages();
            return this.composeForgeMainPromptAssembly('agentSystemPrompt', {
                ...options,
                messages: this.truncateHistory(options.messages, maxHistory)
            });
        }
        const maxHistory = options.maxHistoryMessages ?? this.getForgeMaxHistoryMessages();
        return this.composeForgeMainPromptAssembly('agentSystemPrompt', {
            ...options,
            messages: this.truncateHistory(options.messages, maxHistory)
        });
    }

    static buildPlannerExecutionRequest(params: {
        context: ForgeRuntimeContext;
        presetData?: BackendPresetDetail | null;
        memorySnapshot: MemorySnapshot;
        resolvedLorebookEntries: LuminaLorebookEntry[];
        forgeAgentSourceUnits?: PromptSourceUnit[];
        charName?: string;
        /** 覆盖默认的历史截断窗口（默认读取 lumina-forge.maxHistoryMessages）。0 = 不限制。 */
        maxHistoryMessages?: number;
    }): ForgeExecutionRequestBase {
        return {
            intent: 'planning',
            modelRoute: 'main',
            messages: [],
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
        forgeAgentSourceUnits?: PromptSourceUnit[];
        charName?: string;
        /** 覆盖默认的历史截断窗口（默认读取 lumina-forge.maxHistoryMessages）。0 = 不限制。 */
        maxHistoryMessages?: number;
    }): ForgeExecutionRequestBase {
        return {
            intent: 'conversation',
            modelRoute: 'main',
            messages: [],
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
        forgeAgentSourceUnits?: PromptSourceUnit[];
        charName?: string;
        /** 覆盖默认的历史截断窗口（默认 10）。 */
        maxRecentMessages?: number;
    }): ForgeExecutionRequestBase {
        return {
            intent: 'analysis',
            modelRoute: 'main',
            messages: [],
            sessionChatId: params.context.sessionChatId,
            charName: params.charName || 'Forge Assistant',
            presetId: params.context.selectedPresetId,
            sourceCommand: params.context.latestUserCommand
        };
    }

    static buildExecutorExecutionRequest(options: BuildExecutorPromptOptions): ForgeExecutionRequestBase {
        return {
            intent: 'edit',
            modelRoute: 'executor',
            messages: [],
            sessionChatId: options.sessionChatId,
            charName: options.charName,
            presetId: options.presetId,
            sourceCommand: options.sourceCommand
        };
    }

    static buildExecutorPreviewPayload(options: BuildExecutorPromptOptions): CleanedMessage[] {
        return this.buildExecutorPreviewMessages(options);
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
            presetId: options.presetId ?? promptPresetRegistry.getActivePresetId('forge-agent'),
            inputs: {
                entryId: options.entryId,
                sourceCommandType: options.sourceCommand.type
            }
        });

        const preset = this.resolveExecutorPreset(options.presetId);
        const assembly = PromptPresetComposer.composeWithTrace(
            'forge-agent',
            preset,
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
        const resourceAssembly = assembly.messages.length >= 3
            ? assembly
            : this.buildExecutorResourceAssembly(options, preset);
        return PromptAssemblyRouter.attachRoute(resourceAssembly ?? assembly, route);
    }

    private static buildExecutorPreviewMessages(options: BuildExecutorPromptOptions): CleanedMessage[] {
        const preset = this.resolveExecutorPreset(options.presetId);
        const composedMessages = PromptPresetComposer.compose(
            'forge-agent',
            preset,
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
        return composedMessages.length >= 3
            ? composedMessages
            : this.buildExecutorResourceMessages(options, preset);
    }
}
