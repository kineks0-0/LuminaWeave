export const focusChatComposerInput = (textarea: HTMLTextAreaElement): void => {
    textarea.focus();
    const selectionPosition = textarea.value.length;
    textarea.setSelectionRange(selectionPosition, selectionPosition);
};
