/**
 * ST 正则脚本（regex_scripts）的规范化模型。
 *
 * 与 `ChatCompletionPresetTypes` 同一口径：已知字段 camelCase 规范化，
 * 未消费字段经索引签名保留，序列化回 ST 兼容 JSON。
 */

export const REGEX_PLACEMENTS = {
    userInput: 1,
    aiOutput: 2,
    slashCommand: 3,
    worldInfo: 5,
    reasoning: 6
} as const;

export type RegexPlacement = (typeof REGEX_PLACEMENTS)[keyof typeof REGEX_PLACEMENTS];

/** ST `substituteRegex`：0 = 不替换，1 = 原始替换，2 = 替换并转义。 */
export type RegexSubstituteMode = 0 | 1 | 2;

export interface RegexScript {
    id: string;
    scriptName: string;
    /** 由 ST 的 `disabled` 取反得到；导出时再取反回去。 */
    enabled: boolean;
    findRegex: string;
    replaceString: string;
    trimStrings: string[];
    placement: RegexPlacement[];
    markdownOnly: boolean;
    promptOnly: boolean;
    runOnEdit: boolean;
    substituteRegex: RegexSubstituteMode;
    /** 距离底部消息的深度范围；`null` 表示不限制。 */
    minDepth: number | null;
    maxDepth: number | null;
    /** 未消费的原始字段，序列化时原样带回。 */
    [key: string]: unknown;
}

export interface RegexScriptParseResult {
    scripts: RegexScript[];
    diagnostics: import('@shared/resources/index.js').ResourceDiagnostic[];
}

export const REGEX_SCRIPT_CONSUMED_KEYS: readonly string[] = [
    'id',
    'scriptName',
    'script_name',
    'disabled',
    'enabled',
    'findRegex',
    'find_regex',
    'replaceString',
    'replace_string',
    'trimStrings',
    'trim_strings',
    'placement',
    'markdownOnly',
    'markdown_only',
    'promptOnly',
    'prompt_only',
    'runOnEdit',
    'run_on_edit',
    'substituteRegex',
    'substitute_regex',
    'minDepth',
    'min_depth',
    'maxDepth',
    'max_depth'
];
