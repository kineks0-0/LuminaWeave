import { LuminaWeaveAPIBase } from '../core/LuminaWeaveAPIBase.js';
import type { ChatManager } from '../core/ChatManager.js';
import type { LuminaChatMessage } from '@shared/LuminaMessage.js';

type ChatDebugHost = LuminaWeaveAPIBase & {
    chatManager: ChatManager;
    commitToST(): Promise<void>;
    saveToIndependentChat(): Promise<void>;
};

export class ChatDebugGateway {
    constructor(private readonly api: ChatDebugHost) {}

    getActiveLeafId(): string | null {
        return this.api.chatManager.activeLeafId;
    }

    listNodes(): LuminaChatMessage[] {
        return this.api.chatManager.store.nodePool || [];
    }

    getNode(nodeId: string): LuminaChatMessage | undefined {
        return this.api.chatManager.store.getNode(nodeId);
    }

    getChildren(nodeId: string): LuminaChatMessage[] {
        return this.api.chatManager.store.getChildren(nodeId);
    }

    getSnapshotNodes(): LuminaChatMessage[] {
        return this.api.chatManager.getSnapshotNodes();
    }

    upsertNode(node: LuminaChatMessage): void {
        this.api.chatManager.store.upsertNode(node);
    }

    removeSubtree(nodeId: string): void {
        this.api.chatManager.store.removeSubtree(nodeId);
    }

    async persistCurrentChat(): Promise<void> {
        await this.api.commitToST();
        await this.api.saveToIndependentChat();
    }
}
