import { lwStorage } from '../../../storage.js';
import { REGEX_PLACEMENTS, type RegexPlacement, type RegexScript } from '../../../../types/RegexScriptTypes.js';
import { RegexScriptEngine } from './RegexScriptEngine.js';
import { mergeRegexScripts, parseRegexScripts } from './RegexScriptDocument.js';
import { getCachedRegexScripts } from './LuminaRegexAssetCache.js';
import { filterDisabledBoundRegexes } from './BoundRegexOverrideStore.js';
import { CHAT_PROMPT_REGEX_STORAGE_KEY } from '../prompt/ChatPromptCompositionService.js';

export type RegexSourceKey = 'user_input' | 'ai_output' | 'slash_command' | 'world_info' | 'reasoning';

const SOURCE_TO_PLACEMENT: Record<RegexSourceKey, RegexPlacement | undefined> = {
    user_input: REGEX_PLACEMENTS.userInput,
    ai_output: REGEX_PLACEMENTS.aiOutput,
    slash_command: REGEX_PLACEMENTS.slashCommand,
    world_info: REGEX_PLACEMENTS.worldInfo,
    reasoning: REGEX_PLACEMENTS.reasoning
};

/**
 * 无 ST 宿主时的显示层正则：预设绑定 → 角色绑定 → 全局库，按 id 去重后依次应用。
 * ST 宿主继续由 TavernHelper 处理宿主正则；本服务只补 Lumina 自有脚本集，避免重复。
 */
export class LuminaRegexDisplayService {
    /** 当前生效的 Lumina 正则脚本集（预设绑定 → 角色绑定 → 全局库，应用 Lumina 级禁用覆盖）。 */
    public getActiveScripts(): RegexScript[] {
        const cached = getCachedRegexScripts();
        return filterDisabledBoundRegexes(mergeRegexScripts(
            cached.presetScripts,
            mergeRegexScripts(cached.characterScripts, this.readGlobalScripts())
        ));
    }

    public apply(
        text: string,
        source: RegexSourceKey,
        destination: 'display' | 'prompt' | string,
        options: { depth?: number } = {}
    ): string {
        if (destination !== 'display') return text;
        const placement = SOURCE_TO_PLACEMENT[source];
        if (placement === undefined) return text;
        const scripts = this.getActiveScripts();
        if (scripts.length === 0) return text;
        const depth = typeof options.depth === 'number' ? options.depth : undefined;
        return new RegexScriptEngine(scripts).apply(text, {
            source: placement,
            destination: 'display',
            ...(depth === undefined ? {} : { depth })
        }).text;
    }

    private readGlobalScripts(): RegexScript[] {
        return parseRegexScripts(lwStorage.get(CHAT_PROMPT_REGEX_STORAGE_KEY, [], 'Global')).scripts;
    }
}

export const luminaRegexDisplayService = new LuminaRegexDisplayService();
