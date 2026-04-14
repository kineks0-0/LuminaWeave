import { END, START, StateGraph, StateSchema } from '@langchain/langgraph/web';
import { z } from 'zod';
import type {
    ForgeRuntimeContext,
    ForgeRuntimeDecision,
    ForgeRuntimeEffect
} from '../../types/ForgeRuntimeTypes';
import type {
    ForgeVisiblePhase,
    ForgeWorkflowAction,
    ForgeWorkflowPromptMode,
    ForgeWorkflowSnapshot,
    ForgeWorkflowTurnInput
} from '../../types/ForgeWorkflowTypes';
import type {
    ForgeLayer,
    ForgeDetailMode,
    ForgeStage,
    ForgeStructuredFieldState,
    ForgeStructuredState
} from '../../types/ForgeStructuredTypes.js';

const orderedLayers: ForgeLayer[] = [
    'concept',
    'entity',
    'state_machine',
    'description',
    'variables',
    'summary',
    'output'
];

const expansionLayers: ForgeLayer[] = ['entity', 'state_machine', 'variables', 'summary', 'output'];
const kickoffFormId = 'kickoff_intent';
const kickoffSuggestedFields = ['direction', 'facets'];
const skeletonSuggestedFields = ['name', 'identity', 'background'];
const narrativeSuggestedFields = ['narrative_core', 'style_notes'];

const plannerIntentPattern = /(?:开始|规划|计划|推进|整理|收束|生成|创建|制作|build|plan|draft|revise|rewrite|update|freeze|form|表单|层|layer|条目|entry|工作区|世界书|审阅|review|publish|输出|补全|重写|修改|更新|草案|冻结)/i;
const conversationIntentPattern = /(?:\?|？|^为什么|^怎么|^如何|^解释|^说明|^聊聊|^对比|^what\b|^why\b|^how\b|^can\b|^could\b|^should\b|是否|能不能|可不可以)/i;
const analystIntentPattern = /(?:回顾|回忆|复盘|检索|重读|重新读取|读取|查阅|查看|总结之前|历史|片段|参考记录|参考内容|世界书|记忆|约束|禁忌|偏好|之前说过|上文|上下文)/i;

const ForgeWorkflowState = new StateSchema({
    userInput: z.string(),
    messageCount: z.number().default(0),
    stagingCount: z.number().default(0),
    commitReadyCount: z.number().default(0),
    stagingEntries: z.array(z.any()).default([]),
    commitReadyEntries: z.array(z.any()).default([]),
    draftCount: z.number().default(0),
    hasReferenceChat: z.boolean().default(false),
    activeLeafId: z.string().nullable().default(null),
    detailMode: z.enum(['detailed', 'quick']).nullable().default(null),
    entryMode: z.enum(['structured', 'freeform']).nullable().default(null),
    activeLayer: z.enum(['concept', 'entity', 'state_machine', 'description', 'variables', 'summary', 'output']).nullable().default(null),
    completedLayers: z.array(z.enum(['concept', 'entity', 'state_machine', 'description', 'variables', 'summary', 'output'])).default([]),
    structuredState: z.any().nullable().default(null),
    missingFields: z.array(z.string()).default([]),
    stage: z.enum(['kickoff', 'skeleton', 'narrative', 'expansion', 'rewrite_export']).default('kickoff'),
    subLayer: z.enum(['concept', 'entity', 'state_machine', 'description', 'variables', 'summary', 'output']).nullable().default(null),
    nextRecommendedLayer: z.enum(['concept', 'entity', 'state_machine', 'description', 'variables', 'summary', 'output']).nullable().default('concept'),
    allowedActions: z.array(z.enum(['choose_detail_mode', 'choose_entry_mode', 'collect_form', 'advance_layer', 'review_drafts', 'freeze_workspace', 'chat'])).default([]),
    reason: z.string().default(''),
    recommendedAction: z.string().default(''),
    shouldGenerate: z.boolean().default(true),
    requiresUserDecision: z.boolean().default(false),
    promptMode: z.enum(['planner', 'conversation', 'analyst', 'executor']).default('planner'),
    updatedAt: z.number().default(0)
});

