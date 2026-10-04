import { readCharacterAvatarDataUrl } from '@shared/resources/index.js';
import { resourceService } from '../../hal/resource/index.js';
import { HALContext } from '../../hal/HALContext.js';
import type { ChatSessionCharacterMeta } from '../../conversation/ChatHostPorts.js';

export interface StandaloneCharacterSummary {
    characterId: string;
    characterName: string;
    characterAvatarUrl: string | null;
}

let cachedCharacters: StandaloneCharacterSummary[] = [];

/**
 * 列出本地角色资源并刷新同步缓存。
 * 同步缓存供 ConversationHostFacadePort 的同步接口消费。
 */
export const listStandaloneCharacters = async (): Promise<StandaloneCharacterSummary[]> => {
    const documents = await resourceService.listResources({ sourceId: 'local', resourceType: 'character' });
    cachedCharacters = documents.map((document) => ({
        characterId: document.ref.resourceId,
        characterName: document.summary.name,
        characterAvatarUrl: readCharacterAvatarDataUrl(document.raw)
    }));
    return cachedCharacters;
};

export const getCachedStandaloneCharacters = (): StandaloneCharacterSummary[] => cachedCharacters;

export const findCachedStandaloneCharacter = (
    predicate: (character: StandaloneCharacterSummary) => boolean
): StandaloneCharacterSummary | null => cachedCharacters.find(predicate) ?? null;

export const resetStandaloneCharacterCacheForTests = (): void => {
    cachedCharacters = [];
};

export const resolveStandaloneSessionCharacterMeta = async (
    sessionId: string,
    target: Partial<ChatSessionCharacterMeta> = {}
): Promise<ChatSessionCharacterMeta | null> => {
    try {
        const result = await HALContext.instance.runtime.conversation.getConversation(sessionId);
        const chat = result.document?.pluginState.chat;
        if (chat) {
            return {
                characterId: chat.characterId ?? target.characterId ?? null,
                characterName: chat.characterName ?? target.characterName ?? null,
                characterAvatarUrl: chat.characterAvatarUrl ?? target.characterAvatarUrl ?? null
            };
        }
    } catch {
        // 会话不存在时退回调用方提供的 meta。
    }
    return {
        characterId: target.characterId ?? null,
        characterName: target.characterName ?? null,
        characterAvatarUrl: target.characterAvatarUrl ?? null
    };
};
