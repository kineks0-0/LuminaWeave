import { LuminaWeaveAPIBase } from '../../facade/LuminaWeaveAPIBase.js';
import type { ForgeLayer } from '../../../../types/ForgeStructuredTypes.js';
import type {
    ForgeTimelineOperationKind,
    ForgeTimelineOperationStatus
} from '../../../../types/ForgeTimelineTypes.js';
import {
    FORGE_FORM_RESULT_SUBMITTED,
    FORGE_LAYER_ADVANCE_REQUESTED,
    FORGE_PLANNER_INTENT_APPLIED,
    FORGE_RUNTIME_EFFECTS_REQUESTED,
    FORGE_WORKSPACE_FREEZE_REQUESTED
} from '../forgeConstants.js';

export {
    FORGE_FORM_RESULT_SUBMITTED,
    FORGE_LAYER_ADVANCE_REQUESTED,
    FORGE_PLANNER_INTENT_APPLIED,
    FORGE_RUNTIME_EFFECTS_REQUESTED,
    FORGE_WORKSPACE_FREEZE_REQUESTED
};

export interface ForgeOperationRecorderPort {
    addOperationTimelineItem(payload: {
        operationKind: ForgeTimelineOperationKind;
        status: ForgeTimelineOperationStatus;
        title: string;
        summary: string;
        detail?: string | null;
        sourceTag?: string | null;
        layer?: ForgeLayer | null;
    }): void;
}

/**
 * ForgeAgentController now only exposes explicit user/control intents.
 * Forge Agent execution, tool trace and direct workspace patch auditing are owned
 * by the pi runtime path; XML action events are no longer consumed here.
 *
 * Operation recording is injected by the Forge plugin (composition root) so Core
 * stays independent of Pinia stores.
 */
export class ForgeAgentController extends LuminaWeaveAPIBase {
    private operationRecorder: ForgeOperationRecorderPort | null = null;

    constructor(private readonly parentApi: any) {
        super();
    }

    public setOperationRecorder(recorder: ForgeOperationRecorderPort | null): void {
        this.operationRecorder = recorder;
    }

    private recordOperation(payload: Parameters<ForgeOperationRecorderPort['addOperationTimelineItem']>[0]): void {
        this.operationRecorder?.addOperationTimelineItem(payload);
    }

    public async initialize(): Promise<void> {
        // No XML action listeners: Forge Agent runtime is pi-native.
    }

    public requestLayerAdvance(targetLayer: ForgeLayer): void {
        this.recordOperation({
            operationKind: 'user_action',
            status: 'completed',
            title: '请求推进设计层',
            summary: `请求切换到 ${targetLayer} 层`,
            sourceTag: 'forge_step_request',
            layer: targetLayer
        });
        this.parentApi.emit(FORGE_LAYER_ADVANCE_REQUESTED, targetLayer);
    }

    public submitFormResult(formId: string, digest: string): void {
        this.recordOperation({
            operationKind: 'user_action',
            status: 'completed',
            title: '已提交表单结果',
            summary: `${formId} 已提交`,
            detail: digest,
            sourceTag: 'forge_form_result'
        });
        this.parentApi.emit(FORGE_FORM_RESULT_SUBMITTED, { formId, digest });
    }

    public applyPlannerIntent(intent: string): void {
        this.recordOperation({
            operationKind: 'plan',
            status: 'completed',
            title: 'Planner 产出控制意图',
            summary: intent.trim() ? `规划意图：${intent}` : '收到空的规划意图',
            sourceTag: 'planner_intent'
        });

        const normalizedIntent = intent.trim();
        const layerMatch = normalizedIntent.match(/^(?:advance_layer|layer):([\w_]+)$/i);
        if (layerMatch) {
            this.requestLayerAdvance(layerMatch[1] as ForgeLayer);
            return;
        }

        if (/^freeze_workspace$/i.test(normalizedIntent)) {
            this.freezeWorkspaceDraft();
            return;
        }

        this.parentApi.emit(FORGE_PLANNER_INTENT_APPLIED, normalizedIntent);
    }

    public freezeWorkspaceDraft(): void {
        this.recordOperation({
            operationKind: 'workspace_write',
            status: 'completed',
            title: '请求冻结虚拟工作区',
            summary: '控制层已请求冻结当前 commit-ready 草案',
            sourceTag: 'freeze_workspace'
        });
        this.parentApi.emit(FORGE_WORKSPACE_FREEZE_REQUESTED);
    }
}