type ForgeWorkflowStateValue = typeof ForgeWorkflowState.State;

const ForgeDecisionState = new StateSchema({
    context: z.any(),
    workflowSnapshot: z.any().nullable().default(null),
    effects: z.array(z.any()).default([]),
    requiresGeneration: z.boolean().default(false),
    requiresUserDecision: z.boolean().default(false),
    executionRequest: z.any().nullable().default(null)
});

type ForgeDecisionStateValue = typeof ForgeDecisionState.State;

const isFieldEmpty = (field?: ForgeStructuredFieldState): boolean => {
    if (!field) return true;
    if (Array.isArray(field.value)) {
        return field.value.length === 0;
    }
    return !String(field.value || '').trim();
};

const getForm = (structuredState: ForgeStructuredState | undefined, formId: string) => {
    const normalizedState = structuredState || ({
        activeFormId: null,
        activeMessageFormId: null,
        forms: {},
        lastUpdatedAt: 0
    } as ForgeStructuredState);
    return normalizedState.forms[formId] || null;
};

const isKickoffComplete = (structuredState: ForgeStructuredState | undefined): boolean => {
    const kickoffForm = getForm(structuredState, kickoffFormId);
    if (!kickoffForm?.lastSubmittedAt) return false;
    return kickoffSuggestedFields.every((fieldKey) => !isFieldEmpty(kickoffForm.fields[fieldKey]));
};

const detectSuggestedFields = (input: ForgeWorkflowTurnInput): string[] => {
    const structuredState = input.structuredState || ({
        activeFormId: null,
        activeMessageFormId: null,
        forms: {},
        lastUpdatedAt: 0
    } as ForgeStructuredState);

    if (!input.detailMode || !isKickoffComplete(structuredState)) {
        const kickoffForm = structuredState.forms[kickoffFormId];
        return kickoffSuggestedFields.filter((fieldKey) => isFieldEmpty(kickoffForm?.fields[fieldKey]));
    }

    if (!input.completedLayers?.includes('concept')) {
        const conceptForm = structuredState.forms.role_core_profile;
        return skeletonSuggestedFields.filter((fieldKey) => isFieldEmpty(conceptForm?.fields[fieldKey]));
    }

    if (!input.completedLayers?.includes('description')) {
        const descriptionForm = structuredState.forms.description_guides;
        return narrativeSuggestedFields.filter((fieldKey) => isFieldEmpty(descriptionForm?.fields[fieldKey]));
    }

    const activeExpansionLayer = input.activeLayer && expansionLayers.includes(input.activeLayer)
        ? input.activeLayer
        : 'entity';
    const formByLayer: Record<ForgeLayer, string> = {
        concept: 'role_core_profile',
        entity: 'entity_materials',
        state_machine: 'state_machine_flow',
        description: 'description_guides',
        variables: 'variable_routes',
        summary: 'world_root_index',
        output: 'output_design'
    };
    const activeForm = structuredState.forms[formByLayer[activeExpansionLayer]];
    const fieldKeys = Object.keys(activeForm?.fields || {});
    return fieldKeys.filter((fieldKey) => isFieldEmpty(activeForm?.fields[fieldKey]));
};

const routeStage = (state: ForgeWorkflowStateValue): ForgeStage => {
    if (!state.detailMode || !isKickoffComplete(state.structuredState || undefined)) {
        return 'kickoff';
    }

    if (state.commitReadyCount > 0 || state.stagingCount > 0) {
        return 'rewrite_export';
    }

    if (!state.completedLayers.includes('concept')) {
        return 'skeleton';
    }

    if (!state.completedLayers.includes('description')) {
        return 'narrative';
    }

    return 'expansion';
};

