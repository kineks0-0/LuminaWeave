import {
    createMacroTrace,
    type MacroContext,
    type MacroMessageLike,
    type MacroResult,
    type MacroTrace,
    type MacroVariableScope
} from './MacroTypes.js';

const MAX_NESTING_DEPTH = 5;

const KNOWN_MACROS = new Set<string>([
    'char',
    'user',
    'persona',
    'description',
    'personality',
    'scenario',
    'input',
    'model',
    'original',
    'time',
    'date',
    'weekday',
    'isotime',
    'isodate',
    'random',
    'pick',
    'roll',
    'newline',
    'trim',
    'noop',
    '//',
    'lastMessage',
    'lastUserMessage',
    'lastCharMessage',
    'firstMessage',
    'getvar',
    'setvar',
    'addvar',
    'incvar',
    'decvar',
    'getglobalvar',
    'setglobalvar'
]);

interface MacroSegment {
    start: number;
    end: number;
    raw: string;
    name: string;
    args: string[];
}

interface IfBlockBounds {
    elseSegmentIndex: number;
    endSegmentIndex: number;
}

const splitTopLevel = (text: string, separator: string): string[] => {
    const parts: string[] = [];
    let depth = 0;
    let quote: string | null = null;
    let current = '';
    for (let index = 0; index < text.length; index++) {
        const char = text[index];
        if (char === '\\' && index + 1 < text.length) {
            current += char + text[index + 1];
            index += 1;
            continue;
        }
        if (quote) {
            current += char;
            if (char === quote) quote = null;
            continue;
        }
        if (char === '"' || char === "'") {
            quote = char;
            current += char;
            continue;
        }
        if (text.startsWith('{{', index)) {
            depth += 1;
            current += '{{';
            index += 1;
            continue;
        }
        if (text.startsWith('}}', index)) {
            depth = Math.max(0, depth - 1);
            current += '}}';
            index += 1;
            continue;
        }
        if (char === separator && depth === 0) {
            parts.push(current);
            current = '';
            continue;
        }
        current += char;
    }
    parts.push(current);
    return parts;
};

const parseTokenContent = (content: string): { name: string; args: string[]; raw: string } => {
    const raw = `{{${content}}}`;
    const trimmed = content.trim();
    if (!trimmed) return { name: '', args: [], raw };
    if (trimmed.startsWith('//')) return { name: '//', args: [], raw };
    if (trimmed === '/if') return { name: '/if', args: [], raw };
    const nameMatch = /^([A-Za-z_][A-Za-z0-9_]*)/.exec(trimmed);
    if (!nameMatch) return { name: trimmed, args: [], raw };
    const name = nameMatch[1];
    const rest = trimmed.slice(name.length);
    if (rest.startsWith('::')) {
        return { name, args: rest.slice(2).split('::'), raw };
    }
    if (rest.startsWith(':')) {
        const argText = rest.slice(1);
        return {
            name,
            args: name === 'random' || name === 'pick' ? splitTopLevel(argText, ',') : [argText],
            raw
        };
    }
    const restTrimmed = rest.trim();
    return { name, args: restTrimmed ? [restTrimmed] : [], raw };
};

const findMacroClose = (text: string, start: number): number => {
    let depth = 0;
    for (let index = start; index < text.length; index++) {
        if (text.startsWith('{{', index)) {
            depth += 1;
            index += 1;
            continue;
        }
        if (text.startsWith('}}', index)) {
            depth -= 1;
            if (depth === 0) return index + 2;
            index += 1;
        }
    }
    return -1;
};

const tokenize = (text: string): MacroSegment[] => {
    const segments: MacroSegment[] = [];
    let index = 0;
    while (index < text.length) {
        const open = text.indexOf('{{', index);
        if (open === -1) break;
        const close = findMacroClose(text, open);
        if (close === -1) {
            index = open + 2;
            continue;
        }
        const parsed = parseTokenContent(text.slice(open + 2, close - 2));
        segments.push({ start: open, end: close, name: parsed.name, args: parsed.args, raw: parsed.raw });
        index = close;
    }
    return segments;
};

