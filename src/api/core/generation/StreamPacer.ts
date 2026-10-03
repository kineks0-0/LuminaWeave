/**
 * 流式平滑吐字的节奏器（纯逻辑，可测试）。
 *
 * 按经过的时间而不是 tick 次数决定输出字符数：速率随积压量变化，但经过低通滤波，避免"先爆发后衰减"。
 * 小数字符跨帧累计；流结束后进入排空模式，保证在短时间内吐完；长时间无帧（后台标签页）直接整段输出。
 */

export interface StreamPacerConfig {
    /** 平滑速度因子（1-7，对应设置 lumina-chat.streamingSmoothnessFactor），越大越快 */
    speedFactor: number;
    /** 每帧最多输出的字符数（对应设置 lumina-chat.streamingMaxSpeed，按 60fps 换算为速率上限） */
    maxCharsPerFrame: number;
}

const MIN_CHARS_PER_SECOND = 24;
const RATE_SMOOTHING_MS = 160;
const DRAIN_TARGET_MS = 450;
const FLUSH_GAP_MS = 250;

const clamp = (value: number, min: number, max: number): number => Math.min(max, Math.max(min, value));

export class StreamPacer {
    private config: StreamPacerConfig;
    private lastTick = 0;
    private carry = 0;
    private rate = 0;
    private drainRate = 0;

    constructor(config: StreamPacerConfig) {
        this.config = config;
    }

    setConfig(config: StreamPacerConfig): void {
        this.config = config;
    }

    reset(now: number): void {
        this.lastTick = now;
        this.carry = 0;
        this.rate = 0;
        this.drainRate = 0;
    }

    /** 积压量对应的追赶时间常数：因子 1 约 420ms，因子 7 约 60ms。 */
    private get catchUpMs(): number {
        return 60 * (8 - clamp(this.config.speedFactor, 1, 7));
    }

    private get maxCharsPerSecond(): number {
        return Math.max(1, this.config.maxCharsPerFrame) * 60;
    }

    take(now: number, backlog: number, draining: boolean): number {
        const elapsed = Math.max(0, now - this.lastTick);
        this.lastTick = now;
        if (backlog <= 0) {
            this.carry = 0;
            this.rate = 0;
            return 0;
        }
        if (elapsed >= FLUSH_GAP_MS) {
            this.carry = 0;
            return backlog;
        }

        const targetRate = clamp(backlog * 1000 / this.catchUpMs, MIN_CHARS_PER_SECOND, this.maxCharsPerSecond);
        const smoothing = Math.min(1, elapsed / RATE_SMOOTHING_MS);
        this.rate = this.rate === 0 ? targetRate : this.rate + (targetRate - this.rate) * smoothing;
        // 排空速率在进入排空时固定一次，保证线性吐完而不是指数衰减。
        if (draining) {
            if (this.drainRate === 0) this.drainRate = backlog * 1000 / DRAIN_TARGET_MS;
            this.rate = Math.max(this.rate, this.drainRate);
        } else {
            this.drainRate = 0;
        }

        const exact = this.carry + this.rate * elapsed / 1000;
        const count = Math.min(backlog, Math.floor(exact));
        this.carry = count === backlog ? 0 : exact - count;
        return count;
    }
}

export interface FrameScheduler {
    /** 预约下一帧回调，返回取消函数 */
    request(callback: () => void): () => void;
    now(): number;
}

const FALLBACK_FRAME_MS = 16;

/**
 * 页面可见时使用 requestAnimationFrame；隐藏时 rAF 会暂停，改用定时器，保证 GENERATION_ENDED 不被拖延。
 */
export const createDefaultFrameScheduler = (): FrameScheduler => ({
    request(callback) {
        const canAnimate = typeof requestAnimationFrame === 'function'
            && typeof document !== 'undefined'
            && document.visibilityState === 'visible';
        if (canAnimate) {
            const handle = requestAnimationFrame(() => callback());
            return () => cancelAnimationFrame(handle);
        }
        const handle = setTimeout(callback, FALLBACK_FRAME_MS);
        return () => clearTimeout(handle);
    },
    now() {
        return typeof performance !== 'undefined' ? performance.now() : Date.now();
    }
});
