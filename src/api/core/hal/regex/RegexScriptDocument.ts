import type { ResourceDiagnostic } from '@shared/resources/index.js';
import {
    REGEX_PLACEMENTS,
    REGEX_SCRIPT_CONSUMED_KEYS,
    type RegexPlacement,
    type RegexScript,
    type RegexScriptParseResult,
    type RegexSubstituteMode
} from '../../../../types/RegexScriptTypes.js';

const asRecord = (value: unknown): Record<string, unknown> | null =>
    value !== null && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : null;

const toTrimmedString = (value: unknown): string => typeof value === 'string' ? value.trim() : '';

const toBoolean = (value: unknown, fallback = false): boolean => {
    if (value === undefined || value === null) return fallback;
    if (typeof value === 'boolean') return value;
    if (value === 1 || value === 'true' || value === '1') return true;
    if (value === 0 || value === 'false' || value === '0') return false;
    return fallback;
};

const VALID_PLACEMENTS = new Set<number>(Object.values(REGEX_PLACEMENTS));

const toPlacements = (value: unknown): RegexPlacement[] => {
    if (!Array.isArray(value)) return [];
    const result: RegexPlacement[] = [];
    for (const item of value) {
        const parsed = typeof item === 'number' ? item : Number(item);
        if (VALID_PLACEMENTS.has(parsed) && !result.includes(parsed as RegexPlacement)) {
            result.push(parsed as RegexPlacement);
        }
    }
    return result;
};

const toSubstituteMode = (value: unknown): RegexSubstituteMode => {
    const parsed = typeof value === 'number' ? value : Number(value);
    return parsed === 1 || parsed === 2 ? parsed : 0;
};

const toDepth = (value: unknown): number | null => {
    if (value === undefined || value === null || value === '') return null;
    const parsed = typeof value === 'number' ? value : Number(value);
    return Number.isFinite(parsed) ? parsed : null;
};

const toTrimStrings = (value: unknown): string[] => {
    if (!Array.isArray(value)) return [];
    return value.map(item => typeof item === 'string' ? item : '').filter(Boolean);
};

const collectExtras = (record: Record<string, unknown>): Record<string, unknown> => {
    const extras: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(record)) {
        if (!REGEX_SCRIPT_CONSUMED_KEYS.includes(key)) extras[key] = value;
    }
    return extras;
};

const normalizeScript = (raw: unknown, index: number, diagnostics: ResourceDiagnostic[]): RegexScript | null => {
    const record = asRecord(raw);
    if (!record) {
        diagnostics.push({
            level: 'warning',
            code: 'regex.script_invalid',
            message: `第 ${index + 1} 条正则脚本不是对象，已跳过。`
        });
        return null;
    }
    const scriptName = toTrimmedString(record.scriptName)
        || toTrimmedString(record.script_name)
        || toTrimmedString(record.name);
    if (!scriptName) {
        diagnostics.push({
            level: 'info',
            code: 'regex.script_name_missing',
            message: `第 ${index + 1} 条正则脚本没有名称，已使用「未命名脚本」。`
        });
    }
    const idValue = record.id;
    const enabled = record.enabled !== undefined
        ? toBoolean(record.enabled, true)
        : !toBoolean(record.disabled);
    return {
        ...collectExtras(record),
        id: typeof idValue === 'string' || typeof idValue === 'number' ? String(idValue) : `regex-${index + 1}`,
        scriptName: scriptName || '未命名脚本',
        enabled,
        findRegex: typeof record.findRegex === 'string'
            ? record.findRegex
            : typeof record.find_regex === 'string' ? record.find_regex : '',
        replaceString: typeof record.replaceString === 'string'
            ? record.replaceString
            : typeof record.replace_string === 'string' ? record.replace_string : '',
        trimStrings: toTrimStrings(record.trimStrings ?? record.trim_strings),
        placement: toPlacements(record.placement),
        markdownOnly: toBoolean(record.markdownOnly ?? record.markdown_only),
        promptOnly: toBoolean(record.promptOnly ?? record.prompt_only),
        runOnEdit: toBoolean(record.runOnEdit ?? record.run_on_edit),
        substituteRegex: toSubstituteMode(record.substituteRegex ?? record.substitute_regex),
        minDepth: toDepth(record.minDepth ?? record.min_depth),
        maxDepth: toDepth(record.maxDepth ?? record.max_depth)
    };
};

/** 解析 ST 正则脚本 JSON（数组或单对象）。纯函数，不读写存储。 */
export const parseRegexScripts = (input: unknown): RegexScriptParseResult => {
    const diagnostics: ResourceDiagnostic[] = [];
    const items = Array.isArray(input) ? input : asRecord(input) ? [input] : null;
    if (!items) {
        return {
            scripts: [],
            diagnostics: [{ level: 'error', code: 'regex.invalid_format', message: '正则脚本必须是 JSON 数组或对象。' }]
        };
    }
    const scripts: RegexScript[] = [];
    items.forEach((item, index) => {
        const script = normalizeScript(item, index, diagnostics);
        if (script) scripts.push(script);
    });
    return { scripts, diagnostics };
};

/** 序列化回 ST 兼容 JSON（字段名与 `disabled` 取反映射）。 */
export const serializeRegexScripts = (scripts: RegexScript[]): Array<Record<string, unknown>> =>
    scripts.map(script => ({
        ...collectExtras(script),
        id: script.id,
        scriptName: script.scriptName,
        findRegex: script.findRegex,
        replaceString: script.replaceString,
        trimStrings: [...script.trimStrings],
        placement: [...script.placement],
        disabled: !script.enabled,
        markdownOnly: script.markdownOnly,
        promptOnly: script.promptOnly,
        runOnEdit: script.runOnEdit,
        substituteRegex: script.substituteRegex,
        minDepth: script.minDepth,
        maxDepth: script.maxDepth
    }));
