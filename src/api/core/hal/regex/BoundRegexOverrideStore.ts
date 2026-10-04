import { lwStorage } from '../../../storage.js';
import type { RegexScript } from '../../../../types/RegexScriptTypes.js';

/**
 * 绑定正则的 Lumina 级禁用覆盖。
 *
 * 预设 / 角色卡内嵌脚本的原始 JSON 不被改写；这里只记录用户在本机禁用的脚本 id，
 * 显示层与提示词层在合并（预设 → 角色 → 全局）之后统一过滤。
 * 同 id 的绑定与全局脚本共享同一开关：禁用后该 id 不再参与执行。
 */

export const BOUND_REGEX_DISABLED_STORAGE_KEY = 'lumina-chat.boundRegexDisabled';

export const readDisabledBoundRegexIds = (): string[] => {
    const raw = lwStorage.get(BOUND_REGEX_DISABLED_STORAGE_KEY, [], 'Global');
    if (!Array.isArray(raw)) return [];
    return raw.filter((id): id is string => typeof id === 'string' && id.length > 0);
};

export const setBoundRegexDisabled = (id: string, disabled: boolean): void => {
    if (!id) return;
    const next = new Set(readDisabledBoundRegexIds());
    if (disabled) {
        next.add(id);
    } else {
        next.delete(id);
    }
    void lwStorage.set(BOUND_REGEX_DISABLED_STORAGE_KEY, Array.from(next), 'Global');
};

export const filterDisabledBoundRegexes = (scripts: RegexScript[]): RegexScript[] => {
    const disabled = new Set(readDisabledBoundRegexIds());
    if (disabled.size === 0) return scripts;
    return scripts.filter(script => !disabled.has(script.id));
};