const pickActiveLayer = (state: ForgeWorkflowStateValue): ForgeLayer => {
    if (state.stage === 'kickoff' || state.stage === 'skeleton') {
        return 'concept';
    }

    if (state.stage === 'narrative') {
        return 'description';
    }

    if (state.activeLayer && expansionLayers.includes(state.activeLayer)) {
        return state.activeLayer;
    }

    return 'entity';
};

const pickSubLayer = (state: ForgeWorkflowStateValue): ForgeLayer | null => {
    if (state.stage === 'kickoff') return null;
    return pickActiveLayer(state);
};

const buildAllowedActions = (state: ForgeWorkflowStateValue): ForgeWorkflowAction[] => {
    if (!state.detailMode) {
        return ['choose_detail_mode'];
    }

    if (state.stage === 'kickoff') {
        return ['collect_form', 'chat'];
    }

    if (state.stage === 'rewrite_export') {
        return state.commitReadyCount > 0
            ? ['freeze_workspace', 'review_drafts']
            : ['review_drafts', 'chat'];
    }

    if (state.stage === 'expansion') {
        return ['collect_form', 'advance_layer', 'chat'];
    }

    return ['collect_form', 'chat'];
};

const pickNextLayer = (state: ForgeWorkflowStateValue): ForgeLayer | null => {
    if (state.stage === 'kickoff' || state.stage === 'skeleton') {
        return 'concept';
    }

    if (state.stage === 'narrative') {
        return 'description';
    }

    const nextLayer = expansionLayers.find((layerName) => !state.completedLayers.includes(layerName) && layerName !== state.activeLayer);
    return nextLayer || state.activeLayer || 'entity';
};

const shouldUseAnalyst = (context: ForgeRuntimeContext): boolean => {
    const trimmedInput = context.latestUserInput.trim();
    if (!trimmedInput) return false;
    if (!analystIntentPattern.test(trimmedInput)) return false;

    return Boolean(
        context.selectedChatSessionId ||
        context.forgeMemoryTree.entries.length > 0 ||
        context.virtualLorebookEntries.length > 0 ||
        context.messages.length > 6
    );
};

const shouldUsePlanner = (context: ForgeRuntimeContext): boolean => {
    const trimmedInput = context.latestUserInput.trim();
    if (!trimmedInput) return false;

    const hasWorkspacePressure = context.stagingEntries.length > 0 || context.commitReadyEntries.length > 0;
    const looksLikeSeedDump = trimmedInput.length >= 80 || trimmedInput.includes('\n');
    const looksConversational = conversationIntentPattern.test(trimmedInput);
    const looksOperational = plannerIntentPattern.test(trimmedInput);
    const isKickoffStage = !context.detailMode || context.workflowSnapshot?.stage === 'kickoff';
    const missingFields = detectSuggestedFields(toTurnInput(context));

    if (looksOperational || looksLikeSeedDump || hasWorkspacePressure) {
        return true;
    }

    if (looksConversational) {
        return false;
    }

    if (isKickoffStage && missingFields.length > 0 && trimmedInput.length >= 24) {
        return true;
    }

    if (context.detailMode && trimmedInput.length >= 36 && !looksConversational) {
        return true;
    }

    return false;
};
const resolveExecutionMode = (context: ForgeRuntimeContext): ForgeWorkflowPromptMode | null => {
    if (context.latestUserCommand.type === 'submit_form' || context.latestUserCommand.type === 'advance_layer') {
        return 'planner';
    }

    if (context.latestUserCommand.type !== 'send_user_input') return null;
    if (!context.detailMode || !context.latestUserInput.trim()) return null;
    if (shouldUseAnalyst(context)) return 'analyst';
    return shouldUsePlanner(context) ? 'planner' : 'conversation';
};

