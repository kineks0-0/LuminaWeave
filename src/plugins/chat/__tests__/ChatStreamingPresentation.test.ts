import { describe, expect, it } from 'vitest';
import { resolveChatStreamingPresentation } from '../presentation/ChatStreamingPresentation.js';

describe('resolveChatStreamingPresentation', () => {
    it.each([
        ['instant', { revealMode: 'none', durationMs: 0, caret: false, caretBlink: false }],
        ['fade-in', { revealMode: 'fade', durationMs: 220, caret: false, caretBlink: false }],
        ['gpt-style', { revealMode: 'trail', durationMs: 700, caret: false, caretBlink: false }],
        ['typewriter', { revealMode: 'none', durationMs: 0, caret: true, caretBlink: true }]
    ] as const)('projects %s with full motion', (effect, expected) => {
        expect(resolveChatStreamingPresentation(effect, { motion: 'full', reducedMotion: false })).toEqual(expected);
    });

    it('degrades gpt-style to a fade in light motion mode', () => {
        expect(resolveChatStreamingPresentation('gpt-style', { motion: 'light', reducedMotion: false }))
            .toEqual({ revealMode: 'fade', durationMs: 220, caret: false, caretBlink: false });
    });

    it.each([
        [{ motion: 'none', reducedMotion: false }],
        [{ motion: 'full', reducedMotion: true }]
    ] as const)('removes reveal animation and caret blinking when motion is off (%o)', (motion) => {
        expect(resolveChatStreamingPresentation('fade-in', motion).revealMode).toBe('none');
        expect(resolveChatStreamingPresentation('gpt-style', motion).revealMode).toBe('none');
        expect(resolveChatStreamingPresentation('typewriter', motion))
            .toEqual({ revealMode: 'none', durationMs: 0, caret: true, caretBlink: false });
    });

    it('defaults to full motion when no preference is given', () => {
        expect(resolveChatStreamingPresentation('fade-in').revealMode).toBe('fade');
    });
});
