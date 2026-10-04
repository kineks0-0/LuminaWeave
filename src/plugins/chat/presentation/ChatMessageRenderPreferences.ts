import type {
    ThemeAvatarPlacement,
    ThemeMessageShape
} from '../../../platform/surface/types.js';

export type ChatThinkingDisplayMode = 'hidden' | 'collapsible';
export type ChatStreamingEffect = 'instant' | 'fade-in' | 'gpt-style' | 'typewriter';
/** 桌面模式决定的消息呈现布局；交互在各布局下保持一致，只有视觉不同 */
export type ChatMessageLayout = 'classic' | 'discord' | 'telegram';

export interface ChatThemeRenderPreferences {
    messageLayout: ChatMessageLayout;
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
    /** 是否把消息中的 ```html 代码块渲染为沙箱交互组件 */
    renderHtmlBlocks: boolean;
}

export const DEFAULT_CHAT_MESSAGE_RENDER_PREFERENCES: Readonly<ChatMessageRenderPreferences> = Object.freeze({
    messageLayout: 'classic',
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
    streamingEffect: 'instant',
    renderHtmlBlocks: false
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

const resolveMessageLayout = (value: unknown): ChatMessageLayout => (
    value === 'classic' || value === 'discord' || value === 'telegram'
        ? value
        : DEFAULT_CHAT_MESSAGE_RENDER_PREFERENCES.messageLayout
);

export const resolveChatThemeRenderPreferences = (
    cssVars: Record<string, string | number> | undefined
): ChatThemeRenderPreferences => ({
    messageLayout: resolveMessageLayout(cssVars?.['--lw-chat-layout']),
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
