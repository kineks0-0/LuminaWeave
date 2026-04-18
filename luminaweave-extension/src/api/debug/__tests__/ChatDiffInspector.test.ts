import { describe, it, expect } from 'vitest';
import { ChatDiffInspector } from '../ChatDiffInspector.js';
import { SyncUtils } from '../../core/SyncUtils.js';
import type { LuminaChatMessage } from '../../core/ChatManager.js';

function makeMsg(partial: Partial<LuminaChatMessage>): LuminaChatMessage {
    return {
        id: partial.id ?? 'id',
        parentId: partial.parentId ?? null,
        name: partial.name ?? 'User',
        role: partial.role ?? 'user',
        is_user: partial.is_user,
        mesRaw: partial.mesRaw ?? '',
        mes: partial.mes ?? '',
        mesST: partial.mesST,
        mesSummary: partial.mesSummary,
        is_hidden: partial.is_hidden,
        pluginRaw: partial.pluginRaw,
        fingerprint: partial.fingerprint ?? '',
        characterId: partial.characterId,
        extra: partial.extra ?? {}
    } as LuminaChatMessage;
}

describe('ChatDiffInspector', () => {
    it('should classify DCC-style write text difference as write_text_mismatch (not content_mismatch)', () => {
        const fp = SyncUtils.getFingerprint('Hello');
        const local: LuminaChatMessage[] = [
            makeMsg({ id: '1', name: 'AI', role: 'assistant', mesRaw: 'Hello', mes: 'Hello', mesST: 'SUMMARY', fingerprint: fp })
        ];
        const st: LuminaChatMessage[] = [
            makeMsg({ id: '1', name: 'AI', role: 'assistant', mesRaw: 'Hello', mes: 'Hello', fingerprint: fp })
        ];

        const report = ChatDiffInspector.analyze(local, st);
        expect(report.summary.contentMismatchCount).toBe(0);
        expect(report.summary.writeTextMismatchCount).toBe(1);
    });

    it('should match by fingerprint when id differs', () => {
        const fp = 'fp_same';
        const local: LuminaChatMessage[] = [
            makeMsg({ id: 'local-id', mesRaw: 'A', mes: 'A', fingerprint: fp })
        ];
        const st: LuminaChatMessage[] = [
            makeMsg({ id: 'st-id', mesRaw: 'A', mes: 'A', fingerprint: fp })
        ];

        const report = ChatDiffInspector.analyze(local, st);
        const first = report.items.find(it => it.lumina && it.st);
        expect(first?.matchReason).toBe('fingerprint');
        expect(first?.confidence).toBe('medium');
    });

    it('should not report divergence when id differs but semantic content is identical', () => {
        const fp = 'fp_same';
        const local: LuminaChatMessage[] = [
            makeMsg({ id: 'local-id', mesRaw: 'A', mes: 'A', mesST: 'A', fingerprint: fp })
        ];
        const st: LuminaChatMessage[] = [
            makeMsg({ id: 'st-id', mesRaw: 'A', mes: 'A', mesST: 'A', fingerprint: fp })
        ];

        const report = ChatDiffInspector.analyze(local, st);

        expect(report.divergenceIndex).toBe(-1);
        expect(report.firstMismatchIndex).toBe(-1);
        expect(report.summary.contentMismatchCount).toBe(0);
        expect(report.summary.metadataMismatchCount).toBe(0);
        expect(report.summary.writeTextMismatchCount).toBe(0);
    });

    it('should fall back to index matching and mark low confidence when id/fingerprint cannot match', () => {
        const local: LuminaChatMessage[] = [
            makeMsg({ id: 'a', mesRaw: 'A', mes: 'A', fingerprint: '' })
        ];
        const st: LuminaChatMessage[] = [
            makeMsg({ id: 'b', mesRaw: 'B', mes: 'B', fingerprint: '' })
        ];

        const report = ChatDiffInspector.analyze(local, st);
        const first = report.items.find(it => it.lumina && it.st);
        expect(first?.matchReason).toBe('index');
        expect(first?.diffTypes.includes('low_confidence_match')).toBe(true);
    });
});
