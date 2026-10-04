import { onBeforeUnmount, ref, watch, type Ref } from 'vue';
import { StickToBottomController } from './stickToBottomController.js';

const UPWARD_KEYS = new Set(['ArrowUp', 'PageUp', 'Home']);

const isEditableTarget = (target: EventTarget | null): boolean => (
    target instanceof HTMLElement
    && (target.isContentEditable || target.tagName === 'TEXTAREA' || target.tagName === 'INPUT' || target.tagName === 'SELECT')
);

/**
 * 滚动容器贴底跟随：内容增高时（ResizeObserver）瞬时置底；用户一旦表现出上翻意图即停止跟随，
 * 回到最底部后自动恢复。返回 showJumpToLatest 供"回到最新"按钮使用。
 */
export function useStickToBottom(
    scrollerRef: Ref<HTMLElement | null>,
    contentRef: Ref<HTMLElement | null>
) {
    const controller = new StickToBottomController();
    const following = ref(true);
    const showJumpToLatest = ref(false);

    let resizeObserver: ResizeObserver | null = null;
    let detachListeners: (() => void) | null = null;

    const sync = (): void => {
        const scroller = scrollerRef.value;
        following.value = controller.following;
        showJumpToLatest.value = scroller ? controller.shouldShowJumpToLatest(scroller) : false;
    };

    const followIfNeeded = (): void => {
        const scroller = scrollerRef.value;
        if (!scroller) return;
        const target = controller.resolveFollowTarget(scroller);
        // 流式跟底必须瞬时：显式 instant，避免全局平滑滚动把每帧跟底变成动画。
        if (target !== null) scroller.scrollTo({ top: target, behavior: 'instant' });
        sync();
    };

    const attach = (scroller: HTMLElement | null, content: HTMLElement | null): void => {
        detachListeners?.();
        detachListeners = null;
        resizeObserver?.disconnect();
        resizeObserver = null;
        if (!scroller) return;

        const markIntent = (intent: Parameters<StickToBottomController['handleUserIntent']>[0]): void => {
            controller.handleUserIntent(intent);
            sync();
        };
        const handleWheel = (event: WheelEvent): void => {
            if (event.deltaY < 0) markIntent('wheel-up');
        };
        const handleTouchMove = (): void => markIntent('touch');
        const handleKeydown = (event: KeyboardEvent): void => {
            if (isEditableTarget(event.target)) return;
            if (UPWARD_KEYS.has(event.key) || (event.key === ' ' && event.shiftKey)) markIntent('key-up');
        };
        const handlePointerDown = (event: PointerEvent): void => {
            // 直接点在滚动容器本身（而非内容）上，通常意味着拖动滚动条
            if (event.target === scroller) markIntent('scrollbar');
        };
        const handleScroll = (): void => {
            controller.handleScroll(scroller);
            sync();
        };

        scroller.addEventListener('wheel', handleWheel, { passive: true });
        scroller.addEventListener('touchmove', handleTouchMove, { passive: true });
        scroller.addEventListener('keydown', handleKeydown);
        scroller.addEventListener('pointerdown', handlePointerDown);
        scroller.addEventListener('scroll', handleScroll, { passive: true });
        detachListeners = () => {
            scroller.removeEventListener('wheel', handleWheel);
            scroller.removeEventListener('touchmove', handleTouchMove);
            scroller.removeEventListener('keydown', handleKeydown);
            scroller.removeEventListener('pointerdown', handlePointerDown);
            scroller.removeEventListener('scroll', handleScroll);
        };

        if (typeof ResizeObserver !== 'undefined') {
            resizeObserver = new ResizeObserver(followIfNeeded);
            resizeObserver.observe(scroller);
            if (content) resizeObserver.observe(content);
        }
        followIfNeeded();
    };

    watch([scrollerRef, contentRef], ([scroller, content]) => attach(scroller, content), { flush: 'post', immediate: true });

    onBeforeUnmount(() => {
        detachListeners?.();
        resizeObserver?.disconnect();
    });

    /** 强制回到底部并恢复跟随（发送消息、点击"回到最新"、外部 SCROLL_TO_BOTTOM 请求）。 */
    const forceFollow = (): void => {
        controller.forceFollow();
        followIfNeeded();
    };

    return {
        following,
        showJumpToLatest,
        forceFollow,
        jumpToLatest: forceFollow,
        /** 内容变化但尺寸观察未覆盖时手动触发一次跟随 */
        followIfNeeded
    };
}
