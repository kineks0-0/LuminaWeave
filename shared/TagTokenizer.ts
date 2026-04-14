/**
 * TagTokenizer - 单遍栈式标签分词器 (Shared Version)
 */

export type TokenType = 'text' | 'open_tag' | 'close_tag' | 'self_closing_tag';

export interface Token {
    type: TokenType;
    value: string;
    attrs: Record<string, string>;
    start: number;
    end: number;
}

const TAG_REGEX = /<(\/?)([a-zA-Z_][a-zA-Z0-9_]*)\b([^>]*?)(\/?)>/g;
const ATTR_REGEX = /([a-zA-Z_][\w-]*)\s*=\s*(?:"([^"]*)"|'([^']*)'|(\S+))/g;

export function tokenize(input: string): Token[] {
    const tokens: Token[] = [];
    let lastIndex = 0;
    TAG_REGEX.lastIndex = 0;

    let match: RegExpExecArray | null;
    while ((match = TAG_REGEX.exec(input)) !== null) {
        const matchStart = match.index;
        const matchEnd = match.index + match[0].length;
        const isClosing = match[1] === '/';
        const tagName = match[2];
        const attrString = match[3];
        const isSelfClosing = match[4] === '/';

        if (matchStart > lastIndex) {
            const textContent = input.slice(lastIndex, matchStart);
            if (textContent) {
                tokens.push({
                    type: 'text',
                    value: textContent,
                    attrs: {},
                    start: lastIndex,
                    end: matchStart
                });
            }
        }

        if (isClosing) {
            tokens.push({
                type: 'close_tag',
                value: tagName,
                attrs: {},
                start: matchStart,
                end: matchEnd
            });
        } else if (isSelfClosing) {
            tokens.push({
                type: 'self_closing_tag',
                value: tagName,
                attrs: parseAttributes(attrString),
                start: matchStart,
                end: matchEnd
            });
        } else {
            tokens.push({
                type: 'open_tag',
                value: tagName,
                attrs: parseAttributes(attrString),
                start: matchStart,
                end: matchEnd
            });
        }
        lastIndex = matchEnd;
    }

    if (lastIndex < input.length) {
        const trailing = input.slice(lastIndex);
        tokens.push({
            type: 'text',
            value: trailing,
            attrs: {},
            start: lastIndex,
            end: input.length
        });
    }

    return tokens;
}

function parseAttributes(attrStr: string): Record<string, string> {
    if (!attrStr || !attrStr.trim()) return {};
    const attrs: Record<string, string> = {};
    ATTR_REGEX.lastIndex = 0;
    let attrMatch: RegExpExecArray | null;
    while ((attrMatch = ATTR_REGEX.exec(attrStr)) !== null) {
        const key = attrMatch[1];
        const val = attrMatch[2] ?? attrMatch[3] ?? attrMatch[4] ?? '';
        attrs[key] = val;
    }
    return attrs;
}

export interface TagBlock {
    tagName: string;
    content: string;
    outerStart: number;
    outerEnd: number;
    innerStart: number;
    innerEnd: number;
    unclosed: boolean;
}

export function extractBlocks(input: string, targetTags: Set<string>): TagBlock[] {
    const tokens = tokenize(input);
    const results: TagBlock[] = [];
    const stack: Array<{
        tagNameLower: string;
        openToken: Token;
    }> = [];

    for (const token of tokens) {
        if (token.type === 'open_tag') {
            stack.push({
                tagNameLower: token.value.toLowerCase(),
                openToken: token
            });
        } else if (token.type === 'close_tag') {
            const closingLower = token.value.toLowerCase();
            let foundIndex = -1;
            for (let i = stack.length - 1; i >= 0; i--) {
                if (stack[i].tagNameLower === closingLower) {
                    foundIndex = i;
                    break;
                }
            }

            if (foundIndex !== -1) {
                const matched = stack[foundIndex];
                if (targetTags.has(closingLower)) {
                    const innerStart = matched.openToken.end;
                    const innerEnd = token.start;
                    results.push({
                        tagName: matched.openToken.value,
                        content: input.slice(innerStart, innerEnd).trim(),
                        outerStart: matched.openToken.start,
                        outerEnd: token.end,
                        innerStart,
                        innerEnd,
                        unclosed: false
                    });
                }
                // 只弹出当前匹配及其上层（由于是非平衡关闭，上层已失效）
                stack.splice(foundIndex);
            } else if (targetTags.has(closingLower)) {
                results.push({
                    tagName: token.value,
                    content: input.slice(0, token.start).trim(),
                    outerStart: 0,
                    outerEnd: token.end,
                    innerStart: 0,
                    innerEnd: token.start,
                    unclosed: false
                });
            }
        }
    }

    for (const entry of stack) {
        if (targetTags.has(entry.tagNameLower)) {
            const innerStart = entry.openToken.end;
            results.push({
                tagName: entry.openToken.value,
                content: input.slice(innerStart).trim(),
                outerStart: entry.openToken.start,
                outerEnd: input.length,
                innerStart,
                innerEnd: input.length,
                unclosed: true
            });
        }
    }

    return results;
}

export function detectTrailingPartialTag(text: string): string | null {
    const ltIndex = text.lastIndexOf('<');
    if (ltIndex === -1) return null;
    const fragment = text.slice(ltIndex);
    if (fragment.includes('>')) return null;
    if (fragment === '<' || fragment === '</') return '';
    const partialMatch = fragment.match(/^<\/?([a-zA-Z_][a-zA-Z0-9_:\-]*)(?:\s[^<>]*)?$/);
    if (!partialMatch) return null;
    return partialMatch[1] || '';
}
