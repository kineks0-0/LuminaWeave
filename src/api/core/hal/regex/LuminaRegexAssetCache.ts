import type { RegexScript } from '../../../../types/RegexScriptTypes.js';

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

export const setCachedPresetRegexScripts = (
    id: string | null,
    scripts: RegexScript[],
    name: string | null = null
): void => {
    cache.presetId = id;
    cache.presetName = name;
    cache.presetScripts = [...scripts];
};

export const setCachedCharacterRegexScripts = (
    id: string | null,
    scripts: RegexScript[],
    name: string | null = null
): void => {
    cache.characterId = id;
    cache.characterName = name;
    cache.characterScripts = [...scripts];
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