const findIfBlock = (segments: MacroSegment[], startIndex: number): IfBlockBounds | null => {
    let nesting = 0;
    let elseSegmentIndex = -1;
    for (let index = startIndex; index < segments.length; index++) {
        const name = segments[index].name;
        if (name === 'if') {
            nesting += 1;
            continue;
        }
        if (name === '/if') {
            nesting -= 1;
            if (nesting === 0) return { elseSegmentIndex, endSegmentIndex: index };
            continue;
        }
        if (name === 'else' && nesting === 1 && elseSegmentIndex === -1) {
            elseSegmentIndex = index;
        }
    }
    return null;
};

const pad = (value: number): string => String(value).padStart(2, '0');

const formatDateTime = (date: Date, format: string): string => {
    const replacements: Array<[RegExp, string]> = [
        [/YYYY/g, String(date.getFullYear())],
        [/MM/g, pad(date.getMonth() + 1)],
        [/DD/g, pad(date.getDate())],
        [/HH/g, pad(date.getHours())],
        [/mm/g, pad(date.getMinutes())],
        [/ss/g, pad(date.getSeconds())],
        [/\bM\b/g, String(date.getMonth() + 1)],
        [/\bD\b/g, String(date.getDate())],
        [/\bH\b/g, String(date.getHours())],
        [/\bm\b/g, String(date.getMinutes())],
        [/\bs\b/g, String(date.getSeconds())]
    ];
    return replacements.reduce((acc, [pattern, value]) => acc.replace(pattern, value), format);
};

const weekdayName = (date: Date, locale: string): string => {
    try {
        return new Intl.DateTimeFormat(locale, { weekday: 'long' }).format(date);
    } catch {
        return new Intl.DateTimeFormat('en-US', { weekday: 'long' }).format(date);
    }
};

const hashString = (value: string): number => {
    let hash = 0x811c9dc5;
    for (let index = 0; index < value.length; index++) {
        hash ^= value.charCodeAt(index);
        hash = Math.imul(hash, 0x01000193) >>> 0;
    }
    return hash;
};

const evaluateRandom = (args: string[], context: MacroContext): string => {
    const random = context.random ?? Math.random;
    if (args.length === 0 || (args.length === 1 && !args[0])) {
        return random().toFixed(3);
    }
    const index = Math.min(args.length - 1, Math.floor(random() * args.length));
    return args[index];
};

const evaluatePick = (args: string[], context: MacroContext): string => {
    const values = args.filter(arg => arg !== '');
    if (values.length === 0) return '';
    const seed = `${context.pickSeed ?? ''}|${values.join(',')}`;
    return values[hashString(seed) % values.length];
};

const evaluateRoll = (expression: string, context: MacroContext): string => {
    const match = /^(\d*)\s*d\s*(\d+)\s*([+-]\s*\d+)?$/i.exec(expression.trim());
    if (!match) return expression;
    const count = match[1] ? Math.min(100, Math.max(1, Number(match[1]))) : 1;
    const sides = Math.max(2, Number(match[2]));
    const modifier = match[3] ? Number(match[3].replace(/\s+/g, '')) : 0;
    const random = context.random ?? Math.random;
    let total = modifier;
    for (let index = 0; index < count; index++) {
        total += 1 + Math.floor(random() * sides);
    }
    return String(total);
};

const resolveOperand = (token: string, context: MacroContext): string => {
    const trimmed = token.trim();
    const quoted = /^"([\s\S]*)"$/.exec(trimmed) ?? /^'([\s\S]*)'$/.exec(trimmed);
    if (quoted) return quoted[1];
    const localMatch = /^getvar::([\s\S]+)$/.exec(trimmed);
    if (localMatch) return context.variables.get('local', localMatch[1]) ?? '';
    const globalMatch = /^getglobalvar::([\s\S]+)$/.exec(trimmed);
    if (globalMatch) return context.variables.get('global', globalMatch[1]) ?? '';
    return trimmed;
};

