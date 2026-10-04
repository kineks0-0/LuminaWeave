import { describe, expect, it } from 'vitest';
import {
    DEFAULT_CHAT_MESSAGE_RENDER_PREFERENCES,
    resolveChatStreamingEffect,
    resolveChatThemeRenderPreferences,
    shouldApplyChatReplyFilter
} from '../presentation/ChatMessageRenderPreferences.js';

describe('ChatMessageRenderPreferences', () => {
    it('strictly resolves message shape, avatar placement and username visibility from theme variables', () => {
        expect(resolveChatThemeRenderPreferences({
            '--lw-chat-assistant-shape': 'document',
            '--lw-chat-user-shape': 'bubble',
            '--lw-chat-assistant-avatar-placement': 'topbar',
            '--lw-chat-user-avatar-placement': 'hidden',
            '--lw-chat-user-name-display': 'none',
            '--lw-chat-layout': 'telegram'
        })).toEqual({
            messageLayout: 'telegram',
            assistantMessageShape: 'document',
            userMessageShape: 'bubble',
            assistantAvatarPlacement: 'topbar',
            userAvatarPlacement: 'hidden',
            showUsernames: false
        });
    });

    it('uses defined defaults for unsupported theme values without approximate matching', () => {
        expect(resolveChatThemeRenderPreferences({
            '--lw-chat-assistant-shape': 'Document',
            '--lw-chat-user-shape': 'rounded-bubble',
            '--lw-chat-assistant-avatar-placement': 'top-bar',
            '--lw-chat-user-avatar-placement': 'INLINE',
            '--lw-chat-user-name-display': 'hidden',
            '--lw-chat-layout': 'Discord'
        })).toEqual({
            messageLayout: DEFAULT_CHAT_MESSAGE_RENDER_PREFERENCES.messageLayout,
            assistantMessageShape: DEFAULT_CHAT_MESSAGE_RENDER_PREFERENCES.assistantMessageShape,
            userMessageShape: DEFAULT_CHAT_MESSAGE_RENDER_PREFERENCES.userMessageShape,
            assistantAvatarPlacement: DEFAULT_CHAT_MESSAGE_RENDER_PREFERENCES.assistantAvatarPlacement,
            userAvatarPlacement: DEFAULT_CHAT_MESSAGE_RENDER_PREFERENCES.userAvatarPlacement,
            showUsernames: DEFAULT_CHAT_MESSAGE_RENDER_PREFERENCES.showUsernames
        });
    });

    it.each([
        ['instant', 'instant'],
        ['fade-in', 'fade-in'],
        ['gpt-style', 'gpt-style'],
        ['typewriter', 'typewriter'],
        ['fadeIn', DEFAULT_CHAT_MESSAGE_RENDER_PREFERENCES.streamingEffect]
    ] as const)('resolves streaming effect %s as %s', (value, expected) => {
        expect(resolveChatStreamingEffect(value)).toBe(expected);
    });

    it('applies the built-in reply filter only to non-streaming, non-greeting messages', () => {
        expect(shouldApplyChatReplyFilter({ filterChatReply: true }, {})).toBe(true);
        expect(shouldApplyChatReplyFilter({ filterChatReply: true }, { isStreaming: true })).toBe(false);
        expect(shouldApplyChatReplyFilter({ filterChatReply: true }, { isGreeting: true })).toBe(false);
        expect(shouldApplyChatReplyFilter({ filterChatReply: false }, {})).toBe(false);
    });
});
