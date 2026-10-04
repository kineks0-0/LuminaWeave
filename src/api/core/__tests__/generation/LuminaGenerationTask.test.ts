import { beforeEach, describe, expect, it, vi } from 'vitest';
import { GenerationSession } from '../../generation/GenerationSession.js';

const nexusInstances = vi.hoisted(() => [] as Array<{
    generateStream: ReturnType<typeof vi.fn>;
    stopGeneration: ReturnType<typeof vi.fn>;
}>);

vi.mock('@/api/core/hal/network/NexusClient.js', () => ({
    NexusClient: class {
        generateStream = vi.fn();
        stopGeneration = vi.fn();
        constructor() {
            nexusInstances.push(this);
        }
    }
}));

vi.mock('@/api/storage.js', () => ({
    lwStorage: {
        get: vi.fn(() => true),
        set: vi.fn()
    }
}));

import { LuminaGenerationTask } from '../../generation/LuminaGenerationTask.js';

const createTask = () => {
    const session = new GenerationSession({ chatId: 'chat1', charName: 'Char', parentId: 'parent1' });
    const task = new LuminaGenerationTask(session);
    const nexus = nexusInstances[nexusInstances.length - 1];
    return { session, task, nexus };
};

describe('LuminaGenerationTask', () => {
    beforeEach(() => {
        nexusInstances.length = 0;
    });

    it('streams chunks into the session and completes on a successful SSE run', async () => {
        const { session, task, nexus } = createTask();
        const callbacks = {
            onChunk: vi.fn(),
            onDone: vi.fn(),
            onBackendCommitted: vi.fn()
        };
        nexus.generateStream.mockImplementation(async (params, handlers) => {
            expect(params).toMatchObject({
                chatId: 'chat1',
                charName: 'Char',
                parentId: 'parent1',
                messages: [{ role: 'user', content: 'hi' }],
                settings: { temperature: 0.5 }
            });
            handlers.onChunk('hi', 'hi');
            handlers.onBackendCommitted({ lastTransactionId: 'tx1', activeLeafId: 'leaf1' });
            handlers.onDone({ status: 'success', fullText: 'hi there' });
        });

        await task.run([{ role: 'user', content: 'hi' }], callbacks, { temperature: 0.5 });

        expect(session.finalText).toBe('hi there');
        expect(session.isCompleted).toBe(true);
        expect(session.committedInfo).toEqual({ lastTransactionId: 'tx1', activeLeafId: 'leaf1' });
        expect(callbacks.onChunk).toHaveBeenCalledWith('hi', 'hi');
        expect(callbacks.onDone).toHaveBeenCalledWith('hi there');
        expect(callbacks.onBackendCommitted).toHaveBeenCalledWith({ lastTransactionId: 'tx1', activeLeafId: 'leaf1' });
        expect(nexus.generateStream).toHaveBeenCalledWith(expect.anything(), expect.anything(), expect.any(AbortSignal));
    });

    it('records an error and does not complete when the backend reports failure', async () => {
        const { session, task, nexus } = createTask();
        const onError = vi.fn();
        const onDone = vi.fn();
        nexus.generateStream.mockImplementation(async (_params, handlers) => {
            handlers.onDone({ status: 'error', fullText: 'partial' });
        });

        await task.run([], { onError, onDone });

        expect(session.finalText).toBe('partial');
        expect(session.isCompleted).toBe(false);
        expect(session.error).toBeInstanceOf(Error);
        expect(onError).toHaveBeenCalledWith(expect.any(Error));
        expect(onDone).not.toHaveBeenCalled();
    });

    it('propagates transport errors to the session and callback', async () => {
        const { session, task, nexus } = createTask();
        const error = new Error('network down');
        const onError = vi.fn();
        nexus.generateStream.mockImplementation(async (_params, handlers) => {
            handlers.onError(error, { isGenerating: false });
        });

        await task.run([], { onError });

        expect(session.error).toBe(error);
        expect(onError).toHaveBeenCalledWith(error, { isGenerating: false });
    });

    it('abort marks the session aborted and stops backend generation', () => {
        const { session, task, nexus } = createTask();

        task.abort();

        expect(session.isAborted).toBe(true);
        expect(session.isCompleted).toBe(true);
        expect(nexus.stopGeneration).toHaveBeenCalledWith('chat1');
    });
});
