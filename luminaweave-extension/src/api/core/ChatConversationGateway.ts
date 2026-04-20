import { lwStorage } from '../storage.js';
import type { PersistenceService } from './PersistenceService.js';
import type { WorldlineStore } from './WorldlineStore.js';
import { LuminaWeaveAPIBase } from './LuminaWeaveAPIBase.js';
import { BridgeDispatcher } from '@shared/api/BridgeDispatcher.js';
import { createEmptyConversationDocument } from '@shared/ConversationTypes.js';
import { buildTitleAndSummary } from './ChatSessionIndexService.js';
import {
    compositeChatHostProvider,
    type CompositeChatHostProvider
} from './chat-host/ChatHostPorts.js';
import type {
    CreateChatConversationInput,
    CreateChatConversationResult,
    DeleteChatConversationInput,
    DeleteChatConversationResult,
    RenameChatConversationInput,
    RenameChatConversationResult
} from '../../types/ConversationContextTypes.js';

type ChatConversationHost = LuminaWeaveAPIBase & {
    chatManager: {
        store: WorldlineStore;
        activeLeafId: string | null;
        persistence: PersistenceService;
        branchFromNode(targetNodeId: string): Promise<boolean>;
        rollbackFromNode(targetNodeId: string): Promise<boolean>;
    };
};

export class ChatConversationGateway {
    constructor(
        private readonly api: ChatConversationHost,
        private readonly hostProvider: CompositeChatHostProvider = compositeChatHostProvider
    ) {}

    private isIgnorableConversationDeleteError(error: unknown): boolean {
        const message = error instanceof Error ? error.message : String(error ?? '');
        const normalized = message.toLowerCase();
        return normalized.includes('not found')
            || normalized.includes('chat not found')
            || normalized.includes('failed to delete chat');
    }

    private async deleteConversationDocumentIfPresent(id: string): Promise<void> {
        try {
            await BridgeDispatcher.conversation.deleteConversation(id);
        } catch (error) {
            if (!this.isIgnorableConversationDeleteError(error)) {
                throw error;
            }
        }
    }

    getCurrentChatId(): string | null {
        return lwStorage._getContextIds().chatId || null;
    }

    getLiveStore(): WorldlineStore {
        return this.api.chatManager.store;
    }

    getLivePersistence(): PersistenceService {
        return this.api.chatManager.persistence;
    }

    getActiveLeafId(): string | null {
        return this.api.chatManager.activeLeafId;
    }

    async branchFromNode(targetNodeId: string): Promise<boolean> {
        return this.api.chatManager.branchFromNode(targetNodeId);
    }

    async rollbackFromNode(targetNodeId: string): Promise<boolean> {
        return this.api.chatManager.rollbackFromNode(targetNodeId);
    }

    async createSession(input: CreateChatConversationInput): Promise<CreateChatConversationResult> {
        const creation = await this.hostProvider.createSession(input);

        if (!creation.success || !creation.resolvedChatFile) {
            throw new Error(creation.reason || 'chat_session_create_failed');
        }

        const { title } = buildTitleAndSummary(creation.resolvedChatFile, '');
        const document = createEmptyConversationDocument({
            id: creation.resolvedChatFile,
            conversationType: 'chat',
            title,
            pluginState: {
                chat: {
                    characterId: creation.resolvedCharacterId,
                    characterName: creation.resolvedCharacterName || '',
                    characterAvatarUrl: creation.resolvedCharacterAvatarUrl ?? null
                }
            }
        });

        await BridgeDispatcher.conversation.saveConversation(creation.resolvedChatFile, document);

        return {
            sessionId: creation.resolvedChatFile,
            title: document.title,
            characterId: creation.resolvedCharacterId,
            characterName: creation.resolvedCharacterName || '',
            characterAvatarUrl: creation.resolvedCharacterAvatarUrl ?? null
        };
    }

    async renameSession(input: RenameChatConversationInput): Promise<RenameChatConversationResult> {
        const renamed = await this.hostProvider.renameSession(input);

        if (!renamed.success || !renamed.resolvedChatFile) {
            throw new Error(renamed.reason || 'chat_session_rename_failed');
        }

        const current = await BridgeDispatcher.conversation.getConversation(input.sessionId);
        const fallbackTitle = buildTitleAndSummary(renamed.resolvedChatFile, '').title;
        const previous = current.document || createEmptyConversationDocument({
            id: input.sessionId,
            conversationType: 'chat',
            title: fallbackTitle
        });
        const nextDocument = {
            ...previous,
            id: renamed.resolvedChatFile,
            title: input.nextTitle.trim(),
            updatedAt: Date.now(),
            pluginState: {
                ...previous.pluginState,
                chat: {
                    ...previous.pluginState.chat,
                    characterId: renamed.resolvedCharacterId,
                    characterName: renamed.resolvedCharacterName || input.characterName || '',
                    characterAvatarUrl: renamed.resolvedCharacterAvatarUrl ?? input.characterAvatarUrl ?? null
                }
            }
        };

        await BridgeDispatcher.conversation.saveConversation(renamed.resolvedChatFile, nextDocument);
        if (renamed.resolvedChatFile !== input.sessionId) {
            await this.deleteConversationDocumentIfPresent(input.sessionId);
        }

        return {
            previousSessionId: input.sessionId,
            sessionId: renamed.resolvedChatFile,
            title: nextDocument.title,
            characterId: renamed.resolvedCharacterId,
            characterName: renamed.resolvedCharacterName || input.characterName || '',
            characterAvatarUrl: renamed.resolvedCharacterAvatarUrl ?? input.characterAvatarUrl ?? null
        };
    }

    async deleteSession(input: DeleteChatConversationInput): Promise<DeleteChatConversationResult> {
        const deleted = await this.hostProvider.deleteSession(input);

        if (!deleted.success) {
            throw new Error(deleted.reason || 'chat_session_delete_failed');
        }

        await this.deleteConversationDocumentIfPresent(input.sessionId);

        return {
            sessionId: input.sessionId,
            characterId: deleted.resolvedCharacterId,
            characterName: deleted.resolvedCharacterName || input.characterName || '',
            characterAvatarUrl: deleted.resolvedCharacterAvatarUrl ?? input.characterAvatarUrl ?? null
        };
    }
}
