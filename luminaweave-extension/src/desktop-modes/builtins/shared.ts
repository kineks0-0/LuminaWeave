import type { SettingDefinition } from '../../types/plugin.js';
import { getDesktopModeSettingValue } from '../core/registry.js';
import type {
    ComponentThemeContext,
    DesktopModeManifest,
    ThemeAvatarPlacement,
    ThemeMessageShape,
    ThemeValueMap,
    ThemeValueResolver
} from '../core/types.js';

const resolveAvatarRadius = (shape: string | undefined) => {
    if (shape === 'square') return '14px';
    if (shape === 'rounded') return '18px';
    return '999px';
};

const resolveBubbleRadius = (style: string | undefined) => {
    if (style === 'compact') return '14px';
    if (style === 'soft') return '22px';
    return '18px';
};

const resolveMessageGap = (density: string | undefined) => {
    if (density === 'compact') return '16px';
    if (density === 'cozy') return '22px';
    return '28px';
};

const CHAT_FONT_OPTIONS = [
    { value: 'sans-serif', label: '黑体', description: '默认现代无衬线正文。' },
    { value: 'serif', label: '宋体', description: '更偏文档阅读的衬线正文。' },
    { value: 'kaiti', label: '楷体', description: '更具书卷感的中文正文。' }
] as const;

const CHAT_SHAPE_OPTIONS = [
    { value: 'bubble', label: '气泡', description: '保留即时通讯式消息块承载。' },
    { value: 'document', label: '文档', description: '去掉气泡壳层，按文稿流呈现正文。' }
] as const;

const CHAT_AVATAR_PLACEMENT_OPTIONS = [
    { value: 'hidden', label: '隐藏', description: '消息流中完全不显示该侧头像。' },
    { value: 'inline', label: '消息旁', description: '头像跟随消息显示在消息流内。' },
    { value: 'topbar', label: '顶栏', description: '头像移动到会话顶栏，不在消息流重复出现。' },
    { value: 'rail', label: '侧栏', description: '头像主要由外部角色/频道侧栏承担。' }
] as const;
const CHAT_ROLE_TYPOGRAPHY_OPTIONS = [
    { value: 'follow', label: '跟随统一值', description: '使用聊天字号、行高和文字间距。' },
    { value: 'custom', label: '单独设置', description: '为该侧消息使用专用排版数值。' }
] as const;
const GLOBAL_SCOPES: Array<'Global'> = ['Global'];
const ACTIVE_DESKTOP_MODE_SETTING_KEY = 'lumina-settings.activeDesktopMode';

const getActiveDesktopModeScopedSetting = (
    settings: Record<string, any>,
    settingKey: string,
    fallback: unknown
) => {
    const activeMode = String(
        settings[ACTIVE_DESKTOP_MODE_SETTING_KEY]
        ?? 'classic'
    );
    return settings[`desktop-mode-${activeMode}.${settingKey}`]
        ?? fallback;
};

const isRoleTypographyCustom = (role: 'assistant' | 'user') => (
    settings: Record<string, any>
) => getActiveDesktopModeScopedSetting(settings, `${role}TypographyMode`, 'follow') === 'custom';

const isAssistantTypographyCustom = isRoleTypographyCustom('assistant');
const isUserTypographyCustom = isRoleTypographyCustom('user');

const resolveFontFamily = (fontFamily: string | undefined) => {
    if (fontFamily === 'serif') return '"Noto Serif CJK SC", "Songti SC", serif';
    if (fontFamily === 'kaiti') return '"Kaiti SC", "STKaiti", serif';
    return '"Noto Sans SC", "Segoe UI", sans-serif';
};

export const createRoleMessageSettings = (defaults: {
    assistantShape: ThemeMessageShape;
    userShape: ThemeMessageShape;
    assistantAvatarPlacement: ThemeAvatarPlacement;
    userAvatarPlacement: ThemeAvatarPlacement;
}): Record<string, SettingDefinition> => ({
    assistantMessageShape: {
        default: defaults.assistantShape,
        label: 'AI 消息形态',
        description: '控制 Assistant 正文以气泡还是文档流承载。',
        common: true,
        type: 'options' as const,
        allowedScopes: GLOBAL_SCOPES,
        options: CHAT_SHAPE_OPTIONS.map(option => ({ ...option }))
    },
    userMessageShape: {
        default: defaults.userShape,
        label: '用户消息形态',
        description: '控制用户消息以气泡还是文档流承载。',
        common: true,
        type: 'options' as const,
        allowedScopes: GLOBAL_SCOPES,
        options: CHAT_SHAPE_OPTIONS.map(option => ({ ...option }))
    },
    assistantAvatarPlacement: {
        default: defaults.assistantAvatarPlacement,
        label: 'AI 头像位置',
        description: '控制 Assistant 头像显示在消息旁、顶栏、侧栏或隐藏。',
        common: true,
        type: 'options' as const,
        allowedScopes: GLOBAL_SCOPES,
        options: CHAT_AVATAR_PLACEMENT_OPTIONS.map(option => ({ ...option }))
    },
    userAvatarPlacement: {
        default: defaults.userAvatarPlacement,
        label: '用户头像位置',
        description: '控制用户头像显示在消息旁、顶栏、侧栏或隐藏。',
        common: true,
        type: 'options' as const,
        allowedScopes: GLOBAL_SCOPES,
        options: CHAT_AVATAR_PLACEMENT_OPTIONS.map(option => ({ ...option }))
    }
});

