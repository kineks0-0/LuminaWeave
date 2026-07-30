import { describe, expect, it } from 'vitest';
import {
    DEFAULT_CHAT_MESSAGE_RENDER_PREFERENCES,
    resolveChatStreamingEffect,
    resolveChatThemeRenderPreferences
} from '../presentation/ChatMessageRenderPreferences.js';

describe('ChatMessageRenderPreferences', () => {
    it('strictly resolves message shape, avatar placement and username visibility from theme variables', () => {
        expect(resolveChatThemeRenderPreferences({
            '--lw-chat-assistant-shape': 'document',
            '--lw-chat-user-shape': 'bubble',
            '--lw-chat-assistant-avatar-placement': 'topbar',
            '--lw-chat-user-avatar-placement': 'hidden',
            '--lw-chat-user-name-display': 'none'
        })).toEqual({
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
            '--lw-chat-user-name-display': 'hidden'
        })).toEqual({
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
});
