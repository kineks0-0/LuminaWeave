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

    it('keeps generation active when dispatch returns while composer approval is pending', async () => {
        const harness = createController({
            shouldKeepGenerationActiveAfterDispatch: () => true
        } as unknown as Partial<ConstructorParameters<typeof ForgeRuntimeActionController>[0]>);

        const result = await harness.controller.dispatchWorkspaceCommand({ type: 'send_user_input', input: '需要联网' });

        expect(result).toEqual({ ok: true });
        expect(harness.processing).toBe(false);
        expect(harness.generating).toBe(true);
        expect(harness.failRunningOperations).not.toHaveBeenCalled();
    });

    it('cleans generation when a paused composer approval is rejected', async () => {
        const harness = createController({
            getRuntimeOrchestrator: () => ({
                dispatch: vi.fn(),
                resolveToolApproval: vi.fn().mockResolvedValue(true)
            } as unknown as ForgeRuntimeOrchestrator)
        });

        const resolved = await harness.controller.resolveToolApproval('session-1', 'turn-1', 'tool-1', false, '拒绝联网');

        expect(resolved).toBe(true);
        expect(harness.generating).toBe(false);
        expect(harness.failRunningOperations).toHaveBeenCalledTimes(1);
    });

    it('marks approval resolved locally before waiting for runtime resume', async () => {
        let resumeRuntime!: (value: boolean) => void;
        const runtimeResult = new Promise<boolean>(resolve => {
            resumeRuntime = resolve;
        });
        const markToolApprovalResolved = vi.fn();
        const harness = createController({
            getRuntimeOrchestrator: () => ({
                dispatch: vi.fn(),
                resolveToolApproval: vi.fn(() => runtimeResult)
            } as unknown as ForgeRuntimeOrchestrator),
            markToolApprovalResolved
        });

        const resolved = harness.controller.resolveToolApproval('session-1', 'turn-1', 'tool-1', true, '允许此域名');

        expect(markToolApprovalResolved).toHaveBeenCalledWith('tool-1', true, '允许此域名');
        resumeRuntime(true);
        await expect(resolved).resolves.toBe(true);
    });

    it('falls back to store approval resolution when runtime has no pending approval', async () => {
        const harness = createController();

        const resolved = await harness.controller.resolveToolApproval('session-1', 'turn-1', 'tool-1', true, 'ok');

        expect(resolved).toBe(false);
        expect(harness.resolveToolApproval).toHaveBeenCalledWith('session-1', 'turn-1', 'tool-1', true, 'ok');
        expect(harness.fallbackResolveToolApproval).toHaveBeenCalledWith('tool-1', true, 'ok');
    });
});
