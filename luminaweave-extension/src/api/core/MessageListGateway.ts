import { LuminaChatMessage } from '../../../../shared/LuminaMessage.js';
import { STClient, STMessageUpdate } from './st-adapter/STClient.js';
import { STProtocol } from './st-adapter/STProtocol.js';

export type STMessageSnapshot = {
    raw: ChatMessage[];
    lumina: LuminaChatMessage[];
    idToIndex: Map<string, number>;
};

export class MessageListGateway {
    static getSnapshotSync(): STMessageSnapshot {
        const raw = STClient.getRawMessages({ includeSwipes: true }) as ChatMessage[];
        const idToIndex = new Map<string, number>();

        for (let i = 0; i < raw.length; i++) {
            const { id } = STProtocol.identifyMessage(raw[i]);
            if (!idToIndex.has(id)) idToIndex.set(id, i);
        }

        const lumina = this.convertRawToLumina(raw);
        return { raw, lumina, idToIndex };
    }

    static getLuminaMessagesSync(): LuminaChatMessage[] {
        return this.getSnapshotSync().lumina;
    }

    static resolveIndexByIdSync(targetId: string, snapshot?: STMessageSnapshot): number | null {
        if (!targetId) return null;
        const snap = snapshot ?? this.getSnapshotSync();
        const idx = snap.idToIndex.get(targetId);
        return idx === undefined ? null : idx;
    }

    static async getSnapshot(options: { ensureStableIds?: boolean } = {}): Promise<STMessageSnapshot> {
        let raw = STClient.getRawMessages({ includeSwipes: true }) as ChatMessage[];
        if (options.ensureStableIds) {
            const changed = await this.ensureStableIds(raw);
            if (changed) {
                raw = STClient.getRawMessages({ includeSwipes: true }) as ChatMessage[];
            }
        }

        const idToIndex = new Map<string, number>();
        for (let i = 0; i < raw.length; i++) {
            const { id } = STProtocol.identifyMessage(raw[i]);
            if (!idToIndex.has(id)) idToIndex.set(id, i);
        }

        const lumina = this.convertRawToLumina(raw);
        return { raw, lumina, idToIndex };
    }

    static async getLuminaMessages(options: { ensureStableIds?: boolean } = {}): Promise<LuminaChatMessage[]> {
        const snap = await this.getSnapshot(options);
        return snap.lumina;
    }

    static async resolveIndexById(targetId: string, snapshot?: STMessageSnapshot): Promise<number | null> {
        if (!targetId) return null;
        const snap = snapshot ?? await this.getSnapshot();
        const idx = snap.idToIndex.get(targetId);
        return idx === undefined ? null : idx;
    }

    private static convertRawToLumina(raw: ChatMessage[]): LuminaChatMessage[] {
        const converted = raw.map(m => STProtocol.fromST(m));

        const seen = new Set<string>();
        for (const msg of converted) {
            if (seen.has(msg.id)) {
                const oldId = msg.id;
                msg.id = STProtocol.generateNodeId();
                msg.extra = msg.extra || {};
                msg.extra.id = msg.id;
                console.warn(`[MessageListGateway] 检测到冲突 ID ${oldId}，已自动愈合为 ${msg.id}。来源：ST 线性导入。`);
            } else {
                msg.extra = msg.extra || {};
                msg.extra.id = msg.id;
            }
            seen.add(msg.id);
        }

        return converted;
    }

    private static async ensureStableIds(raw: ChatMessage[]): Promise<boolean> {
        const updates: STMessageUpdate[] = [];

        for (let i = 0; i < raw.length; i++) {
            const msg = raw[i];
            const extra = ((msg as unknown as { extra?: Record<string, unknown> })?.extra || {}) as Record<string, unknown>;
            const hasId = typeof extra.id === 'string' && extra.id.length > 0;
            const hasFingerprint = typeof extra.fingerprint === 'string' && extra.fingerprint.length > 0;
            const hasStFingerprint = typeof extra.stFingerprint === 'string' && extra.stFingerprint.length > 0;
            if (hasId && hasFingerprint && hasStFingerprint) continue;

            const { id, fingerprint } = STProtocol.identifyMessage(msg);
            const msgObj = msg as unknown as { message?: string; mes?: string };
            const stWriteText = msgObj.message || msgObj.mes || '';
            const stFingerprint = hasStFingerprint ? (extra.stFingerprint as string) : STProtocol.getSTFingerprint(stWriteText);
            const nextExtra: Record<string, unknown> = { ...extra };
            if (!hasId) nextExtra.id = id;
            if (!hasFingerprint) nextExtra.fingerprint = fingerprint;
            if (!hasStFingerprint) nextExtra.stFingerprint = stFingerprint;

            updates.push({
                index: i,
                content: stWriteText,
                extra: nextExtra,
                expectedSwipeId: typeof extra.swipe_id === 'number' ? extra.swipe_id : undefined,
                expectedActiveSwipeText: typeof extra.activeSwipeText === 'string' ? extra.activeSwipeText : stWriteText
            });
        }

        if (updates.length === 0) return false;
        await STClient.updateMessages(updates, true);
        await STClient.flush();
        return true;
    }
}
