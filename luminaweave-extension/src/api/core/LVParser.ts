/**
 * LVParser - LuminaView DSL 解析器
 *
 * 将 <V> 标签内的文本解析为结构化组件数组。
 * 支持两种语法模式：
 * 1. 函数式 DSL（主力）：Stat("生命值", 75, 100)
 * 2. 管道微 DSL（补充）：C|选项A|选项B|选项C
 *
 * 解析器通过行首特征自动判别语法模式。
 */

import { viewComponentRegistry, type ParsedViewComponent } from './ViewComponentRegistry';

/** 消息段落类型 */
export type SegmentType = 'text' | 'view';

/** 解析后的消息段落 */
export interface MessageSegment {
    type: SegmentType;
    /** 文本段：原始文本；视图段：原始 DSL 文本 */
    raw: string;
    /** 视图段专用：解析后的组件列表 */
    components?: ParsedViewComponent[];
    /** 标识段落是否仍在流式输出中 (如未闭合的 <V> 标签) */
    isStreaming?: boolean;
}

// ──────────────────────────────────────────────
// 顶层 API
// ──────────────────────────────────────────────

/**
 * 将 mesRaw 分割为交替的文本段和视图段
 *
 * @param mesRaw 消息的原始文本（可能含 <V>...</V> 块）
 * @returns 按出现顺序排列的段落数组
 */
export function splitToSegments(mesRaw: string): MessageSegment[] {
    if (!mesRaw) return [];

    const segments: MessageSegment[] = [];
    console.group(`[LVParser] Splitting message (${mesRaw.length} chars)`);
    
    // 1. 匹配所有闭合的 <V>...</V> 块（支持单行和多行）
    // 核心修复：将正则局部化，确保 lastIndex 每次调用重置，修复响应式刷新导致的组件消失问题
    const viewBlockRegex = /<V>([\s\S]*?)<\/V>/gi;
    let lastIndex = 0;

    let match: RegExpExecArray | null;
    while ((match = viewBlockRegex.exec(mesRaw)) !== null) {
        // 前置文本段
        if (match.index > lastIndex) {
            const textContent = mesRaw.slice(lastIndex, match.index);
            if (textContent) {
                segments.push({ type: 'text', raw: textContent });
            }
        }

        // 视图段：解析 <V> 内部内容
        const viewContent = match[1].trim();
        if (viewContent) {
            console.debug(`[LVParser] Found closed <V> block: "${viewContent.substring(0, 30)}..."`);
            const components = parseViewBlock(viewContent);
            segments.push({
                type: 'view',
                raw: viewContent,
                components,
                isStreaming: false
            });
        }

        lastIndex = match.index + match[0].length;
    }
    console.groupEnd();

    // 2. 检查尾部是否包含未闭合的 <V> 标签 (流式中间态)
    const trailingContent = mesRaw.slice(lastIndex);
    const unclosedMatch = trailingContent.match(/<V>([\s\S]*)$/i);

    if (unclosedMatch) {
        // 未闭合标签前的文本
        const textBeforeUnclosed = trailingContent.slice(0, unclosedMatch.index);
        if (textBeforeUnclosed) {
            segments.push({ type: 'text', raw: textBeforeUnclosed });
        }

        // 未闭合的视图段
        const viewContent = unclosedMatch[1].trim();
        const components = viewContent ? parseViewBlock(viewContent) : [];
        segments.push({
            type: 'view',
            raw: viewContent,
            components,
            isStreaming: true
        });
    } else if (trailingContent) {
        // 普通尾部文本段
        segments.push({ type: 'text', raw: trailingContent });
    }

    return segments;
}

// ──────────────────────────────────────────────
// <V> 块内部解析
// ──────────────────────────────────────────────

/**
 * 解析 <V> 块内的 DSL 文本
 *
 * 逐行解析，通过行首特征自动判别语法模式
 */
