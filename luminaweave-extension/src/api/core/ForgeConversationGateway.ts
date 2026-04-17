import { watch, type WatchStopHandle } from 'vue';
import type { LuminaChatMessage } from '../../../../shared/LuminaMessage.js';
import type { ConversationTimelineNode } from '../../types/ConversationContextTypes.js';
import { useCardMakerStore } from '../../plugins/forge/CardMakerStore.js';
import type { WorldlineStore } from './WorldlineStore.js';

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

type ForgeConversationStoreLike = Pick<
    ReturnType<typeof useCardMakerStore>,
    | 'workspaceSessionId'
    | 'sessionChatId'
    | 'workspaceTitle'
    | 'selectedChatSessionId'
    | 'selectedChatSnapshotId'
    | 'activeLeafId'
    | 'timelineGraph'
    | 'messages'
    | 'messageCount'
    | 'timelineRevision'
    | 'workspaceUpdatedAt'
    | 'openWorkspaceSession'
    | 'switchToNode'
    | 'branchFromNode'
    | 'rollbackFromNode'
    | 'getWorldlineStore'
>;

export class ForgeConversationGateway {
    private getStore(): ForgeConversationStoreLike {
        return useCardMakerStore();
    }

    getCurrentSessionId(): string | null {
        const store = this.getStore();
        return store.workspaceSessionId || store.sessionChatId || null;
    }

    getLiveState(): ForgeConversationLiveState {
        const store = this.getStore();
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
        return this.getStore().getWorldlineStore?.() || null;
    }

    async openWorkspaceSession(sessionId: string): Promise<boolean> {
        return this.getStore().openWorkspaceSession(sessionId);
    }

    switchToNode(targetNodeId: string): void {
        this.getStore().switchToNode(targetNodeId);
    }

    async branchFromNode(targetNodeId: string): Promise<boolean> {
        return this.getStore().branchFromNode(targetNodeId);
    }

    async rollbackFromNode(targetNodeId: string): Promise<boolean> {
        return this.getStore().rollbackFromNode(targetNodeId);
    }

    watchConversationState(callback: () => void): WatchStopHandle {
        const store = this.getStore();
        return watch(
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
    }
}

export const forgeConversationGateway = new ForgeConversationGateway();
