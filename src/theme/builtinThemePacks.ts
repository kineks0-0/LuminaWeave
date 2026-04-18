import type { SettingDefinition } from '../types/plugin';
import { getThemeSettingValue } from './themeRegistry';
import type { DesktopModeManifest, ThemePack, ThemeValueMap } from './types';

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
            '--lw-timeline-card-bg': 'var(--lw-bg-surface)',
            '--lw-timeline-mini-avatar-radius': '50%'
        }
    }
});

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
        description: '频道式深色桌面模式，角色轨、聊天区和侧栏统一成更强的面板结构。',
        preferredAppearance: 'dark',
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
        designTokens: {
            '--lw-bg-app': '#1e1f22',
            '--lw-bg-app-rgb': '30, 31, 34',
            '--lw-bg-surface': '#2b2d31',
            '--lw-bg-surface-rgb': '43, 45, 49',
            '--lw-bg-elevated': '#313338',
            '--lw-bg-elevated-rgb': '49, 51, 56',
            '--lw-bg-subtle': '#232428',
            '--lw-bg-muted': '#1a1b1e',
            '--lw-border-base': '#3f4147',
            '--lw-border-subtle': '#36383d',
            '--lw-text-main': '#f2f3f5',
            '--lw-text-secondary': '#b5bac1',
            '--lw-text-muted': '#949ba4',
            '--lw-text-dim': '#72767d',
            '--lw-primary': '#5865f2',
            '--lw-primary-rgb': '88, 101, 242',
            '--lw-glass-bg': 'rgba(35, 36, 40, 0.88)',
            '--lw-glass-border': 'rgba(255, 255, 255, 0.06)',
            '--lw-shadow-card': '0 18px 44px rgba(0, 0, 0, 0.28)',
            '--lw-font-display': '"Noto Sans SC", "Segoe UI", sans-serif',
            '--lw-font-main': '"Noto Sans SC", "Segoe UI", sans-serif'
        },
        surfaceSkins: createSurfaceSkinMap({
            '--lw-shell-panel-bg':
                'linear-gradient(180deg, #1e1f22, #1a1b1e)',
            '--lw-shell-panel-overlay':
                'linear-gradient(180deg, rgba(255, 255, 255, 0.04), transparent 24%), radial-gradient(rgba(255, 255, 255, 0.03) 0.8px, transparent 0.8px)',
            '--lw-shell-body-bg':
                'linear-gradient(180deg, rgba(88, 101, 242, 0.10) 0%, rgba(88, 101, 242, 0.04) 18%, transparent 44%), linear-gradient(180deg, #2b2d31, #232428)',
            '--lw-shell-main-bg': '#2b2d31',
            '--lw-shell-main-border': '#3f4147',
            '--lw-shell-main-radius': '18px',
            '--lw-shell-main-shadow': '0 18px 44px rgba(0, 0, 0, 0.24)',
            '--lw-shell-widget-bg': '#232428',
            '--lw-shell-widget-border': '#3f4147',
            '--lw-shell-widget-radius': '18px',
            '--lw-shell-widget-header-bg': '#2b2d31',
            '--lw-shell-stage-bg':
                'linear-gradient(180deg, #2b2d31 0%, #232428 100%)',
            '--lw-shell-stage-border': '#3f4147',
            '--lw-shell-stage-radius': '22px',
            '--lw-shell-stage-shadow': '0 24px 56px rgba(0, 0, 0, 0.28)',
            '--lw-shell-workspace-menu-bg':
                'linear-gradient(180deg, rgba(35, 36, 40, 0.96), rgba(30, 31, 34, 0.92))',
            '--lw-shell-workspace-menu-border': '#3f4147',
            '--lw-shell-workspace-menu-item-bg': '#2b2d31',
            '--lw-shell-workspace-menu-item-active-bg': '#383a40',
            '--lw-character-rail-bg': '#232428',
            '--lw-character-rail-border': '#3f4147',
            '--lw-character-rail-width': '312px',
            '--lw-guild-rail-bg': '#1b1d21',
            '--lw-guild-rail-border': '#121317',
            '--lw-guild-rail-width': '74px',
            '--lw-guild-rail-item-bg': '#2b2d31',
            '--lw-guild-rail-item-active-bg': '#5865f2',
            '--lw-guild-rail-item-color': '#b5bac1',
            '--lw-character-card-bg': '#2b2d31',
            '--lw-character-card-border': '#3f4147',
            '--lw-character-card-active-border': 'rgba(88, 101, 242, 0.42)',
            '--lw-character-card-shadow': '0 14px 30px rgba(0, 0, 0, 0.16)',
            '--lw-character-session-bg': '#383a40',
            '--lw-chat-stream-bg': '#313338',
            '--lw-chat-scroll-padding': '20px 24px',
            '--lw-chat-content-gap': '18px',
            '--lw-chat-avatar-size': '40px',
            '--lw-chat-bubble': '#2b2d31',
            '--lw-chat-user-bubble': '#383a40',
            '--lw-chat-border': '#3f4147',
            '--lw-chat-color': '#f2f3f5',
            '--lw-chat-input-area-bg': '#2b2d31',
            '--lw-chat-input-surface': '#383a40',
            '--lw-chat-input-border': '#4e5058',
            '--lw-chat-bubble-shadow': 'none',
            '--lw-settings-shell-bg': '#313338',
            '--lw-settings-sidebar-bg': '#232428',
            '--lw-settings-header-bg': '#2b2d31',
            '--lw-settings-block-bg': '#2b2d31',
            '--lw-settings-detail-bg': '#2b2d31',
            '--lw-timeline-header-bg': '#232428',
            '--lw-timeline-card-bg': '#2b2d31'
        }),
        rendererVariants: {
            'shell.guildRail': 'discord',
            'shell.characterRail': 'discord',
            'shell.characterCard': 'discord',
            'chat.stream': 'discord',
            'settings.root': 'discord-panel',
            'settings.control': 'discord',
            'timeline.root': 'discord'
        },
        settingsManifest: discordThemeSettings
    }
];

export const builtinThemePacks: ThemePack[] = builtinDesktopModes;