export const createChatTypographySettings = (defaults: {
    fontFamily?: string;
    fontWeight?: number;
    fontSize?: number;
    pageWidth?: 'auto' | number;
    lineHeight?: number;
    paragraphSpacing?: number;
    letterSpacing?: number;
}): Record<string, SettingDefinition> => ({
    chatFontFamily: {
        default: defaults.fontFamily ?? 'sans-serif',
        label: '聊天字体',
        description: '控制当前桌面模式聊天正文的字体族。',
        common: true,
        type: 'options' as const,
        allowedScopes: GLOBAL_SCOPES,
        options: CHAT_FONT_OPTIONS.map(option => ({ ...option }))
    },
    chatFontWeight: {
        default: defaults.fontWeight ?? 400,
        label: '聊天字重',
        common: true,
        type: 'stepper' as const,
        min: 100,
        max: 900,
        step: 100,
        allowedScopes: GLOBAL_SCOPES
    },
    chatFontSize: {
        default: defaults.fontSize ?? 16,
        label: '聊天字号',
        common: true,
        type: 'stepper' as const,
        min: 12,
        max: 72,
        allowedScopes: GLOBAL_SCOPES
    },
    chatPageWidth: {
        default: defaults.pageWidth ?? 'auto',
        label: '聊天最大宽度',
        common: false,
        type: 'options' as const,
        allowedScopes: GLOBAL_SCOPES,
        options: [
            { value: 'auto', label: '自动', description: '跟随当前布局自然撑开。' },
            { value: 640, label: '640', description: '更窄、更偏阅读视角。' },
            { value: 800, label: '800', description: '适合长文阅读。' },
            { value: 900, label: '900', description: '平衡聊天和文档感。' },
            { value: 1000, label: '1000', description: '更宽的正文容器。' },
            { value: 1280, label: '1280', description: '接近全宽工作台。' }
        ]
    },
    chatLineHeight: {
        default: defaults.lineHeight ?? 1.6,
        label: '聊天行高',
        common: false,
        type: 'slider' as const,
        min: 1,
        max: 3,
        step: 0.05,
        allowedScopes: GLOBAL_SCOPES
    },
    chatParagraphSpacing: {
        default: defaults.paragraphSpacing ?? 16,
        label: '段落间距',
        common: false,
        type: 'slider' as const,
        min: 0,
        max: 64,
        step: 1,
        allowedScopes: GLOBAL_SCOPES
    },
    chatLetterSpacing: {
        default: defaults.letterSpacing ?? 0,
        label: '文字间距',
        common: false,
        type: 'slider' as const,
        min: 0,
        max: 10,
        step: 0.1,
        allowedScopes: GLOBAL_SCOPES
    },
    assistantTypographyMode: {
        default: 'follow',
        label: 'AI 回复排版',
        description: '控制 AI 回复是否跟随统一聊天排版。',
        common: false,
        type: 'options' as const,
        allowedScopes: GLOBAL_SCOPES,
        options: CHAT_ROLE_TYPOGRAPHY_OPTIONS.map(option => ({ ...option }))
    },
    assistantFontSize: {
        default: defaults.fontSize ?? 16,
        label: 'AI 回复字号',
        common: false,
        type: 'stepper' as const,
        min: 12,
        max: 72,
        showIf: isAssistantTypographyCustom,
        allowedScopes: GLOBAL_SCOPES
    },
    assistantLineHeight: {
        default: defaults.lineHeight ?? 1.6,
        label: 'AI 回复行高',
        common: false,
        type: 'slider' as const,
        min: 1,
        max: 3,
        step: 0.05,
        showIf: isAssistantTypographyCustom,
        allowedScopes: GLOBAL_SCOPES
    },
    assistantLetterSpacing: {
        default: defaults.letterSpacing ?? 0,
        label: 'AI 回复字距',
        common: false,
        type: 'slider' as const,
        min: 0,
        max: 10,
        step: 0.1,
        showIf: isAssistantTypographyCustom,
        allowedScopes: GLOBAL_SCOPES
    },
    userTypographyMode: {
        default: 'follow',
        label: '用户输入排版',
        description: '控制用户消息和输入框是否跟随统一聊天排版。',
        common: false,
        type: 'options' as const,
        allowedScopes: GLOBAL_SCOPES,
        options: CHAT_ROLE_TYPOGRAPHY_OPTIONS.map(option => ({ ...option }))
    },
    userFontSize: {
        default: defaults.fontSize ?? 16,
        label: '用户输入字号',
        common: false,
        type: 'stepper' as const,
        min: 12,
        max: 72,
        showIf: isUserTypographyCustom,
        allowedScopes: GLOBAL_SCOPES
    },
    userLineHeight: {
        default: defaults.lineHeight ?? 1.6,
        label: '用户输入行高',
        common: false,
        type: 'slider' as const,
        min: 1,
        max: 3,
        step: 0.05,
        showIf: isUserTypographyCustom,
        allowedScopes: GLOBAL_SCOPES
    },
    userLetterSpacing: {
        default: defaults.letterSpacing ?? 0,
        label: '用户输入字距',
        common: false,
        type: 'slider' as const,
        min: 0,
        max: 10,
        step: 0.1,
        showIf: isUserTypographyCustom,
        allowedScopes: GLOBAL_SCOPES
    }
});

