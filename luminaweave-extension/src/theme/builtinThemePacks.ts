import type { SettingDefinition } from '../types/plugin';
import { getThemeSettingValue } from './themeRegistry';
import type {
    ComponentThemeContext,
    DesktopModeManifest,
    ThemePack,
    ThemeValueMap,
    ThemeValueResolver
} from './types';

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

const discordThemeSettings: Record<string, SettingDefinition> = {
    messageDensity: {
        default: 'compact',
        label: '消息密度',
        description: '控制聊天消息之间的垂直间距与整体紧凑度。',
        common: true,
        type: 'options' as const,
        allowedScopes: ['Global'],
        options: [
            { value: 'compact', label: '紧凑', description: '更接近 Discord 的密集聊天列表。' },
            { value: 'cozy', label: '舒适', description: '保留更多留白，适合长文本阅读。' }
        ]
    },
    avatarShape: {
        default: 'rounded',
        label: '头像形状',
        description: '控制角色卡和聊天头像的圆角风格。',
        common: true,
        type: 'options' as const,
        allowedScopes: ['Global'],
        options: [
            { value: 'rounded', label: '圆角方形', description: '更接近 Discord 的频道头像感觉。' },
            { value: 'circle', label: '圆形', description: '保留传统聊天头像样式。' },
            { value: 'square', label: '方形', description: '更硬朗的面板化视觉。' }
        ]
    },
    bubbleStyle: {
        default: 'compact',
        label: '消息气泡样式',
        description: '控制消息块的圆角和背景强度。',
        common: true,
        type: 'options' as const,
        allowedScopes: ['Global'],
        options: [
            { value: 'compact', label: '频道块', description: '更扁平、紧凑，像频道聊天日志。' },
            { value: 'soft', label: '柔和卡片', description: '更圆润，更强调消息卡片感。' }
        ]
    },
    showUsernames: {
        default: true,
        label: '显示用户名',
        description: '关闭后仅保留头像与消息主体。',
        common: true,
        type: 'boolean' as const,
        allowedScopes: ['Global']
    },
    sidebarCardDensity: {
        default: 'cozy',
        label: '角色卡密度',
        description: '用于 Discord 风格角色卡侧栏的留白密度。',
        common: true,
        type: 'options' as const,
        allowedScopes: ['Global'],
        options: [
            { value: 'compact', label: '紧凑', description: '更高信息密度。' },
            { value: 'cozy', label: '舒适', description: '保留更宽松的点击区。' }
        ]
    },
    sidebarPreviewLines: {
        default: 2,
        label: '侧栏预览行数',
        description: '角色卡会话预览保留的文本行数。',
        common: true,
        type: 'stepper' as const,
        min: 1,
        max: 4,
        allowedScopes: ['Global']
    },
    'discord-channel-mark': {
        default: true,
        label: '显示 Guild Rail',
        description: '控制 Discord 桌面模式中的频道标记轨是否显示。',
        common: true,
        type: 'boolean' as const,
        allowedScopes: ['Global']
    },
    mobileGuildRailPosition: {
        default: 'top',
        label: '移动端 Guild Rail 位置',
        description: '控制 Discord 移动端主导航条固定在哪个边缘。',
        common: true,
        type: 'options' as const,
        allowedScopes: ['Global'],
        options: [
            { value: 'top', label: '顶部', description: '像 Discord 移动端一样停靠在顶部。' },
            { value: 'bottom', label: '底部', description: '把主导航条移到底部，便于拇指切换。' },
            { value: 'left', label: '左侧', description: '将主导航条改成左侧竖向停靠。' },
            { value: 'right', label: '右侧', description: '将主导航条改成右侧竖向停靠。' }
        ]
    },
    mobileCharacterEntryPosition: {
        default: 'top',
        label: '移动端角色频道入口位置',
        description: '控制 Discord 移动端 DM / 角色历史入口固定在哪个边缘。',
        common: true,
        type: 'options' as const,
        allowedScopes: ['Global'],
        options: [
            { value: 'top', label: '顶部', description: '将角色频道入口放在顶部。' },
            { value: 'bottom', label: '底部', description: '将角色频道入口放在底部。' },
            { value: 'left', label: '左侧', description: '将角色频道入口停靠在左侧。' },
            { value: 'right', label: '右侧', description: '将角色频道入口停靠在右侧。' }
        ]
    }
};

const classicThemeSettings: Record<string, SettingDefinition> = {
    messageDensity: {
        default: 'cozy',
        label: '消息密度',
        description: '控制聊天区消息间距。',
        common: true,
        type: 'options' as const,
        allowedScopes: ['Global'],
        options: [
            { value: 'compact', label: '紧凑', description: '适合长对话快速浏览。' },
            { value: 'cozy', label: '舒适', description: '保留默认阅读节奏。' }
        ]
    },
    avatarShape: {
        default: 'circle',
        label: '头像形状',
        description: '控制聊天头像圆角。',
        common: true,
        type: 'options' as const,
        allowedScopes: ['Global'],
        options: [
            { value: 'circle', label: '圆形', description: '默认传统聊天样式。' },
            { value: 'rounded', label: '圆角', description: '更现代的卡片化头像。' }
        ]
    },
    bubbleStyle: {
        default: 'default',
        label: '消息气泡样式',
        description: '控制默认消息卡片的圆角强度。',
        common: true,
        type: 'options' as const,
        allowedScopes: ['Global'],
        options: [
            { value: 'default', label: '默认', description: '保持当前 Lumina 聊天气泡。' },
            { value: 'soft', label: '柔和', description: '更圆润、更轻。' }
        ]
    },
    showUsernames: {
        default: true,
        label: '显示用户名',
        common: true,
        type: 'boolean' as const,
        allowedScopes: ['Global']
    }
};

