import { LuminaChatMessage } from '@shared/LuminaMessage.js';
import { getChatMessageListPort, type ChatMessageSnapshot } from './ChatHostPorts.js';

export class MessageListGateway {
    private static createEmptySnapshot(): ChatMessageSnapshot {
        return {
            raw: [],
            lumina: [],
            idToIndex: new Map()
        };
    }

    static getSnapshotSync(): ChatMessageSnapshot {
        return getChatMessageListPort().getSnapshotSync();
    }

    static getLuminaMessagesSync(): LuminaChatMessage[] {
        return this.getSnapshotSync().lumina;
    }

    static resolveIndexByIdSync(targetId: string, snapshot?: ChatMessageSnapshot): number | null {
        if (!targetId) return null;
        const snap = snapshot ?? this.getSnapshotSync();
        const idx = snap.idToIndex.get(targetId);
        return idx === undefined ? null : idx;
    }

    static async getSnapshot(options: { ensureStableIds?: boolean } = {}): Promise<ChatMessageSnapshot> {
        return getChatMessageListPort().getSnapshot(options);
    }

    static async getLuminaMessages(options: { ensureStableIds?: boolean } = {}): Promise<LuminaChatMessage[]> {
        const snap = await this.getSnapshot(options);
        return snap.lumina;
    }

    static async resolveIndexById(targetId: string, snapshot?: ChatMessageSnapshot): Promise<number | null> {
        if (!targetId) return null;
        const snap = snapshot ?? await this.getSnapshot();
        const idx = snap.idToIndex.get(targetId);
        return idx === undefined ? null : idx;
    }
}
