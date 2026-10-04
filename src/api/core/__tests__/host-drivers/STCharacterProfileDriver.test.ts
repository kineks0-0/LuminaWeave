import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { STCharacterProfileDriver } from '@/api/core/host-drivers/st/STCharacterProfileDriver.js';
import { STGlobalAccessor } from '@/api/core/host-drivers/st/STGlobalAccessor.js';

describe('STCharacterProfileDriver', () => {
    let helper: any;
    let stMain: any;
    let ctx: any;
    let stGlobal: any;

    beforeEach(() => {
        helper = undefined;
        stMain = undefined;
        ctx = undefined;
        stGlobal = {};
        vi.spyOn(STGlobalAccessor, 'stHelper', 'get').mockImplementation(() => helper);
        vi.spyOn(STGlobalAccessor, 'stMain', 'get').mockImplementation(() => stMain as any);
        vi.spyOn(STGlobalAccessor, 'ctx', 'get').mockImplementation(() => ctx as any);
        vi.spyOn(STGlobalAccessor, 'stGlobal', 'get').mockImplementation(() => stGlobal as any);
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('getAssistantName should prefer the helper current character name', () => {
        helper = { getCurrentCharacterName: () => 'Beta' };
        ctx = { characterId: 0, characters: [{ name: 'Alpha' }], name2: 'Alpha' };

        expect(STCharacterProfileDriver.getAssistantName()).toBe('Beta');
    });

    it('getAssistantName should fall back to host context', () => {
        ctx = { characterId: 0, characters: [{ name: 'Alpha' }], name2: 'Alpha' };

        expect(STCharacterProfileDriver.getAssistantName()).toBe('Alpha');
    });

    it('getUserName should prefer the helper current persona name', () => {
        helper = { getCurrentPersonaName: () => 'PersonaB' };
        ctx = { user: { name: 'PersonaA' }, name1: 'PersonaA' };

        expect(STCharacterProfileDriver.getUserName()).toBe('PersonaB');
    });

    it('getUserAvatar should prefer the helper persona avatar path without message overrides', () => {
        helper = { getPersonaAvatarPath: () => '/persona/path.png' };
        stGlobal = { user_avatar: 'glob.png' };
        ctx = {};

        expect(STCharacterProfileDriver.getUserAvatar('User', 'default.png')).toBe('/persona/path.png');
    });

    it('getUserAvatar should keep per-message force_avatar as highest priority', () => {
        helper = { getPersonaAvatarPath: () => '/persona/path.png' };
        ctx = { chat: [{ is_user: true, name: 'User', force_avatar: 'override.png' }] };

        expect(STCharacterProfileDriver.getUserAvatar('User', 'default.png'))
            .toBe('/thumbnail?type=persona&file=override.png');
    });

    it('getCharacterAvatar should prefer helper.getCharAvatarPath', () => {
        helper = { getCharAvatarPath: (name: string) => `/avatars/${name}.png` };

        expect(STCharacterProfileDriver.getCharacterAvatar('Alpha', 'default.png')).toBe('/avatars/Alpha.png');
    });
});
