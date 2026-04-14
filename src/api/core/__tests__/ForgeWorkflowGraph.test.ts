import { describe, expect, it } from 'vitest';
import { ForgeWorkflowGraph } from '../ForgeWorkflowGraph';
import type { ForgeStructuredState } from '../../../types/ForgeStructuredTypes';
import type { ForgeRuntimeContext } from '../../../types/ForgeRuntimeTypes';

const emptyStructuredState: ForgeStructuredState = {
    activeFormId: null,
    activeMessageFormId: null,
    forms: {},
    lastUpdatedAt: 0
};

const kickoffCompletedState: ForgeStructuredState = {
    activeFormId: 'kickoff_intent',
    activeMessageFormId: null,
    lastUpdatedAt: 1,
    forms: {
        kickoff_intent: {
            id: 'kickoff_intent',
            layer: 'concept',
            title: '启动阶段',
            fields: {
                direction: { value: '沿途风景', locked: false, confirmed: true, source: 'manual', updatedAt: 1 },
                facets: { value: ['空间变化', '情绪流动'], locked: false, confirmed: true, source: 'manual', updatedAt: 1 }
            },
            missingFields: [],
            lastSubmittedAt: 1
        }
    }
};

const conceptCompletedState: ForgeStructuredState = {
    ...kickoffCompletedState,
    activeFormId: 'role_core_profile',
    forms: {
        ...kickoffCompletedState.forms,
        role_core_profile: {
            id: 'role_core_profile',
            layer: 'concept',
            title: '概念层',
            fields: {
                name: { value: '林雾', locked: false, confirmed: true, source: 'manual', updatedAt: 1 },
                identity: { value: '失忆的审讯官', locked: false, confirmed: true, source: 'manual', updatedAt: 1 },
                background: { value: '被迫踏上旅行', locked: false, confirmed: true, source: 'manual', updatedAt: 1 }
            },
            missingFields: [],
            lastSubmittedAt: 1
        }
    }
};

const narrativeCompletedState: ForgeStructuredState = {
    ...conceptCompletedState,
    activeFormId: 'description_guides',
    forms: {
        ...conceptCompletedState.forms,
        description_guides: {
            id: 'description_guides',
            layer: 'description',
            title: '描写层',
            fields: {
                narrative_core: { value: '慢节奏旅行叙事', locked: false, confirmed: true, source: 'manual', updatedAt: 1 },
                style_notes: { value: '重氛围和景色切换', locked: false, confirmed: true, source: 'manual', updatedAt: 1 }
            },
            missingFields: [],
            lastSubmittedAt: 1
        }
    }
};

const createRuntimeContext = (overrides: Partial<ForgeRuntimeContext> = {}): ForgeRuntimeContext => ({
    workspaceSessionId: 'forge_ws_test',
    sessionChatId: 'lw_card_test',
    workspaceTitle: 'Forge Workspace',
    selectedPresetId: 'preset_1',
    selectedChatSessionId: null,
    selectedChatSnapshotId: null,
    detailMode: null,
    entryMode: null,
    activeLayer: 'concept',
    completedLayers: [],
    workflowSnapshot: null,
    publishState: 'drafting',
    activeLeafId: null,
    worldlineNodes: [],
    messages: [],
    timelineItems: [],
    structuredState: emptyStructuredState,
    draftTree: { nodes: [], lastUpdatedAt: 0 },
    forgeMemoryTree: { entries: [], lastUpdatedAt: 0 },
    stagingEntries: [],
    commitReadyEntries: [],
    virtualLorebookEntries: [],
    latestUserInput: '',
    latestUserCommand: { type: 'noop' },
    ...overrides
});

