import type { LuminaChatMessage, LuminaConversationType } from '../../../shared/LuminaMessage.js';

export type ConversationContextSource = Extract<LuminaConversationType, 'chat' | 'forge'>;

export interface ConversationContextOption {
    id: ConversationContextSource;
    label: string;
    description: string;
    count: number;
    sessionId: string | null;
    activeLeafId: string | null;
}

export interface ConversationContext {
    source: ConversationContextSource;
    sessionId: string | null;
    activeLeafId: string | null;
    messages: LuminaChatMessage[];
    timelineGraph: Record<string, LuminaChatMessage>;
    focusedMessage: LuminaChatMessage | null;
}
