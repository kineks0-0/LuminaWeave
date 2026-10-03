import { describe, expect, it } from 'vitest';
import {
    createRevealTracker,
    recordRevealProgress,
    resolveActiveRevealRanges
} from '../presentation/streamReveal.js';

describe('streamReveal', () => {
    it('does not animate text that existed before tracking started', () => {
        const tracker = createRevealTracker(120);
        expect(resolveActiveRevealRanges(tracker, 0, 200)).toEqual([]);
    });

    it('records each arrival as a range with its age', () => {
        let tracker = createRevealTracker(0);
        tracker = recordRevealProgress(tracker, 5, 1000, 200);
        tracker = recordRevealProgress(tracker, 9, 1050, 200);
        expect(resolveActiveRevealRanges(tracker, 1100, 200)).toEqual([
            { start: 0, end: 5, ageMs: 100 },
            { start: 5, end: 9, ageMs: 50 }
        ]);
    });

    it('drops ranges older than the effect duration', () => {
        let tracker = createRevealTracker(0);
        tracker = recordRevealProgress(tracker, 5, 1000, 200);
        tracker = recordRevealProgress(tracker, 9, 1300, 200);
        expect(tracker.arrivals).toHaveLength(1);
        expect(resolveActiveRevealRanges(tracker, 1300, 200)).toEqual([{ start: 5, end: 9, ageMs: 0 }]);
    });

    it('clamps ranges when rendered text shrinks', () => {
        let tracker = createRevealTracker(0);
        tracker = recordRevealProgress(tracker, 5, 1000, 200);
        tracker = recordRevealProgress(tracker, 12, 1010, 200);
        tracker = recordRevealProgress(tracker, 8, 1020, 200);
        expect(tracker.length).toBe(8);
        expect(resolveActiveRevealRanges(tracker, 1020, 200)).toEqual([
            { start: 0, end: 5, ageMs: 20 },
            { start: 5, end: 8, ageMs: 10 }
        ]);
    });

    it('resets ranges entirely when text is replaced from the start', () => {
        let tracker = createRevealTracker(0);
        tracker = recordRevealProgress(tracker, 5, 1000, 200);
        tracker = recordRevealProgress(tracker, 0, 1010, 200);
        expect(tracker.arrivals).toEqual([]);
    });
});
