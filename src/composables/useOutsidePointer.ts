import { onBeforeUnmount, onMounted, unref, type Ref } from 'vue';

export type MaybeElementRef = Ref<HTMLElement | null> | (() => HTMLElement | null);

/**
 * 指针在目标元素之外按下时触发 handler。
 * 使用 composedPath 以兼容 Shadow DOM。
 */
export const useOutsidePointer = (targets: MaybeElementRef[], handler: () => void): void => {
    const resolve = (target: MaybeElementRef): HTMLElement | null =>
        (typeof target === 'function' ? target() : unref(target));

    const listener = (event: PointerEvent): void => {
        const path = event.composedPath();
        for (const target of targets) {
            const element = resolve(target);
            if (element && path.includes(element)) return;
        }
        handler();
    };

    onMounted(() => document.addEventListener('pointerdown', listener, true));
    onBeforeUnmount(() => document.removeEventListener('pointerdown', listener, true));
};
