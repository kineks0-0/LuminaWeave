import { lwStorage } from '../../storage.js';
import type { ContextControlSettings } from './types.js';

export class ContextControlSettingsService {
    static getSettings(): ContextControlSettings {
        const fullMode = lwStorage.get('lumina-chat.contextControl.fullMode', 'count', 'Global') as 'count' | 'token' | 'char';
        const summaryMode = lwStorage.get('lumina-chat.contextControl.summaryMode', 'count', 'Global') as 'count' | 'token' | 'char';

        return {
            fullMode,
            fullValueCount: Number(lwStorage.get('lumina-chat.contextControl.fullValueCount', 10, 'Global')),
            fullValueToken: Number(lwStorage.get('lumina-chat.contextControl.fullValueToken', 2000, 'Global')),
            fullValueChar: Number(lwStorage.get('lumina-chat.contextControl.fullValueChar', 5000, 'Global')),
            summaryMode,
            summaryValueCount: Number(lwStorage.get('lumina-chat.contextControl.summaryValueCount', 30, 'Global')),
            summaryValueToken: Number(lwStorage.get('lumina-chat.contextControl.summaryValueToken', 4000, 'Global')),
            summaryValueChar: Number(lwStorage.get('lumina-chat.contextControl.summaryValueChar', 10000, 'Global')),
            tokenSplitAllowed: Boolean(lwStorage.get('lumina-chat.contextControl.tokenSplitAllowed', false, 'Global')),
            tokenMaxFloat: Number(lwStorage.get('lumina-chat.contextControl.tokenMaxFloat', 200, 'Global')),
            enableFallbackSummary: Boolean(lwStorage.get('lumina-chat.contextControl.enableFallbackSummary', false, 'Global'))
        };
    }
}
