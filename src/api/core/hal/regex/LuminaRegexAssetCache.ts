import type { RegexScript } from '../../../../types/RegexScriptTypes.js';

/**
 * 预设 / 角色绑定正则的展示缓存。
 *
 * 显示层正则是同步应用（消息渲染路径），无法每次异步读资源；因此由合成管线与
 * 预设库操作在切换/保存时刷新这里，显示服务只读缓存 + 全局库。
 */

interface RegexAssetCache {
    presetId: string | null;
    presetScripts: RegexScript[];
    characterId: string | null;
    characterScripts: RegexScript[];
}

const cache: RegexAssetCache = {
    presetId: null,
    presetScripts: [],
    characterId: null,
    characterScripts: []
};

export const setCachedPresetRegexScripts = (id: string | null, scripts: RegexScript[]): void => {
    cache.presetId = id;
    cache.presetScripts = [...scripts];
};

export const setCachedCharacterRegexScripts = (id: string | null, scripts: RegexScript[]): void => {
    cache.characterId = id;
    cache.characterScripts = [...scripts];
};

export const getCachedRegexScripts = (): { presetScripts: RegexScript[]; characterScripts: RegexScript[] } => ({
    presetScripts: [...cache.presetScripts],
    characterScripts: [...cache.characterScripts]
});

export const getRegexCacheIds = (): { presetId: string | null; characterId: string | null } => ({
    presetId: cache.presetId,
    characterId: cache.characterId
});
