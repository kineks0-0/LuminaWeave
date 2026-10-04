import type {
    ChatSessionCharacterMeta
} from '../../conversation/ChatHostPorts.js';
import type { ConversationHostFacadePort } from '../../facade/ConversationHostFacadePort.js';
import {
    findCachedStandaloneCharacter,
    getCachedStandaloneCharacters,
    listStandaloneCharacters,
    resolveStandaloneSessionCharacterMeta
} from './StandaloneCharacterDirectory.js';
import { getStandaloneChatContext } from './StandaloneChatContext.js';
import { readStandaloneUserName } from './StandalonePersona.js';

/**
 * standalone 的角色 / persona facade。
 * 角色来自本地资源缓存；当前角色名来自 StandaloneChatContext 指针。
 */
export class StandaloneConversationHostFacadePort implements ConversationHostFacadePort {
    getPresets(): string[] {
        return [];
    }

    getActivePresetName(): string | null {
        return null;
    }

    selectPreset(): boolean {
        return false;
    }

    getMainApi(): string {
        return '';
    }

    getAssistantName(fallback = 'Assistant'): string {
        const name = getStandaloneChatContext()?.characterName?.trim();
        return name || fallback;
    }

    getUserName(fallback = 'User'): string {
        return readStandaloneUserName(fallback);
    }

    getCharacterNames(): string[] {
        return getCachedStandaloneCharacters().map((character) => character.characterName);
    }

    getCharacterNameById(characterId: string | number | null | undefined): string | null {
        if (characterId == null) return null;
        const key = String(characterId);
        const pointer = getStandaloneChatContext();
        if (pointer?.characterId === key && pointer.characterName.trim()) {
            return pointer.characterName.trim();
        }
        return findCachedStandaloneCharacter((character) => character.characterId === key)?.characterName ?? null;
    }

    getCharacterRoster(): Array<{
        characterId: string;
        characterName: string;
        characterAvatarUrl: string | null;
    }> {
        const cached = getCachedStandaloneCharacters();
        if (cached.length === 0) {
            void listStandaloneCharacters();
        }
        return cached.map((character) => ({ ...character }));
    }

    async getChatSessionCharacterMeta(
        chatFile: string | null | undefined,
        target: Partial<ChatSessionCharacterMeta> = {}
    ): Promise<ChatSessionCharacterMeta | null> {
        if (!chatFile) {
            return {
                characterId: target.characterId ?? null,
                characterName: target.characterName ?? null,
                characterAvatarUrl: target.characterAvatarUrl ?? null
            };
        }
        return resolveStandaloneSessionCharacterMeta(chatFile, target);
    }

    getCharacterAvatar(name?: string, fallback = ''): string {
        const trimmed = name?.trim();
        if (!trimmed) return fallback;
        const character = findCachedStandaloneCharacter((item) => item.characterName === trimmed);
        return character?.characterAvatarUrl || fallback;
    }

    getUserAvatar(_userName?: string, fallback = ''): string {
        return fallback;
    }
}
