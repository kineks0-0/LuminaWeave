import { describe, expect, it } from 'vitest';
import { isSurfaceValueEquivalent } from '../surfaceValueEquality.js';

describe('isSurfaceValueEquivalent', () => {
    it('treats separately allocated plain inputs with the same values as equivalent', () => {
        expect(isSurfaceValueEquivalent(
            { activity: { size: 'small' }, flags: [true, false] },
            { activity: { size: 'small' }, flags: [true, false] }
        )).toBe(true);
    });

    it('detects nested input changes', () => {
        expect(isSurfaceValueEquivalent(
            { activity: { size: 'small' } },
            { activity: { size: 'default' } }
        )).toBe(false);
    });

    it('compares callbacks by identity', () => {
        const callback = (): void => undefined;

        expect(isSurfaceValueEquivalent({ callback }, { callback })).toBe(true);
        expect(isSurfaceValueEquivalent(
            { callback },
            { callback: (): void => undefined }
        )).toBe(false);
    });
});
