const FORGE_PIPE_CHARS = new Set(['|', '｜', '丨', '│', '┃', '‖', '¦']);

export interface ForgeRichOptionItem {
    body: string;
    actionLabel: string;
    raw: string;
}

/** ForgeFormAssist 单个候选值（含可选说明） */
export interface FormAssistCandidate {
    /** 候选值正文 */
    value: string;
    /** 以 '::' 分隔的说明文字，无则为 null */
    description: string | null;
}

/** ForgeFormAssist 单字段辅助数据 */
export interface FormAssistField {
    /** 目标字段键名（可能包含 formId/ 前缀） */
    fieldKey: string;
    /** 候选值列表（prefill 模式取首项；suggestion 模式全部呈现） */
    candidates: FormAssistCandidate[];
}

/**
 * 构造复合字段键名
 * @param formId 表单 ID，可为空
 * @param fieldKey 字段键名
 * @returns 复合路径（如 "formId/fieldKey" 或 "fieldKey"）
 */
export function buildCompositeFieldKey(formId: string | null | undefined, fieldKey: string): string {
    const cid = formId?.trim();
    const fk = fieldKey?.trim();
    if (cid && fk && !fk.includes('/')) {
        return `${cid}/${fk}`;
    }
    return fk;
}

/**
 * 解析复合字段路径
 * @param path 路径字符串，如 "character/name" 或 "name"
 * @returns [formId, realFieldKey]
 */
export function parseCompositePath(path: string | null | undefined): [string | null, string] {
    const raw = (path || '').trim();
    if (!raw) return [null, ''];
    if (raw.includes('/')) {
        const parts = raw.split('/');
        return [parts[0].trim(), parts[1].trim()];
    }
    return [null, raw];
}

/**
 * 解析 ForgeFormAssist 单个 vararg 字符串
 * 格式：fieldKey|value1::desc1|value2
 * 首个 | 前为 fieldKey，之后每段为一个候选值（:: 可选分隔说明）
 */
export function parseFormAssistVararg(raw: string): FormAssistField | null {
    const normalized = raw.trim();
    if (!normalized) return null;

    // 找到首个 pipe 字符的位置
    let firstPipeIndex = -1;
    for (let i = 0; i < normalized.length; i++) {
        if (FORGE_PIPE_CHARS.has(normalized[i])) {
            firstPipeIndex = i;
            break;
        }
    }

    // 没有 pipe 则无效（无法区分 fieldKey 与值）
    if (firstPipeIndex === -1) return null;

    const fieldKey = normalized.slice(0, firstPipeIndex).trim();
    if (!fieldKey) return null;

    // 剩余部分按 pipe 分割为候选值串
    const candidateRaws = splitTopLevelByPipeInternal(normalized.slice(firstPipeIndex + 1));
    const candidates: FormAssistCandidate[] = candidateRaws
        .map(raw => parseFormAssistCandidate(raw))
        .filter((c): c is FormAssistCandidate => Boolean(c.value));

    if (candidates.length === 0) return null;

    return { fieldKey, candidates };
}

/** 解析单个候选值字符串，支持 '::' 说明分隔 */
function parseFormAssistCandidate(raw: string): FormAssistCandidate {
    const normalized = raw.trim();
    const separatorIndex = normalized.indexOf('::');
    if (separatorIndex !== -1) {
        return {
            value: normalized.slice(0, separatorIndex).trim(),
            description: normalized.slice(separatorIndex + 2).trim() || null
        };
    }
    return { value: normalized, description: null };
}