const resolveVisiblePhase = (
    detailMode: ForgeDetailMode | null | undefined,
    stage: ForgeStage,
    activeLayer: ForgeLayer
): ForgeVisiblePhase => {
    if (detailMode === 'quick') {
        if (stage === 'rewrite_export') {
            return 'finalize';
        }
        if (stage === 'kickoff') {
            return 'kickoff';
        }
        return 'build';
    }

    switch (stage) {
    case 'kickoff':
        return 'alignment';
    case 'skeleton':
        return 'alignment';
    case 'narrative':
        return 'narrative_style';
    case 'expansion':
        if (activeLayer === 'entity') {
            return 'entity_world';
        }
        if (activeLayer === 'state_machine') {
            return 'state_topology';
        }
        if (activeLayer === 'description') {
            return 'narrative_style';
        }
        if (activeLayer === 'output') {
            return 'output_delivery';
        }
        return 'variables_index';
    case 'rewrite_export':
        return 'output_delivery';
    default:
        return 'alignment';
    }
};

const buildSnapshot = (state: ForgeWorkflowStateValue): ForgeWorkflowSnapshot => {
    const activeLayer = pickActiveLayer(state);

    return {
        stage: state.stage,
        visiblePhase: resolveVisiblePhase(state.detailMode, state.stage, activeLayer),
        detailMode: state.detailMode,
        activeLayer,
        subLayer: state.subLayer,
        promptMode: state.promptMode,
        reason: state.reason,
        recommendedAction: state.recommendedAction,
        shouldGenerate: state.shouldGenerate,
        requiresUserDecision: state.requiresUserDecision,
        allowedActions: state.allowedActions,
        missingFields: state.missingFields,
        nextRecommendedLayer: state.nextRecommendedLayer,
        entryMode: state.entryMode,
        stagingCount: state.stagingCount,
        commitReadyCount: state.commitReadyCount,
        stagingEntries: state.stagingEntries,
        commitReadyEntries: state.commitReadyEntries,
        draftCount: state.draftCount,
        completedLayers: state.completedLayers,
        updatedAt: state.updatedAt
    };
};

const toTurnInput = (context: ForgeRuntimeContext): ForgeWorkflowTurnInput => ({
    userInput: context.latestUserInput,
    messageCount: context.messages.length,
    stagingCount: context.stagingEntries.length,
    commitReadyCount: context.commitReadyEntries.length,
    stagingEntries: context.stagingEntries,
    commitReadyEntries: context.commitReadyEntries,
    draftCount: context.draftTree.nodes.length,
    hasReferenceChat: Boolean(context.selectedChatSessionId),
    activeLeafId: context.activeLeafId,
    detailMode: context.detailMode,
    entryMode: context.entryMode,
    activeLayer: context.activeLayer,
    completedLayers: context.completedLayers,
    structuredState: context.structuredState
});

