/**
 * TagTokenizer - 单遍栈式标签分词器
 *
 * 设计目标：
 * 1. 单次扫描产出完整 Token 流，替代 XMLInterceptor 中三套独立正则逻辑
 * 2. 容错处理非标准 XML（自由文本与标签混合的"脏输入"）
 * 3. 支持流式输入中的未闭合标签检测
 */

/** Token 类型标识 */
export type TokenType = 'text' | 'open_tag' | 'close_tag' | 'self_closing_tag';

/** 分词产出的原子单元 */
export interface Token {
    type: TokenType;
    /** 文本内容（text 类型）或标签名（tag 类型，保留原始大小写） */
    value: string;
    /** 标签属性键值对（仅 open_tag / self_closing_tag 有效） */
    attrs: Record<string, string>;
    /** 在原始文本中的起始位置 */
    start: number;
    /** 在原始文本中的结束位置（不含） */
    end: number;
}

/**
 * 标签正则：匹配完整的 XML 标签（开/闭/自闭合）
 * 捕获组：
 *   [1] = 闭合标签的斜杠 "/"（如果是闭合标签）
 *   [2] = 标签名
 *   [3] = 属性部分（可能为空）
 *   [4] = 自闭合斜杠 "/"（如果是自闭合标签）
 */
const TAG_REGEX = /<(\/?)([a-zA-Z_][a-zA-Z0-9_]*)\b([^>]*?)(\/?)>/g;

/**
 * 属性正则：从属性字符串中提取键值对
 * 支持三种格式：key="val"、key='val'、key=val
 */
const ATTR_REGEX = /([a-zA-Z_][\w-]*)\s*=\s*(?:"([^"]*)"|'([^']*)'|(\S+))/g;

/**
 * 将原始文本分词为 Token 序列
 *
 * @param input 原始文本（可包含自由文本与 XML 标签的混合内容）
 * @returns Token 数组，按出现顺序排列
 */
export function tokenize(input: string): Token[] {
    const tokens: Token[] = [];
    let lastIndex = 0;

    // 重置正则状态
    TAG_REGEX.lastIndex = 0;

    let match: RegExpExecArray | null;
    while ((match = TAG_REGEX.exec(input)) !== null) {
        const matchStart = match.index;
        const matchEnd = match.index + match[0].length;
        const isClosing = match[1] === '/';
        const tagName = match[2];
        const attrString = match[3];
        const isSelfClosing = match[4] === '/';

        // 将匹配前的文本作为 TextToken 推入
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
            // 闭合标签：</tagName>
            tokens.push({
                type: 'close_tag',
                value: tagName,
                attrs: {},
                start: matchStart,
                end: matchEnd
            });
        } else if (isSelfClosing) {
            // 自闭合标签：<tagName ... />
            tokens.push({
                type: 'self_closing_tag',
                value: tagName,
                attrs: parseAttributes(attrString),
                start: matchStart,
                end: matchEnd
            });
        } else {
            // 开放标签：<tagName ...>
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

    // 处理尾部残余文本
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

/**
 * 从属性字符串中解析键值对
 */
function parseAttributes(attrStr: string): Record<string, string> {
    if (!attrStr || !attrStr.trim()) return {};

    const attrs: Record<string, string> = {};
    ATTR_REGEX.lastIndex = 0;

    let attrMatch: RegExpExecArray | null;
    while ((attrMatch = ATTR_REGEX.exec(attrStr)) !== null) {
        const key = attrMatch[1];
        // 取第一个非 undefined 的捕获组值
        const val = attrMatch[2] ?? attrMatch[3] ?? attrMatch[4] ?? '';
        attrs[key] = val;
    }

    return attrs;
}

// ──────────────────────────────────────────────
// 基于 Token 流的高级工具函数
// ──────────────────────────────────────────────

/** 标签块描述（带内容的标签对） */
export interface TagBlock {
    /** 标签名（保留原始大小写） */
    tagName: string;
    /** 标签内部的原始文本内容 */
    content: string;
    /** 整个标签块（含开闭标签）在原始文本中的起始位置 */
    outerStart: number;
    /** 整个标签块在原始文本中的结束位置（不含） */
    outerEnd: number;
    /** 内容部分在原始文本中的起始位置 */
    innerStart: number;
    /** 内容部分在原始文本中的结束位置 */
    innerEnd: number;
    /** 是否为未闭合的标签（流式截断） */
    unclosed: boolean;
}

/**
 * 从 Token 流中提取指定标签名的所有内容块
 *
 * 行为与旧 XMLInterceptor.extractTagContent() 对齐：
 * - 支持大小写不敏感匹配
 * - 支持嵌套同名标签（栈式匹配）
 * - 支持未闭合标签的兜底提取
 * - 支持只有闭合标签的情况（从文本开头提取）
 *
 * @param input 原始文本
 * @param targetTags 目标标签名集合（已小写化）
 */
export function extractBlocks(input: string, targetTags: Set<string>): TagBlock[] {
    const tokens = tokenize(input);
    const results: TagBlock[] = [];

    // 栈：追踪所有打开的标签
    const stack: Array<{
        tagNameLower: string;
        /** 开放标签的 Token */
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

            // 在栈中从顶向下查找最近的匹配开放标签
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
                    // 提取内容：从开放标签结束到闭合标签开始
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
                // 出栈到匹配位置（隐式闭合内部未闭合的脏标签）
                stack.splice(foundIndex, stack.length - foundIndex);
            } else if (targetTags.has(closingLower)) {
                // 只有闭合标签，没有对应的开放标签（被截断的情况）
                // 保守策略：从文本开头提取到此闭合标签前
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
        // text 和 self_closing_tag 对提取逻辑无影响
    }

    // 兜底：栈中残余的目标标签（流式截断导致缺少闭合标签）
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

/**
 * 检测文本末尾是否有未完成的标签片段
 * 例如 "some text <Thi" → 返回 "Thi" 的部分标签名
 *
 * @param text 待检测文本
 * @returns 部分标签名；如果没有则返回 null
 */
export function detectTrailingPartialTag(text: string): string | null {
    const ltIndex = text.lastIndexOf('<');
    if (ltIndex === -1) return null;

    const fragment = text.slice(ltIndex);
    // 如果已经有 >，说明标签是完整的
    if (fragment.includes('>')) return null;

    if (fragment === '<' || fragment === '</') return '';

    const partialMatch = fragment.match(/^<\/?([a-zA-Z_][a-zA-Z0-9_:\-]*)(?:\s[^<>]*)?$/);
    if (!partialMatch) return null;

    return partialMatch[1] || '';
}
