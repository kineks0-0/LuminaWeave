import { describe, expect, it, vi } from 'vitest';
import { focusChatComposerInput } from '../presentation/ChatPresentationInteractions.js';

describe('ChatPresentationInteractions', () => {
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
