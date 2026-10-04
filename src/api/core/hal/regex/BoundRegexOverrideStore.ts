import { lwStorage } from '../../../storage.js';
import type { RegexScript } from '../../../../types/RegexScriptTypes.js';
import { notifyRegexDisplayChanged } from './RegexDisplayChange.js';

/**
 * 绑定正则的 Lumina 级启用/禁用覆盖。
 *
 * 预设 / 角色卡内嵌脚本的原始 JSON 不被改写；这里只记录用户在本机的覆盖：
 * - `disabled`：来源启用但本机停用；
 * - `enabled`：来源停用但本机强制启用。
 * 无覆盖时跟随来源 `enabled`。显示层与提示词层在合并（预设 → 角色 → 全局）后统一应用。
 * 同 id 的绑定与全局脚本共享同一覆盖：覆盖后该 id 按覆盖状态执行。
 */

export const BOUND_REGEX_OVERRIDE_STORAGE_KEY = 'lumina-chat.boundRegexOverrides';

export type BoundRegexOverride = 'enabled' | 'disabled';

export type BoundRegexOverrides = Record<string, BoundRegexOverride>;

export const readBoundRegexOverrides = (): BoundRegexOverrides => {
    const raw = lwStorage.get(BOUND_REGEX_OVERRIDE_STORAGE_KEY, null, 'Global');
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
    const overrides: BoundRegexOverrides = {};
    for (const [id, value] of Object.entries(raw as Record<string, unknown>)) {
        if (id && (value === 'enabled' || value === 'disabled')) {
            overrides[id] = value;
        }
    }
    return overrides;
};

/** 写入 / 清除某条脚本的覆盖；无实际变化时不写库也不派发通知。 */
export const setBoundRegexOverride = (id: string, override: BoundRegexOverride | null): void => {
    if (!id) return;
    const current = readBoundRegexOverrides();
    if (override === null ? !(id in current) : current[id] === override) return;

    const next = { ...current };
    if (override === null) {
        delete next[id];
    } else {
        next[id] = override;
    }
    void lwStorage.set(BOUND_REGEX_OVERRIDE_STORAGE_KEY, next, 'Global');
    notifyRegexDisplayChanged();
};

export const resolveBoundRegexEnabled = (
    id: string,
    sourceEnabled: boolean,
    overrides: BoundRegexOverrides = readBoundRegexOverrides()
): boolean => {
    const override = overrides[id];
    if (override === 'enabled') return true;
    if (override === 'disabled') return false;
    return sourceEnabled;
};

/** 应用覆盖：剔除本机停用的脚本，并为强制启用的脚本打开 enabled。 */
export const applyBoundRegexOverrides = (scripts: RegexScript[]): RegexScript[] => {
    const overrides = readBoundRegexOverrides();
    if (Object.keys(overrides).length === 0) return scripts;

    const result: RegexScript[] = [];
    for (const script of scripts) {
        const override = overrides[script.id];
        if (override === 'disabled') continue;
        if (override === 'enabled' && !script.enabled) {
            result.push({ ...script, enabled: true });
            continue;
        }
        result.push(script);
    }
    return result;
};
