/**
 * 流式"新字淡入"的到达记录。
 *
 * 以渲染后文本（textContent）的字符偏移记录每次新增的区间与到达时间，只保留仍处于动画时长内的区间。
 * DOM 层据此只包裹"年轻"文本，并用负的 animation-delay 让重建后的节点从正确进度继续，不会重播。
 */

export interface RevealArrival {
    readonly start: number;
    readonly end: number;
    readonly at: number;
}

export interface RevealTracker {
    readonly length: number;
    readonly arrivals: readonly RevealArrival[];
}

export interface ActiveRevealRange {
    readonly start: number;
    readonly end: number;
    readonly ageMs: number;
}

export const createRevealTracker = (initialLength: number): RevealTracker => ({
    length: Math.max(0, initialLength),
    arrivals: []
});

export const recordRevealProgress = (
    tracker: RevealTracker,
    length: number,
    now: number,
    durationMs: number
): RevealTracker => {
    const nextLength = Math.max(0, length);
    let arrivals = tracker.arrivals.filter(arrival => now - arrival.at < durationMs);

    if (nextLength > tracker.length) {
        arrivals = [...arrivals, { start: tracker.length, end: nextLength, at: now }];
    } else if (nextLength < tracker.length) {
        arrivals = arrivals
            .map(arrival => ({ ...arrival, end: Math.min(arrival.end, nextLength) }))
            .filter(arrival => arrival.end > arrival.start);
    }

    return { length: nextLength, arrivals };
};

export const resolveActiveRevealRanges = (
    tracker: RevealTracker,
    now: number,
    durationMs: number
): ActiveRevealRange[] => tracker.arrivals
    .filter(arrival => now - arrival.at < durationMs)
    .map(arrival => ({
        start: arrival.start,
        end: arrival.end,
        ageMs: Math.max(0, now - arrival.at)
    }));