const resolveRoleTypographyVars = (
    activeSettings: ThemeValueMap,
    desktopModeId: string,
    prefix: '--lw-chat' | '--lw-chat-preview'
): Record<string, string> => {
    const fontSize = Number(getDesktopModeSettingValue(activeSettings, desktopModeId, 'chatFontSize', 16));
    const lineHeight = Number(getDesktopModeSettingValue(activeSettings, desktopModeId, 'chatLineHeight', 1.6));
    const letterSpacing = Number(getDesktopModeSettingValue(activeSettings, desktopModeId, 'chatLetterSpacing', 0));
    const assistantMode = String(getDesktopModeSettingValue(activeSettings, desktopModeId, 'assistantTypographyMode', 'follow'));
    const userMode = String(getDesktopModeSettingValue(activeSettings, desktopModeId, 'userTypographyMode', 'follow'));
    const assistantFontSize = assistantMode === 'custom'
        ? Number(getDesktopModeSettingValue(activeSettings, desktopModeId, 'assistantFontSize', fontSize))
        : fontSize;
    const assistantLineHeight = assistantMode === 'custom'
        ? Number(getDesktopModeSettingValue(activeSettings, desktopModeId, 'assistantLineHeight', lineHeight))
        : lineHeight;
    const assistantLetterSpacing = assistantMode === 'custom'
        ? Number(getDesktopModeSettingValue(activeSettings, desktopModeId, 'assistantLetterSpacing', letterSpacing))
        : letterSpacing;
    const userFontSize = userMode === 'custom'
        ? Number(getDesktopModeSettingValue(activeSettings, desktopModeId, 'userFontSize', fontSize))
        : fontSize;
    const userLineHeight = userMode === 'custom'
        ? Number(getDesktopModeSettingValue(activeSettings, desktopModeId, 'userLineHeight', lineHeight))
        : lineHeight;
    const userLetterSpacing = userMode === 'custom'
        ? Number(getDesktopModeSettingValue(activeSettings, desktopModeId, 'userLetterSpacing', letterSpacing))
        : letterSpacing;

    return {
        [`${prefix}-assistant-font-size`]: `${assistantFontSize}px`,
        [`${prefix}-assistant-line-height`]: String(assistantLineHeight),
        [`${prefix}-assistant-letter-spacing`]: `${assistantLetterSpacing}px`,
        [`${prefix}-user-font-size`]: `${userFontSize}px`,
        [`${prefix}-user-line-height`]: String(userLineHeight),
        [`${prefix}-user-letter-spacing`]: `${userLetterSpacing}px`
    };
};

