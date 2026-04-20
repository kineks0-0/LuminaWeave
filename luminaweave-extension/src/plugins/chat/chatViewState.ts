import type { ConversationSourceId } from '../../types/ConversationContextTypes.js';

export const NO_ACTIVE_CHAT_MESSAGE = '当前尚未打开聊天，请先在 酒馆 或者 插件的角色频道 中打开一个聊天。';
export const NO_ACTIVE_CHAT_INPUT_HINT = '请先打开一个聊天';
const HISTORY_READONLY_REASON = '当前正在浏览历史对话，仅支持查看，不会直接驱动 ST 当前聊天。';
const HISTORY_READONLY_PLACEHOLDER = '当前为历史对话浏览，只读模式已开启。';
const HISTORY_READONLY_SEND_TITLE = '历史对话浏览模式下不可发送';

export type ChatViewStateInput = {
    sourceId: ConversationSourceId;
    sessionId: string | null;
    currentChatSessionId: string | null;
    isLive: boolean;
    isSessionSwitching: boolean;
};

export type ChatViewStateResolved = {
    isLiveChatView: boolean;
    isReadOnlyView: boolean;
    isNoActiveChatView: boolean;
    isHistoryReadOnlyView: boolean;
    readOnlyReason: string;
    inputDisabledHint: string;
    inputPlaceholder: string;
    sendButtonTitle: string;
    emptyStateMessage: string;
};

export type ChatSurfaceStateInput = {
    viewState: ChatViewStateResolved;
    messageCount: number;
    isSessionSwitching: boolean;
    isGenerating: boolean;
    isSyncing: boolean;
    hasStreamingBuffer: boolean;
    hasGenerationError: boolean;
};

export type ChatSurfaceStateResolved = {
    showReadOnlyBanner: boolean;
    showNoActiveChatEmptyState: boolean;
};

export function resolveChatViewState(input: ChatViewStateInput): ChatViewStateResolved {
    const isLiveChatView = input.sourceId === 'chat' && input.isLive === true;
    const isNoActiveChatView =
        input.sourceId === 'chat'
        && input.sessionId === null
        && input.currentChatSessionId === null
        && input.isLive === false;
    const isReadOnlyView = !isLiveChatView;
    const isHistoryReadOnlyView = isReadOnlyView && !isNoActiveChatView;

    let inputPlaceholder = '请输入您的回复或指令... (Enter 发送，Shift+Enter 换行)';
    let sendButtonTitle = '发送 (Enter)';

    if (input.isSessionSwitching) {
        inputPlaceholder = '正在切换聊天，请稍候...';
        sendButtonTitle = '聊天切换中，请稍候';
    } else if (isNoActiveChatView) {
        inputPlaceholder = NO_ACTIVE_CHAT_INPUT_HINT;
        sendButtonTitle = NO_ACTIVE_CHAT_INPUT_HINT;
    } else if (isHistoryReadOnlyView) {
        inputPlaceholder = HISTORY_READONLY_PLACEHOLDER;
        sendButtonTitle = HISTORY_READONLY_SEND_TITLE;
    }

    return {
        isLiveChatView,
        isReadOnlyView,
        isNoActiveChatView,
        isHistoryReadOnlyView,
        readOnlyReason: isHistoryReadOnlyView ? HISTORY_READONLY_REASON : '',
        inputDisabledHint: isNoActiveChatView ? NO_ACTIVE_CHAT_INPUT_HINT : '',
        inputPlaceholder,
        sendButtonTitle,
        emptyStateMessage: isNoActiveChatView ? NO_ACTIVE_CHAT_MESSAGE : ''
    };
}

export function resolveChatSurfaceState(input: ChatSurfaceStateInput): ChatSurfaceStateResolved {
    return {
        showReadOnlyBanner: Boolean(input.viewState.readOnlyReason),
        showNoActiveChatEmptyState:
            input.viewState.isNoActiveChatView
            && input.messageCount === 0
            && !input.isSessionSwitching
            && !input.isGenerating
            && !input.isSyncing
            && !input.hasStreamingBuffer
            && !input.hasGenerationError
    };
}
