import { describe, expect, it, vi } from 'vitest';
import {
    focusChatComposerInput,
    scrollChatTranscriptToBottom
} from '../presentation/ChatPresentationInteractions.js';

describe('ChatPresentationInteractions', () => {
    it('forces a transcript to the bottom even when the user is away from the bottom', () => {
        const scrollTo = vi.fn();
        const viewport = {
            scrollHeight: 1200,
            scrollTop: 120,
            clientHeight: 400,
            scrollTo
        };

        expect(scrollChatTranscriptToBottom(viewport, true)).toBe(true);
        expect(scrollTo).toHaveBeenCalledWith({ top: 1200, behavior: 'auto' });
    });

    it('does not move a transcript for a non-forced request when the user is away from the bottom', () => {
        const scrollTo = vi.fn();
        const viewport = {
            scrollHeight: 1200,
            scrollTop: 120,
            clientHeight: 400,
            scrollTo
        };

        expect(scrollChatTranscriptToBottom(viewport, false)).toBe(false);
        expect(scrollTo).not.toHaveBeenCalled();
    });

    it('focuses the composer and moves the selection to the end', () => {
        const focus = vi.fn();
        const setSelectionRange = vi.fn();
        const textarea = {
            value: 'Timeline message',
            focus,
            setSelectionRange
        } as unknown as HTMLTextAreaElement;

        focusChatComposerInput(textarea);

        expect(focus).toHaveBeenCalledTimes(1);
        expect(setSelectionRange).toHaveBeenCalledWith(textarea.value.length, textarea.value.length);
    });
});
