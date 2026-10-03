import type { ChatStreamingEffect } from './ChatMessageRenderPreferences.js';

export type ChatMotionLevel = 'full' | 'light' | 'none';
export type ChatStreamingRevealMode = 'none' | 'fade' | 'trail';

export interface ChatMotionPreference {
    motion: ChatMotionLevel;
    reducedMotion: boolean;
}

export interface ChatStreamingPresentation {
    /** 新到文本的显现方式：fade 为短淡入，trail 为较长的渐隐拖尾 */
    revealMode: ChatStreamingRevealMode;
    durationMs: number;
    /** 是否在文末显示行内光标 */
    caret: boolean;
    caretBlink: boolean;
}

const FADE_DURATION_MS = 220;
const TRAIL_DURATION_MS = 700;

const NO_REVEAL: ChatStreamingPresentation = { revealMode: 'none', durationMs: 0, caret: false, caretBlink: false };

export const resolveChatStreamingPresentation = (
    effect: ChatStreamingEffect,
    preference: ChatMotionPreference = { motion: 'full', reducedMotion: false }
): ChatStreamingPresentation => {
    const motionOff = preference.motion === 'none' || preference.reducedMotion;
    switch (effect) {
        case 'fade-in':
            return motionOff ? NO_REVEAL : { ...NO_REVEAL, revealMode: 'fade', durationMs: FADE_DURATION_MS };
        case 'gpt-style':
            if (motionOff) return NO_REVEAL;
            return preference.motion === 'light'
                ? { ...NO_REVEAL, revealMode: 'fade', durationMs: FADE_DURATION_MS }
                : { ...NO_REVEAL, revealMode: 'trail', durationMs: TRAIL_DURATION_MS };
        case 'typewriter':
            return { ...NO_REVEAL, caret: true, caretBlink: !motionOff };
        case 'instant':
            return NO_REVEAL;
    }
};
