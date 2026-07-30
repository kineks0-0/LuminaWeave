export interface ChatTranscriptViewport {
    readonly scrollHeight: number;
    readonly scrollTop: number;
    readonly clientHeight: number;
    scrollTo(options: ScrollToOptions): void;
}

const CHAT_BOTTOM_THRESHOLD = 120;

export const scrollChatTranscriptToBottom = (
    viewport: ChatTranscriptViewport,
    force: boolean
): boolean => {
    const distanceFromBottom = viewport.scrollHeight - viewport.scrollTop - viewport.clientHeight;
    if (!force && distanceFromBottom > CHAT_BOTTOM_THRESHOLD) {
        return false;
    }

    viewport.scrollTo({
        top: viewport.scrollHeight,
        behavior: force ? 'auto' : 'smooth'
    });
    return true;
};

export const focusChatComposerInput = (textarea: HTMLTextAreaElement): void => {
    textarea.focus();
    const selectionPosition = textarea.value.length;
    textarea.setSelectionRange(selectionPosition, selectionPosition);
};
