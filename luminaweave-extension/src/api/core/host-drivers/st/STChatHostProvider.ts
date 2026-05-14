import {
    configureChatHostProvider,
    configureChatMessageListPort,
    type ChatMessageListPort,
    type ChatSessionCharacterMeta,
    type ChatSessionDescriptor,
    type ChatSessionDirectoryPort,
    type ChatSessionMutationResult
} from '../../conversation/ChatHostPorts.js';
import type {
    CreateChatConversationInput,
    DeleteChatConversationInput,
    RenameChatConversationInput
} from '../../../../types/ConversationContextTypes.js';
import { STConversationHostDriver } from './STConversationHostDriver.js';

class STChatSessionDirectoryProvider implements ChatSessionDirectoryPort {
    async listCharacterRoster(): Promise<Array<{
        characterId: string;
        characterName: string;
        characterAvatarUrl: string | null;
    }>> {
        return STConversationHostDriver.getCharacterRoster();
    }

    async openSession(target: ChatSessionDescriptor): Promise<boolean> {
        const result = await STConversationHostDriver.switchToCharacterChat({
            characterId: target.characterId,
            characterName: target.characterName || '',
            characterAvatarUrl: target.characterAvatarUrl ?? null,
            chatFile: target.sessionId
        });
        return Boolean(result.success);
    }

    async createSession(input: CreateChatConversationInput): Promise<ChatSessionMutationResult> {
        return STConversationHostDriver.createNewCharacterChat({
            characterId: input.characterId ?? null,
            characterName: input.characterName || '',
            characterAvatarUrl: input.characterAvatarUrl ?? null
        });
    }

    async renameSession(input: RenameChatConversationInput): Promise<ChatSessionMutationResult> {
        return STConversationHostDriver.renameCharacterChat({
            characterId: input.characterId ?? null,
            characterName: input.characterName || '',
            characterAvatarUrl: input.characterAvatarUrl ?? null,
            oldChatFile: input.sessionId,
            newChatTitle: input.nextTitle
        });
    }

    async deleteSession(input: DeleteChatConversationInput): Promise<ChatSessionMutationResult> {
        return STConversationHostDriver.deleteCharacterChat({
            characterId: input.characterId ?? null,
            characterName: input.characterName || '',
            characterAvatarUrl: input.characterAvatarUrl ?? null,
            chatFile: input.sessionId
        });
    }

    async closeCurrentSession(): Promise<boolean> {
        return STConversationHostDriver.closeCurrentChatView();
    }

    async resolveSessionCharacterMeta(
        sessionId: string,
        target: Partial<ChatSessionCharacterMeta> = {}
    ): Promise<ChatSessionCharacterMeta | null> {
        return STConversationHostDriver.getChatSessionCharacterMeta(sessionId, {
            characterId: target.characterId ?? null,
            characterName: target.characterName || '',
            characterAvatarUrl: target.characterAvatarUrl ?? null
        });
    }
}

const stMessageListPort: ChatMessageListPort = {
    getSnapshotSync: () => STConversationHostDriver.getSnapshotSync(),
    getSnapshot: (options) => STConversationHostDriver.getSnapshot(options)
};

let registered = false;

export function registerSTChatHostProvider(): void {
    if (registered) return;
    registered = true;
    configureChatHostProvider(new STChatSessionDirectoryProvider());
    configureChatMessageListPort(stMessageListPort);
}
