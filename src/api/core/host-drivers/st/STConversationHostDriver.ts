import { LuminaChatMessage } from '@shared/LuminaMessage.js';
import { STClient, type STMessageUpdate } from './STClient.js';
import { STProtocol } from './STProtocol.js';

export type { STMessageUpdate };

export type STMessageSnapshot = {
    raw: ChatMessage[];
    lumina: LuminaChatMessage[];
    idToIndex: Map<string, number>;
};

export interface STConversationHostMessageInput {
    role?: string;
    mesST?: string;
    mesRaw?: string;
    mes?: string;
    name?: string;
    extra?: Record<string, unknown>;
}

export class STConversationHostDriver {
    static normalizeChatId(value: unknown): string | null {
        return STClient.normalizeChatId(value);
    }

    static getCharacterNames(): string[] {
        return STClient.getCharacterNames();
    }

    static getCharacterNameById(characterId: string | number | null | undefined): string | null {
        return STClient.getCharacterNameById(characterId);
    }

    static getCharacterRoster() {
        return STClient.getCharacterRoster();
    }

    static switchToCharacterChat(input: Parameters<typeof STClient.switchToCharacterChat>[0]) {
        return STClient.switchToCharacterChat(input);
    }

    static createNewCharacterChat(input: Parameters<typeof STClient.createNewCharacterChat>[0]) {
        return STClient.createNewCharacterChat(input);
    }

    static renameCharacterChat(input: Parameters<typeof STClient.renameCharacterChat>[0]) {
        return STClient.renameCharacterChat(input);
    }

    static deleteCharacterChat(input: Parameters<typeof STClient.deleteCharacterChat>[0]) {
        return STClient.deleteCharacterChat(input);
    }

    static duplicateCharacterChat(input: Parameters<typeof STClient.duplicateCharacterChat>[0]) {
        return STClient.duplicateCharacterChat(input);
    }

    static closeCurrentChatView(): Promise<boolean> {
        return STClient.closeCurrentChatView();
    }

    static getChatSessionCharacterMeta(
        chatFile: string | null | undefined,
        target: {
            characterId?: string | number | null;
            characterName?: string;
            characterAvatarUrl?: string | null;
        } = {}
    ) {
        return STClient.getChatSessionCharacterMeta(chatFile, target);
    }

    static getPresets(type: string): string[] {
        return STClient.getPresets(type);
    }

    static getMainApi(): string {
        return STClient.getMainApi();
    }

    static getActivePresetName(type: string): string | null {
        return STClient.getActivePresetName(type);
    }

    static selectPreset(type: string, name: string): void {
        STClient.selectPreset(type, name);
    }

    static createEmptySnapshot(): STMessageSnapshot {
        return {
            raw: [],
            lumina: [],
            idToIndex: new Map()
        };
    }

    static getSnapshotSync(): STMessageSnapshot {
        if (!STClient.hasActiveLiveChat()) {
            return this.createEmptySnapshot();
        }
        return this.buildSnapshot(STClient.getRawMessages({ includeSwipes: true }) as ChatMessage[]);
    }

    static async getSnapshot(options: { ensureStableIds?: boolean } = {}): Promise<STMessageSnapshot> {
        if (!STClient.hasActiveLiveChat()) {
            return this.createEmptySnapshot();
        }

        let raw = STClient.getRawMessages({ includeSwipes: true }) as ChatMessage[];
        if (options.ensureStableIds) {
            const changed = await this.ensureStableIds(raw);
            if (changed) {
                raw = STClient.getRawMessages({ includeSwipes: true }) as ChatMessage[];
            }
        }

        return this.buildSnapshot(raw);
    }

    static async updateMessages(updates: STMessageUpdate[], skipFlush = false): Promise<void> {
        await STClient.updateMessages(updates, skipFlush);
    }

    static async deleteMessages(indices: number[], skipFlush = false): Promise<void> {
        await STClient.deleteMessages(indices, skipFlush);
    }

    static async appendMessage(message: STConversationHostMessageInput): Promise<void> {
        await STClient.appendMessage(message);
    }

    static async flush(): Promise<void> {
        await STClient.flush();
    }

    private static buildSnapshot(raw: ChatMessage[]): STMessageSnapshot {
        const idToIndex = new Map<string, number>();
        for (let i = 0; i < raw.length; i++) {
            const { id } = STProtocol.identifyMessage(raw[i]);
            if (!idToIndex.has(id)) idToIndex.set(id, i);
        }

        return {
            raw,
            lumina: this.convertRawToLumina(raw),
            idToIndex
        };
    }

    private static convertRawToLumina(raw: ChatMessage[]): LuminaChatMessage[] {
        // ST 线性导入阶段 parentId 尚未重建，首条非用户消息即角色卡招呼，需显式告知
        const converted = raw.map((m, index) => {
            const item = m as unknown as { is_user?: boolean; role?: string };
            const isUser = item.is_user === true || item.role === 'user';
            return STProtocol.fromST(m, undefined, { isGreeting: index === 0 && !isUser });
        });
        const seen = new Set<string>();

        for (const msg of converted) {
            if (seen.has(msg.id)) {
                const oldId = msg.id;
                msg.id = STProtocol.generateNodeId();
                msg.extra = msg.extra || {};
                msg.extra.id = msg.id;
                console.warn(`[STConversationHostDriver] 检测到冲突 ID ${oldId}，已自动愈合为 ${msg.id}。来源：ST 线性导入。`);
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