const buildDirectEffects = (context: ForgeRuntimeContext, snapshot: ForgeWorkflowSnapshot): ForgeRuntimeEffect[] => {
    const command = context.latestUserCommand;

    switch (command.type) {
    case 'choose_detail_mode':
        return [
            {
                type: 'add_operation',
                operationKind: 'user_action',
                status: 'completed',
                title: '已选择 Forge 节奏',
                summary: command.mode === 'detailed' ? '进入详细定制模式' : '进入快速开始模式',
                sourceTag: 'choose_detail_mode',
                layer: 'concept'
            },
            { type: 'set_detail_mode', mode: command.mode },
            { type: 'set_entry_mode', mode: 'structured' },
            { type: 'set_active_layer', layer: 'concept' },
            { type: 'refresh_workflow' },
            { type: 'persist_session' }
        ];
    case 'choose_entry_mode':
        return buildDirectEffects({
            ...context,
            latestUserCommand: {
                type: 'choose_detail_mode',
                mode: command.mode === 'structured' ? 'detailed' : 'quick'
            }
        }, snapshot);
    case 'submit_form':
        return [
            {
                type: 'add_operation',
                operationKind: 'user_action',
                status: 'completed',
                title: '已提交结构化表单',
                summary: `${command.formId} 已提交`,
                sourceTag: 'forge_form_result',
                layer: snapshot.activeLayer
            },
            { type: 'submit_form_result', formId: command.formId },
            { type: 'refresh_workflow', userInput: command.userInput },
            { type: 'persist_session' }
        ];
    case 'advance_layer':
        return [
            {
                type: 'add_operation',
                operationKind: 'user_action',
                status: 'completed',
                title: '已切换结构化扩展子层',
                summary: `当前子层已切换到 ${command.layer}`,
                sourceTag: 'forge_step_request',
                layer: command.layer
            },
            { type: 'set_active_layer', layer: command.layer },
            { type: 'refresh_workflow' },
            { type: 'persist_session' }
        ];
    case 'approve_staging':
        return [
            {
                type: 'add_operation',
                operationKind: 'user_action',
                status: 'completed',
                title: '已批准修改建议',
                summary: `暂存项 ${command.stagingId} 已加入工作区准备`,
                sourceTag: 'staging_approved',
                layer: context.activeLayer
            },
            { type: 'move_staging_to_commit_ready', stagingId: command.stagingId },
            { type: 'refresh_workflow' },
            { type: 'persist_session' }
        ];
    case 'reject_staging':
        return [
            {
                type: 'add_operation',
                operationKind: 'user_action',
                status: 'completed',
                title: '已丢弃修改建议',
                summary: `暂存项 ${command.stagingId} 已移除`,
                sourceTag: 'staging_rejected',
                layer: context.activeLayer
            },
            { type: 'remove_staging_entry', stagingId: command.stagingId },
            { type: 'refresh_workflow' },
            { type: 'persist_session' }
        ];
    case 'return_commit_ready':
        return [
            {
                type: 'add_operation',
                operationKind: 'user_action',
                status: 'completed',
                title: '已退回修改建议',
                summary: `写回准备项 ${command.entryId} 已回到暂存区`,
                sourceTag: 'commit_ready_returned',
                layer: context.activeLayer
            },
            { type: 'move_commit_ready_to_staging', entryId: command.entryId },
            { type: 'refresh_workflow' },
            { type: 'persist_session' }
        ];
    case 'freeze_workspace':
        return [
            {
                type: 'add_operation',
                operationKind: 'workspace_write',
                status: 'completed',
                title: '请求冻结虚拟工作区',
                summary: '控制层已请求冻结当前 commit-ready 草案',
                sourceTag: 'freeze_workspace',
                layer: context.activeLayer
            },
            { type: 'freeze_workspace' },
            { type: 'refresh_workflow' },
            { type: 'persist_session' }
        ];
    case 'attach_reference_chat':
        return [
            { type: 'attach_reference_chat', chatSessionId: command.chatSessionId },
            { type: 'refresh_workflow' },
            { type: 'persist_session' }
        ];
    case 'send_user_input':
        return [
            { type: 'append_message', role: 'user', content: command.input, sourceTag: 'user_input' },
            { type: 'refresh_workflow', userInput: command.input },
            { type: 'persist_session' }
        ];
    case 'refresh_workflow':
        return [
            { type: 'refresh_workflow', userInput: command.userInput }
        ];
    case 'noop':
    default:
        return [];
    }
};

const inferPromptModeForTurn = (input: ForgeWorkflowTurnInput, stage: ForgeStage): ForgeWorkflowPromptMode => {
    const trimmedInput = input.userInput.trim();
    if (!trimmedInput) return 'planner';
    if (!input.detailMode) return 'planner';

    const hasContextToRead = Boolean(input.hasReferenceChat || input.draftCount || input.stagingCount || input.commitReadyCount);
    if (hasContextToRead && analystIntentPattern.test(trimmedInput)) {
        return 'analyst';
    }

    if (conversationIntentPattern.test(trimmedInput) && stage !== 'kickoff') {
        return 'conversation';
    }

    return 'planner';
};

