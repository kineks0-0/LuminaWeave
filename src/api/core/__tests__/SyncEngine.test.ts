import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SyncEngine } from '../SyncEngine';
import { STBridge } from '../STBridge';
import { LuminaChatMessage } from '../ChatManager';
import { ChatConverter } from '../ChatConverter';

vi.mock('../STBridge', () => ({
    STBridge: {
        getRawMessages: vi.fn(),
        getMessages: vi.fn(),
        updateMessages: vi.fn(),
        appendMessage: vi.fn(),
        appendMessages: vi.fn(),
        deleteMessages: vi.fn(),
        flush: vi.fn()
    }
}));

vi.mock('../../storage.js', () => ({
    lwStorage: {
        _getContextIds: vi.fn(() => ({ charId: 'c1' })),
        get: vi.fn((key, def) => def)
    }
}));

describe('SyncEngine', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('applyDelta should detect added messages and call appendMessages', async () => {
        const localTrace: LuminaChatMessage[] = [
            { id: '1', mes: 'Hello', mesRaw: 'Hello', fingerprint: 'fp1', role: 'user', extra: {} } as any
        ];
        const stChat: LuminaChatMessage[] = []; // ST is empty

        (STBridge.getMessages as any).mockReturnValue([]); // ST latest is also empty

        await SyncEngine.applyDelta(localTrace, stChat);

        expect(STBridge.appendMessages).toHaveBeenCalledTimes(1);
        const appendArgs = (STBridge.appendMessages as any).mock.calls[0][0];
        expect(appendArgs[0].message).toBe('Hello');
        expect(appendArgs[0].extra[SyncEngine.SYNC_SOURCE_KEY]).toBe(SyncEngine.SYNC_SOURCE_LUMINA);
        expect(typeof appendArgs[0].extra[SyncEngine.SYNC_TS_KEY]).toBe('number');
        expect(STBridge.flush).toHaveBeenCalledTimes(1);
    });

    it('applyDelta should detect deleted messages and call deleteMessages', async () => {
        const localTrace: LuminaChatMessage[] = []; // Local is empty
        const stChat: LuminaChatMessage[] = [
            ChatConverter.fromST({ message_id: 0, name: 'You', role: 'user', is_hidden: false, message: 'Hello', data: {}, extra: { id: '1', fingerprint: 'fp1' } })
        ];

        (STBridge.getMessages as any).mockReturnValue(stChat);

        await SyncEngine.applyDelta(localTrace, stChat);

        expect(STBridge.deleteMessages).toHaveBeenCalledTimes(1);
        expect(STBridge.deleteMessages).toHaveBeenCalledWith([0], true); // The index in ST to delete
        expect(STBridge.flush).toHaveBeenCalledTimes(1);
    });

    it('applyDelta should detect updated messages and call updateMessages', async () => {
        const localTrace: LuminaChatMessage[] = [
            { id: '1', mes: 'Hello World', mesRaw: 'Hello World', fingerprint: 'fp1_new', role: 'user', extra: {} } as any
        ];
        const stChat: LuminaChatMessage[] = [
            ChatConverter.fromST({ message_id: 0, name: 'You', role: 'user', is_hidden: false, message: 'Hello', data: {}, extra: { id: '1', fingerprint: 'fp1' } })
        ];

        (STBridge.getMessages as any).mockReturnValue(stChat);

        await SyncEngine.applyDelta(localTrace, stChat);

        expect(STBridge.updateMessages).toHaveBeenCalledTimes(1);
        const updateArg = (STBridge.updateMessages as any).mock.calls[0][0];
        expect(updateArg[0].index).toBe(0);
        expect(updateArg[0].content).toBe('Hello World');
        expect(updateArg[0].extra[SyncEngine.SYNC_SOURCE_KEY]).toBe(SyncEngine.SYNC_SOURCE_LUMINA);
        expect(STBridge.flush).toHaveBeenCalledTimes(1);
    });

    it('compareStates should treat append-only local messages as mergeable', () => {
        const local: LuminaChatMessage[] = [
            { id: '1', mesRaw: 'A', fingerprint: SyncEngine.getFingerprint('A'), mes: 'A', name: 'User', role: 'user', parentId: null, extra: {} } as any,
            { id: '2', mesRaw: 'B', fingerprint: SyncEngine.getFingerprint('B'), mes: 'B', name: 'User', role: 'user', parentId: '1', extra: {} } as any,
            { id: '3', mesRaw: 'C', fingerprint: SyncEngine.getFingerprint('C'), mes: 'C', name: 'User', role: 'user', parentId: '2', extra: {} } as any
        ];
        const st = [
            ChatConverter.fromST({ message_id: 0, name: 'User', role: 'user', is_hidden: false, message: 'A', data: {}, extra: { id: '1', fingerprint: SyncEngine.getFingerprint('A') } }),
            ChatConverter.fromST({ message_id: 1, name: 'User', role: 'user', is_hidden: false, message: 'B', data: {}, extra: { id: '2', fingerprint: SyncEngine.getFingerprint('B') } })
        ];

        const diff = SyncEngine.compareStates(local, st);
        expect(diff.hasDivergence).toBe(false);
        expect(diff.onlyInIndependent).toHaveLength(1);
        expect(diff.onlyInST).toHaveLength(0);
        expect(diff.independentSequence).toHaveLength(3);
        expect(diff.stSequence).toHaveLength(2);
    });



    it('isLuminaSyncMessage should validate source and time window', () => {
        const now = Date.now();
        expect(SyncEngine.isLuminaSyncMessage({
            extra: {
                [SyncEngine.SYNC_SOURCE_KEY]: SyncEngine.SYNC_SOURCE_LUMINA,
                [SyncEngine.SYNC_TS_KEY]: now - 100
            }
        } as unknown as LuminaChatMessage, now, 500)).toBe(true);

        expect(SyncEngine.isLuminaSyncMessage({
            extra: {
                [SyncEngine.SYNC_SOURCE_KEY]: SyncEngine.SYNC_SOURCE_LUMINA,
                [SyncEngine.SYNC_TS_KEY]: now - 2000
            }
        } as unknown as LuminaChatMessage, now, 500)).toBe(false);
    });
});
