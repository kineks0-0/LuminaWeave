/**
 * 流式文本的增量分块渲染。
 *
 * 在代码围栏之外、且下一行不是缩进续行的空行处切块。已提交的块只渲染一次并保持对象引用不变，
 * 只有最后一个块（tail）随新文本重新渲染，避免每个 chunk 都整段重建 DOM。
 *
 * 切块规则保证"逐块渲染再拼接"与"整段渲染"输出一致：块的 source 保留分隔空行中的第一个换行，
 * 剩余文本从下一个非空行开始。该规则对 marked 与逐行渲染器（Forge）都成立。
 */

export interface TextRenderBlock {
    readonly key: string;
    readonly source: string;
    readonly html: string;
}

export interface TextBlocksState {
    readonly text: string;
    readonly renderFn: (text: string) => string;
    readonly committed: readonly TextRenderBlock[];
    readonly committedLength: number;
    readonly blocks: readonly TextRenderBlock[];
}

const FENCE_PATTERN = /^ {0,3}(`{3,}|~{3,})/;

interface FenceState {
    marker: string;
    length: number;
}

const updateFence = (line: string, fence: FenceState | null): FenceState | null => {
    const match = FENCE_PATTERN.exec(line);
    if (!match) return fence;
    const marker = match[1][0];
    const length = match[1].length;
    if (!fence) return { marker, length };
    if (marker === fence.marker && length >= fence.length && line.trim() === match[1]) return null;
    return fence;
};

const isWhitespace = (char: string): boolean => char === ' ' || char === '\t' || char === '\n' || char === '\r';

/** 在 remainder 中寻找已完结的块，返回各块 source 与剩余 tail 的起点。 */
const scanBlocks = (remainder: string): { sources: string[]; consumed: number } => {
    const sources: string[] = [];
    let fence: FenceState | null = null;
    let blockStart = 0;
    let lineStart = 0;

    while (lineStart < remainder.length) {
        const newlineIndex = remainder.indexOf('\n', lineStart);
        if (newlineIndex === -1) break;
        const line = remainder.slice(lineStart, newlineIndex);
        const nextChar = remainder.charAt(newlineIndex + 1);

        if (!fence && line.trim() === '' && nextChar && !isWhitespace(nextChar)) {
            const source = remainder.slice(blockStart, lineStart);
            if (source.trim()) {
                sources.push(source);
                blockStart = newlineIndex + 1;
            }
        } else {
            fence = updateFence(line, fence);
        }
        lineStart = newlineIndex + 1;
    }

    return { sources, consumed: blockStart };
};

export const advanceTextBlocks = (
    previous: TextBlocksState | null,
    text: string,
    renderFn: (text: string) => string
): TextBlocksState => {
    const canContinue = previous !== null
        && previous.renderFn === renderFn
        && text.length >= previous.committedLength
        && text.startsWith(previous.text.slice(0, previous.committedLength));

    const committed: TextRenderBlock[] = canContinue ? [...previous.committed] : [];
    let committedLength = canContinue ? previous.committedLength : 0;

    const scan = scanBlocks(text.slice(committedLength));
    for (const source of scan.sources) {
        committed.push({ key: `b${committed.length}`, source, html: renderFn(source) });
    }
    committedLength += scan.consumed;

    const tailSource = text.slice(committedLength);
    const blocks: TextRenderBlock[] = [...committed];
    if (tailSource) {
        const previousTail = canContinue ? previous.blocks[previous.blocks.length - 1] : undefined;
        const tailKey = `b${committed.length}`;
        blocks.push(previousTail && previousTail.key === tailKey && previousTail.source === tailSource
            ? previousTail
            : { key: tailKey, source: tailSource, html: renderFn(tailSource) });
    }

    return { text, renderFn, committed, committedLength, blocks };
};