export const createSurfaceSkinMap = (overrides: ThemeValueMap = {}): DesktopModeManifest['surfaceSkins'] => ({
    'shell.app': {
        componentId: 'shell.app',
        cssVars: {
            '--lw-shell-panel-bg':
                'radial-gradient(circle at 18% 10%, rgba(var(--lw-primary-rgb), 0.12), transparent 24%), radial-gradient(circle at 80% 14%, rgba(255, 255, 255, 0.72), transparent 20%), linear-gradient(180deg, color-mix(in srgb, var(--lw-bg-elevated) 98%, white), color-mix(in srgb, var(--lw-bg-app) 96%, white))',
            '--lw-shell-panel-overlay':
                'linear-gradient(180deg, rgba(255, 255, 255, 0.42), transparent 24%), radial-gradient(rgba(38, 52, 76, 0.055) 0.8px, transparent 0.8px)'
        }
    },
    'shell.panelBody': {
        componentId: 'shell.panelBody',
        cssVars: {
            '--lw-shell-body-bg':
                'linear-gradient(180deg, rgba(var(--lw-primary-rgb), 0.16) 0%, rgba(var(--lw-primary-rgb), 0.08) 18%, transparent 44%), linear-gradient(180deg, color-mix(in srgb, var(--lw-bg-surface) 98%, white), color-mix(in srgb, var(--lw-bg-subtle) 96%, white))',
            '--lw-shell-freeform-gap': '14px'
        }
    },
    'shell.header': {
        componentId: 'shell.header',
        cssVars: {
            '--lw-header-bg': 'var(--lw-bg-elevated)',
            '--lw-header-border': 'var(--lw-border-base)',
            '--lw-header-shadow': 'none',
            '--lw-header-bottom-shadow': 'none',
            '--lw-header-control-bg': 'var(--lw-bg-elevated)',
            '--lw-header-control-border': 'var(--lw-border-base)',
            '--lw-header-control-shadow': 'var(--lw-shadow-card)',
            '--lw-header-control-hover-bg': 'var(--lw-bg-hover)',
            '--lw-header-avatar-shadow': 'var(--lw-shadow-card)',
            '--lw-header-tab-bg': 'var(--lw-bg-subtle)',
            '--lw-header-tab-hover-bg': 'var(--lw-bg-hover)',
            '--lw-header-tab-active-bg': 'var(--lw-bg-active)',
            '--lw-header-channel-mark-bg': 'var(--lw-bg-elevated)',
            '--lw-header-channel-mark-color': 'var(--lw-text-muted)',
            '--lw-header-channel-mark-active-bg': 'var(--lw-bg-hover)',
            '--lw-header-channel-mark-active-color': 'var(--lw-text-main)',
            '--lw-header-channel-mark-active-border': 'rgba(var(--lw-primary-rgb), 0.3)'
        }
    },
    'shell.mainSurface': {
        componentId: 'shell.mainSurface',
        cssVars: {
            '--lw-shell-main-bg':
                'linear-gradient(180deg, color-mix(in srgb, var(--lw-bg-elevated) 94%, transparent), color-mix(in srgb, var(--lw-bg-surface) 88%, transparent))',
            '--lw-shell-main-mobile-bg': 'var(--lw-shell-main-bg)',
            '--lw-shell-main-border': 'color-mix(in srgb, var(--lw-border-base) 88%, var(--lw-bg-elevated))',
            '--lw-shell-main-radius': '24px',
            '--lw-shell-main-shadow': '0 20px 44px rgba(15, 23, 42, 0.08)'
        }
    },
    'shell.widget': {
        componentId: 'shell.widget',
        cssVars: {
            '--lw-shell-widget-bg':
                'linear-gradient(180deg, color-mix(in srgb, var(--lw-bg-elevated) 94%, transparent), color-mix(in srgb, var(--lw-bg-surface) 88%, transparent))',
            '--lw-shell-widget-border': 'color-mix(in srgb, var(--lw-border, var(--lw-border-base)) 88%, var(--lw-bg-elevated))',
            '--lw-shell-widget-divider-border': '1px solid var(--lw-shell-widget-border)',
            '--lw-shell-widget-radius': '24px',
            '--lw-shell-widget-header-bg': 'transparent',
            '--lw-shell-widget-pane-bg': 'var(--lw-shell-widget-bg)',
            '--lw-shell-widget-dropdown-bg': 'var(--lw-surface-container-high)',
            '--lw-shell-widget-dropdown-border': 'var(--lw-border-subtle)',
            '--lw-shell-widget-content-overlay': 'transparent'
        }
    },
    'shell.workspaceStage': {
        componentId: 'shell.workspaceStage',
        cssVars: {
            '--lw-shell-stage-radius': '30px',
            '--lw-shell-stage-border': 'color-mix(in srgb, var(--lw-border-base) 88%, white)',
            '--lw-shell-stage-shadow': '0 22px 52px rgba(15, 23, 42, 0.08)',
            '--lw-shell-stage-bg':
                'radial-gradient(circle at 18% 20%, rgba(var(--lw-primary-rgb), 0.24), transparent 26%), radial-gradient(circle at 82% 14%, rgba(255, 255, 255, 0.64), transparent 24%), linear-gradient(180deg, rgba(154, 184, 232, 0.96) 0%, rgba(182, 204, 241, 0.88) 24%, rgba(216, 228, 247, 0.94) 70%, rgba(236, 242, 251, 0.98) 100%)'
        }
    },
    'shell.workspaceMenu': {
        componentId: 'shell.workspaceMenu',
        cssVars: {
            '--lw-shell-workspace-menu-bg':
                'linear-gradient(180deg, color-mix(in srgb, var(--lw-bg-elevated) 78%, transparent), color-mix(in srgb, var(--lw-bg-surface) 54%, transparent))',
            '--lw-shell-workspace-menu-border': 'color-mix(in srgb, var(--lw-border-base) 72%, transparent)',
            '--lw-shell-workspace-menu-item-bg': 'color-mix(in srgb, var(--lw-bg-elevated) 76%, transparent)',
            '--lw-shell-workspace-menu-item-active-bg': 'color-mix(in srgb, var(--lw-bg-hover) 82%, transparent)'
        }
    },
    'shell.characterRail': {
        componentId: 'shell.characterRail',
        cssVars: {
            '--lw-character-rail-bg': 'color-mix(in srgb, var(--lw-bg-subtle) 88%, transparent)',
            '--lw-character-rail-border': 'var(--lw-border-base)',
            '--lw-character-rail-width': '288px',
            ...overrides
        }
    },
    'shell.guildRail': {
        componentId: 'shell.guildRail',
        cssVars: {
            '--lw-guild-rail-bg': 'color-mix(in srgb, var(--lw-bg-app) 94%, white)',
            '--lw-guild-rail-border': 'color-mix(in srgb, var(--lw-border-base) 92%, white)',
            '--lw-guild-rail-width': '76px',
            '--lw-guild-rail-item-bg': 'color-mix(in srgb, var(--lw-bg-elevated) 94%, white)',
            '--lw-guild-rail-item-active-bg': 'color-mix(in srgb, var(--lw-primary) 14%, white)',
            '--lw-guild-rail-item-color': 'var(--lw-text-secondary)',
            ...overrides
        }
    },
    'shell.characterCard': {
        componentId: 'shell.characterCard',
        cssVars: ({ activeSettings, desktopModeId }) => {
            const density = getDesktopModeSettingValue(activeSettings, desktopModeId, 'sidebarCardDensity');
            const avatarShape = getDesktopModeSettingValue(activeSettings, desktopModeId, 'avatarShape');
            return {
                '--lw-character-card-bg': 'var(--lw-bg-surface)',
                '--lw-character-card-border': 'var(--lw-border-base)',
                '--lw-character-card-active-border': 'rgba(var(--lw-primary-rgb), 0.32)',
                '--lw-character-card-radius': density === 'compact' ? '18px' : '20px',
                '--lw-character-card-avatar-size': density === 'compact' ? '42px' : '46px',
                '--lw-character-card-avatar-radius': resolveAvatarRadius(avatarShape),
                '--lw-character-card-avatar-shadow': 'none',
                '--lw-character-card-menu-shadow': 'var(--lw-shadow-card)',
                '--lw-character-rail-logo-bg': 'var(--lw-primary)',
                '--lw-character-card-shadow': 'none',
                '--lw-character-rail-mobile-shadow': '0 -22px 40px rgba(0, 0, 0, 0.22)',
                '--lw-character-session-bg': 'color-mix(in srgb, var(--lw-bg-elevated) 76%, transparent)',
                ...overrides
            };
        }
    },
    'shell.mobileDiscord': {
        componentId: 'shell.mobileDiscord',
        cssVars: {
            '--lw-discord-mobile-shell-bg': 'var(--lw-bg-app)',
            '--lw-discord-mobile-shell-border': 'var(--lw-border-strong)',
            '--lw-discord-mobile-shell-shadow': '0 16px 30px rgba(0, 0, 0, 0.22)',
            '--lw-discord-mobile-toggle-bg': 'var(--lw-bg-elevated)',
            '--lw-discord-mobile-toggle-border': 'var(--lw-border-strong)',
            '--lw-discord-mobile-toggle-shadow': '0 16px 28px rgba(0, 0, 0, 0.22)',
            '--lw-discord-mobile-toggle-active-bg': 'var(--lw-bg-hover)',
            '--lw-discord-mobile-toggle-active-border': 'rgba(var(--lw-primary-rgb), 0.45)',
            '--lw-discord-mobile-toggle-mark-bg': 'var(--lw-bg-surface)',
            '--lw-discord-mobile-toggle-mark-color': 'var(--lw-text-muted)',
            '--lw-discord-mobile-sheet-bg': 'rgba(0, 0, 0, 0.42)',
            '--lw-discord-mobile-sheet-backdrop': 'blur(6px)'
        }
    },
    'chat.stream': {
        componentId: 'chat.stream',
        cssVars: ({ activeSettings, desktopModeId, resolvedAppearance }) => {
            const density = getDesktopModeSettingValue(activeSettings, desktopModeId, 'messageDensity');
            const avatarShape = getDesktopModeSettingValue(activeSettings, desktopModeId, 'avatarShape');
            const bubbleStyle = getDesktopModeSettingValue(activeSettings, desktopModeId, 'bubbleStyle');
            const chatFontFamily = getDesktopModeSettingValue(activeSettings, desktopModeId, 'chatFontFamily', 'sans-serif');
            const isDark = resolvedAppearance === 'dark';
            return {
                '--lw-chat-stream-bg': isDark ? 'var(--lw-bg-app)' : 'transparent',
                '--lw-chat-scroll-bg': 'transparent',
                '--lw-chat-scroll-padding': density === 'compact' ? '18px 28px' : '24px 40px',
                '--lw-chat-content-gap': resolveMessageGap(density),
                '--lw-chat-avatar-size': density === 'compact' ? '36px' : '40px',
                '--lw-chat-avatar-radius': resolveAvatarRadius(avatarShape),
                '--lw-chat-avatar-shadow': 'none',
                '--lw-chat-bubble-radius': resolveBubbleRadius(bubbleStyle),
                '--lw-chat-input-radius': bubbleStyle === 'soft' ? '20px' : '16px',
                '--lw-chat-input-toolbar-bg': 'var(--lw-surface-container-high)',
                '--lw-chat-input-toolbar-shadow': 'var(--lw-shadow-card)',
                '--lw-chat-input-shadow': 'var(--lw-shadow-card)',
                '--lw-chat-menu-shadow': 'var(--lw-shadow-card)',
                '--lw-chat-empty-mark-bg': 'var(--lw-primary)',
                '--lw-chat-empty-mark-shadow': 'var(--lw-shadow-card)',
                '--lw-chat-user-name-display': getDesktopModeSettingValue(activeSettings, desktopModeId, 'showUsernames', true) === false ? 'none' : 'inline-flex',
                '--lw-chat-user-bubble': isDark ? 'color-mix(in srgb, var(--lw-bg-surface) 92%, white 8%)' : 'var(--lw-bg-subtle)',
                '--lw-chat-user-bubble-border': 'var(--lw-chat-border, var(--lw-border-subtle))',
                '--lw-chat-message-hover-bg': 'transparent',
                '--lw-chat-assistant-shape': String(getDesktopModeSettingValue(activeSettings, desktopModeId, 'assistantMessageShape', 'bubble')),
                '--lw-chat-user-shape': String(getDesktopModeSettingValue(activeSettings, desktopModeId, 'userMessageShape', 'bubble')),
                '--lw-chat-assistant-avatar-placement': String(getDesktopModeSettingValue(activeSettings, desktopModeId, 'assistantAvatarPlacement', 'inline')),
                '--lw-chat-user-avatar-placement': String(getDesktopModeSettingValue(activeSettings, desktopModeId, 'userAvatarPlacement', 'inline')),
                '--lw-chat-font': resolveFontFamily(chatFontFamily),
                '--lw-chat-font-weight': Number(getDesktopModeSettingValue(activeSettings, desktopModeId, 'chatFontWeight', 400)),
                '--lw-chat-font-size': `${Number(getDesktopModeSettingValue(activeSettings, desktopModeId, 'chatFontSize', 16))}px`,
                '--lw-chat-line-height': Number(getDesktopModeSettingValue(activeSettings, desktopModeId, 'chatLineHeight', 1.6)),
                '--lw-chat-paragraph-spacing': `${Number(getDesktopModeSettingValue(activeSettings, desktopModeId, 'chatParagraphSpacing', 16))}px`,
                '--lw-chat-letter-spacing': `${Number(getDesktopModeSettingValue(activeSettings, desktopModeId, 'chatLetterSpacing', 0))}px`,
                '--lw-chat-page-width': String(getDesktopModeSettingValue(activeSettings, desktopModeId, 'chatPageWidth', 'auto')),
                ...resolveRoleTypographyVars(activeSettings, desktopModeId, '--lw-chat'),
                ...overrides
            };
        }
    },
    'chat.preview': {
        componentId: 'chat.preview',
        cssVars: ({ activeSettings, desktopModeId, resolvedAppearance }) => {
            const density = getDesktopModeSettingValue(activeSettings, desktopModeId, 'messageDensity');
            const bubbleStyle = getDesktopModeSettingValue(activeSettings, desktopModeId, 'bubbleStyle');
            const avatarShape = getDesktopModeSettingValue(activeSettings, desktopModeId, 'avatarShape');
            const chatFontFamily = getDesktopModeSettingValue(activeSettings, desktopModeId, 'chatFontFamily', 'sans-serif');
            const isDark = resolvedAppearance === 'dark';
            return {
                '--lw-chat-preview-bg': isDark ? 'color-mix(in srgb, var(--lw-bg-app) 92%, black)' : 'var(--lw-bg-subtle)',
                '--lw-chat-preview-bubble-bg': 'var(--lw-bg-surface)',
                '--lw-chat-preview-user-bubble-bg': isDark ? 'color-mix(in srgb, var(--lw-bg-surface) 80%, white 20%)' : 'var(--lw-bg-hover)',
                '--lw-chat-preview-text-color': 'var(--lw-text-main)',
                '--lw-chat-preview-bubble-radius': resolveBubbleRadius(bubbleStyle),
                '--lw-chat-preview-padding': density === 'compact' ? '10px 14px' : '12px 16px',
                '--lw-chat-preview-avatar-radius': resolveAvatarRadius(avatarShape),
                '--lw-chat-preview-assistant-shape': String(getDesktopModeSettingValue(activeSettings, desktopModeId, 'assistantMessageShape', 'bubble')),
                '--lw-chat-preview-user-shape': String(getDesktopModeSettingValue(activeSettings, desktopModeId, 'userMessageShape', 'bubble')),
                '--lw-chat-preview-assistant-avatar-placement': String(getDesktopModeSettingValue(activeSettings, desktopModeId, 'assistantAvatarPlacement', 'inline')),
                '--lw-chat-preview-user-avatar-placement': String(getDesktopModeSettingValue(activeSettings, desktopModeId, 'userAvatarPlacement', 'inline')),
                '--lw-chat-preview-font': resolveFontFamily(chatFontFamily),
                '--lw-chat-preview-font-weight': Number(getDesktopModeSettingValue(activeSettings, desktopModeId, 'chatFontWeight', 400)),
                '--lw-chat-preview-font-size': `${Number(getDesktopModeSettingValue(activeSettings, desktopModeId, 'chatFontSize', 16))}px`,
                '--lw-chat-preview-line-height': Number(getDesktopModeSettingValue(activeSettings, desktopModeId, 'chatLineHeight', 1.6)),
                '--lw-chat-preview-paragraph-spacing': `${Number(getDesktopModeSettingValue(activeSettings, desktopModeId, 'chatParagraphSpacing', 16))}px`,
                '--lw-chat-preview-letter-spacing': `${Number(getDesktopModeSettingValue(activeSettings, desktopModeId, 'chatLetterSpacing', 0))}px`,
                ...resolveRoleTypographyVars(activeSettings, desktopModeId, '--lw-chat-preview'),
                ...overrides
            };
        }
    },
    'settings.root': {
        componentId: 'settings.root',
        cssVars: {
            '--lw-settings-shell-bg': 'transparent',
            '--lw-settings-shell-overlay': 'none',
            '--lw-settings-sidebar-bg': 'color-mix(in srgb, var(--lw-bg-elevated) 92%, transparent)',
            '--lw-settings-sidebar-border': 'var(--lw-border-base)',
            '--lw-settings-header-bg': 'color-mix(in srgb, var(--lw-bg-elevated) 92%, transparent)',
            '--lw-settings-header-border': 'var(--lw-border-base)',
            '--lw-settings-nav-item-color': 'var(--lw-text-secondary)',
            '--lw-settings-nav-hover-bg': 'var(--lw-bg-hover)',
            '--lw-settings-nav-hover-color': 'var(--lw-text-main)',
            '--lw-settings-nav-active-bg': 'var(--lw-bg-selection)',
            '--lw-settings-nav-active-color': 'var(--lw-text-main)',
            '--lw-settings-nav-active-shadow': 'var(--lw-shadow)',
            '--lw-settings-muted-color': 'var(--lw-text-muted)',
            '--lw-settings-breadcrumb-hover-color': 'var(--lw-primary)',
            '--lw-settings-card-radius': '24px'
        }
    },
    'settings.unified': {
        componentId: 'settings.unified',
        cssVars: {
            '--lw-settings-grid-gap': 'var(--lw-item-gap)',
            '--lw-settings-block-bg': 'color-mix(in srgb, var(--lw-bg-elevated) 96%, transparent)',
            '--lw-settings-block-border': 'var(--lw-border-base)',
            '--lw-settings-block-shadow': 'var(--lw-shadow-card)',
            '--lw-settings-inner-card-bg': 'var(--lw-surface-container)',
            '--lw-settings-inner-card-border': 'var(--lw-border-subtle)'
        }
    },
    'settings.detailed': {
        componentId: 'settings.detailed',
        cssVars: {
            '--lw-settings-detail-bg': 'color-mix(in srgb, var(--lw-bg-elevated) 94%, transparent)',
            '--lw-settings-detail-border': 'var(--lw-border-base)',
            '--lw-settings-detail-shadow': 'var(--lw-shadow-card)',
            '--lw-settings-detail-radius': '24px'
        }
    },
    'settings.control': {
        componentId: 'settings.control',
        cssVars: ({ resolvedAppearance }) => ({
            '--lw-setting-row-hover-bg': resolvedAppearance === 'dark'
                ? 'color-mix(in srgb, var(--lw-bg-surface) 84%, white 16%)'
                : 'var(--lw-bg-hover)',
            '--lw-setting-control-bg': 'var(--lw-bg-subtle)',
            '--lw-setting-control-border': 'var(--lw-border-base)',
            '--lw-setting-control-active-bg': 'var(--lw-bg-surface)',
            '--lw-setting-control-active-shadow': 'var(--lw-shadow-card)',
            '--lw-setting-tip-border': 'var(--lw-primary)',
            '--lw-setting-slider-track': resolvedAppearance === 'dark' ? '#3b3d44' : '#f1f5f9'
        })
    },
    'timeline.root': {
        componentId: 'timeline.root',
        cssVars: {
            '--lw-timeline-canvas-bg': 'var(--lw-bg-app)',
            '--lw-timeline-header-bg': 'color-mix(in srgb, var(--lw-bg-elevated) 88%, transparent)',
            '--lw-timeline-header-border': 'var(--lw-border-base)',
            '--lw-timeline-card-bg': 'var(--lw-surface-container-low)',
            '--lw-timeline-card-border': 'var(--lw-border-base)',
            '--lw-timeline-card-shadow': 'var(--lw-shadow-card)',
            '--lw-timeline-card-active-bg': 'var(--lw-surface-container-lowest)',
            '--lw-timeline-card-active-border': 'var(--lw-border-active)',
            '--lw-timeline-chip-bg': 'var(--lw-surface-container-high)',
            '--lw-timeline-chip-border': 'var(--lw-border-subtle)',
            '--lw-timeline-chip-active-bg': 'var(--lw-bg-selection)',
            '--lw-timeline-chip-active-border': 'var(--lw-border-active)',
            '--lw-timeline-modal-overlay-bg': 'rgba(var(--lw-bg-elevated-rgb), 0.42)',
            '--lw-timeline-modal-bg': 'var(--lw-surface-container-lowest)',
            '--lw-timeline-modal-border': 'var(--lw-border-base)',
            '--lw-timeline-modal-body-bg': 'var(--lw-surface-container-low)',
            '--lw-timeline-mini-avatar-radius': '50%'
        }
    },
    'lorebook.workspace': {
        componentId: 'lorebook.workspace',
        cssVars: {
            '--lw-lorebook-workspace-bg':
                'linear-gradient(180deg, rgba(var(--lw-bg-elevated-rgb), 0.48), rgba(var(--lw-bg-elevated-rgb), 0))',
            '--lw-lorebook-header-bg': 'color-mix(in srgb, var(--lw-bg-elevated) 90%, transparent)',
            '--lw-lorebook-header-border': 'var(--lw-border-base)',
            '--lw-lorebook-panel-bg': 'var(--lw-surface-container-lowest)',
            '--lw-lorebook-panel-hover-bg': 'var(--lw-bg-hover)',
            '--lw-lorebook-panel-border': 'var(--lw-border-base)',
            '--lw-lorebook-control-bg': 'var(--lw-surface-container-high)',
            '--lw-lorebook-control-border': 'var(--lw-border-base)',
            '--lw-lorebook-item-bg': 'var(--lw-surface-container-lowest)',
            '--lw-lorebook-item-border': 'var(--lw-border-base)',
            '--lw-lorebook-item-hover-bg': 'var(--lw-bg-hover)',
            '--lw-lorebook-panel-outline': 'rgba(0, 0, 0, 0.02)',
            '--lw-lorebook-overlay-bg': 'rgba(var(--lw-bg-elevated-rgb), 0.5)',
            '--lw-lorebook-overlay-backdrop': 'var(--lw-glass-blur)',
            '--lw-lorebook-chip-bg': 'var(--lw-surface-container-high)',
            '--lw-lorebook-chip-accent-bg': 'var(--lw-bg-subtle)',
            '--lw-lorebook-table-header-bg': 'var(--lw-bg-app)'
        }
    },
    'lorebook.editor': {
        componentId: 'lorebook.editor',
        cssVars: {
            '--lw-lorebook-editor-bg': 'var(--lw-surface-container-lowest)',
            '--lw-lorebook-editor-header-bg': 'var(--lw-surface-container-lowest)',
            '--lw-lorebook-editor-header-border': 'var(--lw-border-base)',
            '--lw-lorebook-editor-control-bg': 'var(--lw-surface-container-low)',
            '--lw-lorebook-editor-control-border': 'var(--lw-border-base)',
            '--lw-lorebook-editor-control-hover-bg': 'var(--lw-surface-container-high)',
            '--lw-lorebook-editor-section-bg': 'var(--lw-surface-container-lowest)',
            '--lw-lorebook-editor-section-border': 'var(--lw-border-base)',
            '--lw-lorebook-editor-accent-bg': 'var(--lw-bg-selection)',
            '--lw-lorebook-editor-switch-bg': 'var(--lw-surface-container-highest)',
            '--lw-lorebook-editor-switch-dot': 'var(--lw-bg-elevated)',
            '--lw-lorebook-editor-range-track': 'var(--lw-surface-container-high)',
            '--lw-lorebook-editor-save-bg': 'var(--lw-black)',
            '--lw-lorebook-editor-save-color': 'var(--lw-text-inverse)',
            '--lw-lorebook-editor-save-hover-bg': 'color-mix(in srgb, var(--lw-black) 92%, white)',
            '--lw-lorebook-editor-saving-bg': 'var(--lw-bg-active)',
            '--lw-lorebook-editor-success-bg': 'var(--lw-success)'
        }
    },
    'stats.panel': {
        componentId: 'stats.panel',
        cssVars: {
            '--lw-stats-panel-bg': 'transparent',
            '--lw-stats-panel-highlight': 'none',
            '--lw-stats-shell-bg': 'color-mix(in srgb, var(--lw-bg-elevated) 94%, transparent)',
            '--lw-stats-shell-border': 'var(--lw-border-base)',
            '--lw-stats-shell-shadow': 'var(--lw-shadow)',
            '--lw-stats-card-bg': 'var(--lw-bg-surface)',
            '--lw-stats-card-border': 'var(--lw-border-subtle)',
            '--lw-stats-badge-bg': 'var(--lw-bg-subtle)',
            '--lw-stats-badge-border': 'var(--lw-border-subtle)',
            '--lw-stats-metric-fill-bg': 'var(--lw-primary)',
            '--lw-stats-tag-bg': 'var(--lw-bg-subtle)',
            '--lw-stats-tag-border': 'var(--lw-border-subtle)',
            '--lw-stats-helper-bg': 'transparent',
            '--lw-stats-helper-border': 'var(--lw-border-subtle)'
        }
    },
    'director.panel': {
        componentId: 'director.panel',
        cssVars: {
            '--lw-director-panel-bg': 'linear-gradient(180deg, rgba(var(--lw-bg-elevated-rgb), 0.42), rgba(var(--lw-bg-elevated-rgb), 0))',
            '--lw-director-panel-highlight': 'none',
            '--lw-director-header-bg': 'color-mix(in srgb, var(--lw-bg-elevated) 92%, transparent)',
            '--lw-director-header-border': 'var(--lw-border-base)',
            '--lw-director-section-bg': 'color-mix(in srgb, var(--lw-bg-elevated) 94%, transparent)',
            '--lw-director-section-border': 'var(--lw-border-base)',
            '--lw-director-section-shadow': 'var(--lw-shadow)',
            '--lw-director-control-bg': 'var(--lw-bg-surface)',
            '--lw-director-control-border': 'var(--lw-border-base)',
            '--lw-director-control-header-bg': 'var(--lw-bg-subtle)',
            '--lw-director-input-bg': 'var(--lw-bg-surface)',
            '--lw-director-input-border': 'var(--lw-border-base)',
            '--lw-director-table-border': 'var(--lw-border-subtle)'
        }
    }
});

const cleanThemeValueMap = (values: ThemeValueMap): ThemeValueMap => {
    const cleaned: ThemeValueMap = {};
    Object.entries(values).forEach(([key, value]) => {
        if (value !== undefined) {
            cleaned[key] = value;
        }
    });
    return cleaned;
};

export const resolveThemeValueMap = (
    resolver: ThemeValueResolver | undefined,
    context: ComponentThemeContext
): ThemeValueMap => {
    if (!resolver) return {};
    const resolved = typeof resolver === 'function' ? resolver(context) : resolver;
    return cleanThemeValueMap(resolved);
};

export const mergeCssVars = (
    base: ThemeValueResolver | undefined,
    overrides: ThemeValueResolver
): ThemeValueResolver => (context: ComponentThemeContext) => ({
    ...resolveThemeValueMap(base, context),
    ...resolveThemeValueMap(overrides, context)
});
