import { LuminaChatMessage, MessageUtils } from '@shared/LuminaMessage.js';
import { SyncEngine } from '@shared/api/SyncEngine.js';
import { lwStorage } from '../../storage.js';
import { globalXMLInterceptor } from '../xml-view/XMLInterceptor.js';
import type { StoredChatMessage } from './types.js';

const syncEngine = new SyncEngine(globalXMLInterceptor);

export class MessageStorageProjection {
    static normalizeRole(role: unknown, isUser: boolean): 'system' | 'assistant' | 'user' {
        if (isUser) return 'user';
        if (role === 'system') return 'system';
        if (role === 'user') return 'user';
        if (role === 'assistant') return 'assistant';
        if (role === 'char') return 'assistant';
        return 'assistant';
    }

    static syncMessageCalculatedFields(
        message: LuminaChatMessage,
        options: { force?: boolean; skipFingerprint?: boolean; isGreeting?: boolean } = {}
    ): void {
        MessageUtils.syncCore(message, globalXMLInterceptor, options);
        if (!message.mesST) {
            message.mesST = this.resolveHostWriteText(message);
        }
        if (!options.skipFingerprint) {
            const stFingerprint = this.getFingerprint(message.mesST || '');
            message.stFingerprint = stFingerprint;
            message.extra = message.extra || {};
            message.extra.stFingerprint = stFingerprint;
            message.extra.mesRaw = message.mesRaw;
            message.extra.mesST = message.mesST;
        }
    }

    static resolveHostWriteText(message: Partial<LuminaChatMessage>): string {
        const extraMesST = typeof message.extra?.mesST === 'string' ? message.extra.mesST : undefined;
        const extraMesRaw = typeof message.extra?.mesRaw === 'string' ? message.extra.mesRaw : undefined;
        return message.mesST ?? extraMesST ?? message.mesRaw ?? extraMesRaw ?? message.mes ?? '';
    }

    static toStorage(message: LuminaChatMessage): StoredChatMessage {
        const stored: StoredChatMessage = {
            id: message.id,
            parentId: message.parentId,
            name: message.name,
            role: message.role,
            is_user: message.is_user,
            mesRaw: message.mesRaw,
            mesSummary: message.mesSummary,
            thinkingText: message.thinkingText || null,
            mesST: message.mesST,
            is_hidden: message.is_hidden,
            pluginRaw: message.pluginRaw,
            fingerprint: message.fingerprint,
            characterId: message.characterId,
            extra: { ...message.extra } as Record<string, unknown>
        };

        const volatileKeys = [
            'swipes', 'swipes_info',
            'mesRaw', 'characterId', 'send_date', 'id', 'fingerprint', 'pluginRaw',
            'mesSummary'
        ];
        for (const key of volatileKeys) {
            delete stored.extra[key];
        }

        return stored;
    }

    static ensureFingerprints(messages: LuminaChatMessage[]): LuminaChatMessage[] {
        const { charId } = lwStorage._getContextIds();
        return messages.map((message) => {
            const identified = syncEngine.identifyMessage(message);
            message.id = identified.id;
            message.fingerprint = identified.fingerprint;
            message.stFingerprint = message.stFingerprint || this.getFingerprint(this.resolveHostWriteText(message));
            message.characterId = message.characterId || charId;
            const normalizedRole = this.normalizeRole(message.role, message.is_user === true || message.role === 'user');
            message.role = normalizedRole;
            message.extra = message.extra || {};
            message.extra.role = normalizedRole;
            return message;
        });
    }

    static comparePools(localNodes: LuminaChatMessage[], remoteNodes: LuminaChatMessage[]): {
        added: LuminaChatMessage[];
        updated: LuminaChatMessage[];
        deletedIds: string[];
    } {
        return syncEngine.comparePools(localNodes, remoteNodes);
    }

    static getFingerprint(content: string): string {
        return MessageUtils.getFingerprint(content);
    }
}
