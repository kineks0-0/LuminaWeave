import { onBeforeUnmount, onMounted, ref, watch, type Ref } from 'vue';
import type { ChatMotionLevel, ChatMotionPreference } from '../plugins/chat/presentation/ChatStreamingPresentation.js';

const resolveMotionLevel = (value: string | undefined): ChatMotionLevel => (
    value === 'light' || value === 'none' ? value : 'full'
);

/**
 * 读取应用根节点的 data-motion（来自 lumina-settings.motionPerformance）与系统"减少动效"偏好。
 */
export function useMotionPreference(elementRef: Ref<HTMLElement | null>): Ref<ChatMotionPreference> {
    const preference = ref<ChatMotionPreference>({ motion: 'full', reducedMotion: false });
    let motionHost: HTMLElement | null = null;
    let observer: MutationObserver | null = null;
    let mediaQuery: MediaQueryList | null = null;

    const refresh = (): void => {
        preference.value = {
            motion: resolveMotionLevel(motionHost?.dataset.motion),
            reducedMotion: mediaQuery?.matches === true
        };
    };

    const attachHost = (element: HTMLElement | null): void => {
        const nextHost = element?.closest<HTMLElement>('[data-motion]') ?? null;
        if (!nextHost || nextHost === motionHost) return;
        observer?.disconnect();
        motionHost = nextHost;
        if (typeof MutationObserver !== 'undefined') {
            observer = new MutationObserver(refresh);
            observer.observe(motionHost, { attributes: true, attributeFilter: ['data-motion'] });
        }
        refresh();
    };

    onMounted(() => {
        if (typeof window !== 'undefined' && typeof window.matchMedia === 'function') {
            mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
            mediaQuery.addEventListener('change', refresh);
        }
        refresh();
    });

    watch(elementRef, attachHost, { flush: 'post', immediate: true });

    onBeforeUnmount(() => {
        observer?.disconnect();
        mediaQuery?.removeEventListener('change', refresh);
    });

    return preference;
}
