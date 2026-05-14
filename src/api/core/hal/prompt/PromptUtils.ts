/**
 * 提示词工具类：提供针对大模型提示词 (Long Text Blocks) 的优化处理功能。
 */

/**
 * Tagged Template Literal: p (prompt)
 * 用于处理多行提示词字符串，自动消除公共前导缩进，并修整首尾空行。
 * 使用示例：
 * const prompt = p`
 *     Line 1
 *     Line 2
 * `;
 */
export function p(strings: TemplateStringsArray, ...values: any[]): string {
    // 1. 合并字符串与插槽
    let raw = strings.reduce((acc, str, i) => acc + str + (values[i] ?? ''), '');

    // 2. 按行拆分
    const lines = raw.split('\n');

    // 3. 找到最小公共缩进（忽略纯空行）
    let minIndent = Infinity;
    lines.forEach((line, index) => {
        // 第一行通常紧跟在 ` 后面，或者是空的，我们跳过完全空的行
        if (line.trim().length === 0) return;

        const indentMatch = line.match(/^(\s+)/);
        const indent = indentMatch ? indentMatch[1].length : 0;

        if (indent < minIndent) {
            minIndent = indent;
        }
    });

    if (minIndent === Infinity) minIndent = 0;

    // 4. 移除缩进并重新合并
    const result = lines
        .map(line => line.length >= minIndent ? line.slice(minIndent) : line.trimStart())
        .join('\n')
        .trim(); // 自动清理首尾换行

    return result;
}
