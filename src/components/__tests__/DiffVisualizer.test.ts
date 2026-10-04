import { describe, expect, it } from 'vitest';
import type { DiffResult } from '@shared/api/SyncEngine.js';
import { DiffVisualizer } from '../common/DiffVisualizer.js';

const buildDiff = (left: unknown[], right: unknown[]): DiffResult => ({
    onlyInIndependent: [],
    onlyInST: [],
    updated: [],
    independentSequence: left,
    stSequence: right,
    diffCount: 0,
    hasConflict: false,
    hasDivergence: false,
    divergenceIndex: -1
});

describe('DiffVisualizer', () => {
    it('marks rows with equal content and identity as same', () => {
        const rows = DiffVisualizer.generateDiffRows(buildDiff(
            [{ name: 'Alice', role: 'assistant', mes: 'hello', stFingerprint: 'fp_a' }],
            [{ name: 'Alice', role: 'assistant', mes: 'hello', stFingerprint: 'fp_a' }]
        ));

        expect(rows).toHaveLength(1);
        expect(rows[0].leftClass).toBe('is-same');
        expect(rows[0].rightClass).toBe('is-same');
        expect(rows[0].leftSign).toBe(' ');
    });

    it('marks a row present only on the independent side as added', () => {
        const rows = DiffVisualizer.generateDiffRows(buildDiff(
            [{ name: 'Alice', role: 'assistant', mes: 'local only', stFingerprint: 'fp_a' }],
            []
        ));

        expect(rows[0].leftClass).toBe('is-add');
        expect(rows[0].rightClass).toBe('is-empty');
        expect(rows[0].leftSign).toBe('+');
    });

    it('marks rows with diverging fingerprints as modified', () => {
        const rows = DiffVisualizer.generateDiffRows(buildDiff(
            [{ name: 'Alice', role: 'assistant', mes: 'before', stFingerprint: 'fp_a' }],
            [{ name: 'Alice', role: 'assistant', mes: 'after', stFingerprint: 'fp_b' }]
        ));

        expect(rows[0].leftClass).toBe('is-mod');
        expect(rows[0].rightClass).toBe('is-mod');
    });
});