function parseViewBlock(content: string): ParsedViewComponent[] {
    if (!content) return [];
    
    console.group(`[LVParser] Parsing block: "${content.substring(0, 50).replace(/\n/g, '\\n')}..."`);
    
    // 1. 尝试快速行解析 (Fast Path)
    const lines = content.split('\n').map(l => l.trim()).filter(l => l.length > 0);
    const components: ParsedViewComponent[] = [];
    let hasUnbalancedLine = false;

    for (const line of lines) {
        // 简单检测行内是否有未闭合的括号 (处理 Choices 等跨行场景)
        const openParenCount = (line.match(/\(/g) || []).length;
        const closeParenCount = (line.match(/\)/g) || []).length;
        if (openParenCount !== closeParenCount) {
            hasUnbalancedLine = true;
        }

        const parsed = parseLine(line);
        if (parsed) {
            console.debug(`[LVParser] Line parsed successfully:`, parsed);
            components.push(parsed);
        }
    }

    // 2. 如果检测到跨行特征且行解析结果不理想，执行跨行回退解析 (Fallback Path)
    // 所谓不理想：行解析没拿到任何组件，但 content 包含疑似函数调用的内容
    if (components.length === 0 && (hasUnbalancedLine || content.includes('('))) {
        console.warn('[LVParser] 检测到跨行调用或未闭合特征，触发 Fallback 解析模式');
        const fallbackResult = parseViewBlockMultiLine(content);
        console.groupEnd();
        return fallbackResult;
    }

    console.groupEnd();
    return components;
}

/**
 * 跨行回退解析器 (Fallback Strategy)
 * 使用全局范围扫描替代行切割，支持 C([ ... ]) 等复杂嵌套
 */
function parseViewBlockMultiLine(content: string): ParsedViewComponent[] {
    const components: ParsedViewComponent[] = [];
    // 全局匹配模式：Name(...)
    const globalFuncRegex = /([A-Za-z_]\w*)\s*\(([\s\S]*?)\)/g;
    let match;

    while ((match = globalFuncRegex.exec(content)) !== null) {
        const name = match[1];
        const argsStr = match[2];
        const parsed = parseFunctionCall(name, argsStr);
        if (parsed) {
            components.push(parsed);
        }
    }

    // 如果函数式完全没匹配到，检查是否有管道符 (管道符通常不跨行，但这里做最后保底)
    if (components.length === 0 && content.includes('|')) {
        const lines = content.split('\n').map(l => l.trim()).filter(l => l.length > 0);
        for (const line of lines) {
            if (line.includes('|')) {
                const parsed = parsePipeLine(line);
                if (parsed) components.push(parsed);
            }
        }
    }

    return components;
}

/**
 * 解析单行 DSL
 *
 * 判别规则：
 * - 包含 `(` → 函数式 DSL
 * - 包含 `|` → 管道微 DSL
 */
function parseLine(line: string): ParsedViewComponent | null {
    if (!line) return null;

    try {
        // 函数式 DSL 检测：Name(...) 或 N(...)，支持末尾可选分号
        const funcMatch = line.match(/^([A-Za-z_]\w*)\s*\((.*)\)\s*;?\s*$/s);
        if (funcMatch) {
            return parseFunctionCall(funcMatch[1], funcMatch[2]);
        }

        // 管道微 DSL 检测：X|arg1... 或 X｜arg1...
        if (/[|｜丨]/.test(line)) {
            return parsePipeLine(line);
        }
    } catch (e) {
        console.warn(`[LVParser] 解析失败，跳过该行: "${line}"`, e);
    }

    return null;
}

// ──────────────────────────────────────────────
// 函数式 DSL 解析器
// ──────────────────────────────────────────────

/**
 * 解析函数式 DSL 调用
 *
 * 示例输入：
 *   name = "Stat", argsStr = '"生命值", 75, 100'
 */
function parseFunctionCall(name: string, argsStr: string): ParsedViewComponent | null {
    const schema = viewComponentRegistry.resolve(name);
    if (!schema) {
        console.warn(`[LVParser] 未注册的组件: ${name}`);
        return null;
    }

    const args = parseArguments(argsStr);
    const props = viewComponentRegistry.mapPositionalArgs(schema, args);

    return { component: schema.name, props };
}

/**
 * 解析函数参数列表
 *
 * 支持：字符串("text")、数字(123)、布尔(true/false)、null、数组([...])、对象({...})
 * 使用有限状态机处理引号嵌套和括号平衡
 */
function parseArguments(argsStr: string): unknown[] {
    const trimmed = argsStr.trim();
    if (!trimmed) return [];

    // 使用 JSON 安全解析策略：将参数列表包裹为 JSON 数组
    // 需预处理：单引号→双引号，尾部逗号移除
    const normalized = trimmed
        // 保护已有双引号字符串内容，只转换外部单引号
        .replace(/'([^']*)'/g, '"$1"')
        // 移除尾部逗号
        .replace(/,\s*$/, '');

    try {
        const parsed = JSON.parse(`[${normalized}]`);
        return Array.isArray(parsed) ? parsed : [parsed];
    } catch {
        // JSON 解析失败：降级为手动分割
        return fallbackParseArgs(trimmed);
    }
}

