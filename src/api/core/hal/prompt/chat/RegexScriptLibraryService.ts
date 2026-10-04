import type { ResourceDiagnostic } from '@shared/resources/index.js';
import { lwStorage } from '../../../../storage.js';
import {
    REGEX_PLACEMENTS,
    type RegexPlacement,
    type RegexScript
} from '../../../../../types/RegexScriptTypes.js';
import { parseRegexScripts, serializeRegexScripts } from '../../regex/RegexScriptDocument.js';
import { RegexScriptEngine, type RegexApplyResult } from '../../regex/RegexScriptEngine.js';
import { notifyRegexDisplayChanged } from '../../regex/RegexDisplayChange.js';
import { CHAT_PROMPT_REGEX_STORAGE_KEY } from '../ChatPromptCompositionService.js';

export interface RegexScriptImportResult {
    added: number;
    scripts: RegexScript[];
    diagnostics: ResourceDiagnostic[];
}

const createScriptId = (): string => {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
        return `regex-${crypto.randomUUID()}`;
    }
    return `regex-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
};

export const createDefaultRegexScript = (): RegexScript => ({
    id: createScriptId(),
    scriptName: '新正则脚本',
    enabled: true,
    findRegex: '',
    replaceString: '',
    trimStrings: [],
    placement: [REGEX_PLACEMENTS.userInput],
    markdownOnly: false,
    promptOnly: false,
    runOnEdit: false,
    substituteRegex: 0,
    minDepth: null,
    maxDepth: null
});

/**
 * 正则脚本库：lwStorage 单一列表（顺序即执行顺序），支持 CRUD、导入导出与内联测试。
 */
export class RegexScriptLibraryService {
    public list(): RegexScript[] {
        return parseRegexScripts(lwStorage.get(CHAT_PROMPT_REGEX_STORAGE_KEY, [], 'Global')).scripts;
    }

    public replaceAll(scripts: RegexScript[]): void {
        void lwStorage.set(CHAT_PROMPT_REGEX_STORAGE_KEY, serializeRegexScripts(scripts), 'Global');
        notifyRegexDisplayChanged();
    }

    public add(partial: Partial<RegexScript> = {}): RegexScript {
        const script: RegexScript = { ...createDefaultRegexScript(), ...partial, id: createScriptId() };
        this.replaceAll([...this.list(), script]);
        return script;
    }

    public update(id: string, patch: Partial<RegexScript>): RegexScript | null {
        const scripts = this.list();
        const index = scripts.findIndex(script => script.id === id);
        if (index < 0) return null;
        const updated: RegexScript = { ...scripts[index], ...patch, id };
        scripts[index] = updated;
        this.replaceAll(scripts);
        return updated;
    }

    public remove(id: string): boolean {
        const scripts = this.list();
        const filtered = scripts.filter(script => script.id !== id);
        if (filtered.length === scripts.length) return false;
        this.replaceAll(filtered);
        return true;
    }

    public move(id: string, direction: -1 | 1): boolean {
        const scripts = this.list();
        const index = scripts.findIndex(script => script.id === id);
        const target = index + direction;
        if (index < 0 || target < 0 || target >= scripts.length) return false;
        const [script] = scripts.splice(index, 1);
        scripts.splice(target, 0, script);
        this.replaceAll(scripts);
        return true;
    }

    public importFromRaw(raw: unknown): RegexScriptImportResult {
        const parsed = parseRegexScripts(raw);
        if (parsed.scripts.length === 0) {
            return { added: 0, scripts: this.list(), diagnostics: parsed.diagnostics };
        }
        const imported = parsed.scripts.map(script => ({ ...script, id: createScriptId() }));
        const scripts = [...this.list(), ...imported];
        this.replaceAll(scripts);
        return { added: imported.length, scripts, diagnostics: parsed.diagnostics };
    }

    public exportRaw(): Array<Record<string, unknown>> {
        return serializeRegexScripts(this.list());
    }

    /** 内联测试：强制启用当前脚本，只跑这一条，按指定 placement 应用。 */
    public test(
        script: RegexScript,
        text: string,
        source: RegexPlacement = REGEX_PLACEMENTS.aiOutput,
        depth?: number
    ): RegexApplyResult {
        const engine = new RegexScriptEngine([{ ...script, enabled: true }]);
        return engine.apply(text, {
            source,
            destination: 'prompt',
            ...(depth === undefined ? {} : { depth })
        });
    }
}

export const regexScriptLibraryService = new RegexScriptLibraryService();
