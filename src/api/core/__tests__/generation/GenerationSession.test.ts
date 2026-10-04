import { describe, expect, it } from 'vitest';
import { GenerationSession } from '../../generation/GenerationSession.js';

const createSession = () => new GenerationSession({
    chatId: 'chat1',
    charName: 'Char',
    parentId: 'parent1'
});

describe('GenerationSession', () => {
    it('exposes constructor input and starts open', () => {
        const session = createSession();

        expect(session.chatId).toBe('chat1');
        expect(session.charName).toBe('Char');
        expect(session.parentId).toBe('parent1');
        expect(session.nodes).toEqual([]);
        expect(session.finalText).toBeNull();
        expect(session.committedInfo).toBeNull();
        expect(session.error).toBeNull();
        expect(session.isFinalizing).toBe(false);
        expect(session.isCompleted).toBe(false);
        expect(session.isAborted).toBe(false);
        expect(session.canFinalize()).toBe(false);
    });

    it('canFinalize requires final text and committed info, and is blocked while finalizing', () => {
        const session = createSession();

        session.finalText = 'done';
        expect(session.canFinalize()).toBe(false);

        session.committedInfo = { lastTransactionId: 'tx1' };
        expect(session.canFinalize()).toBe(true);

        session.isFinalizing = true;
        expect(session.canFinalize()).toBe(false);
    });

    it('tracks completion and abort as distinct terminal states', () => {
        const completed = createSession();
        completed.markCompleted();
        expect(completed.isCompleted).toBe(true);
        expect(completed.isAborted).toBe(false);

        const aborted = createSession();
        aborted.markAborted();
        expect(aborted.isAborted).toBe(true);
        expect(aborted.isCompleted).toBe(true);
    });

    it('keeps committed info and error assignable across the lifecycle', () => {
        const session = createSession();
        const error = new Error('boom');

        session.committedInfo = { lastTransactionId: 'tx2', activeLeafId: 'leaf1', generationId: 'gen1' };
        session.error = error;

        expect(session.committedInfo?.lastTransactionId).toBe('tx2');
        expect(session.error).toBe(error);
    });
});
