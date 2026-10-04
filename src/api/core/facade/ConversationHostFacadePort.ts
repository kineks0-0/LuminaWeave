import type { ChatSessionCharacterMeta } from '../conversation/ChatHostPorts.js';

export interface ConversationHostFacadePort {
    getPresets(type: string): string[];
    getActivePresetName(type: string): string | null;
    selectPreset(type: string, name: string): void | Promise<void> | boolean | Promise<boolean>;
    /** 当前宿主生成引擎类型（ST mainApi，如 openai/kobold）；非 ST 宿主返回空串。 */
    getMainApi(): string;
    getAssistantName(fallback?: string): string;
    getUserName(fallback?: string): string;
    getCharacterNames(): string[];
    getCharacterNameById(characterId: string | number | null | undefined): string | null;
    getCharacterRoster(): Array<{
        characterId: string;
        characterName: string;
        characterAvatarUrl: string | null;
    }>;
    getChatSessionCharacterMeta(
        chatFile: string | null | undefined,
        target?: Partial<ChatSessionCharacterMeta>
    ): Promise<ChatSessionCharacterMeta | null>;
    getCharacterAvatar(name?: string, fallback?: string): string;
    getUserAvatar(userName?: string, fallback?: string): string;
}

class EmptyConversationHostFacadePort implements ConversationHostFacadePort {
    getPresets(): string[] { return []; }
    getActivePresetName(): string | null { return null; }
    selectPreset(): boolean { return false; }
    getMainApi(): string { return ''; }
    getAssistantName(fallback = 'Assistant'): string { return fallback; }
    getUserName(fallback = 'User'): string { return fallback; }
    getCharacterNames(): string[] { return []; }
    getCharacterNameById(): string | null { return null; }
    getCharacterRoster(): Array<{ characterId: string; characterName: string; characterAvatarUrl: string | null }> { return []; }
    async getChatSessionCharacterMeta(_chatFile: string | null | undefined, target: Partial<ChatSessionCharacterMeta> = {}): Promise<ChatSessionCharacterMeta | null> {
        return {
            characterId: target.characterId ?? null,
            characterName: target.characterName ?? null,
            characterAvatarUrl: target.characterAvatarUrl ?? null
        };
    }
    getCharacterAvatar(_name?: string, fallback = ''): string { return fallback; }
    getUserAvatar(_userName?: string, fallback = ''): string { return fallback; }
}

let conversationHostFacadePort: ConversationHostFacadePort = new EmptyConversationHostFacadePort();

export function configureConversationHostFacadePort(port: ConversationHostFacadePort): void {
    conversationHostFacadePort = port;
}

export function getConversationHostFacadePort(): ConversationHostFacadePort {
    return conversationHostFacadePort;
}
