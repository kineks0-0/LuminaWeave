/**
 * 流式输出时"贴底跟随"的状态机（纯逻辑）。
 *
 * - 只有明确的用户意图（上滚滚轮、触摸拖动、向上翻页键、拖动滚动条）或程序外的滚动离开底部时才脱离跟随；
 * - 自身写入 scrollTop 产生的 scroll 事件不计为用户滚动；
 * - 脱离后，用户需回到最底部才恢复跟随，不会因轻微上滑被拽回。
 */

export const STICK_TO_BOTTOM_THRESHOLD_PX = 48;
const AT_BOTTOM_EPSILON_PX = 2;

export interface ScrollMetrics {
    scrollTop: number;
    scrollHeight: number;
    clientHeight: number;
}

export type StickToBottomUserIntent = 'wheel-up' | 'touch' | 'key-up' | 'scrollbar';

const distanceFromBottom = (metrics: ScrollMetrics): number => (
    Math.max(0, metrics.scrollHeight - metrics.clientHeight - metrics.scrollTop)
);

export class StickToBottomController {
    following = true;
    private expectedScrollTop: number | null = null;

    handleUserIntent(_intent: StickToBottomUserIntent): void {
        this.following = false;
        this.expectedScrollTop = null;
    }

    handleScroll(metrics: ScrollMetrics): void {
        if (this.expectedScrollTop !== null && Math.abs(metrics.scrollTop - this.expectedScrollTop) <= 1) {
            this.expectedScrollTop = null;
            return;
        }
        this.expectedScrollTop = null;

        const distance = distanceFromBottom(metrics);
        if (this.following) {
            if (distance > STICK_TO_BOTTOM_THRESHOLD_PX) this.following = false;
            return;
        }
        if (distance <= AT_BOTTOM_EPSILON_PX) this.following = true;
    }

    forceFollow(): void {
        this.following = true;
    }

    /** 返回需要写入的 scrollTop；不跟随或已在底部时返回 null。 */
    resolveFollowTarget(metrics: ScrollMetrics): number | null {
        if (!this.following) return null;
        const target = Math.max(0, metrics.scrollHeight - metrics.clientHeight);
        if (Math.abs(target - metrics.scrollTop) <= 1) return null;
        this.expectedScrollTop = target;
        return target;
    }

    shouldShowJumpToLatest(metrics: ScrollMetrics): boolean {
        return !this.following && distanceFromBottom(metrics) > STICK_TO_BOTTOM_THRESHOLD_PX;
    }
}