const readVariable = (context: MacroContext, scope: MacroVariableScope, name: string, trace: MacroTrace): string => {
    if (!name) {
        trace.warnings.push('变量宏缺少变量名。');
        return '';
    }
    return context.variables.get(scope, name) ?? '';
};

const writeVariable = (
    context: MacroContext,
    scope: MacroVariableScope,
    name: string,
    value: string,
    trace: MacroTrace
): void => {
    if (!name) {
        trace.warnings.push('变量宏缺少变量名。');
        return;
    }
    context.variables.set(scope, name, value);
};

const addVariable = (
    context: MacroContext,
    scope: MacroVariableScope,
    name: string,
    delta: number,
    trace: MacroTrace
): void => {
    if (!name) {
        trace.warnings.push('变量宏缺少变量名。');
        return;
    }
    const current = Number(context.variables.get(scope, name) ?? '0');
    const base = Number.isFinite(current) ? current : 0;
    context.variables.set(scope, name, String(base + delta));
};

const lastMessageOfRoles = (messages: MacroMessageLike[] | undefined, roles: string[]): string => {
    if (!messages || messages.length === 0) return '';
    for (let index = messages.length - 1; index >= 0; index--) {
        if (roles.includes(messages[index].role)) return messages[index].content;
    }
    return '';
};

