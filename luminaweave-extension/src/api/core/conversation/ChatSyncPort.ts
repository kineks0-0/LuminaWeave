import type { WorldlineStore } from '../storage/WorldlineStore.js';

export interface ChatSyncPort {
    isHostLoading: boolean;
    isSTLoading: boolean;
    isSTGenerating: boolean;
    isAutoSyncPaused: boolean;
    syncFromHost(options?: { forceOverwrite?: boolean }): Promise<{ totalDiff: number; details?: unknown }>;
    commitToHost(): Promise<void>;
    syncFromST(options?: { forceOverwrite?: boolean }): Promise<{ totalDiff: number; details?: unknown }>;
    commitToST(): Promise<void>;
    pauseAutoSync(): void;
    resumeAutoSync(): void;
}

class EmptyChatSyncPort implements ChatSyncPort {
    isHostLoading = false;
    isSTLoading = false;
    isSTGenerating = false;
    isAutoSyncPaused = false;

    async syncFromHost(): Promise<{ totalDiff: number; details?: unknown }> {
        return { totalDiff: 0, details: null };
    }

    async commitToHost(): Promise<void> {}

    async syncFromST(): Promise<{ totalDiff: number; details?: unknown }> {
        return this.syncFromHost();
    }

    async commitToST(): Promise<void> {
        return this.commitToHost();
    }

    pauseAutoSync(): void {
        this.isAutoSyncPaused = true;
    }

    resumeAutoSync(): void {
        this.isAutoSyncPaused = false;
    }
}

let chatSyncPortFactory: (store: WorldlineStore) => ChatSyncPort = () => new EmptyChatSyncPort();

export function configureChatSyncPortFactory(factory: (store: WorldlineStore) => ChatSyncPort): void {
    chatSyncPortFactory = factory;
}

export function createChatSyncPort(store: WorldlineStore): ChatSyncPort {
    return chatSyncPortFactory(store);
}
