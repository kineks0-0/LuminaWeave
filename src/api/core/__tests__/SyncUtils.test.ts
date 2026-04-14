import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SyncUtils, MessageTextResolver, MessageComparator } from '../SyncUtils';
import { LuminaChatMessage } from '../../../../../shared/LuminaMessage.js';
import { STClient } from '../st-adapter/STClient';
import { STProtocol } from '../st-adapter/STProtocol';

vi.mock('../st-adapter/STClient', () => ({
    STClient: {
        getRawMessages: vi.fn(),
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

describe('SyncUtils', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('applyDelta should detect added messages and call appendMessages', async () => {
        const localTrace: LuminaChatMessage[] = [
            { id: '1', mes: 'Hello', mesRaw: 'Hello', fingerprint: 'fp1', role: 'user', extra: {} } as unknown as LuminaChatMessage
        ];
        const stChat: LuminaChatMessage[] = []; // ST is empty

        const diffData = SyncUtils.compareStates(localTrace, stChat);
        await SyncUtils.applyDelta(diffData, localTrace, stChat);

        expect(STClient.appendMessages).toHaveBeenCalledTimes(1);
        const appendArgs = vi.mocked(STClient.appendMessages).mock.calls[0][0] as unknown as Array<{ message: string; extra: Record<string, unknown> }>;
        expect(appendArgs[0].message).toBe('Hello');
        expect(appendArgs[0].extra[SyncUtils.SYNC_SOURCE_KEY]).toBe(SyncUtils.SYNC_SOURCE_LUMINA);
        expect(typeof appendArgs[0].extra[SyncUtils.SYNC_TS_KEY]).toBe('number');
        expect(STClient.flush).toHaveBeenCalledTimes(1);
    });

    it('applyDelta should detect deleted messages and call deleteMessages', async () => {
        const localTrace: LuminaChatMessage[] = []; // Local is empty
        const stChat: LuminaChatMessage[] = [
            STProtocol.fromST({ message_id: 0, name: 'You', role: 'user', is_hidden: false, message: 'Hello', data: {}, extra: { id: '1', fingerprint: 'fp1' } })
        ];

        const diffData = SyncUtils.compareStates(localTrace, stChat);
        await SyncUtils.applyDelta(diffData, localTrace, stChat);

        expect(STClient.deleteMessages).toHaveBeenCalledTimes(1);
        expect(STClient.deleteMessages).toHaveBeenCalledWith([0], true); // The index in ST to delete
        expect(STClient.flush).toHaveBeenCalledTimes(1);
    });

    it('applyDelta should detect updated messages and call updateMessages', async () => {
        const localTrace: LuminaChatMessage[] = [
            { id: '1', mes: 'Hello World', mesRaw: 'Hello World', fingerprint: 'fp1_new', role: 'user', extra: {} } as unknown as LuminaChatMessage
        ];
        const stChat: LuminaChatMessage[] = [
            STProtocol.fromST({ message_id: 0, name: 'You', role: 'user', is_hidden: false, message: 'Hello', data: {}, extra: { id: '1', fingerprint: 'fp1' } })
        ];

        const diffData = SyncUtils.compareStates(localTrace, stChat);
        await SyncUtils.applyDelta(diffData, localTrace, stChat);

        expect(STClient.updateMessages).toHaveBeenCalledTimes(1);
        const updateArg = vi.mocked(STClient.updateMessages).mock.calls[0][0] as unknown as Array<{ index: number; content: string; extra?: Record<string, unknown> }>;
        expect(updateArg[0].index).toBe(0);
        expect(updateArg[0].content).toBe('Hello World');
        expect(updateArg[0].extra?.[SyncUtils.SYNC_SOURCE_KEY]).toBe(SyncUtils.SYNC_SOURCE_LUMINA);
        expect(STClient.flush).toHaveBeenCalledTimes(1);
    });

    it('compareStates should treat append-only local messages as mergeable', () => {
        const local: LuminaChatMessage[] = [
            { id: '1', mesRaw: 'A', fingerprint: SyncUtils.getFingerprint('A'), mes: 'A', name: 'User', role: 'user', parentId: null, extra: {} } as any,
            { id: '2', mesRaw: 'B', fingerprint: SyncUtils.getFingerprint('B'), mes: 'B', name: 'User', role: 'user', parentId: '1', extra: {} } as any,
            { id: '3', mesRaw: 'C', fingerprint: SyncUtils.getFingerprint('C'), mes: 'C', name: 'User', role: 'user', parentId: '2', extra: {} } as any
        ];
        const st = [
            STProtocol.fromST({ message_id: 0, name: 'User', role: 'user', is_hidden: false, message: 'A', data: {}, extra: { id: '1', fingerprint: SyncUtils.getFingerprint('A') } }),
            STProtocol.fromST({ message_id: 1, name: 'User', role: 'user', is_hidden: false, message: 'B', data: {}, extra: { id: '2', fingerprint: SyncUtils.getFingerprint('B') } })
        ];

        const diff = SyncUtils.compareStates(local, st);
        expect(diff.hasDivergence).toBe(false);
        expect(diff.onlyInIndependent).toHaveLength(1);
        expect(diff.onlyInST).toHaveLength(0);
        expect(diff.independentSequence).toHaveLength(3);
        expect(diff.stSequence).toHaveLength(2);
    });



    it('isLuminaSyncMessage should validate source and time window', () => {
        const now = Date.now();
        expect(SyncUtils.isLuminaSyncMessage({
            extra: {
                [SyncUtils.SYNC_SOURCE_KEY]: SyncUtils.SYNC_SOURCE_LUMINA,
                [SyncUtils.SYNC_TS_KEY]: now - 100
            }
        } as unknown as LuminaChatMessage, now, 500)).toBe(true);

        expect(SyncUtils.isLuminaSyncMessage({
            extra: {
                [SyncUtils.SYNC_SOURCE_KEY]: SyncUtils.SYNC_SOURCE_LUMINA,
                [SyncUtils.SYNC_TS_KEY]: now - 2000
            }
        } as unknown as LuminaChatMessage, now, 500)).toBe(false);
    });

    describe('MessageTextResolver', () => {
        it('should normalize text by removing invisible chars and trimming', () => {
            const text = '  Hello\u200BWorld\uFEFF  ';
            expect(MessageTextResolver.normalize(text)).toBe('HelloWorld');
        });

        it('should normalize fingerprint text by folding whitespace', () => {
            expect(MessageTextResolver.normalizeForFingerprint('  A\u200B  B  \n\tC  ')).toBe('A B C');
        });

        it('should resolve for sync prioritizing mesST > mesRaw > mes', () => {
            expect(MessageTextResolver.resolveForSync({ mesST: 'st', mesRaw: 'raw', mes: 'mes' })).toBe('st');
            expect(MessageTextResolver.resolveForSync({ mesRaw: 'raw', mes: 'mes' })).toBe('raw');
            expect(MessageTextResolver.resolveForSync({ mes: 'mes' })).toBe('mes');
            expect(MessageTextResolver.resolveForSync({})).toBe('');
        });
    });

    describe('MessageComparator', () => {
        it('should generate identical snapshot for same state', () => {
            const msgA: Partial<LuminaChatMessage> = { name: 'A', role: 'user', is_hidden: false, mesST: 'text' };
            const msgB: Partial<LuminaChatMessage> = { name: 'A', role: 'user', is_hidden: false, mesST: 'text' };
            expect(MessageComparator.getStateSnapshot(msgA)).toBe(MessageComparator.getStateSnapshot(msgB));
            expect(MessageComparator.isStateEqual(msgA, msgB)).toBe(true);
        });

        it('should generate different snapshot for different state', () => {
            const msgA: Partial<LuminaChatMessage> = { name: 'A', role: 'user', is_hidden: false, mesST: 'text' };
            const msgB: Partial<LuminaChatMessage> = { name: 'A', role: 'user', is_hidden: true, mesST: 'text' };
            expect(MessageComparator.isStateEqual(msgA, msgB)).toBe(false);
        });
    });

    describe('fingerprint and DCC/st-write behavior', () => {
        it('getFingerprint should be stable across whitespace-only differences', () => {
            expect(SyncUtils.getFingerprint('Hello   World')).toBe(SyncUtils.getFingerprint('Hello World'));
            expect(SyncUtils.getFingerprint(' Hello\u200BWorld ')).toBe(SyncUtils.getFingerprint('HelloWorld'));
        });

        it('identifyMessage should ignore mesST when computing fingerprint', () => {
            const a = SyncUtils.identifyMessage({ mesRaw: 'FULL', mesST: 'SUMMARY' } as any).fingerprint;
            const b = SyncUtils.identifyMessage({ mesRaw: 'FULL', mesST: 'SUMMARY_CHANGED' } as any).fingerprint;
            expect(a).toBe(b);
        });

        it('compareStates should not treat DCC summary as ST edit when ST shows mesST', () => {
            const local: LuminaChatMessage[] = [
                { id: '1', mesRaw: 'FULL', mesST: 'SUMMARY', fingerprint: SyncUtils.getFingerprint('FULL'), mes: 'FULL', name: 'A', role: 'assistant', extra: {} } as unknown as LuminaChatMessage
            ];
            const st = [
                STProtocol.fromST({ message_id: 0, name: 'A', role: 'assistant', is_hidden: false, message: 'SUMMARY', data: {}, extra: { id: '1', fingerprint: SyncUtils.getFingerprint('FULL'), mesRaw: 'FULL', mesST: 'SUMMARY' } })
            ];

            const diff = SyncUtils.compareStates(local, st);
            expect(diff.updated).toHaveLength(0);
            expect(diff.onlyInIndependent).toHaveLength(0);
            expect(diff.onlyInST).toHaveLength(0);
        });

        it('compareStates should classify ST user edits when ST mes differs from stored mesST', () => {
            const local: LuminaChatMessage[] = [
                { id: '1', mesRaw: 'FULL', mesST: 'SUMMARY', fingerprint: SyncUtils.getFingerprint('FULL'), mes: 'FULL', name: 'A', role: 'assistant', extra: {} } as unknown as LuminaChatMessage
            ];
            const st = [
                STProtocol.fromST({ message_id: 0, name: 'A', role: 'assistant', is_hidden: false, message: 'EDITED', data: {}, extra: { id: '1', fingerprint: SyncUtils.getFingerprint('FULL'), mesRaw: 'FULL', mesST: 'SUMMARY' } })
            ];

            const diff = SyncUtils.compareStates(local, st);
            expect(diff.updated).toHaveLength(1);
            expect(diff.updated[0]._isSTEdit).toBe(true);
        });
    });

    describe('mergeNodeState', () => {
        it('should merge ST node into Lumina node keeping Lumina extra', () => {
            const target = { mes: 'old', name: 'old', is_hidden: false, extra: { keep: true } } as unknown as LuminaChatMessage;
            const source = { mes: 'new', name: 'new', is_hidden: true, extra: { discard: true } } as Partial<LuminaChatMessage>;
            SyncUtils.mergeNodeState(target, source, true);
            expect(target.mes).toBe('new');
            expect(target.name).toBe('new');
            expect(target.is_hidden).toBe(true);
            expect(target.extra).toEqual({ keep: true });
        });

        it('should merge non-ST node into Lumina node keeping and merging extra', () => {
            const target = { mes: 'old', name: 'old', is_hidden: false, extra: { keep: true } } as unknown as LuminaChatMessage;
            const source = { mes: 'new', name: 'new', is_hidden: true, extra: { keep2: true } } as Partial<LuminaChatMessage>;
            SyncUtils.mergeNodeState(target, source, false);
            expect(target.mes).toBe('new');
            expect(target.name).toBe('new');
            expect(target.is_hidden).toBe(true);
            expect(target.extra).toEqual({ keep: true, keep2: true });
        });
    });
});
