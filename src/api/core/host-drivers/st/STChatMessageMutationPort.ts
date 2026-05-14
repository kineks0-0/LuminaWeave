import type { LuminaChatMessage } from '@shared/LuminaMessage.js';
import { configureChatMessageMutationPort, type ChatMessageMutationPort } from '../../conversation/ChatMessageMutationPort.js';
import { STAdapter } from './STAdapter.js';
import { STConversationHostDriver } from './STConversationHostDriver.js';
import { STProtocol } from './STProtocol.js';
import { MessageTextResolver, SyncUtils } from './SyncUtils.js';

class STChatMessageMutationPort implements ChatMessageMutationPort {
    normalizeChatId(chatId: string | null | undefined): string | null {
        return STConversationHostDriver.normalizeChatId(chatId);
    }

    getSnapshotMessagesSync(): LuminaChatMessage[] {
        return STAdapter.getSnapshotSync().lumina;
    }

    compareStates(localMessages: LuminaChatMessage[], hostMessages: LuminaChatMessage[]): any {
        return STAdapter.compareStates(localMessages, hostMessages);
    }

    async getHostIndex(messageId: string): Promise<number | undefined> {
        const snapshot = await STAdapter.getSnapshot();
        return snapshot.idToIndex.get(messageId);
    }

    getFingerprint(text: string): string {
        return SyncUtils.getFingerprint(text);
    }

    getHostFingerprint(text: string): string {
        return SyncUtils.getSTFingerprint(text);
    }

    generateNodeId(): string {
        return SyncUtils.generateNodeId();
    }

    syncMessageCalculatedFields(message: LuminaChatMessage, options: { force?: boolean; skipFingerprint?: boolean } = {}): void {
        STProtocol.syncMessageCalculatedFields(message, options);
    }

    resolveHostWriteText(message: LuminaChatMessage): string {
        return STProtocol.resolveForSTWrite(message);
    }

    async updateHostMessage(input: {
        index: number;
        message: LuminaChatMessage;
        content: string;
        extra?: Record<string, unknown>;
    }): Promise<void> {
        const message = input.message as any;
        await STConversationHostDriver.updateMessages([{
            index: input.index,
            content: input.content,
            expectedSwipeId: typeof message.extra?.swipe_id === 'number' ? message.extra.swipe_id : undefined,
            expectedActiveSwipeText: typeof message.extra?.activeSwipeText === 'string' ? message.extra.activeSwipeText : message.mesST,
            extra: input.extra
        }]);
    }

    async deleteHostMessage(index: number): Promise<void> {
        await STConversationHostDriver.deleteMessages([index]);
    }

    async appendHostMessage(message: LuminaChatMessage): Promise<void> {
        const msg = message as any;
        await STConversationHostDriver.appendMessage({
            role: msg.role,
            mesST: msg.mesST,
            mesRaw: msg.mesRaw,
            mes: msg.mes,
            name: msg.name,
            extra: msg.extra || {}
        });
    }

    extractMessageText(message: LuminaChatMessage): string {
        return MessageTextResolver.extractMessageText(message);
    }
}

let registered = false;

export function registerSTChatMessageMutationPort(): void {
    if (registered) return;
    configureChatMessageMutationPort(new STChatMessageMutationPort());
    registered = true;
}
