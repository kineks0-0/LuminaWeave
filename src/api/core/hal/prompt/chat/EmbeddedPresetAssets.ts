import type { ResourceDiagnostic } from '@shared/resources/index.js';
import { resolveCharacterCardSource } from '@shared/resources/index.js';
import type { ChatCompletionPreset } from '../../../../../types/ChatCompletionPresetTypes.js';
import type { RegexScript } from '../../../../../types/RegexScriptTypes.js';
import { parseRegexScripts } from '../../regex/RegexScriptDocument.js';

/**
 * 从 ST 预设 / 角色卡的内嵌扩展中提取绑定资产。
 *
 * 正则与预设/角色**原生绑定**：仅在对应预设激活、对应角色使用时生效，
 * 不并入全局正则库；显示层与提示词层统一从绑定来源读取。
 *
 * 覆盖：
 * - 预设：`extensions.regex_scripts`、`extensions.SPreset.RegexBinding.regexes`（按 id 去重）。
 * - 角色卡：`data.extensions.regex_scripts` / `extensions.regex_scripts` / 顶层 `regex_scripts`。
 * - `tavern_helper.variables`（作用域 `global/local` 或扁平写法，扁平视为全局）。
 *
 * 其余扩展字段（scripts、MessageInjections、OutputPreprocessing 等）保持原样不执行。
 */

const asRecord = (value: unknown): Record<string, unknown> =>
    value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};

export interface EmbeddedPresetAssets {
    regexScripts: RegexScript[];
    variables: { global: Record<string, string>; local: Record<string, string> };
    diagnostics: ResourceDiagnostic[];
}

const toTextRecord = (value: unknown): Record<string, string> => {
    const record = asRecord(value);
    const result: Record<string, string> = {};
    for (const [key, item] of Object.entries(record)) {
        if (typeof item === 'string' || typeof item === 'number' || typeof item === 'boolean') {
            result[key] = String(item);
        }
    }
    return result;
};

/** TavernHelper 变量：支持 `{ global, local }` 作用域写法与扁平写法（视为全局）。 */
const extractVariables = (extensions: Record<string, unknown>): { global: Record<string, string>; local: Record<string, string> } => {
    const rawVariables = asRecord(asRecord(extensions.tavern_helper).variables);
    if (Object.keys(rawVariables).length === 0) {
        return { global: {}, local: {} };
    }
    if ('global' in rawVariables || 'local' in rawVariables) {
        return {
            global: toTextRecord(rawVariables.global),
            local: toTextRecord(rawVariables.local)
        };
    }
    return { global: toTextRecord(rawVariables), local: {} };
};

const dedupeById = (items: unknown[]): unknown[] => {
    const seen = new Set<string>();
    const deduped: unknown[] = [];
    for (const item of items) {
        const record = asRecord(item);
        const id = typeof record.id === 'string' || typeof record.id === 'number'
            ? String(record.id)
            : JSON.stringify([record.scriptName, record.findRegex]);
        if (seen.has(id)) continue;
        seen.add(id);
        deduped.push(item);
    }
    return deduped;
};

export const extractEmbeddedPresetAssets = (preset: ChatCompletionPreset): EmbeddedPresetAssets => {
    const extensions = asRecord(preset.extensions);
    const variables = extractVariables(extensions);
    const rawScripts = Array.isArray(extensions.regex_scripts) ? extensions.regex_scripts : [];
    const spreset = asRecord(extensions.SPreset);
    const regexBinding = asRecord(spreset.RegexBinding);
    const bindingScripts = Array.isArray(regexBinding.regexes) ? regexBinding.regexes : [];
    const merged = [...rawScripts, ...bindingScripts];
    if (merged.length === 0) {
        return { regexScripts: [], variables, diagnostics: [] };
    }

    const parsed = parseRegexScripts(dedupeById(merged));
    return { regexScripts: parsed.scripts, variables, diagnostics: parsed.diagnostics };
};

/** 角色卡内嵌正则：随该角色生效，不写入全局正则库。 */
export const extractCharacterRegexScripts = (raw: unknown): RegexScript[] => {
    const root = asRecord(raw);
    const source = resolveCharacterCardSource(root);
    const sourceExtensions = asRecord(source.extensions);
    const rootExtensions = asRecord(root.extensions);
    const scripts = [
        ...(Array.isArray(source.regex_scripts) ? source.regex_scripts : []),
        ...(Array.isArray(sourceExtensions.regex_scripts) ? sourceExtensions.regex_scripts : []),
        ...(Array.isArray(root.regex_scripts) ? root.regex_scripts : []),
        ...(Array.isArray(rootExtensions.regex_scripts) ? rootExtensions.regex_scripts : [])
    ];
    if (scripts.length === 0) return [];
    return parseRegexScripts(dedupeById(scripts)).scripts;
};
