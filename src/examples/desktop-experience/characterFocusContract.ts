import type { ShallowRef } from 'vue';
import { z } from 'zod';
import type {
    ConversationTimelineNode,
    ConversationViewContext,
    LuminaChatMessage,
    SurfaceContractDefinition,
    SurfaceContractSpec,
    SurfaceInputSchema
} from '../../sdk/index.js';

export const CHARACTER_FOCUS_CONTRACT_ID = 'example.characterFocus' as const;
export const CHARACTER_FOCUS_PLUGIN_ID = 'example-character-focus' as const;

export interface CharacterFocusSurfaceInput {
    title: string;
    showTimeline?: boolean;
}

export interface CharacterFocusSessionOption {
    id: string;
    title: string;
}

export interface CharacterFocusSnapshot {
    characterName: string;
    sessionId: string | null;
    conversation: ConversationViewContext | null;
    messages: LuminaChatMessage[];
    timeline: Record<string, ConversationTimelineNode>;
    availableSessions: CharacterFocusSessionOption[];
    isGenerating: boolean;
    loading: boolean;
    error: string | null;
}

export interface CharacterFocusSurfaceState {
    snapshot: Readonly<ShallowRef<CharacterFocusSnapshot>>;
}

export interface CharacterFocusSurfaceIntents {
    refresh(): Promise<void>;
    openSession(sessionId: string): Promise<void>;
    sendMessage(text: string): Promise<boolean>;
    stopGeneration(): Promise<unknown>;
}

declare module '../../sdk/index.js' {
    interface SurfaceContractMap {
        'example.characterFocus': SurfaceContractSpec<
            CharacterFocusSurfaceInput,
            CharacterFocusSurfaceState,
            CharacterFocusSurfaceIntents
        >;
    }
}

export const characterFocusInputSchema: SurfaceInputSchema<typeof CHARACTER_FOCUS_CONTRACT_ID> = z.object({
    title: z.string().min(1),
    showTimeline: z.boolean().optional()
}).strict();

export const characterFocusContractDefinition: SurfaceContractDefinition<
    typeof CHARACTER_FOCUS_CONTRACT_ID
> = {
    id: CHARACTER_FOCUS_CONTRACT_ID,
    inputSchema: characterFocusInputSchema,
    ownerPluginId: CHARACTER_FOCUS_PLUGIN_ID,
    description: 'Trusted third-party example that follows the active character and conversation.',
    requiredIntents: ['refresh', 'openSession', 'sendMessage', 'stopGeneration']
};

export const CHARACTER_FOCUS_EXAMPLE_COPY = Object.freeze({
    refresh: 'Refresh character focus',
    openSession: 'Open conversation',
    send: 'Send message',
    stop: 'Stop generation',
    loading: 'Loading current conversation',
    emptyMessages: 'No messages in the current conversation',
    timeline: 'Timeline nodes',
    session: 'Current conversation'
});