describe('ForgeWorkflowGraph', () => {
    it('应在未选择 detailMode 时进入 kickoff 阶段', async () => {
        const result = await ForgeWorkflowGraph.routeTurn({
            userInput: '帮我做卡',
            messageCount: 0,
            stagingCount: 0,
            commitReadyCount: 0,
            draftCount: 0,
            hasReferenceChat: false,
            activeLeafId: null,
            detailMode: null,
            entryMode: null,
            activeLayer: null,
            completedLayers: [],
            stagingEntries: [],
            commitReadyEntries: [],
            structuredState: emptyStructuredState
        });

        expect(result.stage).toBe('kickoff');
        expect(result.allowedActions).toContain('choose_detail_mode');
        expect(result.missingFields).toEqual(['direction', 'facets']);
    });

    it('应在已选择 detailMode 但未提交启动偏好时仍停留 kickoff', async () => {
        const result = await ForgeWorkflowGraph.routeTurn({
            userInput: '我想做有旅行感的人设',
            messageCount: 2,
            stagingCount: 0,
            commitReadyCount: 0,
            draftCount: 0,
            hasReferenceChat: false,
            activeLeafId: null,
            detailMode: 'detailed',
            entryMode: 'structured',
            activeLayer: 'concept',
            completedLayers: [],
            stagingEntries: [],
            commitReadyEntries: [],
            structuredState: emptyStructuredState
        });

        expect(result.stage).toBe('kickoff');
        expect(result.allowedActions).toContain('collect_form');
        expect(result.requiresUserDecision).toBe(true);
    });

    it('应在启动偏好提交后进入 skeleton 阶段', async () => {
        const result = await ForgeWorkflowGraph.routeTurn({
            userInput: '继续',
            messageCount: 4,
            stagingCount: 0,
            commitReadyCount: 0,
            draftCount: 0,
            hasReferenceChat: true,
            activeLeafId: 'node_123',
            detailMode: 'quick',
            entryMode: 'structured',
            activeLayer: 'concept',
            completedLayers: [],
            stagingEntries: [],
            commitReadyEntries: [],
            structuredState: kickoffCompletedState
        });

        expect(result.stage).toBe('skeleton');
        expect(result.activeLayer).toBe('concept');
        expect(result.allowedActions).toContain('collect_form');
        expect(result.missingFields).toContain('name');
    });

    it('应在概念层完成后进入 narrative 阶段', async () => {
        const result = await ForgeWorkflowGraph.routeTurn({
            userInput: '继续完善风格',
            messageCount: 6,
            stagingCount: 0,
            commitReadyCount: 0,
            draftCount: 1,
            hasReferenceChat: true,
            activeLeafId: 'node_456',
            detailMode: 'detailed',
            entryMode: 'structured',
            activeLayer: 'description',
            completedLayers: ['concept'],
            stagingEntries: [],
            commitReadyEntries: [],
            structuredState: conceptCompletedState
        });

        expect(result.stage).toBe('narrative');
        expect(result.activeLayer).toBe('description');
        expect(result.allowedActions).toContain('collect_form');
        expect(result.missingFields).toContain('narrative_core');
    });

    it('应在概念和描写完成后进入 expansion 阶段', async () => {
        const result = await ForgeWorkflowGraph.routeTurn({
            userInput: '继续扩展实体层',
            messageCount: 8,
            stagingCount: 0,
            commitReadyCount: 0,
            draftCount: 1,
            hasReferenceChat: true,
            activeLeafId: 'node_999',
            detailMode: 'detailed',
            entryMode: 'structured',
            activeLayer: 'entity',
            completedLayers: ['concept', 'description'],
            stagingEntries: [],
            commitReadyEntries: [],
            structuredState: narrativeCompletedState
        });

        expect(result.stage).toBe('expansion');
        expect(result.allowedActions).toContain('advance_layer');
        expect(result.nextRecommendedLayer).toBe('state_machine');
    });

    it('应在已有 commit-ready 条目时进入 rewrite_export 阶段', async () => {
        const result = await ForgeWorkflowGraph.routeTurn({
            userInput: '继续',
            messageCount: 9,
            stagingCount: 0,
            commitReadyCount: 2,
            draftCount: 2,
            hasReferenceChat: true,
            activeLeafId: 'node_999',
            detailMode: 'detailed',
            entryMode: 'structured',
            activeLayer: 'output',
            completedLayers: ['concept', 'description', 'entity', 'state_machine', 'variables', 'summary', 'output'],
            stagingEntries: [],
            commitReadyEntries: [],
            structuredState: narrativeCompletedState
        });

        expect(result.stage).toBe('rewrite_export');
        expect(result.commitReadyCount).toBe(2);
        expect(result.requiresUserDecision).toBe(true);
        expect(result.allowedActions).toContain('freeze_workspace');
    });

    it('resolveDecision 在 choose_detail_mode 下只设置模式，不应自动追加 kickoff 消息', async () => {
        const result = await ForgeWorkflowGraph.resolveDecision(createRuntimeContext({
            latestUserCommand: { type: 'choose_detail_mode', mode: 'detailed' }
        }));

        expect(result.requiresGeneration).toBe(false);
        expect(result.effects).toEqual(expect.arrayContaining([
            expect.objectContaining({ type: 'set_detail_mode', mode: 'detailed' }),
            expect.objectContaining({ type: 'set_entry_mode', mode: 'structured' }),
            expect.objectContaining({ type: 'persist_session' })
        ]));
        expect(result.effects).not.toEqual(expect.arrayContaining([
            expect.objectContaining({ type: 'append_message', role: 'assistant' })
        ]));
    });

    it('resolveDecision 在 quick 模式下同样不应自动追加 kickoff 组件', async () => {
        const result = await ForgeWorkflowGraph.resolveDecision(createRuntimeContext({
            latestUserCommand: { type: 'choose_detail_mode', mode: 'quick' }
        }));

        expect(result.effects).toEqual(expect.arrayContaining([
            expect.objectContaining({ type: 'set_detail_mode', mode: 'quick' }),
            expect.objectContaining({ type: 'set_entry_mode', mode: 'structured' })
        ]));
        expect(result.effects).not.toEqual(expect.arrayContaining([
            expect.objectContaining({ type: 'append_message', role: 'assistant' })
        ]));
    });

    it('resolveDecision 在 submit_form 后应触发 planner，而不是只做本地层推进', async () => {
        const result = await ForgeWorkflowGraph.resolveDecision(createRuntimeContext({
            detailMode: 'detailed',
            entryMode: 'structured',
            structuredState: kickoffCompletedState,
            latestUserInput: '我刚提交了启动阶段 · 偏好与方向，请继续推进。',
            latestUserCommand: {
                type: 'submit_form',
                formId: 'kickoff_intent',
                userInput: '我刚提交了启动阶段 · 偏好与方向，请继续推进。'
            }
        }));

        expect(result.requiresGeneration).toBe(true);
        expect(result.executionRequest?.mode).toBe('planner');
        expect(result.effects).toEqual(expect.arrayContaining([
            expect.objectContaining({ type: 'submit_form_result', formId: 'kickoff_intent' })
        ]));
    });

    it('resolveDecision 在上下文检索意图下应走 analyst', async () => {
        const result = await ForgeWorkflowGraph.resolveDecision(createRuntimeContext({
            detailMode: 'detailed',
            entryMode: 'structured',
            selectedChatSessionId: 'chat_1',
            forgeMemoryTree: {
                entries: [{
                    path: '启动/用户偏好',
                    title: '启动偏好',
                    content: '方向：沿途风景',
                    summary: '沿途风景',
                    updatedAt: 1,
                    source: 'user'
                }],
                lastUpdatedAt: 1
            },
            latestUserInput: '帮我回顾一下之前提过的偏好和约束',
            latestUserCommand: { type: 'send_user_input', input: '帮我回顾一下之前提过的偏好和约束' },
            structuredState: narrativeCompletedState
        }));

        expect(result.requiresGeneration).toBe(true);
        expect(result.executionRequest?.mode).toBe('analyst');
    });

    it('resolveDecision 在普通问答下应走 conversation 而不是 planner', async () => {
        const result = await ForgeWorkflowGraph.resolveDecision(createRuntimeContext({
            detailMode: 'quick',
            entryMode: 'structured',
            workflowSnapshot: {
                stage: 'skeleton',
                visiblePhase: 'build',
                detailMode: 'quick',
                activeLayer: 'concept',
                subLayer: 'concept',
                promptMode: 'planner',
                reason: '当前正在 concept 层收敛设定。',
                recommendedAction: '继续讨论角色动机。',
                shouldGenerate: true,
                requiresUserDecision: false,
                allowedActions: ['collect_form', 'chat'],
                missingFields: [],
                nextRecommendedLayer: 'description',
                entryMode: 'structured',
                stagingCount: 0,
                commitReadyCount: 0,
                stagingEntries: [],
                commitReadyEntries: [],
                draftCount: 0,
                completedLayers: [],
                updatedAt: Date.now()
            },
            latestUserInput: '为什么你建议先补背景，而不是先写外貌？',
            latestUserCommand: { type: 'send_user_input', input: '为什么你建议先补背景，而不是先写外貌？' },
            structuredState: kickoffCompletedState
        }));

        expect(result.requiresGeneration).toBe(true);
        expect(result.executionRequest?.mode).toBe('conversation');
    });
});
