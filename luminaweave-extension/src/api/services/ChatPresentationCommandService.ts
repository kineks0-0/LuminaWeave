export type ChatPresentationCommand =
    | { type: 'scroll_to_bottom'; force: boolean }
    | { type: 'focus_composer'; text?: string };

export type ChatPresentationCommandListener = (command: ChatPresentationCommand) => void;
export type ChatPresentationCommandEventListener = (payload?: unknown) => void;

export interface ChatPresentationCommandEventSource {
    on(eventName: string, listener: ChatPresentationCommandEventListener): void;
    off(eventName: string, listener: ChatPresentationCommandEventListener): void;
}

const readOptionalText = (payload: unknown): string | undefined => {
    if (typeof payload !== 'object' || payload === null || !('text' in payload)) {
        return undefined;
    }
    return typeof payload.text === 'string' ? payload.text : undefined;
};

const readForce = (payload: unknown): boolean => {
    if (typeof payload !== 'object' || payload === null || !('force' in payload)) {
        return false;
    }
    return payload.force === true;
};

export class ChatPresentationCommandService {
    constructor(private readonly source: ChatPresentationCommandEventSource) {}

    subscribe(listener: ChatPresentationCommandListener): () => void {
        let active = true;
        const onScrollToBottom: ChatPresentationCommandEventListener = (payload): void => {
            if (!active) return;
            listener({ type: 'scroll_to_bottom', force: readForce(payload) });
        };
        const onFocusComposer: ChatPresentationCommandEventListener = (payload): void => {
            if (!active) return;
            const text = readOptionalText(payload);
            listener(text === undefined
                ? { type: 'focus_composer' }
                : { type: 'focus_composer', text });
        };

        this.source.on('SCROLL_TO_BOTTOM', onScrollToBottom);
        this.source.on('FOCUS_MAIN_INPUT', onFocusComposer);

        return (): void => {
            if (!active) return;
            active = false;
            this.source.off('SCROLL_TO_BOTTOM', onScrollToBottom);
            this.source.off('FOCUS_MAIN_INPUT', onFocusComposer);
        };
    }
}