const evaluateMacro = (
    segment: MacroSegment,
    context: MacroContext,
    trace: MacroTrace,
    depth: number
): string => {
    const name = segment.name;
    if (!name) return segment.raw;
    if (!KNOWN_MACROS.has(name)) {
        trace.warnings.push(`未知宏 {{${name}}}，已按原文保留。`);
        if (!trace.unresolvedMacros.includes(name)) trace.unresolvedMacros.push(name);
        return segment.raw;
    }
    if (!trace.usedMacros.includes(name)) trace.usedMacros.push(name);
    const args = segment.args.map(arg => resolveMacrosInternal(arg, context, trace, depth + 1));
    const now = context.now ?? new Date();

    switch (name) {
        case 'char':
            return context.characterName ?? '';
        case 'user':
            return context.userName ?? '';
        case 'persona':
            return context.persona ?? '';
        case 'description':
            return context.description ?? '';
        case 'personality':
            return context.personality ?? '';
        case 'scenario':
            return context.scenario ?? '';
        case 'input':
            return context.input ?? '';
        case 'model':
            return context.model ?? '';
        case 'original':
            return context.original ?? '';
        case 'time':
            return formatDateTime(now, args[0] || 'HH:mm');
        case 'date':
            return formatDateTime(now, args[0] || 'YYYY-MM-DD');
        case 'weekday':
            return weekdayName(now, context.locale ?? 'en-US');
        case 'isotime':
            return `${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;
        case 'isodate':
            return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
        case 'random':
            return evaluateRandom(args, context);
        case 'pick':
            return evaluatePick(args, context);
        case 'roll':
            return evaluateRoll(args[0] ?? '1d6', context);
        case 'newline':
            return '\n';
        case 'trim':
            return '';
        case 'noop':
        case '//':
            return '';
        case 'lastMessage':
            return context.messages?.length ? context.messages[context.messages.length - 1].content : '';
        case 'lastUserMessage':
            return lastMessageOfRoles(context.messages, ['user']);
        case 'lastCharMessage':
            return lastMessageOfRoles(context.messages, ['assistant']);
        case 'firstMessage':
            return context.messages?.[0]?.content ?? '';
        case 'getvar':
            return readVariable(context, 'local', args[0] ?? '', trace);
        case 'getglobalvar':
            return readVariable(context, 'global', args[0] ?? '', trace);
        case 'setvar':
            writeVariable(context, 'local', args[0] ?? '', args[1] ?? '', trace);
            return '';
        case 'setglobalvar':
            writeVariable(context, 'global', args[0] ?? '', args[1] ?? '', trace);
            return '';
        case 'addvar':
            addVariable(context, 'local', args[0] ?? '', Number(args[1] || '0'), trace);
            return '';
        case 'incvar':
            addVariable(context, 'local', args[0] ?? '', 1, trace);
            return '';
        case 'decvar':
            addVariable(context, 'local', args[0] ?? '', -1, trace);
            return '';
        default:
            return segment.raw;
    }
};

const evaluateCondition = (text: string, context: MacroContext, trace: MacroTrace, depth: number): boolean => {
    const resolved = resolveMacrosInternal(text, context, trace, depth + 1).trim();
    const comparison = /^([\s\S]*?)\s*(==|!=|>=|<=|>|<)\s*([\s\S]*)$/.exec(resolved);
    if (comparison) {
        const left = resolveOperand(comparison[1], context);
        const right = resolveOperand(comparison[3], context);
        const leftNumber = Number(left);
        const rightNumber = Number(right);
        const numeric = left.trim() !== ''
            && right.trim() !== ''
            && Number.isFinite(leftNumber)
            && Number.isFinite(rightNumber);
        switch (comparison[2]) {
            case '==':
                return numeric ? leftNumber === rightNumber : left === right;
            case '!=':
                return numeric ? leftNumber !== rightNumber : left !== right;
            case '>=':
                return numeric && leftNumber >= rightNumber;
            case '<=':
                return numeric && leftNumber <= rightNumber;
            case '>':
                return numeric && leftNumber > rightNumber;
            case '<':
                return numeric && leftNumber < rightNumber;
        }
    }
    const value = resolveOperand(resolved, context);
    return value !== '' && value !== '0' && value.toLowerCase() !== 'false';
};

const resolveMacrosInternal = (
    text: string,
    context: MacroContext,
    trace: MacroTrace,
    depth: number
): string => {
    if (depth > MAX_NESTING_DEPTH) {
        trace.warnings.push('宏嵌套超过上限，已按原文保留。');
        return text;
    }
    const segments = tokenize(text);
    if (segments.length === 0) return text;

    let result = '';
    let cursor = 0;
    let index = 0;
    while (index < segments.length) {
        const segment = segments[index];

        if (segment.name === 'if') {
            const bounds = findIfBlock(segments, index);
            if (!bounds) {
                result += text.slice(cursor, segment.end);
                cursor = segment.end;
                index += 1;
                continue;
            }
            const elseSegment = bounds.elseSegmentIndex >= 0 ? segments[bounds.elseSegmentIndex] : null;
            const endSegment = segments[bounds.endSegmentIndex];
            const thenText = text.slice(segment.end, elseSegment ? elseSegment.start : endSegment.start);
            const elseText = elseSegment ? text.slice(elseSegment.end, endSegment.start) : '';
            const chosen = evaluateCondition(segment.args[0] ?? '', context, trace, depth) ? thenText : elseText;
            result += text.slice(cursor, segment.start) + resolveMacrosInternal(chosen, context, trace, depth + 1);
            cursor = endSegment.end;
            index = bounds.endSegmentIndex + 1;
            continue;
        }

        if (segment.name === 'else' || segment.name === '/if') {
            trace.warnings.push(`孤立的 {{${segment.name}}}，已按原文保留。`);
            result += text.slice(cursor, segment.end);
            cursor = segment.end;
            index += 1;
            continue;
        }

        if (segment.name === 'trim') {
            result += text.slice(cursor, segment.start);
            result = result.replace(/[ \t]*\n[ \t]*$/, '').replace(/[ \t]+$/, '');
            cursor = segment.end;
            const following = /^[ \t]*\n[ \t]*/.exec(text.slice(cursor));
            if (following) cursor += following[0].length;
            index += 1;
            continue;
        }

        result += text.slice(cursor, segment.start) + evaluateMacro(segment, context, trace, depth);
        cursor = segment.end;
        index += 1;
    }
    result += text.slice(cursor);
    return result;
};

/** 解析文本中的宏。纯函数；变量读写通过 `context.variables` 注入。 */
export const resolveMacros = (text: string, context: MacroContext): MacroResult => {
    const trace = createMacroTrace();
    const resolved = resolveMacrosInternal(text, context, trace, 0);
    return { text: resolved, trace };
};
