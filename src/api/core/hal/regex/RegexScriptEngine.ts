import type { RegexPlacement, RegexScript } from '../../../../types/RegexScriptTypes.js';

export type RegexDestination = 'prompt' | 'display' | 'edit';

export interface RegexApplyOptions {
    /** 文本所处的 placement 上下文（用户输入 / AI 输出 / 世界书 / 推理）。 */
    source: RegexPlacement;
    destination: RegexDestination;
    /** 消息距底部的深度，用于 minDepth / maxDepth 过滤。 */
    depth?: number;
    /** `substituteRegex` 非 0 时用于宏替换；由管线注入宏运行时。 */
    resolveSubstitution?: (text: string) => string;
}

export interface RegexApplyResult {
    text: string;
    applied: string[];
    warnings: string[];
}

/**
 * ponytail: 用输入长度上限替代正则超时保护；JS 正则没有中断机制，
 * 需要更强保证时迁移到 Web Worker + timeout（见任务文档开放问题 3）。
 */
const MAX_INPUT_LENGTH = 100_000;

export const compileFindRegex = (source: string): RegExp | null => {
    const trimmed = source.trim();
    if (!trimmed) return null;
    try {
        const literal = /^\/([\s\S]*)\/([a-z]*)$/.exec(trimmed);
        if (literal) return new RegExp(literal[1], literal[2]);
        return new RegExp(trimmed);
    } catch {
        return null;
    }
};

export class RegexScriptEngine {
    private readonly scripts: readonly RegexScript[];

    constructor(scripts: readonly RegexScript[]) {
        this.scripts = scripts;
    }

    public apply(text: string, options: RegexApplyOptions): RegexApplyResult {
        const warnings: string[] = [];
        const applied: string[] = [];
        if (text.length > MAX_INPUT_LENGTH) {
            warnings.push(`输入超过 ${MAX_INPUT_LENGTH} 字符，已跳过正则处理。`);
            return { text, applied, warnings };
        }

        let result = text;
        for (const script of this.scripts) {
            if (!this.shouldApply(script, options)) continue;

            let findRegex = script.findRegex;
            let replaceString = script.replaceString;
            if (script.substituteRegex !== 0) {
                if (script.substituteRegex === 2) {
                    warnings.push(`「${script.scriptName}」使用了 escaped 宏替换，当前按 raw 处理。`);
                }
                if (options.resolveSubstitution) {
                    findRegex = options.resolveSubstitution(findRegex);
                    replaceString = options.resolveSubstitution(replaceString);
                }
            }

            const compiled = compileFindRegex(findRegex);
            if (!compiled) {
                warnings.push(`「${script.scriptName}」正则无法编译，已跳过。`);
                continue;
            }

            try {
                result = result.replace(compiled, replaceString);
                for (const trim of script.trimStrings) {
                    if (trim) result = result.split(trim).join('');
                }
                applied.push(script.id);
            } catch (error) {
                warnings.push(`「${script.scriptName}」执行失败：${error instanceof Error ? error.message : String(error)}`);
            }
        }

        return { text: result, applied, warnings };
    }

    private shouldApply(script: RegexScript, options: RegexApplyOptions): boolean {
        if (!script.enabled) return false;
        if (!script.placement.includes(options.source)) return false;
        if (options.destination === 'prompt' && script.markdownOnly) return false;
        if (options.destination === 'display' && script.promptOnly) return false;
        if (options.destination === 'edit' && !script.runOnEdit) return false;
        if (options.depth !== undefined) {
            if (script.minDepth !== null && options.depth < script.minDepth) return false;
            if (script.maxDepth !== null && options.depth > script.maxDepth) return false;
        }
        return true;
    }
}
