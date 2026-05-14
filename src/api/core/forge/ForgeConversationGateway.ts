import { watch, type WatchStopHandle } from 'vue';
import type { LuminaChatMessage } from '@shared/LuminaMessage.js';
import type { ConversationTimelineNode } from '../../../types/ConversationContextTypes.js';
import type { WorldlineStore } from '../storage/WorldlineStore.js';

export interface ForgeConversationLiveState {
    workspaceSessionId: string;
    sessionChatId: string;
    workspaceTitle: string;
    selectedChatSessionId: string | null;
    selectedChatSnapshotId: string | null;
    activeLeafId: string | null;
    timelineGraph: Record<string, ConversationTimelineNode>;
    messages: LuminaChatMessage[];
    messageCount: number;
    timelineRevision: number;
    workspaceUpdatedAt: number;
}

export interface ForgeConversationStoreLike {
    workspaceSessionId: string;
    sessionChatId: string;
    workspaceTitle: string;
    selectedChatSessionId: string | null;
    selectedChatSnapshotId: string | null;
    activeLeafId: string | null;
    timelineGraph: Record<string, ConversationTimelineNode>;
    messages: LuminaChatMessage[];
    messageCount: number;
    timelineRevision: number;
    workspaceUpdatedAt: number;
    openWorkspaceSession(sessionId: string): Promise<boolean>;
    switchToNode(targetNodeId: string): void;
    branchFromNode(targetNodeId: string): Promise<boolean>;
    rollbackFromNode(targetNodeId: string): Promise<boolean>;
    getWorldlineStore?(): WorldlineStore | null;
}

export type ForgeConversationStoreProvider = () => ForgeConversationStoreLike;

const createEmptyLiveState = (): ForgeConversationLiveState => ({
    workspaceSessionId: '',
    sessionChatId: '',
    workspaceTitle: 'Forge',
    selectedChatSessionId: null,
    selectedChatSnapshotId: null,
    activeLeafId: null,
    timelineGraph: {},
    messages: [],
    messageCount: 0,
    timelineRevision: 0,
    workspaceUpdatedAt: 0
});

export class ForgeConversationGateway {
    private storeProvider: ForgeConversationStoreProvider | null = null;
    private readonly stateWatchers = new Set<() => void>();
    private readonly watcherStops = new Map<() => void, WatchStopHandle>();

    setStoreProvider(provider: ForgeConversationStoreProvider): void {
        this.storeProvider = provider;
        this.stateWatchers.forEach(callback => this.ensureWatcher(callback));
    }

    private getStore(): ForgeConversationStoreLike | null {
        return this.storeProvider?.() || null;
    }

    private ensureWatcher(callback: () => void): void {
        if (this.watcherStops.has(callback)) {
            return;
        }

        const store = this.getStore();
        if (!store) {
            return;
        }

        const stop = watch(
            () => [
                store.timelineRevision,
                store.workspaceSessionId,
                store.activeLeafId,
                store.messageCount,
                store.workspaceTitle,
                store.workspaceUpdatedAt
            ],
            () => callback(),
            { flush: 'post' }
        );
        this.watcherStops.set(callback, stop);
    }

    getCurrentSessionId(): string | null {
        const store = this.getStore();
        if (!store) return null;
        return store.workspaceSessionId || store.sessionChatId || null;
    }

    getLiveState(): ForgeConversationLiveState {
        const store = this.getStore();
        if (!store) return createEmptyLiveState();
        return {
            workspaceSessionId: store.workspaceSessionId,
            sessionChatId: store.sessionChatId,
            workspaceTitle: store.workspaceTitle,
            selectedChatSessionId: store.selectedChatSessionId,
            selectedChatSnapshotId: store.selectedChatSnapshotId,
            activeLeafId: store.activeLeafId,
            timelineGraph: store.timelineGraph,
            messages: store.messages,
            messageCount: store.messageCount,
            timelineRevision: store.timelineRevision,
            workspaceUpdatedAt: store.workspaceUpdatedAt
        };
    }

    getWorldlineStore(): WorldlineStore | null {
        return this.getStore()?.getWorldlineStore?.() || null;
    }

    async openWorkspaceSession(sessionId: string): Promise<boolean> {
        return this.getStore()?.openWorkspaceSession(sessionId) || false;
    }

    switchToNode(targetNodeId: string): void {
        this.getStore()?.switchToNode(targetNodeId);
    }

    async branchFromNode(targetNodeId: string): Promise<boolean> {
        return this.getStore()?.branchFromNode(targetNodeId) || false;
    }

    async rollbackFromNode(targetNodeId: string): Promise<boolean> {
        return this.getStore()?.rollbackFromNode(targetNodeId) || false;
    }

    watchConversationState(callback: () => void): WatchStopHandle {
        this.stateWatchers.add(callback);
        this.ensureWatcher(callback);
        return () => {
            this.stateWatchers.delete(callback);
            this.watcherStops.get(callback)?.();
            this.watcherStops.delete(callback);
        };
    }
}

export const forgeConversationGateway = new ForgeConversationGateway();
