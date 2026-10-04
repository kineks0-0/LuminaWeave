import { onBeforeUnmount } from 'vue';

export interface LongPressMenuOptions<Payload> {
    /** 触发长按的按住时长 */
    delayMs?: number;
    /** 手指移动超过该距离视为滚动 / 拖动，取消长按 */
    moveThresholdPx?: number;
    onTrigger: (payload: Payload) => void;
}

export interface LongPressMenuHandlers<Payload> {
    handlePointerdown: (payload: Payload, event: PointerEvent) => void;
    handlePointermove: (event: PointerEvent) => void;
    handlePointerup: () => void;
    handlePointercancel: () => void;
    /** 长按已弹出菜单时吞掉随后的 click，返回 true 表示应忽略本次点击 */
    consumeClick: () => boolean;
}

/**
 * 触屏长按弹出菜单：显式忽略鼠标（鼠标走右键 / 悬停按钮），
 * 滚动或拖动（pointercancel / 位移超阈值）不触发。
 */
export const useLongPressMenu = <Payload>({
    onTrigger,
    delayMs = 480,
    moveThresholdPx = 10
}: LongPressMenuOptions<Payload>): LongPressMenuHandlers<Payload> => {
    let timer: ReturnType<typeof setTimeout> | null = null;
    let startX = 0;
    let startY = 0;
    let suppressClick = false;

    const clearTimer = (): void => {
        if (timer) clearTimeout(timer);
        timer = null;
    };

    const handlePointerdown = (payload: Payload, event: PointerEvent): void => {
        if (event.pointerType === 'mouse') return;
        clearTimer();
        suppressClick = false;
        startX = event.clientX;
        startY = event.clientY;
        timer = setTimeout(() => {
            timer = null;
            suppressClick = true;
            onTrigger(payload);
        }, delayMs);
    };

    const handlePointermove = (event: PointerEvent): void => {
        if (!timer) return;
        if (Math.abs(event.clientX - startX) > moveThresholdPx || Math.abs(event.clientY - startY) > moveThresholdPx) {
            clearTimer();
        }
    };

    const consumeClick = (): boolean => {
        const suppress = suppressClick;
        suppressClick = false;
        return suppress;
    };

    onBeforeUnmount(clearTimer);

    return {
        handlePointerdown,
        handlePointermove,
        handlePointerup: clearTimer,
        handlePointercancel: clearTimer,
        consumeClick
    };
};
