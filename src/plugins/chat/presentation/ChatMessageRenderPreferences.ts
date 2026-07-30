import type {
    ThemeAvatarPlacement,
    ThemeMessageShape
} from '../../../platform/surface/types.js';

export type ChatThinkingDisplayMode = 'hidden' | 'collapsible';
export type ChatStreamingEffect = 'instant' | 'fade-in' | 'gpt-style' | 'typewriter';

export interface ChatThemeRenderPreferences {
    assistantMessageShape: ThemeMessageShape;
    userMessageShape: ThemeMessageShape;
    assistantAvatarPlacement: ThemeAvatarPlacement;
    userAvatarPlacement: ThemeAvatarPlacement;
    showUsernames: boolean;
}

export interface ChatMessageRenderPreferences extends ChatThemeRenderPreferences {
    thinkingDisplayMode: ChatThinkingDisplayMode;
    thinkingAutoExpand: boolean;
    filterChatReply: boolean;
    allowTopLevelInFilter: boolean;
    implicitThinkingInFilter: boolean;
    streamingEffect: ChatStreamingEffect;
}

export const DEFAULT_CHAT_MESSAGE_RENDER_PREFERENCES: Readonly<ChatMessageRenderPreferences> = Object.freeze({
    thinkingDisplayMode: 'collapsible',
    thinkingAutoExpand: true,
    filterChatReply: false,
    allowTopLevelInFilter: true,
    implicitThinkingInFilter: false,
    assistantMessageShape: 'bubble',
    userMessageShape: 'bubble',
    assistantAvatarPlacement: 'inline',
    userAvatarPlacement: 'inline',
    showUsernames: true,
    streamingEffect: 'instant'
});

const resolveMessageShape = (value: unknown, fallback: ThemeMessageShape): ThemeMessageShape => (
    value === 'bubble' || value === 'document' ? value : fallback
);

const resolveAvatarPlacement = (
    value: unknown,
    fallback: ThemeAvatarPlacement
): ThemeAvatarPlacement => (
    value === 'hidden' || value === 'inline' || value === 'topbar' || value === 'rail'
        ? value
        : fallback
);

export const resolveChatThemeRenderPreferences = (
    cssVars: Record<string, string | number> | undefined
): ChatThemeRenderPreferences => ({
    assistantMessageShape: resolveMessageShape(
        cssVars?.['--lw-chat-assistant-shape'],
        DEFAULT_CHAT_MESSAGE_RENDER_PREFERENCES.assistantMessageShape
    ),
    userMessageShape: resolveMessageShape(
        cssVars?.['--lw-chat-user-shape'],
        DEFAULT_CHAT_MESSAGE_RENDER_PREFERENCES.userMessageShape
    ),
    assistantAvatarPlacement: resolveAvatarPlacement(
        cssVars?.['--lw-chat-assistant-avatar-placement'],
        DEFAULT_CHAT_MESSAGE_RENDER_PREFERENCES.assistantAvatarPlacement
    ),
    userAvatarPlacement: resolveAvatarPlacement(
        cssVars?.['--lw-chat-user-avatar-placement'],
        DEFAULT_CHAT_MESSAGE_RENDER_PREFERENCES.userAvatarPlacement
    ),
    showUsernames: cssVars?.['--lw-chat-user-name-display'] === 'none'
        ? false
        : cssVars?.['--lw-chat-user-name-display'] === 'inline-flex'
            ? true
            : DEFAULT_CHAT_MESSAGE_RENDER_PREFERENCES.showUsernames
});

export const resolveChatStreamingEffect = (value: unknown): ChatStreamingEffect => (
    value === 'instant'
    || value === 'fade-in'
    || value === 'gpt-style'
    || value === 'typewriter'
        ? value
        : DEFAULT_CHAT_MESSAGE_RENDER_PREFERENCES.streamingEffect
);