const stageThemeSettings: Record<string, SettingDefinition> = {
    messageDensity: classicThemeSettings.messageDensity,
    avatarShape: {
        ...classicThemeSettings.avatarShape,
        default: 'rounded'
    },
    bubbleStyle: {
        ...classicThemeSettings.bubbleStyle,
        default: 'soft'
    },
    showUsernames: classicThemeSettings.showUsernames
};

const createSurfaceSkinMap = (overrides: ThemeValueMap = {}): DesktopModeManifest['surfaceSkins'] => ({
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
    'shell.mainSurface': {
        componentId: 'shell.mainSurface',
        cssVars: {
            '--lw-shell-main-bg':
                'linear-gradient(180deg, rgba(255, 255, 255, 0.92), color-mix(in srgb, var(--lw-bg-elevated) 96%, white))',
            '--lw-shell-main-border': 'color-mix(in srgb, var(--lw-border-base) 88%, white)',
            '--lw-shell-main-radius': '24px',
            '--lw-shell-main-shadow': '0 20px 44px rgba(15, 23, 42, 0.08)'
        }
    },
    'shell.widget': {
        componentId: 'shell.widget',
        cssVars: {
            '--lw-shell-widget-bg':
                'linear-gradient(180deg, rgba(255, 255, 255, 0.92), color-mix(in srgb, var(--lw-bg-elevated) 96%, white))',
            '--lw-shell-widget-border': 'color-mix(in srgb, var(--lw-border, var(--lw-border-base)) 88%, white)',
            '--lw-shell-widget-radius': '24px',
            '--lw-shell-widget-header-bg': 'transparent'
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
                'linear-gradient(180deg, rgba(255, 255, 255, 0.56), rgba(244, 248, 254, 0.34))',
            '--lw-shell-workspace-menu-border': 'rgba(255, 255, 255, 0.42)',
            '--lw-shell-workspace-menu-item-bg': 'rgba(255, 255, 255, 0.24)',
            '--lw-shell-workspace-menu-item-active-bg': 'rgba(255, 255, 255, 0.4)'
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
        cssVars: ({ activeSettings, themePackId }) => {
            const density = getThemeSettingValue(activeSettings, themePackId, 'sidebarCardDensity');
            const avatarShape = getThemeSettingValue(activeSettings, themePackId, 'avatarShape');
            return {
                '--lw-character-card-bg': 'var(--lw-bg-surface)',
                '--lw-character-card-border': 'var(--lw-border-base)',
                '--lw-character-card-active-border': 'rgba(var(--lw-primary-rgb), 0.32)',
                '--lw-character-card-radius': density === 'compact' ? '18px' : '20px',
                '--lw-character-card-avatar-size': density === 'compact' ? '42px' : '46px',
                '--lw-character-card-avatar-radius': resolveAvatarRadius(avatarShape),
                '--lw-character-card-shadow': 'none',
                '--lw-character-session-bg': 'color-mix(in srgb, var(--lw-bg-elevated) 76%, transparent)',
                ...overrides
            };
        }
    },
    'chat.stream': {
        componentId: 'chat.stream',
        cssVars: ({ activeSettings, themePackId, resolvedAppearance }) => {
            const density = getThemeSettingValue(activeSettings, themePackId, 'messageDensity');
            const avatarShape = getThemeSettingValue(activeSettings, themePackId, 'avatarShape');
            const bubbleStyle = getThemeSettingValue(activeSettings, themePackId, 'bubbleStyle');
            const isDark = resolvedAppearance === 'dark';
            return {
                '--lw-chat-stream-bg': isDark ? 'var(--lw-bg-app)' : 'transparent',
                '--lw-chat-scroll-padding': density === 'compact' ? '18px 28px' : '24px 40px',
                '--lw-chat-content-gap': resolveMessageGap(density),
                '--lw-chat-avatar-size': density === 'compact' ? '36px' : '40px',
                '--lw-chat-avatar-radius': resolveAvatarRadius(avatarShape),
                '--lw-chat-bubble-radius': resolveBubbleRadius(bubbleStyle),
                '--lw-chat-input-radius': bubbleStyle === 'soft' ? '20px' : '16px',
                '--lw-chat-user-name-display': getThemeSettingValue(activeSettings, themePackId, 'showUsernames', true) === false ? 'none' : 'inline-flex',
                '--lw-chat-user-bubble': isDark ? 'color-mix(in srgb, var(--lw-bg-surface) 92%, white 8%)' : 'var(--lw-bg-subtle)',
                ...overrides
            };
        }
    },
    'chat.preview': {
        componentId: 'chat.preview',
        cssVars: ({ activeSettings, themePackId, resolvedAppearance }) => {
            const density = getThemeSettingValue(activeSettings, themePackId, 'messageDensity');
            const bubbleStyle = getThemeSettingValue(activeSettings, themePackId, 'bubbleStyle');
            const avatarShape = getThemeSettingValue(activeSettings, themePackId, 'avatarShape');
            const isDark = resolvedAppearance === 'dark';
            return {
                '--lw-chat-preview-bg': isDark ? 'color-mix(in srgb, var(--lw-bg-app) 92%, black)' : 'var(--lw-bg-subtle)',
                '--lw-chat-preview-bubble-bg': 'var(--lw-bg-surface)',
                '--lw-chat-preview-user-bubble-bg': isDark ? 'color-mix(in srgb, var(--lw-bg-surface) 80%, white 20%)' : 'var(--lw-bg-hover)',
                '--lw-chat-preview-text-color': 'var(--lw-text-main)',
                '--lw-chat-preview-bubble-radius': resolveBubbleRadius(bubbleStyle),
                '--lw-chat-preview-padding': density === 'compact' ? '10px 14px' : '12px 16px',
                '--lw-chat-preview-avatar-radius': resolveAvatarRadius(avatarShape),
                ...overrides
            };
        }
    },
    'settings.root': {
        componentId: 'settings.root',
        cssVars: {
            '--lw-settings-shell-bg': 'transparent',
            '--lw-settings-sidebar-bg': 'color-mix(in srgb, var(--lw-bg-elevated) 92%, transparent)',
            '--lw-settings-header-bg': 'color-mix(in srgb, var(--lw-bg-elevated) 92%, transparent)',
            '--lw-settings-card-radius': '24px'
        }
    },
    'settings.unified': {
        componentId: 'settings.unified',
        cssVars: {
            '--lw-settings-grid-gap': 'var(--lw-item-gap)',
            '--lw-settings-block-bg': 'color-mix(in srgb, var(--lw-bg-elevated) 96%, transparent)',
            '--lw-settings-block-border': 'var(--lw-border-base)'
        }
    },
    'settings.detailed': {
        componentId: 'settings.detailed',
        cssVars: {
            '--lw-settings-detail-bg': 'color-mix(in srgb, var(--lw-bg-elevated) 94%, transparent)',
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
            '--lw-setting-tip-border': 'var(--lw-primary)',
            '--lw-setting-slider-track': resolvedAppearance === 'dark' ? '#3b3d44' : '#f1f5f9'
        })
    },
    'timeline.root': {
        componentId: 'timeline.root',
        cssVars: {
            '--lw-timeline-header-bg': 'color-mix(in srgb, var(--lw-bg-elevated) 88%, transparent)',
            '--lw-timeline-card-bg': 'var(--lw-surface-container-low)',
            '--lw-timeline-mini-avatar-radius': '50%'
        }
    },
    'lorebook.workspace': {
        componentId: 'lorebook.workspace',
        cssVars: {
            '--lw-lorebook-workspace-bg':
                'linear-gradient(180deg, rgba(var(--lw-bg-elevated-rgb), 0.48), rgba(var(--lw-bg-elevated-rgb), 0))',
            '--lw-lorebook-header-bg': 'color-mix(in srgb, var(--lw-bg-elevated) 90%, transparent)',
            '--lw-lorebook-panel-bg': 'var(--lw-surface-container-lowest)',
            '--lw-lorebook-panel-hover-bg': 'var(--lw-bg-hover)',
            '--lw-lorebook-panel-border': 'var(--lw-border-base)',
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
            '--lw-lorebook-editor-control-bg': 'var(--lw-surface-container-low)',
            '--lw-lorebook-editor-control-hover-bg': 'var(--lw-surface-container-high)',
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

const resolveThemeValueMap = (
    resolver: ThemeValueResolver | undefined,
    context: ComponentThemeContext
): ThemeValueMap => {
    if (!resolver) return {};
    const resolved = typeof resolver === 'function' ? resolver(context) : resolver;
    return cleanThemeValueMap(resolved);
};

const mergeCssVars = (
    base: ThemeValueResolver | undefined,
    overrides: ThemeValueResolver
): ThemeValueResolver => (context: ComponentThemeContext) => ({
    ...resolveThemeValueMap(base, context),
    ...resolveThemeValueMap(overrides, context)
});

const resolveDiscordDesignTokens = ({ resolvedAppearance }: ComponentThemeContext): ThemeValueMap => {
    const isDark = resolvedAppearance === 'dark';
    return isDark
        ? {
            '--lw-bg-app': '#1e1f22',
            '--lw-bg-app-rgb': '30, 31, 34',
            '--lw-bg-surface': '#2b2d31',
            '--lw-bg-surface-rgb': '43, 45, 49',
            '--lw-bg-elevated': '#313338',
            '--lw-bg-elevated-rgb': '49, 51, 56',
            '--lw-bg-subtle': '#232428',
            '--lw-bg-muted': '#1a1b1e',
            '--lw-bg-hover': '#35373c',
            '--lw-bg-active': '#404249',
            '--lw-bg-selection': 'rgba(88, 101, 242, 0.18)',
            '--lw-surface-container-lowest': '#313338',
            '--lw-surface-container-low': '#2b2d31',
            '--lw-surface-container': '#232428',
            '--lw-surface-container-high': '#383a40',
            '--lw-surface-container-highest': '#4e5058',
            '--lw-border-base': '#3f4147',
            '--lw-border-subtle': '#36383d',
            '--lw-border-strong': '#4e5058',
            '--lw-border-hover': 'rgba(219, 222, 225, 0.18)',
            '--lw-border-active': 'rgba(88, 101, 242, 0.42)',
            '--lw-text-main': '#f2f3f5',
            '--lw-text-secondary': '#b5bac1',
            '--lw-text-muted': '#949ba4',
            '--lw-text-dim': '#72767d',
            '--lw-text-inverse': '#f8fafc',
            '--lw-primary': '#5865f2',
            '--lw-primary-rgb': '88, 101, 242',
            '--lw-primary-soft': 'rgba(88, 101, 242, 0.14)',
            '--lw-primary-softer': 'rgba(88, 101, 242, 0.22)',
            '--lw-glass-bg': 'rgba(35, 36, 40, 0.88)',
            '--lw-glass-bg-hover': 'rgba(49, 51, 56, 0.92)',
            '--lw-glass-border': 'rgba(255, 255, 255, 0.06)',
            '--lw-glass-shadow': 'rgba(0, 0, 0, 0.24)',
            '--lw-shadow': '0 1px 2px rgba(0, 0, 0, 0.24)',
            '--lw-shadow-card': '0 18px 44px rgba(0, 0, 0, 0.28)',
            '--lw-shadow-hover': '0 22px 52px rgba(0, 0, 0, 0.28)',
            '--lw-shadow-xl': '0 36px 78px rgba(0, 0, 0, 0.34)',
            '--lw-font-display': '"Noto Sans SC", "Segoe UI", sans-serif',
            '--lw-font-main': '"Noto Sans SC", "Segoe UI", sans-serif'
        }
        : {
            '--lw-bg-app': '#e3e5e8',
            '--lw-bg-app-rgb': '227, 229, 232',
            '--lw-bg-surface': '#f2f3f5',
            '--lw-bg-surface-rgb': '242, 243, 245',
            '--lw-bg-elevated': '#ffffff',
            '--lw-bg-elevated-rgb': '255, 255, 255',
            '--lw-bg-subtle': '#ebeef2',
            '--lw-bg-muted': '#dde2e8',
            '--lw-bg-hover': '#e4e8ed',
            '--lw-bg-active': '#cfd6de',
            '--lw-bg-selection': 'rgba(88, 101, 242, 0.12)',
            '--lw-surface-container-lowest': '#ffffff',
            '--lw-surface-container-low': '#f4f5f7',
            '--lw-surface-container': '#ebeef2',
            '--lw-surface-container-high': '#dde2e8',
            '--lw-surface-container-highest': '#cfd6de',
            '--lw-border-base': 'rgba(78, 85, 98, 0.16)',
            '--lw-border-subtle': 'rgba(78, 85, 98, 0.1)',
            '--lw-border-strong': 'rgba(78, 85, 98, 0.24)',
            '--lw-border-hover': 'rgba(78, 85, 98, 0.28)',
            '--lw-border-active': 'rgba(88, 101, 242, 0.28)',
            '--lw-text-main': '#1f2328',
            '--lw-text-secondary': '#4e5562',
            '--lw-text-muted': '#6b7280',
            '--lw-text-dim': '#8a93a3',
            '--lw-text-inverse': '#ffffff',
            '--lw-primary': '#5865f2',
            '--lw-primary-rgb': '88, 101, 242',
            '--lw-primary-soft': 'rgba(88, 101, 242, 0.1)',
            '--lw-primary-softer': 'rgba(88, 101, 242, 0.18)',
            '--lw-glass-bg': 'rgba(255, 255, 255, 0.8)',
            '--lw-glass-bg-hover': 'rgba(255, 255, 255, 0.92)',
            '--lw-glass-border': 'rgba(255, 255, 255, 0.58)',
            '--lw-glass-shadow': 'rgba(31, 35, 40, 0.08)',
            '--lw-shadow': '0 1px 2px rgba(31, 35, 40, 0.06)',
            '--lw-shadow-card': '0 18px 44px rgba(31, 35, 40, 0.08)',
            '--lw-shadow-hover': '0 22px 52px rgba(31, 35, 40, 0.12)',
            '--lw-shadow-xl': '0 36px 78px rgba(31, 35, 40, 0.14)',
            '--lw-font-display': '"Noto Sans SC", "Segoe UI", sans-serif',
            '--lw-font-main': '"Noto Sans SC", "Segoe UI", sans-serif'
        };
};

const createDiscordSurfaceSkinMap = (): DesktopModeManifest['surfaceSkins'] => {
    const base = createSurfaceSkinMap() as NonNullable<DesktopModeManifest['surfaceSkins']>;

    return {
        ...base,
        'shell.app': {
            ...base['shell.app'],
            cssVars: mergeCssVars(base['shell.app']?.cssVars, ({ resolvedAppearance }) => ({
                '--lw-shell-panel-bg': resolvedAppearance === 'dark'
                    ? 'linear-gradient(180deg, #1e1f22, #1a1b1e)'
                    : 'linear-gradient(180deg, #e9ebee, #dfe3e8)',
                '--lw-shell-panel-overlay': resolvedAppearance === 'dark'
                    ? 'linear-gradient(180deg, rgba(255, 255, 255, 0.04), transparent 24%), radial-gradient(rgba(255, 255, 255, 0.03) 0.8px, transparent 0.8px)'
                    : 'linear-gradient(180deg, rgba(255, 255, 255, 0.36), transparent 26%), radial-gradient(rgba(88, 101, 242, 0.05) 0.8px, transparent 0.8px)'
            }))
        },
        'shell.panelBody': {
            ...base['shell.panelBody'],
            cssVars: mergeCssVars(base['shell.panelBody']?.cssVars, ({ resolvedAppearance }) => ({
                '--lw-shell-body-bg': resolvedAppearance === 'dark'
                    ? 'linear-gradient(180deg, rgba(88, 101, 242, 0.10) 0%, rgba(88, 101, 242, 0.04) 18%, transparent 44%), linear-gradient(180deg, #2b2d31, #232428)'
                    : 'linear-gradient(180deg, rgba(88, 101, 242, 0.08) 0%, rgba(88, 101, 242, 0.03) 18%, transparent 44%), linear-gradient(180deg, #f2f3f5, #ebeef2)'
            }))
        },
        'shell.mainSurface': {
            ...base['shell.mainSurface'],
            cssVars: mergeCssVars(base['shell.mainSurface']?.cssVars, ({ resolvedAppearance }) => ({
                '--lw-shell-main-bg': resolvedAppearance === 'dark'
                    ? '#2b2d31'
                    : 'linear-gradient(180deg, color-mix(in srgb, var(--lw-bg-elevated) 96%, white), color-mix(in srgb, var(--lw-bg-surface) 96%, white))',
                '--lw-shell-main-border': 'var(--lw-border-strong)',
                '--lw-shell-main-radius': resolvedAppearance === 'dark' ? '18px' : '22px',
                '--lw-shell-main-shadow': resolvedAppearance === 'dark'
                    ? '0 18px 44px rgba(0, 0, 0, 0.24)'
                    : '0 18px 40px rgba(31, 35, 40, 0.08)'
            }))
        },
        'shell.widget': {
            ...base['shell.widget'],
            cssVars: mergeCssVars(base['shell.widget']?.cssVars, ({ resolvedAppearance }) => ({
                '--lw-shell-widget-bg': resolvedAppearance === 'dark'
                    ? '#232428'
                    : 'var(--lw-surface-container-low)',
                '--lw-shell-widget-border': 'var(--lw-border-strong)',
                '--lw-shell-widget-radius': resolvedAppearance === 'dark' ? '18px' : '20px',
                '--lw-shell-widget-header-bg': resolvedAppearance === 'dark'
                    ? '#2b2d31'
                    : 'var(--lw-surface-container-high)'
            }))
        },
        'shell.workspaceStage': {
            ...base['shell.workspaceStage'],
            cssVars: mergeCssVars(base['shell.workspaceStage']?.cssVars, ({ resolvedAppearance }) => ({
                '--lw-shell-stage-bg': resolvedAppearance === 'dark'
                    ? 'linear-gradient(180deg, #2b2d31 0%, #232428 100%)'
                    : 'linear-gradient(180deg, var(--lw-surface-container-lowest) 0%, var(--lw-surface-container) 100%)',
                '--lw-shell-stage-border': 'var(--lw-border-strong)',
                '--lw-shell-stage-radius': resolvedAppearance === 'dark' ? '22px' : '24px',
                '--lw-shell-stage-shadow': resolvedAppearance === 'dark'
                    ? '0 24px 56px rgba(0, 0, 0, 0.28)'
                    : '0 20px 46px rgba(31, 35, 40, 0.12)'
            }))
        },
        'shell.workspaceMenu': {
            ...base['shell.workspaceMenu'],
            cssVars: mergeCssVars(base['shell.workspaceMenu']?.cssVars, ({ resolvedAppearance }) => ({
                '--lw-shell-workspace-menu-bg': resolvedAppearance === 'dark'
                    ? 'linear-gradient(180deg, rgba(35, 36, 40, 0.96), rgba(30, 31, 34, 0.92))'
                    : 'linear-gradient(180deg, rgba(255, 255, 255, 0.94), rgba(242, 243, 245, 0.92))',
                '--lw-shell-workspace-menu-border': 'var(--lw-border-strong)',
                '--lw-shell-workspace-menu-item-bg': resolvedAppearance === 'dark'
                    ? '#2b2d31'
                    : 'var(--lw-surface-container-low)',
                '--lw-shell-workspace-menu-item-active-bg': resolvedAppearance === 'dark'
                    ? '#383a40'
                    : 'var(--lw-surface-container-high)'
            }))
        },
        'shell.characterRail': {
            ...base['shell.characterRail'],
            cssVars: mergeCssVars(base['shell.characterRail']?.cssVars, ({ resolvedAppearance }) => ({
                '--lw-character-rail-bg': resolvedAppearance === 'dark'
                    ? '#232428'
                    : 'var(--lw-surface-container)',
                '--lw-character-rail-border': resolvedAppearance === 'dark'
                    ? '#3f4147'
                    : 'var(--lw-border-strong)',
                '--lw-character-rail-width': '312px'
            }))
        },
        'shell.guildRail': {
            ...base['shell.guildRail'],
            cssVars: mergeCssVars(base['shell.guildRail']?.cssVars, ({ resolvedAppearance }) => ({
                '--lw-guild-rail-bg': resolvedAppearance === 'dark'
                    ? '#1b1d21'
                    : 'var(--lw-surface-container-high)',
                '--lw-guild-rail-border': resolvedAppearance === 'dark'
                    ? '#121317'
                    : 'var(--lw-border-strong)',
                '--lw-guild-rail-width': '74px',
                '--lw-guild-rail-item-bg': resolvedAppearance === 'dark'
                    ? '#2b2d31'
                    : 'var(--lw-surface-container-lowest)',
                '--lw-guild-rail-item-active-bg': resolvedAppearance === 'dark'
                    ? '#5865f2'
                    : 'rgba(88, 101, 242, 0.14)',
                '--lw-guild-rail-item-color': resolvedAppearance === 'dark'
                    ? '#b5bac1'
                    : 'var(--lw-text-secondary)'
            }))
        },
        'shell.characterCard': {
            ...base['shell.characterCard'],
            cssVars: (context: ComponentThemeContext) => ({
                ...resolveThemeValueMap(base['shell.characterCard']?.cssVars, context),
                '--lw-character-card-bg': context.resolvedAppearance === 'dark'
                    ? '#2b2d31'
                    : 'var(--lw-surface-container-lowest)',
                '--lw-character-card-border': 'var(--lw-border-strong)',
                '--lw-character-card-active-border': context.resolvedAppearance === 'dark'
                    ? 'rgba(88, 101, 242, 0.42)'
                    : 'rgba(88, 101, 242, 0.24)',
                '--lw-character-card-shadow': context.resolvedAppearance === 'dark'
                    ? '0 14px 30px rgba(0, 0, 0, 0.16)'
                    : '0 10px 24px rgba(31, 35, 40, 0.08)',
                '--lw-character-session-bg': context.resolvedAppearance === 'dark'
                    ? '#383a40'
                    : 'var(--lw-surface-container-high)'
            })
        },
        'chat.stream': {
            ...base['chat.stream'],
            cssVars: (context: ComponentThemeContext) => ({
                ...resolveThemeValueMap(base['chat.stream']?.cssVars, context),
                '--lw-chat-stream-bg': context.resolvedAppearance === 'dark'
                    ? '#313338'
                    : 'var(--lw-surface-container-low)',
                '--lw-chat-bubble': context.resolvedAppearance === 'dark'
                    ? '#2b2d31'
                    : 'var(--lw-surface-container-lowest)',
                '--lw-chat-user-bubble': context.resolvedAppearance === 'dark'
                    ? '#383a40'
                    : 'var(--lw-surface-container-high)',
                '--lw-chat-border': 'var(--lw-border-strong)',
                '--lw-chat-color': 'var(--lw-text-main)',
                '--lw-chat-input-area-bg': context.resolvedAppearance === 'dark'
                    ? '#313338'
                    : 'var(--lw-surface-container)',
                '--lw-chat-input-surface': context.resolvedAppearance === 'dark'
                    ? '#383a40'
                    : 'var(--lw-surface-container-lowest)',
                '--lw-chat-input-border': context.resolvedAppearance === 'dark'
                    ? '#4e5058'
                    : 'var(--lw-border-strong)',
                '--lw-chat-bubble-shadow': 'none',
                '--lw-chat-streaming-surface': context.resolvedAppearance === 'dark'
                    ? 'rgba(88, 101, 242, 0.08)'
                    : 'rgba(88, 101, 242, 0.08)',
                '--lw-chat-streaming-border': context.resolvedAppearance === 'dark'
                    ? 'rgba(88, 101, 242, 0.18)'
                    : 'rgba(88, 101, 242, 0.16)',
                '--lw-chat-streaming-status-bg': context.resolvedAppearance === 'dark'
                    ? 'rgba(49, 51, 56, 0.92)'
                    : 'rgba(255, 255, 255, 0.88)',
                '--lw-chat-streaming-status-border': 'var(--lw-border-base)',
                '--lw-chat-streaming-status-color': 'var(--lw-text-secondary)'
            })
        },
        'chat.preview': {
            ...base['chat.preview'],
            cssVars: mergeCssVars(base['chat.preview']?.cssVars, ({ resolvedAppearance }) => ({
                '--lw-chat-preview-bg': resolvedAppearance === 'dark'
                    ? '#232428'
                    : 'var(--lw-surface-container-low)',
                '--lw-chat-preview-bubble-bg': resolvedAppearance === 'dark'
                    ? '#2b2d31'
                    : 'var(--lw-surface-container-lowest)',
                '--lw-chat-preview-user-bubble-bg': resolvedAppearance === 'dark'
                    ? '#383a40'
                    : 'var(--lw-surface-container-high)'
            }))
        },
        'settings.root': {
            ...base['settings.root'],
            cssVars: mergeCssVars(base['settings.root']?.cssVars, ({ resolvedAppearance }) => ({
                '--lw-settings-shell-bg': resolvedAppearance === 'dark'
                    ? '#313338'
                    : 'var(--lw-surface-container-low)',
                '--lw-settings-sidebar-bg': resolvedAppearance === 'dark'
                    ? '#232428'
                    : 'var(--lw-surface-container)',
                '--lw-settings-header-bg': resolvedAppearance === 'dark'
                    ? '#2b2d31'
                    : 'var(--lw-surface-container-high)'
            }))
        },
        'settings.unified': {
            ...base['settings.unified'],
            cssVars: mergeCssVars(base['settings.unified']?.cssVars, ({ resolvedAppearance }) => ({
                '--lw-settings-block-bg': resolvedAppearance === 'dark'
                    ? '#2b2d31'
                    : 'var(--lw-surface-container-lowest)',
                '--lw-settings-block-border': 'var(--lw-border-strong)'
            }))
        },
        'settings.detailed': {
            ...base['settings.detailed'],
            cssVars: mergeCssVars(base['settings.detailed']?.cssVars, ({ resolvedAppearance }) => ({
                '--lw-settings-detail-bg': resolvedAppearance === 'dark'
                    ? '#2b2d31'
                    : 'var(--lw-surface-container-lowest)'
            }))
        },
        'settings.control': {
            ...base['settings.control'],
            cssVars: (context: ComponentThemeContext) => ({
                ...resolveThemeValueMap(base['settings.control']?.cssVars, context),
                '--lw-setting-control-bg': context.resolvedAppearance === 'dark'
                    ? '#383a40'
                    : 'var(--lw-surface-container-lowest)',
                '--lw-setting-control-border': 'var(--lw-border-strong)',
                '--lw-setting-control-active-bg': context.resolvedAppearance === 'dark'
                    ? '#2b2d31'
                    : 'var(--lw-surface-container-high)',
                '--lw-setting-slider-track': context.resolvedAppearance === 'dark'
                    ? '#3b3d44'
                    : 'var(--lw-surface-container-high)'
            })
        },
        'timeline.root': {
            ...base['timeline.root'],
            cssVars: mergeCssVars(base['timeline.root']?.cssVars, ({ resolvedAppearance }) => ({
                '--lw-timeline-header-bg': resolvedAppearance === 'dark'
                    ? '#232428'
                    : 'var(--lw-surface-container-high)',
                '--lw-timeline-card-bg': resolvedAppearance === 'dark'
                    ? '#2b2d31'
                    : 'var(--lw-surface-container-lowest)',
                '--lw-timeline-canvas-bg': resolvedAppearance === 'dark'
                    ? '#313338'
                    : 'var(--lw-surface-container-low)',
                '--lw-timeline-chip-bg': resolvedAppearance === 'dark'
                    ? '#383a40'
                    : 'var(--lw-surface-container-high)',
                '--lw-timeline-chip-border': 'var(--lw-border-strong)',
                '--lw-timeline-chip-color': resolvedAppearance === 'dark'
                    ? '#dbdee1'
                    : 'var(--lw-text-secondary)',
                '--lw-timeline-line-color': 'var(--lw-border-strong)',
                '--lw-timeline-line-active': 'var(--lw-primary)',
                '--lw-timeline-subtle-text': 'var(--lw-text-muted)',
                '--lw-timeline-muted-text': 'var(--lw-text-secondary)',
                '--lw-timeline-loading-overlay-bg': resolvedAppearance === 'dark'
                    ? 'rgba(30, 31, 34, 0.72)'
                    : 'rgba(255, 255, 255, 0.72)',
                '--lw-timeline-loading-spinner-track': resolvedAppearance === 'dark'
                    ? '#3f4147'
                    : 'var(--lw-surface-container-high)',
                '--lw-timeline-modal-overlay-bg': resolvedAppearance === 'dark'
                    ? 'rgba(15, 23, 42, 0.45)'
                    : 'rgba(15, 23, 42, 0.22)',
                '--lw-timeline-modal-bg': resolvedAppearance === 'dark'
                    ? '#2b2d31'
                    : 'var(--lw-surface-container-lowest)',
                '--lw-timeline-modal-body-bg': resolvedAppearance === 'dark'
                    ? '#232428'
                    : 'var(--lw-surface-container-low)',
                '--lw-timeline-modal-footer-bg': resolvedAppearance === 'dark'
                    ? '#2b2d31'
                    : 'var(--lw-surface-container-lowest)'
            }))
        },
        'lorebook.workspace': {
            ...base['lorebook.workspace'],
            cssVars: mergeCssVars(base['lorebook.workspace']?.cssVars, ({ resolvedAppearance }) => ({
                '--lw-lorebook-workspace-bg': resolvedAppearance === 'dark'
                    ? 'linear-gradient(180deg, rgba(49, 51, 56, 0.72), rgba(49, 51, 56, 0))'
                    : 'linear-gradient(180deg, rgba(255, 255, 255, 0.58), rgba(255, 255, 255, 0))',
                '--lw-lorebook-header-bg': resolvedAppearance === 'dark'
                    ? '#2b2d31'
                    : 'var(--lw-surface-container-lowest)',
                '--lw-lorebook-panel-bg': resolvedAppearance === 'dark'
                    ? '#2b2d31'
                    : 'var(--lw-surface-container-lowest)',
                '--lw-lorebook-panel-hover-bg': resolvedAppearance === 'dark'
                    ? '#35373c'
                    : 'var(--lw-bg-hover)',
                '--lw-lorebook-panel-border': 'var(--lw-border-strong)',
                '--lw-lorebook-panel-outline': resolvedAppearance === 'dark'
                    ? 'rgba(255, 255, 255, 0.03)'
                    : 'rgba(31, 35, 40, 0.04)',
                '--lw-lorebook-overlay-bg': resolvedAppearance === 'dark'
                    ? 'rgba(30, 31, 34, 0.68)'
                    : 'rgba(255, 255, 255, 0.62)',
                '--lw-lorebook-overlay-backdrop': resolvedAppearance === 'dark'
                    ? 'blur(10px)'
                    : 'blur(12px)',
                '--lw-lorebook-chip-bg': resolvedAppearance === 'dark'
                    ? '#383a40'
                    : 'var(--lw-surface-container-high)',
                '--lw-lorebook-chip-accent-bg': resolvedAppearance === 'dark'
                    ? 'rgba(88, 101, 242, 0.14)'
                    : 'rgba(88, 101, 242, 0.1)',
                '--lw-lorebook-table-header-bg': resolvedAppearance === 'dark'
                    ? '#232428'
                    : 'var(--lw-surface-container)'
            }))
        },
        'lorebook.editor': {
            ...base['lorebook.editor'],
            cssVars: mergeCssVars(base['lorebook.editor']?.cssVars, ({ resolvedAppearance }) => ({
                '--lw-lorebook-editor-bg': resolvedAppearance === 'dark'
                    ? '#2b2d31'
                    : 'var(--lw-surface-container-lowest)',
                '--lw-lorebook-editor-header-bg': resolvedAppearance === 'dark'
                    ? '#2b2d31'
                    : 'var(--lw-surface-container-lowest)',
                '--lw-lorebook-editor-control-bg': resolvedAppearance === 'dark'
                    ? '#383a40'
                    : 'var(--lw-surface-container-low)',
                '--lw-lorebook-editor-control-hover-bg': resolvedAppearance === 'dark'
                    ? '#404249'
                    : 'var(--lw-surface-container-high)',
                '--lw-lorebook-editor-accent-bg': resolvedAppearance === 'dark'
                    ? 'rgba(88, 101, 242, 0.14)'
                    : 'rgba(88, 101, 242, 0.1)',
                '--lw-lorebook-editor-switch-bg': resolvedAppearance === 'dark'
                    ? '#4e5058'
                    : 'var(--lw-surface-container-highest)',
                '--lw-lorebook-editor-switch-dot': resolvedAppearance === 'dark'
                    ? '#f2f3f5'
                    : 'var(--lw-bg-elevated)',
                '--lw-lorebook-editor-range-track': resolvedAppearance === 'dark'
                    ? '#4e5058'
                    : 'var(--lw-surface-container-high)',
                '--lw-lorebook-editor-save-bg': 'var(--lw-primary)',
                '--lw-lorebook-editor-save-color': '#ffffff',
                '--lw-lorebook-editor-save-hover-bg': resolvedAppearance === 'dark'
                    ? 'color-mix(in srgb, var(--lw-primary) 88%, black)'
                    : 'color-mix(in srgb, var(--lw-primary) 92%, black 8%)',
                '--lw-lorebook-editor-saving-bg': resolvedAppearance === 'dark'
                    ? '#4e5058'
                    : 'var(--lw-surface-container-highest)',
                '--lw-lorebook-editor-success-bg': 'var(--lw-success)'
            }))
        }
    };
};

export const builtinDesktopModes: DesktopModeManifest[] = [
    {
        id: 'classic',
        name: '传统桌面',
        description: '保留当前 Lumina 工作区的传统桌面组织方式与默认阅读节奏。',
        preferredAppearance: 'follow-setting',
        shell: {
            kind: 'traditional'
        },
        navigationPreset: {
            traditional: {
                headerVariant: 'default',
                leftRail: 'none',
                widgetVariant: 'default',
                headerDesktopPosition: 'follow-setting',
                headerMobilePosition: 'follow-setting',
            },
        },
        surfacePreset: {
            mainSurfaceVariant: 'default',
            widgetSurfaceVariant: 'default',
            chatVariant: 'default',
            settingsVariant: 'default',
            timelineVariant: 'default',
        },
        designTokens: ({ resolvedAppearance }) => ({
            '--lw-theme-accent-soft': resolvedAppearance === 'dark'
                ? 'rgba(var(--lw-primary-rgb), 0.16)'
                : 'rgba(var(--lw-primary-rgb), 0.10)'
        }),
        surfaceSkins: createSurfaceSkinMap(),
        settingsManifest: classicThemeSettings
    },
    {
        id: 'stage',
        name: '自由工作台',
        description: '以舞台调度和多窗口工作台为核心的桌面模式。',
        preferredAppearance: 'follow-setting',
        shell: {
            kind: 'freeform'
        },
        navigationPreset: {
            traditional: {
                headerVariant: 'default',
                leftRail: 'none',
                widgetVariant: 'default',
                headerDesktopPosition: 'follow-setting',
                headerMobilePosition: 'follow-setting',
            },
        },
        surfacePreset: {
            mainSurfaceVariant: 'default',
            widgetSurfaceVariant: 'default',
            chatVariant: 'default',
            settingsVariant: 'default',
            timelineVariant: 'default',
        },
        designTokens: ({ resolvedAppearance }) => ({
            '--lw-theme-accent-soft': resolvedAppearance === 'dark'
                ? 'rgba(var(--lw-primary-rgb), 0.20)'
                : 'rgba(var(--lw-primary-rgb), 0.14)',
            '--lw-theme-panel-sheen': resolvedAppearance === 'dark'
                ? 'rgba(255, 255, 255, 0.04)'
                : 'rgba(255, 255, 255, 0.42)'
        }),
        surfaceSkins: createSurfaceSkinMap({
            '--lw-shell-main-bg':
                'linear-gradient(180deg, color-mix(in srgb, var(--lw-bg-elevated) 84%, white), color-mix(in srgb, var(--lw-bg-surface) 90%, transparent))',
            '--lw-shell-widget-bg':
                'linear-gradient(180deg, color-mix(in srgb, var(--lw-bg-elevated) 90%, white), color-mix(in srgb, var(--lw-bg-surface) 88%, transparent))',
            '--lw-shell-stage-bg':
                'radial-gradient(circle at 18% 20%, rgba(var(--lw-primary-rgb), 0.20), transparent 26%), radial-gradient(circle at 82% 14%, rgba(255, 255, 255, 0.32), transparent 24%), linear-gradient(180deg, color-mix(in srgb, var(--lw-bg-elevated) 74%, white), color-mix(in srgb, var(--lw-bg-app) 86%, transparent))',
            '--lw-chat-stream-bg': 'color-mix(in srgb, var(--lw-bg-elevated) 64%, transparent)',
            '--lw-chat-input-surface': 'color-mix(in srgb, var(--lw-bg-surface) 88%, transparent)',
            '--lw-chat-bubble-shadow': '0 18px 32px rgba(15, 23, 42, 0.10)'
        }),
        settingsManifest: stageThemeSettings
    },
    {
        id: 'discord',
        name: 'Discord 桌面',
        description: '频道式桌面模式，角色轨、聊天区和侧栏统一成更强的面板结构，并跟随全局浅色/深色外观。',
        preferredAppearance: 'follow-setting',
        shell: {
            kind: 'traditional'
        },
        navigationPreset: {
            traditional: {
                headerVariant: 'discord',
                leftRail: 'character-rail',
                widgetVariant: 'discord',
                headerDesktopPosition: 'top',
                headerMobilePosition: 'top',
            },
        },
        surfacePreset: {
            mainSurfaceVariant: 'discord',
            widgetSurfaceVariant: 'discord',
            chatVariant: 'discord',
            settingsVariant: 'discord',
            timelineVariant: 'discord',
        },
        designTokens: resolveDiscordDesignTokens,
        surfaceSkins: createDiscordSurfaceSkinMap(),
        rendererVariants: {
            'shell.guildRail': 'discord',
            'shell.characterRail': 'discord',
            'shell.characterCard': 'discord',
            'chat.stream': 'discord',
            'settings.root': 'discord-panel',
            'settings.control': 'discord',
            'timeline.root': 'discord',
            'lorebook.workspace': 'discord',
            'lorebook.editor': 'discord'
        },
        settingsManifest: discordThemeSettings
    }
];

export const builtinThemePacks: ThemePack[] = builtinDesktopModes;
