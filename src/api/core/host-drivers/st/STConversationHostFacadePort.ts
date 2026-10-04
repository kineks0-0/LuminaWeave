import type { ChatSessionCharacterMeta } from '../../conversation/ChatHostPorts.js';
import { configureConversationHostFacadePort, type ConversationHostFacadePort } from '../../facade/ConversationHostFacadePort.js';
import { STCharacterProfileDriver } from './STCharacterProfileDriver.js';
import { STConversationHostDriver } from './STConversationHostDriver.js';

class STConversationHostFacadePort implements ConversationHostFacadePort {
    getPresets(type: string): string[] {
        return STConversationHostDriver.getPresets(type);
    }

    getActivePresetName(type: string): string | null {
        return STConversationHostDriver.getActivePresetName(type);
    }

    selectPreset(type: string, name: string): void {
        STConversationHostDriver.selectPreset(type, name);
    }

    getMainApi(): string {
        return STConversationHostDriver.getMainApi();
    }

    getAssistantName(fallback = 'Assistant'): string {
        return STCharacterProfileDriver.getAssistantName(fallback);
    }

    getUserName(fallback = 'User'): string {
        return STCharacterProfileDriver.getUserName(fallback);
    }

    getCharacterNames(): string[] {
        return STConversationHostDriver.getCharacterNames();
    }

    getCharacterNameById(characterId: string | number | null | undefined): string | null {
        return STConversationHostDriver.getCharacterNameById(characterId);
    }

    getCharacterRoster(): Array<{
        characterId: string;
        characterName: string;
        characterAvatarUrl: string | null;
    }> {
        return STConversationHostDriver.getCharacterRoster();
    }

    getChatSessionCharacterMeta(
        chatFile: string | null | undefined,
        target: Partial<ChatSessionCharacterMeta> = {}
    ): Promise<ChatSessionCharacterMeta | null> {
        return STConversationHostDriver.getChatSessionCharacterMeta(chatFile, {
            characterId: target.characterId ?? null,
            characterName: target.characterName ?? undefined,
            characterAvatarUrl: target.characterAvatarUrl ?? null
        });
    }

    getCharacterAvatar(name?: string, fallback = ''): string {
        return STCharacterProfileDriver.getCharacterAvatar(name || '', fallback);
    }

    getUserAvatar(userName?: string, fallback = ''): string {
        return STCharacterProfileDriver.getUserAvatar(userName, fallback);
    }
}

let registered = false;

export function registerSTConversationHostFacadePort(): void {
    if (registered) return;
    configureConversationHostFacadePort(new STConversationHostFacadePort());
    registered = true;
}
