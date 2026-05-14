import type { LuminaChatMessage } from '@shared/LuminaMessage.js';
import { lwStorage } from '../../storage.js';
import { globalXMLInterceptor } from '../xml-view/XMLInterceptor.js';

export class MessageTextProjection {
    static normalize(text: string): string {
        return (text || '').replace(/\r\n/g, '\n').trim();
    }

    static extractMessageText(message: LuminaChatMessage, useCompressed = false): string {
        let text = '';

        if (useCompressed && message.mesSummary) {
            text = message.mesSummary;
        } else if (message.is_user === false) {
            text = message.pluginRaw ?? message.mesRaw ?? message.extra?.mesRaw ?? message.mes ?? '';
        } else {
            text = message.mes ?? message.mesRaw ?? message.extra?.mesRaw ?? '';
        }

        const cleaned = globalXMLInterceptor.cleanText(text, {
            filterChatReply: Boolean(lwStorage.get('lumina-chat.filterChatReply', false, 'Global')),
            allowTopLevel: Boolean(lwStorage.get('lumina-chat.allowTopLevelInFilter', true, 'Global')),
            implicitThinking: Boolean(lwStorage.get('lumina-chat.implicitStartThinking', false, 'Global')),
            aggressiveThinking: Boolean(lwStorage.get('lumina-chat.aggressiveThinking', false, 'Global'))
        });

        return this.normalize(cleaned);
    }
}
