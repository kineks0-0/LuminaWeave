import { STClient } from './STClient.js';
import { STEnvironmentDriver } from './STEnvironmentDriver.js';
import { STGlobalAccessor } from './STGlobalAccessor.js';

export class STCharacterProfileDriver {
    static getAssistantName(fallback = 'Assistant'): string {
        const ctx = STEnvironmentDriver.ctx as any;
        const charId = ctx?.characterId;
        if (charId !== undefined && ctx?.characters && ctx.characters[Number(charId)]) {
            return ctx.characters[Number(charId)].name;
        }
        return ctx?.name2 || (STGlobalAccessor.stGlobal as any)?.name2 || fallback;
    }

    static getUserName(fallback = 'User'): string {
        const ctx = STEnvironmentDriver.ctx as any;
        if (ctx?.user?.name) return ctx.user.name;
        return ctx?.name1 || (STGlobalAccessor.stGlobal as any)?.name1 || fallback;
    }

    static getCharacterAvatar(name: string, defaultAvatar: string): string {
        if (!name) return defaultAvatar;

        const targetName = name || this.getAssistantName();
        const helper = STEnvironmentDriver.stHelper as any;
        const ctx = STEnvironmentDriver.ctx as any;
        const stMain = STEnvironmentDriver.stMain as any;
        const glob = STGlobalAccessor.stGlobal as any;

        if (ctx && typeof ctx.getCharAvatarPath === 'function') {
            const path = ctx.getCharAvatarPath(targetName);
            if (path) return path;
        }
        if (stMain && typeof stMain.getCharAvatarPath === 'function') {
            const path = stMain.getCharAvatarPath(targetName);
            if (path) return path;
        }
        if (helper && typeof helper.getCharAvatarPath === 'function') {
            const path = helper.getCharAvatarPath(targetName);
            if (path) return path;
        }

        const characters = STClient.getCharacters();
        const searchName = targetName.toLowerCase().trim();
        const character = characters.find((candidate: any) =>
            (candidate.name && candidate.name.toLowerCase().trim() === searchName) ||
            (candidate.original_name && candidate.original_name.toLowerCase().trim() === searchName)
        );

        if (!character?.avatar) return defaultAvatar;

        if (ctx && typeof ctx.getThumbnailUrl === 'function') {
            try {
                return ctx.getThumbnailUrl('avatar', character.avatar);
            } catch { /* ignore */ }
        }
        if (stMain && typeof stMain.getThumbnailUrl === 'function') {
            try {
                return stMain.getThumbnailUrl('avatar', character.avatar);
            } catch { /* ignore */ }
        }

        if (character.avatar.includes('.')) {
            return `/thumbnail?type=avatar&file=${encodeURIComponent(character.avatar)}`;
        }

        if (typeof glob?.getCharacterAvatar === 'function') {
            const path = glob.getCharacterAvatar(character.avatar);
            if (path) return path;
        }

        return defaultAvatar;
    }

    static getUserAvatar(userName: string | undefined, defaultAvatar: string): string {
        const ctx = STEnvironmentDriver.ctx as any;
        const stMain = STEnvironmentDriver.stMain as any;
        const glob = STGlobalAccessor.stGlobal as any;

        if (userName && ctx && Array.isArray(ctx.chat)) {
            const msg = ctx.chat
                .slice()
                .reverse()
                .find((candidate: any) => candidate.is_user && candidate.name === userName && candidate.force_avatar);
            if (msg?.force_avatar) {
                return msg.force_avatar.startsWith('http') || msg.force_avatar.startsWith('data:')
                    ? msg.force_avatar
                    : `/thumbnail?type=persona&file=${encodeURIComponent(msg.force_avatar)}`;
            }
        }

        const persona = glob?.user_avatar || ctx?.user?.avatar || 'user-default.png';
        if (persona.startsWith('http') || persona.startsWith('data:')) return persona;

        const getThumbnailUrl =
            typeof ctx?.getThumbnailUrl === 'function'
                ? ctx.getThumbnailUrl.bind(ctx)
                : (typeof stMain?.getThumbnailUrl === 'function' ? stMain.getThumbnailUrl.bind(stMain) : null);

        if (getThumbnailUrl) {
            try {
                return getThumbnailUrl('persona', persona);
            } catch (error) {
                console.warn('[LuminaWeave] getThumbnailUrl failed:', error);
            }
        }

        if (persona.includes('.') || persona === 'user-default.png') {
            return `/thumbnail?type=persona&file=${encodeURIComponent(persona)}`;
        }

        if (!persona || persona === 'default.png') return defaultAvatar;

        return persona.startsWith('/') || persona.includes('://') ? persona : `/${persona}`;
    }
}
