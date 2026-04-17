import { lwStorage } from '../storage.js';
import type { PersistenceService } from './PersistenceService.js';
import type { WorldlineStore } from './WorldlineStore.js';
import { LuminaWeaveAPIBase } from './LuminaWeaveAPIBase.js';

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
    constructor(private readonly api: ChatConversationHost) {}

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
}
