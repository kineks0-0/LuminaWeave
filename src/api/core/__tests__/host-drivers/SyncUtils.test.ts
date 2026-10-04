import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SyncUtils, MessageTextResolver, MessageComparator } from '@/api/core/host-drivers/st/SyncUtils.js';
import { LuminaChatMessage } from '@shared/LuminaMessage.js';
import { STProtocol } from '@/api/core/host-drivers/st/STProtocol.js';

vi.mock('@/api/storage.js', () => ({
    lwStorage: {
        _getContextIds: vi.fn(() => ({ charId: 'c1' })),
        get: vi.fn((key, def) => def)
    }
}));

describe('SyncUtils', () => {
    beforeEach(() => {
        vi.clearAllMocks();
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

    it('isLuminaSyncMessage should trust written hash over the time window', () => {
        const writtenHash = SyncUtils.getSTFingerprint('Hello');

        // 时间窗早已过期，但内容与写回一致 → 仍是自写回声
        expect(SyncUtils.isLuminaSyncMessage({
            mes: 'Hello',
            extra: {
                [SyncUtils.SYNC_SOURCE_KEY]: SyncUtils.SYNC_SOURCE_LUMINA,
                [SyncUtils.SYNC_TS_KEY]: Date.now() - 60_000,
                [SyncUtils.SYNC_WRITTEN_HASH_KEY]: writtenHash
            }
        } as unknown as LuminaChatMessage, Date.now(), 500)).toBe(true);

        // 时间窗内，但 ST 侧已改过内容 → 不再视为回声
        expect(SyncUtils.isLuminaSyncMessage({
            mes: 'Hello edited',
            extra: {
                [SyncUtils.SYNC_SOURCE_KEY]: SyncUtils.SYNC_SOURCE_LUMINA,
                [SyncUtils.SYNC_TS_KEY]: Date.now() - 100,
                [SyncUtils.SYNC_WRITTEN_HASH_KEY]: writtenHash
            }
        } as unknown as LuminaChatMessage, Date.now(), 500)).toBe(false);
    });

    it('createSyncSourceMeta should record the written hash when text is provided', () => {
        const meta = SyncUtils.createSyncSourceMeta('Hello');
        expect(meta[SyncUtils.SYNC_WRITTEN_HASH_KEY]).toBe(SyncUtils.getSTFingerprint('Hello'));

        const metaWithoutText = SyncUtils.createSyncSourceMeta();
        expect(metaWithoutText[SyncUtils.SYNC_WRITTEN_HASH_KEY]).toBeUndefined();
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
            const a = STProtocol.identifyMessage({ mesRaw: 'FULL', mesST: 'SUMMARY' } as any).fingerprint;
            const b = STProtocol.identifyMessage({ mesRaw: 'FULL', mesST: 'SUMMARY_CHANGED' } as any).fingerprint;
            expect(a).toBe(b);
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
