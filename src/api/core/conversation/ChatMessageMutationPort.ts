import type { LuminaChatMessage } from '@shared/LuminaMessage.js';
import { createPrefixedId } from '@shared/CommonUtils.js';
import { digestString } from '@shared/hash.js';

export interface ChatMessageMutationPort {
    normalizeChatId(chatId: string | null | undefined): string | null;
    getSnapshotMessagesSync(): LuminaChatMessage[];
    compareStates(localMessages: LuminaChatMessage[], hostMessages: LuminaChatMessage[]): any;
    getHostIndex(messageId: string): Promise<number | undefined>;
    getFingerprint(text: string): string;
    getHostFingerprint(text: string): string;
    generateNodeId(): string;
    syncMessageCalculatedFields(
        message: LuminaChatMessage,
        options?: { force?: boolean; skipFingerprint?: boolean; isGreeting?: boolean }
    ): void;
    resolveHostWriteText(message: LuminaChatMessage): string;
    updateHostMessage(input: {
        index: number;
        message: LuminaChatMessage;
        content: string;
        extra?: Record<string, unknown>;
    }): Promise<void>;
    deleteHostMessage(index: number): Promise<void>;
    appendHostMessage(message: LuminaChatMessage): Promise<void>;
    extractMessageText(message: LuminaChatMessage): string;
}

class EmptyChatMessageMutationPort implements ChatMessageMutationPort {
    normalizeChatId(chatId: string | null | undefined): string | null {
        const normalized = typeof chatId === 'string' ? chatId.trim() : '';
        return normalized && normalized !== 'default' ? normalized : null;
    }

    getSnapshotMessagesSync(): LuminaChatMessage[] {
        return [];
    }

    compareStates(localMessages: LuminaChatMessage[], hostMessages: LuminaChatMessage[]): any {
        return {
            hasDivergence: false,
            hasConflict: false,
            onlyInIndependent: localMessages,
            onlyInST: hostMessages,
            updated: [],
            diffCount: localMessages.length + hostMessages.length
        };
    }

    async getHostIndex(_messageId: string): Promise<number | undefined> {
        return undefined;
    }

    getFingerprint(text: string): string {
        return `fp_${digestString(text)}`;
    }

    getHostFingerprint(text: string): string {
        return this.getFingerprint(text);
    }

    generateNodeId(): string {
        return createPrefixedId('node');
    }

    syncMessageCalculatedFields(message: LuminaChatMessage): void {
        const text = message.mesRaw || message.mes || '';
        message.fingerprint = message.fingerprint || this.getFingerprint(text);
    }

    resolveHostWriteText(message: LuminaChatMessage): string {
        return message.mesST || message.mesRaw || message.mes || '';
    }

    async updateHostMessage(_input: {
        index: number;
        message: LuminaChatMessage;
        content: string;
        extra?: Record<string, unknown>;
    }): Promise<void> {}

    async deleteHostMessage(_index: number): Promise<void> {}

    async appendHostMessage(_message: LuminaChatMessage): Promise<void> {}

    extractMessageText(message: LuminaChatMessage): string {
        return message.mesRaw || message.mes || '';
    }
}

let chatMessageMutationPort: ChatMessageMutationPort = new EmptyChatMessageMutationPort();

export function configureChatMessageMutationPort(port: ChatMessageMutationPort): void {
    chatMessageMutationPort = port;
}

export function getChatMessageMutationPort(): ChatMessageMutationPort {
    return chatMessageMutationPort;
}