/**
 * 降级参数解析器：手动处理逗号分割和括号配对
 */
function fallbackParseArgs(argsStr: string): unknown[] {
    const args: unknown[] = [];
    let current = '';
    let depth = 0; // 括号/方括号/花括号深度
    let inString: string | null = null; // 当前字符串引号类型

    for (let i = 0; i < argsStr.length; i++) {
        const ch = argsStr[i];
        const prev = i > 0 ? argsStr[i - 1] : '';

        // 字符串状态管理
        if (inString) {
            current += ch;
            if (ch === inString && prev !== '\\') {
                inString = null;
            }
            continue;
        }

        if (ch === '"' || ch === "'" || ch === '`') {
            inString = ch;
            current += ch;
            continue;
        }

        // 括号深度追踪
        if (ch === '(' || ch === '[' || ch === '{') {
            depth++;
            current += ch;
            continue;
        }
        if (ch === ')' || ch === ']' || ch === '}') {
            depth--;
            current += ch;
            continue;
        }

        // 顶层逗号 = 参数分隔
        if (ch === ',' && depth === 0) {
            args.push(coerceValue(current.trim()));
            current = '';
            continue;
        }

        current += ch;
    }

    // 最后一个参数
    const lastTrimmed = current.trim();
    if (lastTrimmed) {
        args.push(coerceValue(lastTrimmed));
    }

    return args;
}

/**
 * 将字符串值强制转换为合适的 JS 类型
 */
function coerceValue(raw: string): unknown {
    if (!raw) return null;

    // 去除引号包裹（双引号、单引号、反引号）
    if ((raw.startsWith('"') && raw.endsWith('"')) ||
        (raw.startsWith("'") && raw.endsWith("'")) ||
        (raw.startsWith('`') && raw.endsWith('`'))) {
        return raw.slice(1, -1);
    }

    // 数值
    if (/^-?\d+(\.\d+)?$/.test(raw)) {
        return Number(raw);
    }

    // 布尔
    if (raw === 'true') return true;
    if (raw === 'false') return false;

    // null
    if (raw === 'null') return null;

    // 尝试 JSON 解析（数组/对象）
    if (raw.startsWith('[') || raw.startsWith('{')) {
        try {
            return JSON.parse(raw.replace(/'/g, '"'));
        } catch {
            return raw;
        }
    }

    // 回退为字符串
    return raw;
}

// ──────────────────────────────────────────────
// 管道微 DSL 解析器
// ──────────────────────────────────────────────

/**
 * 解析管道分隔的简易 DSL 行
 *
 * 格式：TypeCode|arg1|arg2|...
 * 示例：C|拔剑迎战|放下武器投降|尝试说服她
 *        S|生命值|75|100
 */
function parsePipeLine(line: string): ParsedViewComponent | null {
    const parts = line.split(/[\s\n]*[|｜丨│┃‖¦][\s\n]*/).map(p => p.trim());
    if (parts.length < 1) return null;

    const typeCode = parts[0];
    const schema = viewComponentRegistry.resolve(typeCode);
    if (!schema) {
        console.warn(`[LVParser] 未注册的管道类型码: ${typeCode}`);
        return null;
    }

    // 将管道参数映射到 Schema
    const rawArgs = parts.slice(1);

    // Choices 组件的特殊处理：所有后续参数合并为选项数组
    if (schema.name === 'Choices') {
        const options = rawArgs.map(opt => {
            // 支持 "显示文本:命令" 格式
            const colonIdx = opt.lastIndexOf(':');
            if (colonIdx > 0 && opt.substring(colonIdx + 1).startsWith('/')) {
                return {
                    label: opt.substring(0, colonIdx).trim(),
                    cmd: opt.substring(colonIdx + 1).trim()
                };
            }
            return opt;
        });
        const props = viewComponentRegistry.mapPositionalArgs(schema, [options]);
        return { component: schema.name, props };
    }

    // 通用映射：按位置参数顺序
    const coercedArgs = rawArgs.map(arg => coerceValue(arg));
    const props = viewComponentRegistry.mapPositionalArgs(schema, coercedArgs);

    return { component: schema.name, props };
}