export class ForgeWorkflowGraph {
    private static readonly compiled = new StateGraph(ForgeWorkflowState)
        .addNode('ingest_context', (state) => {
            const stage = routeStage(state);
            const activeLayer = pickActiveLayer({ ...state, stage });
            const subLayer = pickSubLayer({ ...state, stage, activeLayer });
            const nextRecommendedLayer = pickNextLayer({ ...state, stage, activeLayer });
            const allowedActions = buildAllowedActions({ ...state, stage, activeLayer, subLayer, nextRecommendedLayer });

            return {
                stage,
                activeLayer,
                subLayer,
                nextRecommendedLayer,
                allowedActions,
                updatedAt: Date.now()
            };
        })
        .addNode('kickoff_state', (state) => ({
            stage: 'kickoff' as const,
            activeLayer: 'concept' as const,
            subLayer: null,
            promptMode: 'planner' as const,
            shouldGenerate: Boolean(state.detailMode),
            requiresUserDecision: true,
            reason: state.detailMode
                ? '当前正在启动阶段，尚未完成本轮启动信息收集。'
                : '当前尚未选择 Forge 节奏。先决定走详细定制还是快速开始。',
            recommendedAction: state.detailMode
                ? '先基于用户首条输入决定是自然语言追问，还是按需输出最小结构化收集组件。'
                : '先选择工作节奏，然后再进入启动偏好收集。',
            allowedActions: buildAllowedActions(state)
        }))
        .addNode('skeleton_state', (state) => ({
            stage: 'skeleton' as const,
            activeLayer: 'concept' as const,
            subLayer: 'concept' as const,
            promptMode: 'planner' as const,
            shouldGenerate: true,
            requiresUserDecision: false,
            reason: '当前正在搭建最小角色骨架，需要先收敛角色的核心身份与背景。',
            recommendedAction: state.missingFields.length > 0
                ? '先追问最少必要信息，必要时给角色骨架表单。'
                : '角色骨架已可运行，可以转入叙事与表现方式。',
            allowedActions: buildAllowedActions(state)
        }))
        .addNode('narrative_state', (state) => ({
            stage: 'narrative' as const,
            activeLayer: 'description' as const,
            subLayer: 'description' as const,
            promptMode: 'planner' as const,
            shouldGenerate: true,
            requiresUserDecision: false,
            reason: '当前正在定义叙事与表现方式，需要明确语言风格、表现重心与场景策略。',
            recommendedAction: state.missingFields.length > 0
                ? '优先补叙事核心和风格约束，再继续结构化扩展。'
                : '叙事表现已成形，可以继续扩展实体、状态与变量结构。',
            allowedActions: buildAllowedActions(state)
        }))
        .addNode('expansion_state', (state) => ({
            stage: 'expansion' as const,
            promptMode: 'planner' as const,
            shouldGenerate: true,
            requiresUserDecision: false,
            reason: `当前正在结构化扩展阶段，正在整理 ${state.activeLayer} 子层。`,
            recommendedAction: state.missingFields.length > 0
                ? '在当前子层补齐关键字段，同时保持推进。'
                : '当前子层已基本完整，可切换到下一个扩展子层或整理草案。',
            allowedActions: buildAllowedActions(state)
        }))
        .addNode('rewrite_export_state', (state) => ({
            stage: 'rewrite_export' as const,
            promptMode: 'planner' as const,
            shouldGenerate: true,
            requiresUserDecision: true,
            reason: state.commitReadyCount > 0
                ? `当前有 ${state.commitReadyCount} 个草案可冻结到虚拟工作区。`
                : `当前有 ${state.stagingCount} 个提案待审阅。`,
            recommendedAction: state.commitReadyCount > 0
                ? '先确认冻结到 Forge 虚拟工作区，再准备导出。'
                : '先审阅 proposal，筛出进入工作区的草案。',
            allowedActions: buildAllowedActions(state)
        }))
        .addEdge(START, 'ingest_context')
        .addConditionalEdges('ingest_context', (state) => state.stage, {
            kickoff: 'kickoff_state',
            skeleton: 'skeleton_state',
            narrative: 'narrative_state',
            expansion: 'expansion_state',
            rewrite_export: 'rewrite_export_state'
        })
        .addEdge('kickoff_state', END)
        .addEdge('skeleton_state', END)
        .addEdge('narrative_state', END)
        .addEdge('expansion_state', END)
        .addEdge('rewrite_export_state', END)
        .compile();

