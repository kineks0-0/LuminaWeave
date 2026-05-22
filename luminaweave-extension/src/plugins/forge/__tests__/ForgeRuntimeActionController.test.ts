import { describe, expect, it, vi } from 'vitest';
import { ForgeRuntimeActionController } from '../store/ForgeRuntimeActionController.js';
import type { ForgeRuntimeOrchestrator } from '../../../api/core/forge/runtime/ForgeRuntimeOrchestrator.js';

const createController = (overrides: Partial<ConstructorParameters<typeof ForgeRuntimeActionController>[0]> = {}) => {
    let processing = false;
    let generating = true;
    const dispatch = vi.fn().mockResolvedValue({ ok: true });
    const resolveToolApproval = vi.fn().mockResolvedValue(false);
    const failRunningOperations = vi.fn();
    const fallbackResolveToolApproval = vi.fn();
    const controller = new ForgeRuntimeActionController({
        getRuntimeOrchestrator: () => ({
            dispatch,
            resolveToolApproval
        } as unknown as ForgeRuntimeOrchestrator),
        setProcessing: (value) => { processing = value; },
        getIsGenerating: () => generating,
        setIsGenerating: (value) => { generating = value; },
        failRunningOperations,
        fallbackResolveToolApproval,
        ...overrides
    });
    return {
        controller,
        dispatch,
        resolveToolApproval,
        failRunningOperations,
        fallbackResolveToolApproval,
        get processing() { return processing; },
        get generating() { return generating; }
    };
};

describe('ForgeRuntimeActionController', () => {
    it('cleans processing and running operations after dispatch', async () => {
        const harness = createController();

        const result = await harness.controller.dispatchWorkspaceCommand({ type: 'send_user_input', input: 'hello' });

        expect(result).toEqual({ ok: true });
        expect(harness.dispatch).toHaveBeenCalledWith({ type: 'send_user_input', input: 'hello' });
        expect(harness.processing).toBe(false);
        expect(harness.generating).toBe(false);
        expect(harness.failRunningOperations).toHaveBeenCalledTimes(1);
    });

    it('cleans lifecycle even when dispatch fails', async () => {
        const error = new Error('boom');
        const harness = createController({
            getRuntimeOrchestrator: () => ({
                dispatch: vi.fn().mockRejectedValue(error),
                resolveToolApproval: vi.fn()
            } as unknown as ForgeRuntimeOrchestrator)
        });

        await expect(harness.controller.dispatchWorkspaceCommand({ type: 'noop' })).rejects.toThrow('boom');

        expect(harness.processing).toBe(false);
        expect(harness.generating).toBe(false);
        expect(harness.failRunningOperations).toHaveBeenCalledTimes(1);
    });

    it('falls back to store approval resolution when runtime has no pending approval', async () => {
        const harness = createController();

        const resolved = await harness.controller.resolveToolApproval('tool-1', true, 'ok');

        expect(resolved).toBe(false);
        expect(harness.resolveToolApproval).toHaveBeenCalledWith('tool-1', true, 'ok');
        expect(harness.fallbackResolveToolApproval).toHaveBeenCalledWith('tool-1', true, 'ok');
    });
});
