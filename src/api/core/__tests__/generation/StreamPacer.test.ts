import { describe, expect, it } from 'vitest';
import { StreamPacer } from '@/api/core/generation/StreamPacer.js';

const runFrames = (pacer: StreamPacer, backlog: number, frames: number, frameMs = 16, draining = false) => {
    let remaining = backlog;
    let emitted = 0;
    const perFrame: number[] = [];
    for (let frame = 1; frame <= frames && remaining > 0; frame += 1) {
        const count = pacer.take(frame * frameMs, remaining, draining);
        perFrame.push(count);
        remaining -= count;
        emitted += count;
    }
    return { emitted, perFrame, remaining };
};

describe('StreamPacer', () => {
    it('emits characters in proportion to elapsed time rather than per tick', () => {
        const fast = new StreamPacer({ speedFactor: 2, maxCharsPerFrame: 100 });
        fast.reset(0);
        const slow = new StreamPacer({ speedFactor: 2, maxCharsPerFrame: 100 });
        slow.reset(0);

        const at60 = runFrames(fast, 400, 30, 16);
        const at30 = runFrames(slow, 400, 15, 32);
        expect(Math.abs(at60.emitted - at30.emitted)).toBeLessThanOrEqual(Math.ceil(at60.emitted * 0.03));
    });

    it('keeps a steady cadence without large bursts for a single network chunk', () => {
        const pacer = new StreamPacer({ speedFactor: 2, maxCharsPerFrame: 100 });
        pacer.reset(0);
        const { perFrame } = runFrames(pacer, 120, 20);
        const nonZero = perFrame.filter(count => count > 0);
        expect(Math.max(...nonZero) - Math.min(...nonZero)).toBeLessThanOrEqual(4);
    });

    it('respects the configured speed cap', () => {
        const pacer = new StreamPacer({ speedFactor: 7, maxCharsPerFrame: 2 });
        pacer.reset(0);
        const { emitted } = runFrames(pacer, 10_000, 60, 1000 / 60);
        expect(emitted).toBeLessThanOrEqual(121);
    });

    it('drains the backlog quickly once the stream has ended', () => {
        const pacer = new StreamPacer({ speedFactor: 1, maxCharsPerFrame: 100 });
        pacer.reset(0);
        const { remaining } = runFrames(pacer, 600, Math.ceil(650 / 16), 16, true);
        expect(remaining).toBe(0);
    });

    it('flushes everything after a long gap such as a background tab', () => {
        const pacer = new StreamPacer({ speedFactor: 2, maxCharsPerFrame: 100 });
        pacer.reset(0);
        pacer.take(16, 500, false);
        expect(pacer.take(1016, 480, false)).toBe(480);
    });

    it('accumulates fractional characters between frames', () => {
        const pacer = new StreamPacer({ speedFactor: 1, maxCharsPerFrame: 100 });
        pacer.reset(0);
        const { emitted } = runFrames(pacer, 3, 120);
        expect(emitted).toBe(3);
    });
});
