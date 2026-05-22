import { describe, expect, it } from 'vitest';

import { STAdapter } from '@/api/core/host-drivers/st/STAdapter.js';
import type { LuminaChatMessage } from '@shared/LuminaMessage.js';

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
});
