import { describe, expect, it, vi } from 'vitest';
import {
    ForgeAgentController,
    FORGE_LAYER_ADVANCE_REQUESTED,
    FORGE_WORKSPACE_FREEZE_REQUESTED
} from '@/api/core/forge/runtime/ForgeAgentController.js';

describe('ForgeAgentController', () => {
    it('records operations through the injected recorder and emits intents', () => {
        const parentApi = { emit: vi.fn() };
        const controller = new ForgeAgentController(parentApi);
        const recorder = { addOperationTimelineItem: vi.fn() };
        controller.setOperationRecorder(recorder);

        controller.requestLayerAdvance('entity');

        expect(recorder.addOperationTimelineItem).toHaveBeenCalledWith(expect.objectContaining({
            operationKind: 'user_action',
            sourceTag: 'forge_step_request',
            layer: 'entity'
        }));
        expect(parentApi.emit).toHaveBeenCalledWith(FORGE_LAYER_ADVANCE_REQUESTED, 'entity');
    });

    it('emits intents without a recorder', () => {
        const parentApi = { emit: vi.fn() };
        const controller = new ForgeAgentController(parentApi);

        expect(() => controller.freezeWorkspaceDraft()).not.toThrow();
        expect(parentApi.emit).toHaveBeenCalledWith(FORGE_WORKSPACE_FREEZE_REQUESTED);
    });

    it('records planner intent before expanding control intents', () => {
        const parentApi = { emit: vi.fn() };
        const controller = new ForgeAgentController(parentApi);
        const recorder = { addOperationTimelineItem: vi.fn() };
        controller.setOperationRecorder(recorder);

        controller.applyPlannerIntent('advance_layer:entity');

        expect(recorder.addOperationTimelineItem).toHaveBeenCalledWith(expect.objectContaining({
            sourceTag: 'planner_intent'
        }));
        expect(parentApi.emit).toHaveBeenCalledWith(FORGE_LAYER_ADVANCE_REQUESTED, 'entity');
    });
});
