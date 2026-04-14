/**
 * Forge DSL 选项拆分工具
 * 用于处理全角、半角及各种 Unicode 竖线变体
 */

/**
 * 鲁棒地拆分 Forge 选项/建议字符串
 * 支持以下分隔符：
 * - | (U+007C) 标准半角
 * - ｜ (U+FF5C) 全角竖线
 * - 丨 (U+4E28) 中文部首
 * - │ (U+2502) 制表符
 * - ┃ (U+2503) 粗制表符
 * - ‖ (U+2016) 双竖线
 */
export function splitForgeOptions(input: string | string[] | undefined | null): string[] {
    if (!input) return [];
    
    // 如果已经是数组，确保项是字符串并修整
    if (Array.isArray(input)) {
        return input.map(item => String(item).trim()).filter(Boolean);
    }

    const str = String(input);
    
    // 使用 Unicode 转义码定义正则，确保在任何源码编码下都能正确工作
    // \u007c -> |
    // \uff5c -> ｜
    // \u4e28 -> 丨
    // \u2502 -> │
    // \u2503 -> ┃
    // \u2016 -> ‖
    // \u00a6 -> ¦
    const splitRegex = /[\s\n]*[\u007c\uff5c\u4e28\u2502\u2503\u2016\u00a6][\s\n]*/;
    
    const result = str.split(splitRegex)
        .map(item => item.trim())
        .filter(Boolean);

    // 运行时诊断日志
    if (result.length <= 1 && str.length > 20) {
        // 如果字符串很长但没切开，可能是遇到了未覆盖的特殊字符，打印 HEX 以供诊断
        const hex = Array.from(str).map(c => `U+${c.charCodeAt(0).toString(16).padStart(4, '0')}`).join(' ');
        console.warn(`[Forge-Split] 警告：长字符串拆分结果为 1。可能存在未识别的分隔符。`, {
            input: str,
            hex: hex,
            result: result
        });
    } else {
        console.debug(`[Forge-Split] 拆分成功: "${str.slice(0, 30)}..." -> ${result.length} 个选项`);
    }

    return result;
}
