import { describe, expect, it } from 'vitest';

import {
    NO_ACTIVE_CHAT_INPUT_HINT,
    NO_ACTIVE_CHAT_MESSAGE,
    resolveChatSurfaceState,
    resolveChatViewState
} from '../chatViewState.js';

describe('resolveChatViewState', () => {
    it('should resolve no-active-chat copy when current chat is invalid', () => {
        const resolved = resolveChatViewState({
            sourceId: 'chat',
            sessionId: null,
            currentChatSessionId: null,
            isLive: false,
            isSessionSwitching: false
        });

        expect(resolved.isLiveChatView).toBe(false);
        expect(resolved.isReadOnlyView).toBe(true);
        expect(resolved.isNoActiveChatView).toBe(true);
        expect(resolved.isHistoryReadOnlyView).toBe(false);
        expect(resolved.readOnlyReason).toBe('');
        expect(resolved.inputDisabledHint).toBe(NO_ACTIVE_CHAT_INPUT_HINT);
        expect(resolved.inputPlaceholder).toBe(NO_ACTIVE_CHAT_INPUT_HINT);
        expect(resolved.sendButtonTitle).toBe(NO_ACTIVE_CHAT_INPUT_HINT);
        expect(resolved.emptyStateMessage).toBe(NO_ACTIVE_CHAT_MESSAGE);
    });

    it('should keep historical readonly copy for archived sessions', () => {
        const resolved = resolveChatViewState({
            sourceId: 'chat',
            sessionId: 'chat_archive',
            currentChatSessionId: null,
            isLive: false,
            isSessionSwitching: false
        });

        expect(resolved.isLiveChatView).toBe(false);
        expect(resolved.isReadOnlyView).toBe(true);
        expect(resolved.isNoActiveChatView).toBe(false);
        expect(resolved.isHistoryReadOnlyView).toBe(true);
        expect(resolved.readOnlyReason).toBe('当前正在浏览历史对话，仅支持查看，不会直接驱动 ST 当前聊天。');
        expect(resolved.inputDisabledHint).toBe('');
        expect(resolved.inputPlaceholder).toBe('当前为历史对话浏览，只读模式已开启。');
        expect(resolved.sendButtonTitle).toBe('历史对话浏览模式下不可发送');
        expect(resolved.emptyStateMessage).toBe('');
    });

    it('should show the no-active-chat center empty state without rendering a readonly banner', () => {
        const viewState = resolveChatViewState({
            sourceId: 'chat',
            sessionId: null,
            currentChatSessionId: null,
            isLive: false,
            isSessionSwitching: false
        });

        const surfaceState = resolveChatSurfaceState({
            viewState,
            messageCount: 0,
            isSessionSwitching: false,
            isGenerating: false,
            isSyncing: false,
            hasStreamingBuffer: false,
            hasGenerationError: false
        });

        expect(surfaceState.showReadOnlyBanner).toBe(false);
        expect(surfaceState.showNoActiveChatEmptyState).toBe(true);
    });

    it('should keep the historical readonly banner and hide the no-active-chat center empty state for archived sessions', () => {
        const viewState = resolveChatViewState({
            sourceId: 'chat',
            sessionId: 'chat_archive',
            currentChatSessionId: null,
            isLive: false,
            isSessionSwitching: false
        });

        const surfaceState = resolveChatSurfaceState({
            viewState,
            messageCount: 0,
            isSessionSwitching: false,
            isGenerating: false,
            isSyncing: false,
            hasStreamingBuffer: false,
            hasGenerationError: false
        });

        expect(surfaceState.showReadOnlyBanner).toBe(true);
        expect(surfaceState.showNoActiveChatEmptyState).toBe(false);
    });
});
