import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
    FORGE_FORM_RESULT_SUBMITTED,
    FORGE_LAYER_ADVANCE_REQUESTED,
    FORGE_PLANNER_INTENT_APPLIED,
    FORGE_WORKSPACE_FREEZE_REQUESTED,
    ForgeAgentController
} from '../ForgeAgentController';

const { mockForgeStore, mockLoadSession } = vi.hoisted(() => ({
    mockForgeStore: {
        upsertRunningOperation: vi.fn(),
        completeOperationByKey: vi.fn(),
        addOperationTimelineItem: vi.fn(),
        upsertStagingEntry: vi.fn(),
        currentSessionId: 'forge-session-1',
        isProcessing: false
    },
    mockLoadSession: vi.fn()
}));

vi.mock('../../../stores/useForgeStore.js', () => ({
    useForgeStore: () => mockForgeStore
}));

vi.mock('../ForgeSessionRepository.js', () => ({
    forgeSessionRepository: {
        loadSession: mockLoadSession
    }
}));

class MockParentApi {
    private events: Record<string, Function[]> = {};

    on(event: string, callback: Function): void {
        if (!this.events[event]) this.events[event] = [];
        this.events[event].push(callback);
    }

    emit(event: string, ...args: any[]): void {
        for (const callback of this.events[event] || []) {
            callback(...args);
        }
    }
}

describe('ForgeAgentController control bridge', () => {
    beforeEach(() => {
        vi.useFakeTimers();
        vi.clearAllMocks();
        mockForgeStore.currentSessionId = 'forge-session-1';
        mockLoadSession.mockReturnValue({
            id: 'forge-session-1',
            virtualLorebookEntries: [{
                id: 'entry-1',
                entry: {
                    uid: 'entry-1',
                    comment: '旧条目',
                    content: '原始内容'
                }
            }],
            stagingEntries: [],
            commitReadyEntries: [],
            draftTree: { nodes: [], lastUpdatedAt: Date.now() }
        });
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it('requestLayerAdvance 应发出控制事件并记录时间线操作', () => {
        const parentApi = new MockParentApi();
        const controller = new ForgeAgentController(parentApi);
        const requested = vi.fn();
        parentApi.on(FORGE_LAYER_ADVANCE_REQUESTED, requested);

        controller.requestLayerAdvance('variables');

        expect(mockForgeStore.addOperationTimelineItem).toHaveBeenCalledWith(expect.objectContaining({
            sourceTag: 'forge_step_request'
        }));
        expect(requested).toHaveBeenCalledWith('variables');
    });

    it('submitFormResult 应发出表单提交事件', () => {
        const parentApi = new MockParentApi();
        const controller = new ForgeAgentController(parentApi);
        const submitted = vi.fn();
        parentApi.on(FORGE_FORM_RESULT_SUBMITTED, submitted);

        controller.submitFormResult('role_core_profile', 'name=林雾');

        expect(mockForgeStore.addOperationTimelineItem).toHaveBeenCalledWith(expect.objectContaining({
            sourceTag: 'forge_form_result'
        }));
        expect(submitted).toHaveBeenCalledWith({
            formId: 'role_core_profile',
            digest: 'name=林雾'
        });
    });

    it('freezeWorkspaceDraft 应发出冻结请求事件', () => {
        const parentApi = new MockParentApi();
        const controller = new ForgeAgentController(parentApi);
        const freezeRequested = vi.fn();
        parentApi.on(FORGE_WORKSPACE_FREEZE_REQUESTED, freezeRequested);

        controller.freezeWorkspaceDraft();

        expect(freezeRequested).toHaveBeenCalledTimes(1);
    });

    it('applyPlannerIntent 应识别 layer/freezing 指令，其余意图走透传事件', () => {
        const parentApi = new MockParentApi();
        const controller = new ForgeAgentController(parentApi);
        const requested = vi.fn();
        const freezeRequested = vi.fn();
        const plannerIntent = vi.fn();
        parentApi.on(FORGE_LAYER_ADVANCE_REQUESTED, requested);
        parentApi.on(FORGE_WORKSPACE_FREEZE_REQUESTED, freezeRequested);
        parentApi.on(FORGE_PLANNER_INTENT_APPLIED, plannerIntent);

        controller.applyPlannerIntent('layer:summary');
        controller.applyPlannerIntent('freeze_workspace');
        controller.applyPlannerIntent('collect:role_core_profile');

        expect(requested).toHaveBeenCalledWith('summary');
        expect(freezeRequested).toHaveBeenCalledTimes(1);
        expect(plannerIntent).toHaveBeenCalledWith('collect:role_core_profile');
        expect(mockForgeStore.addOperationTimelineItem).toHaveBeenCalledWith(expect.objectContaining({
            sourceTag: 'planner_intent'
        }));
    });

    it('stageDraftEntry 应回填原始内容并写入 staging', async () => {
        const parentApi = new MockParentApi();
        const controller = new ForgeAgentController(parentApi);

        await controller.stageDraftEntry('<entry_update id="entry-1" description="重写背景">新的背景</entry_update>');

        expect(mockForgeStore.upsertStagingEntry).toHaveBeenCalledWith({
            targetEntryId: 'entry-1',
            proposedContent: '新的背景',
            description: '重写背景',
            originalContent: '原始内容',
            layer: null,
            sourceTag: 'entry_update',
            sourceMessageId: null,
            sourceSessionId: 'forge-session-1'
        });
    });

    it('应忽略短时间内重复的 FORGE_TRACE 事件', () => {
        const parentApi = new MockParentApi();
        new ForgeAgentController(parentApi);

        parentApi.emit('FORGE_TRACE', { tag: 'forge_skill', status: 'Agent 正在执行技能...', timestamp: 1 });
        parentApi.emit('FORGE_TRACE', { tag: 'forge_skill', status: 'Agent 正在执行技能...', timestamp: 2 });

        expect(mockForgeStore.upsertRunningOperation).toHaveBeenCalledTimes(1);
    });

    it('应忽略重复的 FORGE_ACTION_COMPLETED 事件，即使跨过短 TTL', async () => {
        const parentApi = new MockParentApi();
        new ForgeAgentController(parentApi);

        parentApi.emit('FORGE_ACTION_COMPLETED', {
            type: 'update',
            content: '新的背景',
            raw: '<entry_update id="entry-1">新的背景</entry_update>'
        });
        vi.advanceTimersByTime(6000);
        parentApi.emit('FORGE_ACTION_COMPLETED', {
            type: 'update',
            content: '新的背景',
            raw: '<entry_update id="entry-1">新的背景</entry_update>'
        });

        expect(mockForgeStore.completeOperationByKey).toHaveBeenCalledTimes(1);
        await vi.waitUntil(() => mockForgeStore.upsertStagingEntry.mock.calls.length > 0);
        expect(mockForgeStore.upsertStagingEntry).toHaveBeenCalledTimes(1);
    });
});
