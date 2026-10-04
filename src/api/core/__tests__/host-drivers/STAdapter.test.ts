import { describe, expect, it, vi, beforeEach } from 'vitest';

import { STAdapter } from '@/api/core/host-drivers/st/STAdapter.js';
import { STClient } from '@/api/core/host-drivers/st/STClient.js';
import { STProtocol } from '@/api/core/host-drivers/st/STProtocol.js';
import { SyncUtils } from '@/api/core/host-drivers/st/SyncUtils.js';
import type { LuminaChatMessage } from '@shared/LuminaMessage.js';

vi.mock('@/api/core/host-drivers/st/STClient.js', () => ({
    STClient: {
        getRawMessages: vi.fn(),
        updateMessages: vi.fn(),
        appendMessages: vi.fn(),
        deleteMessages: vi.fn(),
        flush: vi.fn(),
        getResolvedCurrentChatId: vi.fn(() => 'chat-1')
    }
}));

function makeMessage(partial: Partial<LuminaChatMessage>): LuminaChatMessage {
    return {
        id: partial.id ?? 'id',
        parentId: partial.parentId ?? null,
        name: partial.name ?? 'Tester',
        role: partial.role ?? 'assistant',
        mesRaw: partial.mesRaw ?? '',
        mes: partial.mes ?? partial.mesRaw ?? '',
        mesST: partial.mesST,
        fingerprint: partial.fingerprint ?? 'fp',
        stFingerprint: partial.stFingerprint ?? partial.mesST ?? partial.mesRaw ?? '',
        extra: partial.extra ?? {},
        is_hidden: partial.is_hidden ?? false
    } as LuminaChatMessage;
}

