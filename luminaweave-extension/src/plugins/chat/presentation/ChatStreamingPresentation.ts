import type { ChatStreamingEffect } from './ChatMessageRenderPreferences.js';

export interface ChatStreamingPresentation {
    effectClass: string;
    showCursor: boolean;
}

export const resolveChatStreamingPresentation = (
    effect: ChatStreamingEffect
): ChatStreamingPresentation => {
    switch (effect) {
        case 'fade-in':
            return { effectClass: 'lw-effect-fade-in', showCursor: false };
        case 'gpt-style':
            return { effectClass: 'lw-effect-gpt-reveal', showCursor: false };
        case 'typewriter':
            return { effectClass: '', showCursor: true };
        case 'instant':
            return { effectClass: '', showCursor: false };
    }
};