    private static readonly decisionGraph = new StateGraph(ForgeDecisionState)
        .addNode('load_workspace_context', async (state) => ({
            workflowSnapshot: await this.routeTurn(toTurnInput(state.context))
        }))
        .addNode('resolve_user_action', () => ({}))
        .addNode('apply_direct_action', (state) => ({
            effects: buildDirectEffects(state.context, state.workflowSnapshot),
            requiresUserDecision: state.workflowSnapshot?.requiresUserDecision ?? false
        }))
        .addNode('route_generation_mode', (state) => {
            const mode = resolveExecutionMode(state.context);
            const needsGeneration = Boolean(mode);
            return {
                requiresGeneration: needsGeneration,
                executionRequest: needsGeneration
                    ? {
                        mode,
                        messages: [],
                        sessionChatId: state.context.sessionChatId,
                        charName: 'Forge Assistant',
                        sourceCommand: state.context.latestUserCommand
                    }
                    : null
            };
        })
        .addNode('build_planner_request', () => ({}))
        .addNode('run_planner', () => ({}))
        .addNode('consume_stream_events', () => ({}))
        .addNode('apply_planner_effects', () => ({}))
        .addNode('build_executor_request', () => ({}))
        .addNode('run_executor', () => ({}))
        .addNode('apply_executor_effects', () => ({}))
        .addNode('finalize_and_persist', (state) => ({
            requiresUserDecision: state.workflowSnapshot?.requiresUserDecision ?? false
        }))
        .addEdge(START, 'load_workspace_context')
        .addEdge('load_workspace_context', 'resolve_user_action')
        .addEdge('resolve_user_action', 'apply_direct_action')
        .addEdge('apply_direct_action', 'route_generation_mode')
        .addConditionalEdges('route_generation_mode', (state) => state.requiresGeneration ? 'planner' : 'final', {
            planner: 'build_planner_request',
            final: 'finalize_and_persist'
        })
        .addEdge('build_planner_request', 'run_planner')
        .addEdge('run_planner', 'consume_stream_events')
        .addEdge('consume_stream_events', 'apply_planner_effects')
        .addEdge('apply_planner_effects', 'build_executor_request')
        .addEdge('build_executor_request', 'run_executor')
        .addEdge('run_executor', 'apply_executor_effects')
        .addEdge('apply_executor_effects', 'finalize_and_persist')
        .addEdge('finalize_and_persist', END)
        .compile();

    static async routeTurn(input: ForgeWorkflowTurnInput): Promise<ForgeWorkflowSnapshot> {
        const missingFields = detectSuggestedFields(input);
        const completedLayers = input.completedLayers || [];

        const result = await this.compiled.invoke({
            userInput: input.userInput,
            messageCount: input.messageCount,
            stagingCount: input.stagingCount,
            commitReadyCount: input.commitReadyCount,
            stagingEntries: input.stagingEntries,
            commitReadyEntries: input.commitReadyEntries,
            draftCount: input.draftCount || 0,
            hasReferenceChat: input.hasReferenceChat,
            activeLeafId: input.activeLeafId,
            detailMode: input.detailMode || null,
            entryMode: input.entryMode || null,
            activeLayer: input.activeLayer || null,
            completedLayers,
            structuredState: input.structuredState || null,
            missingFields
        });

        const promptMode = inferPromptModeForTurn(input, result.stage);
        return buildSnapshot({ ...result, promptMode });
    }

    static async resolveDecision(context: ForgeRuntimeContext): Promise<ForgeRuntimeDecision> {
        const result = await this.decisionGraph.invoke({
            context,
            workflowSnapshot: null,
            effects: [],
            requiresGeneration: false,
            requiresUserDecision: false,
            executionRequest: null
        } as ForgeDecisionStateValue);

        return {
            workflowSnapshot: result.workflowSnapshot,
            executionRequest: result.executionRequest,
            effects: result.effects,
            requiresGeneration: result.requiresGeneration,
            requiresUserDecision: result.requiresUserDecision
        };
    }
}