describe('STAdapter.compareStates', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('should ignore semantic no-op id drift when content and metadata are identical', () => {
        const local = [
            makeMessage({ id: 'local-1', mesRaw: 'Hello', mes: 'Hello', mesST: 'Hello', fingerprint: 'fp-hello', stFingerprint: 'stfp-hello' })
        ];
        const st = [
            makeMessage({ id: 'st-1', mesRaw: 'Hello', mes: 'Hello', mesST: 'Hello', fingerprint: 'fp-hello', stFingerprint: 'stfp-hello' })
        ];

        const diff = STAdapter.compareStates(local, st);

        expect(diff.onlyInIndependent).toHaveLength(0);
        expect(diff.onlyInST).toHaveLength(0);
        expect(diff.updated).toHaveLength(0);
        expect(diff.diffCount).toBe(0);
        expect(diff.hasConflict).toBe(false);
        expect(diff.hasDivergence).toBe(false);
        expect(diff.divergenceIndex).toBe(-1);
    });

    it('should treat ST-only messages as mergeable differences, not unmergeable divergence', () => {
        const diff = STAdapter.compareStates([], [
            makeMessage({ id: 'st-1', mesRaw: 'Hello from ST', mes: 'Hello from ST', mesST: 'Hello from ST', fingerprint: 'fp-st' })
        ]);

        expect(diff.onlyInIndependent).toHaveLength(0);
        expect(diff.onlyInST).toHaveLength(1);
        expect(diff.diffCount).toBe(1);
        expect(diff.hasConflict).toBe(true);
        expect(diff.hasDivergence).toBe(false);
        expect(diff.divergenceIndex).toBe(0);
    });

    it('should treat worldline branch tails as mergeable, not unmergeable divergence', () => {
        const local = [
            makeMessage({ id: '1', parentId: null, mesRaw: 'prefix', mes: 'prefix', mesST: 'prefix', fingerprint: 'fp-prefix', stFingerprint: 'stfp-prefix' }),
            makeMessage({ id: 'branch', parentId: '1', mesRaw: 'branch tail', mes: 'branch tail', mesST: 'branch tail', fingerprint: 'fp-branch', stFingerprint: 'stfp-branch' })
        ];
        const st = [
            makeMessage({ id: '1', parentId: null, mesRaw: 'prefix', mes: 'prefix', mesST: 'prefix', fingerprint: 'fp-prefix', stFingerprint: 'stfp-prefix' }),
            makeMessage({ id: 'st-tail', parentId: '1', mesRaw: 'st tail', mes: 'st tail', mesST: 'st tail', fingerprint: 'fp-st-tail', stFingerprint: 'stfp-st-tail' })
        ];

        const diff = STAdapter.compareStates(local, st);

        expect(diff.onlyInIndependent).toHaveLength(1);
        expect(diff.onlyInST).toHaveLength(1);
        expect(diff.hasDivergence).toBe(false);
    });

    it('should report unmergeable divergence when both sides edited the same message differently', () => {
        const local = [
            makeMessage({
                id: '1',
                parentId: null,
                mesRaw: 'local edit',
                mes: 'local edit',
                mesST: 'local edit',
                fingerprint: 'fp-local-edit',
                stFingerprint: 'stfp-local-edit',
                extra: { stFingerprint: 'stfp-baseline' }
            })
        ];
        const st = [
            makeMessage({
                id: '1',
                parentId: null,
                mesRaw: 'st edit',
                mes: 'st edit',
                mesST: 'st edit',
                fingerprint: 'fp-st-edit',
                extra: { stFingerprint: 'stfp-baseline' }
            })
        ];

        const diff = STAdapter.compareStates(local, st);

        expect(diff.updated).toHaveLength(1);
        expect(diff.hasDivergence).toBe(true);
    });

    it('should report unmergeable divergence when identities are broken with unique content on both sides', () => {
        const local = [
            makeMessage({ id: 'L1', parentId: null, mesRaw: 'local content', mes: 'local content', mesST: 'local content', fingerprint: 'fp-L1', stFingerprint: 'stfp-L1' })
        ];
        const st = [
            makeMessage({ id: 'S1', parentId: null, mesRaw: 'st content', mes: 'st content', mesST: 'st content', fingerprint: 'fp-S1', stFingerprint: 'stfp-S1' })
        ];

        const diff = STAdapter.compareStates(local, st);

        expect(diff.onlyInIndependent).toHaveLength(1);
        expect(diff.onlyInST).toHaveLength(1);
        expect(diff.hasDivergence).toBe(true);
    });

    it('should treat append-only local messages as mergeable', () => {
        const local: LuminaChatMessage[] = [
            makeMessage({ id: '1', mesRaw: 'A', mes: 'A', fingerprint: SyncUtils.getFingerprint('A') }),
            makeMessage({ id: '2', parentId: '1', mesRaw: 'B', mes: 'B', fingerprint: SyncUtils.getFingerprint('B') }),
            makeMessage({ id: '3', parentId: '2', mesRaw: 'C', mes: 'C', fingerprint: SyncUtils.getFingerprint('C') })
        ];
        const st = [
            STProtocol.fromST({ message_id: 0, name: 'User', role: 'user', is_hidden: false, message: 'A', data: {}, extra: { id: '1', fingerprint: SyncUtils.getFingerprint('A') } }),
            STProtocol.fromST({ message_id: 1, name: 'User', role: 'user', is_hidden: false, message: 'B', data: {}, extra: { id: '2', fingerprint: SyncUtils.getFingerprint('B') } })
        ];

        const diff = STAdapter.compareStates(local, st);
        expect(diff.hasDivergence).toBe(false);
        expect(diff.onlyInIndependent).toHaveLength(1);
        expect(diff.onlyInST).toHaveLength(0);
        expect(diff.independentSequence).toHaveLength(3);
        expect(diff.stSequence).toHaveLength(2);
    });

    it('should not treat DCC summary as ST edit when ST shows mesST', () => {
        const local = [
            makeMessage({ id: '1', mesRaw: 'FULL', mes: 'FULL', mesST: 'SUMMARY', fingerprint: SyncUtils.getFingerprint('FULL') })
        ];
        const st = [
            makeMessage({ id: '1', mesRaw: 'FULL', mes: 'SUMMARY', mesST: 'SUMMARY', fingerprint: SyncUtils.getFingerprint('FULL') })
        ];

        const diff = STAdapter.compareStates(local, st);
        expect(diff.updated).toHaveLength(0);
        expect(diff.onlyInIndependent).toHaveLength(0);
        expect(diff.onlyInST).toHaveLength(0);
    });

    it('should classify ST user edits when ST text differs from stored write hash', () => {
        const baseline = SyncUtils.getSTFingerprint('SUMMARY');
        const local = [
            makeMessage({
                id: '1',
                mesRaw: 'FULL',
                mes: 'FULL',
                mesST: 'SUMMARY',
                fingerprint: SyncUtils.getFingerprint('FULL'),
                stFingerprint: baseline,
                extra: { stFingerprint: baseline }
            })
        ];
        const st = [
            makeMessage({
                id: '1',
                mesRaw: 'FULL',
                mes: 'EDITED',
                mesST: 'EDITED',
                fingerprint: SyncUtils.getFingerprint('FULL'),
                stFingerprint: baseline,
                extra: { stFingerprint: baseline }
            })
        ];

        const diff = STAdapter.compareStates(local, st);
        expect(diff.updated).toHaveLength(1);
        expect(diff.updated[0]._isSTEdit).toBe(true);
    });

    it('applyDelta should append local-only messages with sync markers and written hash', async () => {
        const localTrace: LuminaChatMessage[] = [
            makeMessage({ id: '1', mes: 'Hello', mesRaw: 'Hello', role: 'user', fingerprint: 'fp1', extra: {} })
        ];

        const diffData = STAdapter.compareStates(localTrace, []);
        await STAdapter.applyDelta(diffData, localTrace, []);

        expect(STClient.appendMessages).toHaveBeenCalledTimes(1);
        const appendArgs = vi.mocked(STClient.appendMessages).mock.calls[0][0];
        expect(appendArgs[0].mesST).toBe('Hello');
        expect(appendArgs[0].extra?.['_lw_sync_source']).toBe('lumina');
        expect(typeof appendArgs[0].extra?.['_lw_sync_ts']).toBe('number');
        expect(appendArgs[0].extra?.['_lw_written_hash']).toBe(SyncUtils.getSTFingerprint('Hello'));
        expect(STClient.flush).toHaveBeenCalledTimes(1);
    });

    it('applyDelta should delete ST-only messages', async () => {
        const stChat: LuminaChatMessage[] = [
            STProtocol.fromST({ message_id: 0, name: 'You', role: 'user', is_hidden: false, message: 'Hello', data: {}, extra: { id: '1', fingerprint: 'fp1' } })
        ];

        const diffData = STAdapter.compareStates([], stChat);
        await STAdapter.applyDelta(diffData, [], stChat);

        expect(STClient.deleteMessages).toHaveBeenCalledTimes(1);
        expect(STClient.deleteMessages).toHaveBeenCalledWith([0], true);
        expect(STClient.flush).toHaveBeenCalledTimes(1);
    });

    it('applyDelta should update changed messages', async () => {
        const localTrace: LuminaChatMessage[] = [
            makeMessage({ id: '1', mes: 'Hello World', mesRaw: 'Hello World', role: 'user', fingerprint: 'fp1_new' })
        ];
        const stChat: LuminaChatMessage[] = [
            STProtocol.fromST({ message_id: 0, name: 'You', role: 'user', is_hidden: false, message: 'Hello', data: {}, extra: { id: '1', fingerprint: 'fp1' } })
        ];

        const diffData = STAdapter.compareStates(localTrace, stChat);
        await STAdapter.applyDelta(diffData, localTrace, stChat);

        expect(STClient.updateMessages).toHaveBeenCalledTimes(1);
        const updateArg = vi.mocked(STClient.updateMessages).mock.calls[0][0];
        expect(updateArg[0].index).toBe(0);
        expect(updateArg[0].content).toBe('Hello World');
        expect(updateArg[0].extra?.['_lw_sync_source']).toBe('lumina');
        expect(STClient.flush).toHaveBeenCalledTimes(1);
    });
});