const normalizeJsonArrayString = (input: string): string => {
    const trimmed = input.trim();
    if (!trimmed.startsWith('[') || !trimmed.endsWith(']')) {
        return trimmed;
    }

    return trimmed.replace(/'([^']*)'/g, (_, value: string) => `"${value.replace(/"/g, '\\"')}"`);
};

const parseJsonArrayOptions = (input: string): string[] | null => {
    const normalized = normalizeJsonArrayString(input);
    if (!normalized.startsWith('[') || !normalized.endsWith(']')) {
        return null;
    }

    try {
        const parsed = JSON.parse(normalized);
        if (!Array.isArray(parsed)) {
            return null;
        }
        return parsed.map((item) => String(item).trim()).filter(Boolean);
    } catch {
        return null;
    }
};

const splitTopLevelByPipeInternal = (input: string): string[] => {
    const result: string[] = [];
    let current = '';
    let quote: '"' | "'" | '`' | null = null;
    let squareDepth = 0;
    let curlyDepth = 0;
    let roundDepth = 0;

    for (let index = 0; index < input.length; index += 1) {
        const char = input[index];
        const previous = index > 0 ? input[index - 1] : '';

        if (quote) {
            current += char;
            if (char === quote && previous !== '\\') {
                quote = null;
            }
            continue;
        }

        if (char === '"' || char === "'" || char === '`') {
            quote = char;
            current += char;
            continue;
        }

        if (char === '[') squareDepth += 1;
        if (char === ']') squareDepth = Math.max(0, squareDepth - 1);
        if (char === '{') curlyDepth += 1;
        if (char === '}') curlyDepth = Math.max(0, curlyDepth - 1);
        if (char === '(') roundDepth += 1;
        if (char === ')') roundDepth = Math.max(0, roundDepth - 1);

        if (FORGE_PIPE_CHARS.has(char) && squareDepth === 0 && curlyDepth === 0 && roundDepth === 0) {
            const trimmed = current.trim();
            if (trimmed) {
                result.push(trimmed);
            }
            current = '';
            continue;
        }

        current += char;
    }

    const finalToken = current.trim();
    if (finalToken) {
        result.push(finalToken);
    }

    return result;
};

const normalizeOptionList = (input: string | string[] | undefined | null): string[] => {
    if (!input) return [];

    if (Array.isArray(input)) {
        return input.map((item) => String(item).trim()).filter(Boolean);
    }

    const asString = String(input).trim();
    if (!asString) return [];

    const parsedArray = parseJsonArrayOptions(asString);
    if (parsedArray) {
        return parsedArray;
    }

    return splitTopLevelByPipeInternal(asString);
};

const splitRichOption = (input: string): { body: string; actionLabel: string } => {
    // 优先寻找管道符 (用于长正文|短按钮格式)
    for (let index = 0; index < input.length; index += 1) {
        if (!FORGE_PIPE_CHARS.has(input[index])) {
            continue;
        }

        const body = input.slice(0, index).trim();
        const actionLabel = input.slice(index + 1).trim();
        if (!body || !actionLabel) {
            break;
        }
        return {
            body,
            actionLabel
        };
    }

    // 其次寻找双冒号 (用于 提交值::显示名 格式)
    const dblColIndex = input.indexOf('::');
    if (dblColIndex !== -1) {
        const body = input.slice(0, dblColIndex).trim();
        const actionLabel = input.slice(dblColIndex + 2).trim();
        if (body && actionLabel) {
            return { body, actionLabel };
        }
    }

    const normalized = input.trim();
    return {
        body: normalized,
        actionLabel: normalized
    };
};

export function splitForgePipeTokens(input: string): string[] {
    return splitTopLevelByPipeInternal(String(input || ''));
}

export function splitForgeOptions(input: string | string[] | undefined | null): string[] {
    const result = normalizeOptionList(input);

    if (result.length <= 1 && typeof input === 'string' && input.trim().length > 20) {
        const hex = Array.from(input).map((char) => `U+${char.charCodeAt(0).toString(16).padStart(4, '0')}`).join(' ');
        console.warn('[Forge-Split] 长字符串拆分结果为 1，已记录字符信息。', {
            input,
            hex,
            result
        });
    }

    return result;
}

export function parseForgeRichOptions(input: string | string[] | undefined | null): ForgeRichOptionItem[] {
    return normalizeOptionList(input).map((option) => {
        const normalized = String(option).trim();
        const parsed = splitRichOption(normalized);
        return {
            body: parsed.body,
            actionLabel: parsed.actionLabel,
            raw: normalized
        };
    });
}
