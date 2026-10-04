import { MessageUtils, type LuminaChatMessage } from '@shared/LuminaMessage.js';
import { createPrefixedId, slugifyId } from '@shared/CommonUtils.js';
import {
    buildSourceResourcePath,
    resolveCharacterCardSource,
    resolveCharacterMacros
} from '@shared/resources/index.js';
import { resourceService } from '../../hal/resource/index.js';
import type {
    ChatSessionCharacterMeta,
    ChatSessionDescriptor,
    ChatSessionDirectoryPort,
    ChatSessionMutationResult
} from '../../conversation/ChatHostPorts.js';
import type {
    CreateChatConversationInput,
    DeleteChatConversationInput,
    DuplicateChatConversationInput,
    RenameChatConversationInput
} from '../../../../types/ConversationContextTypes.js';
import {
    clearStandaloneChatContext,
    getStandaloneChatContext,
    setStandaloneChatContext
} from './StandaloneChatContext.js';
import {
    listStandaloneCharacters,
    resolveStandaloneSessionCharacterMeta
} from './StandaloneCharacterDirectory.js';
import { readStandaloneUserName } from './StandalonePersona.js';

const readFirstMessage = (raw: unknown): string => {
    const source = resolveCharacterCardSource(raw);
    const value = source.first_mes ?? source.firstMessage;
    return typeof value === 'string' ? value : '';
};

const buildChatId = (characterId: string | null): string =>
    createPrefixedId(`lw_chat_${slugifyId(characterId ?? '', 'chat').slice(0, 32)}`);

/**
 * standalone 会话目录：角色来自本地资源，会话是本地 ConversationDocument。
 * 通过 StandaloneChatContext 指针让 lwStorage / 生成链路获得“当前会话”。
 */
export class StandaloneChatSessionDirectoryProvider implements ChatSessionDirectoryPort {
    readonly supportsCharacterImport = true;

    async listCharacterRoster(): Promise<Array<{
        characterId: string;
        characterName: string;
        characterAvatarUrl: string | null;
    }>> {
        return listStandaloneCharacters();
    }

    async openSession(target: ChatSessionDescriptor): Promise<boolean> {
        setStandaloneChatContext({
            chatId: target.sessionId,
            characterId: target.characterId == null ? null : String(target.characterId),
            characterName: target.characterName ?? '',
            characterAvatarUrl: target.characterAvatarUrl ?? null
        });
        return true;
    }

    async createSession(input: CreateChatConversationInput): Promise<ChatSessionMutationResult> {
        const characterId = input.characterId == null ? null : String(input.characterId);
        const characterName = input.characterName?.trim() || '';
        const characterAvatarUrl = input.characterAvatarUrl ?? null;
        const chatId = buildChatId(characterId);

        setStandaloneChatContext({ chatId, characterId, characterName, characterAvatarUrl });

        return {
            success: true,
            resolvedCharacterId: characterId,
            resolvedCharacterName: characterName,
            resolvedCharacterAvatarUrl: characterAvatarUrl,
            resolvedChatFile: chatId,
            initialNodes: await this.buildGreetingNodes(characterId, characterName)
        };
    }

    async renameSession(input: RenameChatConversationInput): Promise<ChatSessionMutationResult> {
        return {
            success: true,
            resolvedCharacterId: input.characterId == null ? null : String(input.characterId),
            resolvedCharacterName: input.characterName ?? null,
            resolvedCharacterAvatarUrl: input.characterAvatarUrl ?? null,
            resolvedChatFile: input.sessionId,
            previousChatFile: input.sessionId
        };
    }

    async deleteSession(input: DeleteChatConversationInput): Promise<ChatSessionMutationResult> {
        const pointer = getStandaloneChatContext();
        if (pointer?.chatId === input.sessionId) {
            clearStandaloneChatContext();
        }
        return {
            success: true,
            resolvedCharacterId: input.characterId == null ? null : String(input.characterId),
            resolvedCharacterName: input.characterName ?? null,
            resolvedCharacterAvatarUrl: input.characterAvatarUrl ?? null,
            resolvedChatFile: input.sessionId
        };
    }

    async duplicateSession(input: DuplicateChatConversationInput): Promise<ChatSessionMutationResult> {
        const characterId = input.characterId == null ? null : String(input.characterId);
        return {
            success: true,
            resolvedCharacterId: characterId,
            resolvedCharacterName: input.characterName ?? null,
            resolvedCharacterAvatarUrl: input.characterAvatarUrl ?? null,
            resolvedChatFile: buildChatId(characterId),
            previousChatFile: input.sessionId
        };
    }

    async closeCurrentSession(): Promise<boolean> {
        clearStandaloneChatContext();
        return true;
    }

    async resolveSessionCharacterMeta(
        sessionId: string,
        target: Partial<ChatSessionCharacterMeta> = {}
    ): Promise<ChatSessionCharacterMeta | null> {
        return resolveStandaloneSessionCharacterMeta(sessionId, target);
    }

    private async buildGreetingNodes(
        characterId: string | null,
        characterName: string
    ): Promise<LuminaChatMessage[]> {
        if (!characterId) return [];

        let firstMessage = '';
        try {
            const document = await resourceService.getResource({
                sourceId: 'local',
                resourceType: 'character',
                resourceId: characterId,
                path: buildSourceResourcePath('local', 'character', characterId),
                writable: true
            });
            firstMessage = readFirstMessage(document?.raw);
        } catch {
            return [];
        }

        if (!firstMessage.trim()) return [];

        const content = resolveCharacterMacros(firstMessage, {
            userName: readStandaloneUserName(),
            charName: characterName
        });

        return [{
            id: MessageUtils.generateNodeId(),
            parentId: null,
            name: characterName || 'Assistant',
            role: 'assistant',
            is_user: false,
            mesRaw: content,
            mes: content,
            mesST: content,
            pluginRaw: content,
            fingerprint: '',
            characterId,
            extra: { role: 'assistant' }
        }];
    }
}
