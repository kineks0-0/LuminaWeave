import { describe, expect, it } from 'vitest';
import {
    STICK_TO_BOTTOM_THRESHOLD_PX,
    StickToBottomController,
    type ScrollMetrics
} from '../stickToBottomController.js';

const metrics = (scrollTop: number, scrollHeight = 2000, clientHeight = 500): ScrollMetrics => ({
    scrollTop,
    scrollHeight,
    clientHeight
});

describe('StickToBottomController', () => {
    it('follows content growth with an instant scroll target while following', () => {
        const controller = new StickToBottomController();
        expect(controller.following).toBe(true);
        expect(controller.resolveFollowTarget(metrics(1500, 2300))).toBe(1800);
    });

    it('ignores scroll events caused by its own scroll writes', () => {
        const controller = new StickToBottomController();
        controller.resolveFollowTarget(metrics(1500, 2300));
        controller.handleScroll(metrics(1800, 2300));
        expect(controller.following).toBe(true);
    });

    it.each(['wheel-up', 'touch', 'key-up', 'scrollbar'] as const)(
        'stops following on user intent: %s',
        (intent) => {
            const controller = new StickToBottomController();
            controller.handleUserIntent(intent);
            expect(controller.following).toBe(false);
            expect(controller.resolveFollowTarget(metrics(1490, 2300))).toBeNull();
        }
    );

    it('does not snap back after a small upward scroll inside the threshold', () => {
        const controller = new StickToBottomController();
        controller.handleUserIntent('wheel-up');
        controller.handleScroll(metrics(1490));
        expect(controller.following).toBe(false);
    });

    it('resumes following once the user scrolls back to the very bottom', () => {
        const controller = new StickToBottomController();
        controller.handleUserIntent('wheel-up');
        controller.handleScroll(metrics(1200));
        controller.handleScroll(metrics(1500));
        expect(controller.following).toBe(true);
    });

    it('stops following when a non-programmatic scroll leaves the threshold', () => {
        const controller = new StickToBottomController();
        controller.handleScroll(metrics(1500 - STICK_TO_BOTTOM_THRESHOLD_PX - 1));
        expect(controller.following).toBe(false);
    });

    it('shows the jump-to-latest affordance only when detached with content below', () => {
        const controller = new StickToBottomController();
        expect(controller.shouldShowJumpToLatest(metrics(1000))).toBe(false);
        controller.handleUserIntent('wheel-up');
        expect(controller.shouldShowJumpToLatest(metrics(1500))).toBe(false);
        expect(controller.shouldShowJumpToLatest(metrics(1000))).toBe(true);
    });

    it('forced follow re-attaches and targets the bottom', () => {
        const controller = new StickToBottomController();
        controller.handleUserIntent('touch');
        controller.forceFollow();
        expect(controller.following).toBe(true);
        expect(controller.resolveFollowTarget(metrics(200))).toBe(1500);
    });
});
