import type { ActiveRevealRange } from '../../presentation/streamReveal.js';

export const REVEAL_CLASS = 'lw-reveal';
export const CARET_HOST_CLASS = 'lw-caret-host';

/** 拆掉上一轮包裹的淡入 span，恢复为纯文本节点。 */
export const clearRevealSpans = (root: HTMLElement): void => {
    const spans = root.querySelectorAll<HTMLElement>(`span.${REVEAL_CLASS}`);
    spans.forEach((span) => {
        const parent = span.parentNode;
        if (!parent) return;
        while (span.firstChild) parent.insertBefore(span.firstChild, span);
        parent.removeChild(span);
        parent.normalize();
    });
};

interface TextNodeSlice {
    node: Text;
    start: number;
}

const collectTextNodes = (root: HTMLElement): TextNodeSlice[] => {
    const walker = root.ownerDocument.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    const slices: TextNodeSlice[] = [];
    let offset = 0;
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
        const textNode = node as Text;
        slices.push({ node: textNode, start: offset });
        offset += textNode.data.length;
    }
    return slices;
};

/**
 * 用 span 包裹仍在动画期内的文本区间。负的 animation-delay 让重建后的节点从当前进度继续。
 * 区间只覆盖尾部少量文本，因此每次更新的 DOM 操作有界。
 */
export const applyRevealRanges = (root: HTMLElement, ranges: readonly ActiveRevealRange[]): void => {
    if (ranges.length === 0) return;
    const slices = collectTextNodes(root);

    // 从后往前处理，拆分文本节点不会影响尚未处理的前序偏移。
    for (let rangeIndex = ranges.length - 1; rangeIndex >= 0; rangeIndex -= 1) {
        const range = ranges[rangeIndex];
        for (let sliceIndex = slices.length - 1; sliceIndex >= 0; sliceIndex -= 1) {
            const slice = slices[sliceIndex];
            const sliceEnd = slice.start + slice.node.data.length;
            if (sliceEnd <= range.start) break;
            if (slice.start >= range.end) continue;

            const localStart = Math.max(0, range.start - slice.start);
            const localEnd = Math.min(slice.node.data.length, range.end - slice.start);
            if (localEnd <= localStart || !slice.node.data.slice(localStart, localEnd).trim()) continue;

            let target = slice.node;
            if (localEnd < target.data.length) target.splitText(localEnd);
            if (localStart > 0) target = target.splitText(localStart);

            const span = root.ownerDocument.createElement('span');
            span.className = REVEAL_CLASS;
            span.style.animationDelay = `-${Math.round(range.ageMs)}ms`;
            target.parentNode?.insertBefore(span, target);
            span.appendChild(target);
        }
    }
};

const lastMeaningfulChild = (element: Element): ChildNode | null => {
    for (let node = element.lastChild; node; node = node.previousSibling) {
        if (node.nodeType === Node.TEXT_NODE && !(node.textContent || '').trim()) continue;
        return node;
    }
    return null;
};

/** 找到文末所在的最深元素，作为行内光标（::after）的宿主。 */
export const markCaretHost = (root: HTMLElement, enabled: boolean): void => {
    root.querySelectorAll(`.${CARET_HOST_CLASS}`).forEach(element => element.classList.remove(CARET_HOST_CLASS));
    if (!enabled) return;

    let host: Element = root;
    for (let child = lastMeaningfulChild(host); child && child.nodeType === Node.ELEMENT_NODE; child = lastMeaningfulChild(host)) {
        const element = child as Element;
        if (element.tagName === 'BR' || element.tagName === 'IMG' || element.tagName === 'HR') break;
        host = element;
    }
    host.classList.add(CARET_HOST_CLASS);
};
