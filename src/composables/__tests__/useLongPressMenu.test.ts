import { effectScope } from 'vue';
import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from 'vitest';
import { useLongPressMenu, type LongPressMenuHandlers } from '../useLongPressMenu.js';

const pointerEvent = (type: string, options: Partial<PointerEvent> = {}): PointerEvent => ({
    pointerType: 'touch',
    clientX: 10,
    clientY: 10,
    ...options
} as PointerEvent);

describe('useLongPressMenu', () => {
    let scope: ReturnType<typeof effectScope>;
    let trigger: Mock<(payload: string) => void>;
    let handlers: LongPressMenuHandlers<string>;

    beforeEach(() => {
        vi.useFakeTimers();
        trigger = vi.fn<(payload: string) => void>();
        scope = effectScope();
        handlers = scope.run(() => useLongPressMenu<string>({ onTrigger: trigger }))!;
    });

    afterEach(() => {
        scope.stop();
        vi.useRealTimers();
    });

    it('fires after the hold delay and swallows the follow-up click once', () => {
        handlers.handlePointerdown('session_a', pointerEvent('pointerdown'));
        vi.advanceTimersByTime(479);
        expect(trigger).not.toHaveBeenCalled();

        vi.advanceTimersByTime(1);
        expect(trigger).toHaveBeenCalledWith('session_a');
        expect(handlers.consumeClick()).toBe(true);
        expect(handlers.consumeClick()).toBe(false);
    });

    it('ignores mouse pointers so desktops keep right-click / hover menus', () => {
        handlers.handlePointerdown('session_a', pointerEvent('pointerdown', { pointerType: 'mouse' }));
        vi.advanceTimersByTime(1000);
        expect(trigger).not.toHaveBeenCalled();
    });

    it('cancels when the finger moves beyond the scroll threshold', () => {
        handlers.handlePointerdown('session_a', pointerEvent('pointerdown'));
        handlers.handlePointermove(pointerEvent('pointermove', { clientY: 30 }));
        vi.advanceTimersByTime(1000);
        expect(trigger).not.toHaveBeenCalled();
    });

    it('cancels on pointercancel and pointerup before the delay', () => {
        handlers.handlePointerdown('session_a', pointerEvent('pointerdown'));
        handlers.handlePointercancel();
        vi.advanceTimersByTime(1000);
        expect(trigger).not.toHaveBeenCalled();

        handlers.handlePointerdown('session_a', pointerEvent('pointerdown'));
        handlers.handlePointerup();
        vi.advanceTimersByTime(1000);
        expect(trigger).not.toHaveBeenCalled();
    });
});
