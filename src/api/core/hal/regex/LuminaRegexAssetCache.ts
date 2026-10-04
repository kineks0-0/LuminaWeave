import type { RegexScript } from '../../../../types/RegexScriptTypes.js';
import { notifyRegexDisplayChanged } from './RegexDisplayChange.js';

/**
 * 预设 / 角色绑定正则的展示缓存。
 *
 * 显示层正则是同步应用（消息渲染路径），无法每次异步读资源；因此由合成管线与
 * 预设库操作在切换/保存时刷新这里，显示服务只读缓存 + 全局库。
 */

interface RegexAssetCache {
    presetId: string | null;
    presetName: string | null;
    presetScripts: RegexScript[];
    characterId: string | null;
    characterName: string | null;
    characterScripts: RegexScript[];
}

const cache: RegexAssetCache = {
    presetId: null,
    presetName: null,
    presetScripts: [],
    characterId: null,
    characterName: null,
    characterScripts: []
};

const sameScripts = (left: RegexScript[], right: RegexScript[]): boolean => (
    left.length === right.length && JSON.stringify(left) === JSON.stringify(right)
);

export const setCachedPresetRegexScripts = (
    id: string | null,
    scripts: RegexScript[],
    name: string | null = null
): void => {
    if (cache.presetId === id && cache.presetName === name && sameScripts(cache.presetScripts, scripts)) {
        return;
    }
    cache.presetId = id;
    cache.presetName = name;
    cache.presetScripts = [...scripts];
    notifyRegexDisplayChanged();
};

export const setCachedCharacterRegexScripts = (
    id: string | null,
    scripts: RegexScript[],
    name: string | null = null
): void => {
    if (cache.characterId === id && cache.characterName === name && sameScripts(cache.characterScripts, scripts)) {
        return;
    }
    cache.characterId = id;
    cache.characterName = name;
    cache.characterScripts = [...scripts];
    notifyRegexDisplayChanged();
};

export const getCachedRegexScripts = (): {
    presetId: string | null;
    presetName: string | null;
    presetScripts: RegexScript[];
    characterId: string | null;
    characterName: string | null;
    characterScripts: RegexScript[];
} => ({
    presetId: cache.presetId,
    presetName: cache.presetName,
    presetScripts: [...cache.presetScripts],
    characterId: cache.characterId,
    characterName: cache.characterName,
    characterScripts: [...cache.characterScripts]
});

export const getRegexCacheIds = (): { presetId: string | null; characterId: string | null } => ({
    presetId: cache.presetId,
    characterId: cache.characterId
});
