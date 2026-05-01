import type { SettingDefinition } from '../types/plugin';
import { getThemeSettingValue } from './themeRegistry';
import type {
    ComponentThemeContext,
    DesktopModeManifest,
    ThemePack,
    ThemeAvatarPlacement,
    ThemeMessageShape,
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
const GLOBAL_SCOPES: Array<'Global'> = ['Global'];

const resolveFontFamily = (fontFamily: string | undefined) => {
    if (fontFamily === 'serif') return '"Noto Serif CJK SC", "Songti SC", serif';
    if (fontFamily === 'kaiti') return '"Kaiti SC", "STKaiti", serif';
    return '"Noto Sans SC", "Segoe UI", sans-serif';
};

const createRoleMessageSettings = (defaults: {
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

const createChatTypographySettings = (defaults: {
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
    }
});

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
    ...createRoleMessageSettings({
        assistantShape: 'document',
        userShape: 'document',
        assistantAvatarPlacement: 'inline',
        userAvatarPlacement: 'inline'
    }),
    ...createChatTypographySettings({
        fontFamily: 'sans-serif',
        fontWeight: 500,
        fontSize: 15,
        pageWidth: 'auto',
        lineHeight: 1.6,
        paragraphSpacing: 10,
        letterSpacing: 0
    }),
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
    ...createRoleMessageSettings({
        assistantShape: 'bubble',
        userShape: 'bubble',
        assistantAvatarPlacement: 'inline',
        userAvatarPlacement: 'inline'
    }),
    ...createChatTypographySettings({
        fontFamily: 'sans-serif',
        fontWeight: 400,
        fontSize: 16,
        pageWidth: 'auto',
        lineHeight: 1.6,
        paragraphSpacing: 16,
        letterSpacing: 0
    }),
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
    ...createRoleMessageSettings({
        assistantShape: 'bubble',
        userShape: 'bubble',
        assistantAvatarPlacement: 'inline',
        userAvatarPlacement: 'inline'
    }),
    ...createChatTypographySettings({
        fontFamily: 'sans-serif',
        fontWeight: 400,
        fontSize: 16,
        pageWidth: 'auto',
        lineHeight: 1.6,
        paragraphSpacing: 16,
        letterSpacing: 0
    }),
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

const telegramThemeSettings: Record<string, SettingDefinition> = {
    appearanceMode: {
        default: 'follow-setting',
        label: '配色模式',
        description: '控制 Telegram 桌面跟随全局外观，或固定为浅色 / 深色。',
        common: true,
        type: 'options' as const,
        allowedScopes: ['Global'],
        options: [
            { value: 'follow-setting', label: '跟随全局', description: '跟随核心外观设置与系统深浅色。' },
            { value: 'light', label: '浅色', description: '固定为雾蓝浅色玻璃界面。' },
            { value: 'dark', label: '深色', description: '固定为深蓝灰玻璃界面。' }
        ]
    },
    glassIntensity: {
        default: 'medium',
        label: '玻璃强度',
        description: '控制 Telegram 桌面玻璃层的透明度和模糊感。',
        common: true,
        type: 'options' as const,
        allowedScopes: ['Global'],
        options: [
            { value: 'soft', label: '柔和', description: '减少透明与高光，适合长时间阅读。' },
            { value: 'medium', label: '标准', description: '接近参考图的液态玻璃质感。' },
            { value: 'clear', label: '通透', description: '更强背景透出与高光层次。' }
        ]
    },
    messageDensity: {
        default: 'cozy',
        label: '消息密度',
        description: '控制 Telegram 聊天消息间距。',
        common: true,
        type: 'options' as const,
        allowedScopes: ['Global'],
        options: [
            { value: 'compact', label: '紧凑', description: '更接近即时通讯的密集聊天。' },
            { value: 'cozy', label: '舒适', description: '保留更宽松的角色扮演阅读节奏。' }
        ]
    },
    panelChromeStyle: {
        default: 'floating-rounded',
        label: '桌面面板样式',
        description: '控制 Telegram 桌面三栏是否使用设计稿式圆角外边距。',
        common: true,
        type: 'options' as const,
        allowedScopes: ['Global'],
        options: [
            { value: 'floating-rounded', label: '圆角浮层', description: '三栏使用独立圆角、外边距与柔和边框。' },
            { value: 'edge-to-edge', label: '贴边兼容', description: '保留旧版贴边三栏结构。' }
        ]
    },
    topBlankSpace: {
        default: true,
        label: '顶部留白',
        description: 'Telegram 桌面三栏顶部保留设计稿式呼吸空间。关闭后贴近容器顶部。',
        common: true,
        type: 'boolean' as const,
        allowedScopes: ['Global']
    },
    ...createRoleMessageSettings({
        assistantShape: 'bubble',
        userShape: 'bubble',
        assistantAvatarPlacement: 'topbar',
        userAvatarPlacement: 'hidden'
    }),
    ...createChatTypographySettings({
        fontFamily: 'sans-serif',
        fontWeight: 400,
        fontSize: 12,
        pageWidth: 900,
        lineHeight: 1.45,
        paragraphSpacing: 12,
        letterSpacing: 0
    }),
    rightInfoPanel: {
        default: 'auto',
        label: '右侧资料栏',
        description: '控制 Telegram 桌面右侧个人资料 / 会话详情栏的显示策略。',
        common: true,
        type: 'options' as const,
        allowedScopes: ['Global'],
        options: [
            { value: 'auto', label: '自动', description: '宽屏显示，窄屏收进个人资料入口。' },
            { value: 'always', label: '常驻', description: '桌面端尽量保持右侧资料栏可见。' },
            { value: 'hidden', label: '隐藏', description: '默认隐藏，仅通过个人资料入口打开。' }
        ]
    },
    showUsernames: {
        default: true,
        label: '显示用户名',
        description: '在消息气泡上方显示发言者名称。',
        common: true,
        type: 'boolean' as const,
        allowedScopes: ['Global']
    },
    avatarShape: {
        default: 'circle',
        label: '头像形状',
        description: 'Telegram 桌面默认使用圆形头像。',
        common: true,
        type: 'options' as const,
        allowedScopes: ['Global'],
        options: [
            { value: 'circle', label: '圆形', description: '接近 Telegram 的圆形头像。' },
            { value: 'rounded', label: '圆角', description: '保留更柔和的 Lumina 卡片感。' }
        ]
    },
    sidebarCardDensity: {
        default: 'cozy',
        label: '角色列表密度',
        description: '控制 Telegram 角色列表项的垂直留白。',
        common: true,
        type: 'options' as const,
        allowedScopes: ['Global'],
        options: [
            { value: 'compact', label: '紧凑', description: '显示更多角色会话。' },
            { value: 'cozy', label: '舒适', description: '保留更大的点击区。' }
        ]
    },
    sidebarPreviewLines: {
        default: 2,
        label: '角色预览行数',
        description: '角色频道列表中保留的最近消息预览行数。',
        common: true,
        type: 'stepper' as const,
        min: 1,
        max: 4,
        allowedScopes: ['Global']
    }
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
                'linear-gradient(180deg, rgba(255, 255, 255, 0.92), color-mix(in srgb, var(--lw-bg-elevated) 96%, white))',
            '--lw-shell-main-mobile-bg': 'var(--lw-shell-main-bg)',
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
        cssVars: ({ activeSettings, themePackId, resolvedAppearance }) => {
            const density = getThemeSettingValue(activeSettings, themePackId, 'messageDensity');
            const avatarShape = getThemeSettingValue(activeSettings, themePackId, 'avatarShape');
            const bubbleStyle = getThemeSettingValue(activeSettings, themePackId, 'bubbleStyle');
            const chatFontFamily = getThemeSettingValue(activeSettings, themePackId, 'chatFontFamily', 'sans-serif');
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
                '--lw-chat-user-name-display': getThemeSettingValue(activeSettings, themePackId, 'showUsernames', true) === false ? 'none' : 'inline-flex',
                '--lw-chat-user-bubble': isDark ? 'color-mix(in srgb, var(--lw-bg-surface) 92%, white 8%)' : 'var(--lw-bg-subtle)',
                '--lw-chat-user-bubble-border': 'var(--lw-chat-border, var(--lw-border-subtle))',
                '--lw-chat-message-hover-bg': 'transparent',
                '--lw-chat-assistant-shape': String(getThemeSettingValue(activeSettings, themePackId, 'assistantMessageShape', 'bubble')),
                '--lw-chat-user-shape': String(getThemeSettingValue(activeSettings, themePackId, 'userMessageShape', 'bubble')),
                '--lw-chat-assistant-avatar-placement': String(getThemeSettingValue(activeSettings, themePackId, 'assistantAvatarPlacement', 'inline')),
                '--lw-chat-user-avatar-placement': String(getThemeSettingValue(activeSettings, themePackId, 'userAvatarPlacement', 'inline')),
                '--lw-chat-font': resolveFontFamily(chatFontFamily),
                '--lw-chat-font-weight': Number(getThemeSettingValue(activeSettings, themePackId, 'chatFontWeight', 400)),
                '--lw-chat-font-size': `${Number(getThemeSettingValue(activeSettings, themePackId, 'chatFontSize', 16))}px`,
                '--lw-chat-line-height': Number(getThemeSettingValue(activeSettings, themePackId, 'chatLineHeight', 1.6)),
                '--lw-chat-paragraph-spacing': `${Number(getThemeSettingValue(activeSettings, themePackId, 'chatParagraphSpacing', 16))}px`,
                '--lw-chat-letter-spacing': `${Number(getThemeSettingValue(activeSettings, themePackId, 'chatLetterSpacing', 0))}px`,
                '--lw-chat-page-width': String(getThemeSettingValue(activeSettings, themePackId, 'chatPageWidth', 'auto')),
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
            const chatFontFamily = getThemeSettingValue(activeSettings, themePackId, 'chatFontFamily', 'sans-serif');
            const isDark = resolvedAppearance === 'dark';
            return {
                '--lw-chat-preview-bg': isDark ? 'color-mix(in srgb, var(--lw-bg-app) 92%, black)' : 'var(--lw-bg-subtle)',
                '--lw-chat-preview-bubble-bg': 'var(--lw-bg-surface)',
                '--lw-chat-preview-user-bubble-bg': isDark ? 'color-mix(in srgb, var(--lw-bg-surface) 80%, white 20%)' : 'var(--lw-bg-hover)',
                '--lw-chat-preview-text-color': 'var(--lw-text-main)',
                '--lw-chat-preview-bubble-radius': resolveBubbleRadius(bubbleStyle),
                '--lw-chat-preview-padding': density === 'compact' ? '10px 14px' : '12px 16px',
                '--lw-chat-preview-avatar-radius': resolveAvatarRadius(avatarShape),
                '--lw-chat-preview-assistant-shape': String(getThemeSettingValue(activeSettings, themePackId, 'assistantMessageShape', 'bubble')),
                '--lw-chat-preview-user-shape': String(getThemeSettingValue(activeSettings, themePackId, 'userMessageShape', 'bubble')),
                '--lw-chat-preview-assistant-avatar-placement': String(getThemeSettingValue(activeSettings, themePackId, 'assistantAvatarPlacement', 'inline')),
                '--lw-chat-preview-user-avatar-placement': String(getThemeSettingValue(activeSettings, themePackId, 'userAvatarPlacement', 'inline')),
                '--lw-chat-preview-font': resolveFontFamily(chatFontFamily),
                '--lw-chat-preview-font-weight': Number(getThemeSettingValue(activeSettings, themePackId, 'chatFontWeight', 400)),
                '--lw-chat-preview-font-size': `${Number(getThemeSettingValue(activeSettings, themePackId, 'chatFontSize', 16))}px`,
                '--lw-chat-preview-line-height': Number(getThemeSettingValue(activeSettings, themePackId, 'chatLineHeight', 1.6)),
                '--lw-chat-preview-paragraph-spacing': `${Number(getThemeSettingValue(activeSettings, themePackId, 'chatParagraphSpacing', 16))}px`,
                '--lw-chat-preview-letter-spacing': `${Number(getThemeSettingValue(activeSettings, themePackId, 'chatLetterSpacing', 0))}px`,
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
        'shell.header': {
            ...base['shell.header'],
            cssVars: mergeCssVars(base['shell.header']?.cssVars, ({ resolvedAppearance }) => ({
                '--lw-header-bg': 'var(--lw-bg-elevated)',
                '--lw-header-border': 'var(--lw-border-strong)',
                '--lw-header-shadow': 'inset 0 -1px 0 color-mix(in srgb, var(--lw-text-inverse) 4%, transparent)',
                '--lw-header-control-bg': 'var(--lw-surface-container)',
                '--lw-header-control-border': 'var(--lw-border-strong)',
                '--lw-header-control-shadow': 'var(--lw-shadow-card)',
                '--lw-header-control-hover-bg': 'var(--lw-surface-container-high)',
                '--lw-header-tab-bg': 'var(--lw-surface-container)',
                '--lw-header-tab-hover-bg': 'var(--lw-surface-container-high)',
                '--lw-header-tab-active-bg': 'color-mix(in srgb, var(--lw-primary) 16%, var(--lw-surface-container-high))',
                '--lw-header-channel-mark-bg': resolvedAppearance === 'dark'
                    ? '#2b2d31'
                    : 'var(--lw-surface-container-lowest)',
                '--lw-header-channel-mark-color': resolvedAppearance === 'dark'
                    ? '#8e9297'
                    : 'var(--lw-text-muted)',
                '--lw-header-channel-mark-active-bg': resolvedAppearance === 'dark'
                    ? '#383a40'
                    : 'var(--lw-surface-container-high)',
                '--lw-header-channel-mark-active-color': resolvedAppearance === 'dark'
                    ? '#f2f3f5'
                    : 'var(--lw-text-main)',
                '--lw-header-channel-mark-active-border': resolvedAppearance === 'dark'
                    ? 'rgba(88, 101, 242, 0.3)'
                    : 'rgba(88, 101, 242, 0.24)'
            }))
        },
        'shell.mainSurface': {
            ...base['shell.mainSurface'],
            cssVars: mergeCssVars(base['shell.mainSurface']?.cssVars, ({ resolvedAppearance }) => ({
                '--lw-shell-main-bg': resolvedAppearance === 'dark'
                    ? '#2b2d31'
                    : 'linear-gradient(180deg, color-mix(in srgb, var(--lw-bg-elevated) 96%, white), color-mix(in srgb, var(--lw-bg-surface) 96%, white))',
                '--lw-shell-main-mobile-bg': resolvedAppearance === 'dark'
                    ? '#313338'
                    : 'var(--lw-surface-container-low)',
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
                '--lw-shell-widget-divider-border': resolvedAppearance === 'dark'
                    ? '1px solid #232428'
                    : '1px solid var(--lw-border-strong)',
                '--lw-shell-widget-radius': resolvedAppearance === 'dark' ? '18px' : '20px',
                '--lw-shell-widget-header-bg': resolvedAppearance === 'dark'
                    ? '#2b2d31'
                    : 'var(--lw-surface-container-high)',
                '--lw-shell-widget-pane-bg': resolvedAppearance === 'dark'
                    ? '#232428'
                    : 'var(--lw-surface-container-low)',
                '--lw-shell-widget-dropdown-bg': resolvedAppearance === 'dark'
                    ? '#2b2d31'
                    : 'var(--lw-surface-container-high)',
                '--lw-shell-widget-dropdown-border': 'var(--lw-border-strong)',
                '--lw-shell-widget-content-overlay': 'transparent'
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
                '--lw-character-card-avatar-shadow': 'none',
                '--lw-character-card-shadow': context.resolvedAppearance === 'dark'
                    ? '0 14px 30px rgba(0, 0, 0, 0.16)'
                    : '0 10px 24px rgba(31, 35, 40, 0.08)',
                '--lw-character-session-bg': context.resolvedAppearance === 'dark'
                    ? '#383a40'
                    : 'var(--lw-surface-container-high)'
            })
        },
        'shell.mobileDiscord': {
            ...base['shell.mobileDiscord'],
            cssVars: mergeCssVars(base['shell.mobileDiscord']?.cssVars, ({ resolvedAppearance }) => ({
                '--lw-discord-mobile-shell-bg': resolvedAppearance === 'dark'
                    ? '#1f2125'
                    : 'var(--lw-surface-container-high)',
                '--lw-discord-mobile-shell-border': resolvedAppearance === 'dark'
                    ? '#121317'
                    : 'var(--lw-border-strong)',
                '--lw-discord-mobile-shell-shadow': resolvedAppearance === 'dark'
                    ? '0 16px 30px rgba(0, 0, 0, 0.22)'
                    : '0 16px 30px rgba(31, 35, 40, 0.12)',
                '--lw-discord-mobile-toggle-bg': resolvedAppearance === 'dark'
                    ? '#2b2d31'
                    : 'var(--lw-surface-container-lowest)',
                '--lw-discord-mobile-toggle-border': resolvedAppearance === 'dark'
                    ? '#3f4147'
                    : 'var(--lw-border-strong)',
                '--lw-discord-mobile-toggle-shadow': resolvedAppearance === 'dark'
                    ? '0 16px 28px rgba(0, 0, 0, 0.22)'
                    : '0 16px 28px rgba(31, 35, 40, 0.12)',
                '--lw-discord-mobile-toggle-active-bg': resolvedAppearance === 'dark'
                    ? '#313338'
                    : 'var(--lw-surface-container-high)',
                '--lw-discord-mobile-toggle-active-border': resolvedAppearance === 'dark'
                    ? 'rgba(88, 101, 242, 0.45)'
                    : 'rgba(88, 101, 242, 0.28)',
                '--lw-discord-mobile-toggle-mark-bg': resolvedAppearance === 'dark'
                    ? '#232428'
                    : 'var(--lw-surface-container-low)',
                '--lw-discord-mobile-toggle-mark-color': resolvedAppearance === 'dark'
                    ? '#8e9297'
                    : 'var(--lw-text-muted)',
                '--lw-discord-mobile-sheet-bg': resolvedAppearance === 'dark'
                    ? 'rgba(0, 0, 0, 0.42)'
                    : 'rgba(31, 35, 40, 0.28)',
                '--lw-discord-mobile-sheet-backdrop': 'blur(6px)'
            }))
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
                '--lw-chat-message-hover-bg': context.resolvedAppearance === 'dark'
                    ? 'rgba(255, 255, 255, 0.02)'
                    : 'rgba(31, 35, 40, 0.04)',
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
                '--lw-chat-input-focus-border': context.resolvedAppearance === 'dark'
                    ? 'rgba(88, 101, 242, 0.42)'
                    : 'rgba(88, 101, 242, 0.26)',
                '--lw-chat-input-focus-shadow': context.resolvedAppearance === 'dark'
                    ? '0 0 0 1px rgba(88, 101, 242, 0.24)'
                    : '0 0 0 1px rgba(88, 101, 242, 0.16)',
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
                '--lw-settings-sidebar-border': resolvedAppearance === 'dark'
                    ? '#1e1f22'
                    : 'var(--lw-border-strong)',
                '--lw-settings-header-bg': resolvedAppearance === 'dark'
                    ? '#2b2d31'
                    : 'var(--lw-surface-container-high)',
                '--lw-settings-header-border': resolvedAppearance === 'dark'
                    ? '#1e1f22'
                    : 'var(--lw-border-strong)',
                '--lw-settings-nav-item-color': resolvedAppearance === 'dark'
                    ? '#b5bac1'
                    : 'var(--lw-text-secondary)',
                '--lw-settings-nav-hover-bg': resolvedAppearance === 'dark'
                    ? '#35373c'
                    : 'var(--lw-bg-hover)',
                '--lw-settings-nav-hover-color': resolvedAppearance === 'dark'
                    ? '#f2f3f5'
                    : 'var(--lw-text-main)',
                '--lw-settings-nav-active-bg': resolvedAppearance === 'dark'
                    ? '#404249'
                    : 'var(--lw-bg-selection)',
                '--lw-settings-nav-active-color': resolvedAppearance === 'dark'
                    ? '#ffffff'
                    : 'var(--lw-text-main)',
                '--lw-settings-nav-active-shadow': 'none',
                '--lw-settings-muted-color': resolvedAppearance === 'dark'
                    ? '#949ba4'
                    : 'var(--lw-text-muted)',
                '--lw-settings-breadcrumb-hover-color': resolvedAppearance === 'dark'
                    ? '#f2f3f5'
                    : 'var(--lw-primary)'
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
                '--lw-timeline-header-border': 'var(--lw-border-strong)',
                '--lw-timeline-card-bg': resolvedAppearance === 'dark'
                    ? '#2b2d31'
                    : 'var(--lw-surface-container-lowest)',
                '--lw-timeline-card-border': 'var(--lw-border-strong)',
                '--lw-timeline-card-shadow': 'none',
                '--lw-timeline-card-active-bg': resolvedAppearance === 'dark'
                    ? '#232428'
                    : 'var(--lw-surface-container-lowest)',
                '--lw-timeline-card-active-border': 'var(--lw-border-active)',
                '--lw-timeline-canvas-bg': resolvedAppearance === 'dark'
                    ? '#313338'
                    : 'var(--lw-surface-container-low)',
                '--lw-timeline-chip-bg': resolvedAppearance === 'dark'
                    ? '#383a40'
                    : 'var(--lw-surface-container-high)',
                '--lw-timeline-chip-border': 'var(--lw-border-strong)',
                '--lw-timeline-chip-active-bg': 'color-mix(in srgb, var(--lw-primary) 24%, var(--lw-timeline-chip-bg, var(--lw-surface-container-high)))',
                '--lw-timeline-chip-active-border': 'var(--lw-border-active)',
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
                '--lw-timeline-modal-border': 'var(--lw-border-strong)',
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
                '--lw-lorebook-header-border': 'var(--lw-border-strong)',
                '--lw-lorebook-panel-bg': resolvedAppearance === 'dark'
                    ? '#2b2d31'
                    : 'var(--lw-surface-container-lowest)',
                '--lw-lorebook-panel-hover-bg': resolvedAppearance === 'dark'
                    ? '#35373c'
                    : 'var(--lw-bg-hover)',
                '--lw-lorebook-panel-border': 'var(--lw-border-strong)',
                '--lw-lorebook-control-bg': resolvedAppearance === 'dark'
                    ? '#383a40'
                    : 'var(--lw-surface-container-high)',
                '--lw-lorebook-control-border': 'var(--lw-border-strong)',
                '--lw-lorebook-item-bg': resolvedAppearance === 'dark'
                    ? '#2b2d31'
                    : 'var(--lw-surface-container-lowest)',
                '--lw-lorebook-item-border': 'var(--lw-border-strong)',
                '--lw-lorebook-item-hover-bg': resolvedAppearance === 'dark'
                    ? '#35373c'
                    : 'var(--lw-bg-hover)',
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
                '--lw-lorebook-editor-header-border': 'var(--lw-border-strong)',
                '--lw-lorebook-editor-control-bg': resolvedAppearance === 'dark'
                    ? '#383a40'
                    : 'var(--lw-surface-container-low)',
                '--lw-lorebook-editor-control-border': 'var(--lw-border-strong)',
                '--lw-lorebook-editor-control-hover-bg': resolvedAppearance === 'dark'
                    ? '#404249'
                    : 'var(--lw-surface-container-high)',
                '--lw-lorebook-editor-section-bg': resolvedAppearance === 'dark'
                    ? '#2b2d31'
                    : 'var(--lw-surface-container-lowest)',
                '--lw-lorebook-editor-section-border': 'var(--lw-border-strong)',
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

const resolveTelegramDesignTokens = ({ activeSettings, resolvedAppearance, themePackId }: ComponentThemeContext): ThemeValueMap => {
    const isDark = resolvedAppearance === 'dark';
    const glassIntensity = getThemeSettingValue(activeSettings, themePackId, 'glassIntensity', 'medium');
    const glassBlur = glassIntensity === 'clear'
        ? (isDark ? 'blur(30px) saturate(1.24)' : 'blur(32px) saturate(1.28)')
        : glassIntensity === 'soft'
            ? (isDark ? 'blur(16px) saturate(1.08)' : 'blur(18px) saturate(1.12)')
            : (isDark ? 'blur(22px) saturate(1.18)' : 'blur(24px) saturate(1.22)');
    const panelShadow = glassIntensity === 'clear'
        ? (isDark ? '0 28px 68px rgba(0, 0, 0, 0.34)' : '0 28px 68px rgba(44, 92, 130, 0.20)')
        : glassIntensity === 'soft'
            ? (isDark ? '0 18px 44px rgba(0, 0, 0, 0.22)' : '0 18px 44px rgba(44, 92, 130, 0.12)')
            : (isDark ? '0 24px 60px rgba(0, 0, 0, 0.28)' : '0 24px 58px rgba(44, 92, 130, 0.16)');

    return isDark
        ? {
            '--lw-primary': '#4aa3ff',
            '--lw-primary-rgb': '74, 163, 255',
            '--lw-bg-app': '#0f1b27',
            '--lw-bg-surface': '#172638',
            '--lw-bg-elevated': '#20354b',
            '--lw-bg-subtle': '#16283a',
            '--lw-bg-hover': 'rgba(115, 177, 255, 0.12)',
            '--lw-bg-active': 'rgba(115, 177, 255, 0.18)',
            '--lw-text-main': '#eaf5ff',
            '--lw-text-secondary': '#a9c4dc',
            '--lw-text-muted': '#7897b2',
            '--lw-border-base': 'rgba(143, 192, 232, 0.18)',
            '--lw-border-strong': 'rgba(176, 216, 255, 0.26)',
            '--lw-border-active': 'rgba(98, 178, 255, 0.44)',
            '--lw-surface-container-lowest': 'rgba(18, 34, 50, 0.78)',
            '--lw-surface-container-low': 'rgba(24, 45, 65, 0.76)',
            '--lw-surface-container': 'rgba(31, 56, 80, 0.78)',
            '--lw-surface-container-high': 'rgba(42, 72, 101, 0.82)',
            '--lw-surface-container-highest': 'rgba(58, 91, 124, 0.88)',
            '--lw-theme-accent-soft': 'rgba(74, 163, 255, 0.18)',
            '--lw-telegram-diffuse-bg': 'radial-gradient(ellipse 112% 62% at 48% 38%, rgba(107, 171, 255, 0.58) 0%, rgba(107, 171, 255, 0.26) 42%, transparent 78%), radial-gradient(ellipse 52% 30% at 25% 26%, rgba(255, 255, 255, 0.20) 0%, transparent 68%), radial-gradient(ellipse 18% 22% at 56% 24%, rgba(255, 255, 255, 0.26) 0%, transparent 70%)',
            '--lw-telegram-glass-blur': glassBlur,
            '--lw-telegram-panel-shadow': panelShadow,
            '--lw-telegram-user-bubble': 'linear-gradient(135deg, rgba(31, 92, 64, 0.92), rgba(35, 116, 74, 0.88))',
            '--lw-telegram-ai-bubble': 'rgba(20, 38, 56, 0.88)'
        }
        : {
            '--lw-primary': '#2e9fe8',
            '--lw-primary-rgb': '46, 159, 232',
            '--lw-bg-app': '#d9eafa',
            '--lw-bg-surface': '#f6fbff',
            '--lw-bg-elevated': '#ffffff',
            '--lw-bg-subtle': '#eaf5fd',
            '--lw-bg-hover': 'rgba(46, 159, 232, 0.10)',
            '--lw-bg-active': 'rgba(46, 159, 232, 0.16)',
            '--lw-text-main': '#152637',
            '--lw-text-secondary': '#557085',
            '--lw-text-muted': '#7d96a8',
            '--lw-border-base': 'rgba(84, 136, 178, 0.18)',
            '--lw-border-strong': 'rgba(64, 122, 168, 0.24)',
            '--lw-border-active': 'rgba(46, 159, 232, 0.38)',
            '--lw-surface-container-lowest': 'rgba(255, 255, 255, 0.82)',
            '--lw-surface-container-low': 'rgba(247, 252, 255, 0.76)',
            '--lw-surface-container': 'rgba(238, 248, 255, 0.74)',
            '--lw-surface-container-high': 'rgba(255, 255, 255, 0.88)',
            '--lw-surface-container-highest': 'rgba(255, 255, 255, 0.96)',
            '--lw-theme-accent-soft': 'rgba(46, 159, 232, 0.14)',
            '--lw-telegram-diffuse-bg': 'radial-gradient(ellipse 112% 62% at 48% 38%, rgba(107, 171, 255, 0.84) 0%, rgba(107, 171, 255, 0.42) 42%, transparent 78%), radial-gradient(ellipse 52% 30% at 25% 26%, rgba(255, 255, 255, 0.52) 0%, transparent 68%), radial-gradient(ellipse 18% 22% at 56% 24%, rgba(255, 255, 255, 0.71) 0%, transparent 70%)',
            '--lw-telegram-glass-blur': glassBlur,
            '--lw-telegram-panel-shadow': panelShadow,
            '--lw-telegram-user-bubble': 'linear-gradient(135deg, #dff7d6, #c9f0bf)',
            '--lw-telegram-ai-bubble': 'rgba(255, 255, 255, 0.92)'
        };
};

const createTelegramSurfaceSkinMap = (): DesktopModeManifest['surfaceSkins'] => {
    const base = createSurfaceSkinMap() as NonNullable<DesktopModeManifest['surfaceSkins']>;

    return {
        ...base,
        'shell.app': {
            ...base['shell.app'],
            cssVars: mergeCssVars(base['shell.app']?.cssVars, ({ resolvedAppearance }) => ({
                '--lw-shell-panel-bg': resolvedAppearance === 'dark'
                    ? 'var(--lw-telegram-diffuse-bg), linear-gradient(180deg, #102033 0%, #0d1824 100%)'
                    : 'var(--lw-telegram-diffuse-bg), linear-gradient(180deg, #c6e2fb 0%, #d7eafa 46%, #eef7fd 100%)',
                '--lw-shell-panel-overlay': 'radial-gradient(rgba(255, 255, 255, 0.16) 0.8px, transparent 0.8px)'
            }))
        },
        'shell.panelBody': {
            ...base['shell.panelBody'],
            cssVars: mergeCssVars(base['shell.panelBody']?.cssVars, ({ resolvedAppearance }) => ({
                '--lw-shell-body-bg': resolvedAppearance === 'dark'
                    ? 'linear-gradient(180deg, rgba(74, 163, 255, 0.10), transparent 34%), rgba(13, 24, 36, 0.56)'
                    : 'linear-gradient(180deg, rgba(255, 255, 255, 0.30), transparent 36%), rgba(218, 236, 250, 0.48)'
            }))
        },
        'shell.header': {
            ...base['shell.header'],
            cssVars: mergeCssVars(base['shell.header']?.cssVars, ({ resolvedAppearance }) => ({
                '--lw-header-bg': resolvedAppearance === 'dark'
                    ? 'linear-gradient(180deg, rgba(24, 45, 65, 0.90), rgba(15, 28, 42, 0.76))'
                    : 'linear-gradient(180deg, rgba(255, 255, 255, 0.78), rgba(245, 251, 255, 0.66))',
                '--lw-header-border': 'var(--lw-border-subtle)',
                '--lw-header-shadow': resolvedAppearance === 'dark'
                    ? '0 14px 34px rgba(0, 0, 0, 0.18)'
                    : '0 14px 34px rgba(44, 92, 130, 0.08)',
                '--lw-header-bottom-shadow': resolvedAppearance === 'dark'
                    ? '0 -14px 34px rgba(0, 0, 0, 0.18)'
                    : '0 -14px 34px rgba(44, 92, 130, 0.08)',
                '--lw-header-control-bg': 'color-mix(in srgb, var(--lw-surface-container-high) 78%, transparent)',
                '--lw-header-control-border': 'var(--lw-border-subtle)',
                '--lw-header-control-shadow': 'var(--lw-telegram-panel-shadow, var(--lw-shadow-card))',
                '--lw-header-control-hover-bg': 'color-mix(in srgb, var(--lw-primary) 10%, var(--lw-header-control-bg))',
                '--lw-header-avatar-shadow': resolvedAppearance === 'dark'
                    ? '0 10px 24px rgba(0, 0, 0, 0.20)'
                    : '0 10px 24px rgba(44, 92, 130, 0.12)',
                '--lw-header-tab-bg': 'color-mix(in srgb, var(--lw-surface-container-high) 78%, transparent)',
                '--lw-header-tab-hover-bg': 'color-mix(in srgb, var(--lw-primary) 8%, transparent)',
                '--lw-header-tab-active-bg': 'color-mix(in srgb, var(--lw-primary) 14%, transparent)'
            }))
        },
        'telegram.frame': {
            componentId: 'telegram.frame',
            variant: 'telegram',
            cssVars: (context: ComponentThemeContext) => {
                const isFloating = getThemeSettingValue(
                    context.activeSettings,
                    context.themePackId,
                    'panelChromeStyle',
                    'floating-rounded'
                ) !== 'edge-to-edge';
                const hasTopBlankSpace = getThemeSettingValue(
                    context.activeSettings,
                    context.themePackId,
                    'topBlankSpace',
                    true
                ) !== false;

                return {
                    '--lw-telegram-frame-bg': context.resolvedAppearance === 'dark'
                        ? 'var(--lw-telegram-diffuse-bg), rgba(18, 34, 50, 0.72)'
                        : 'var(--lw-telegram-diffuse-bg), rgba(225, 241, 252, 0.62)',
                    '--lw-telegram-frame-border': context.resolvedAppearance === 'dark'
                        ? 'rgba(143, 192, 232, 0.22)'
                        : 'rgba(255, 255, 255, 0.58)',
                    '--lw-telegram-frame-radius': isFloating ? '24px' : '18px',
                    '--lw-telegram-frame-shadow': context.resolvedAppearance === 'dark'
                        ? '0 26px 70px rgba(0, 0, 0, 0.34)'
                        : '0 26px 70px rgba(44, 92, 130, 0.18)',
                    '--lw-telegram-frame-gap': isFloating ? '10px' : '0px',
                    '--lw-telegram-frame-padding': isFloating ? '12px' : '0px',
                    '--lw-telegram-frame-padding-top': isFloating && hasTopBlankSpace ? '28px' : (isFloating ? '12px' : '0px'),
                    '--lw-telegram-pane-radius': isFloating ? '18px' : '0px',
                    '--lw-telegram-pane-border': isFloating
                        ? (context.resolvedAppearance === 'dark' ? 'rgba(143, 192, 232, 0.18)' : 'rgba(255, 255, 255, 0.64)')
                        : 'transparent',
                    '--lw-telegram-pane-shadow': isFloating
                        ? (context.resolvedAppearance === 'dark' ? '0 18px 44px rgba(0, 0, 0, 0.22)' : '0 18px 44px rgba(44, 92, 130, 0.12)')
                        : 'none',
                    '--lw-telegram-mobile-sheet-bg': context.resolvedAppearance === 'dark'
                        ? 'rgba(4, 12, 20, 0.38)'
                        : 'rgba(15, 38, 58, 0.26)',
                    '--lw-telegram-mobile-sheet-backdrop': context.resolvedAppearance === 'dark'
                        ? 'blur(10px)'
                        : 'blur(8px)'
                };
            }
        },
        'telegram.chatList': {
            componentId: 'telegram.chatList',
            variant: 'telegram',
            cssVars: ({ resolvedAppearance }) => ({
                '--lw-telegram-chat-list-bg': resolvedAppearance === 'dark'
                    ? 'rgba(18, 34, 50, 0.72)'
                    : 'rgba(255, 255, 255, 0.56)',
                '--lw-telegram-chat-list-width': '320px',
                '--lw-telegram-chat-list-compact-width': '268px'
            })
        },
        'telegram.conversation': {
            componentId: 'telegram.conversation',
            variant: 'telegram',
            cssVars: ({ resolvedAppearance }) => ({
                '--lw-telegram-conversation-bg': resolvedAppearance === 'dark'
                    ? 'rgba(15, 28, 42, 0.68)'
                    : 'rgba(231, 244, 253, 0.58)',
                '--lw-chat-message-max-width': '560px',
                '--lw-chat-bubble': 'var(--lw-telegram-ai-bubble)',
                '--lw-chat-user-bubble': 'var(--lw-telegram-user-bubble)'
            })
        },
        'telegram.infoPanel': {
            componentId: 'telegram.infoPanel',
            variant: 'telegram',
            cssVars: ({ resolvedAppearance }) => ({
                '--lw-telegram-info-panel-bg': resolvedAppearance === 'dark'
                    ? 'rgba(24, 45, 65, 0.84)'
                    : 'rgba(255, 255, 255, 0.74)',
                '--lw-telegram-info-panel-border': 'var(--lw-border-base)',
                '--lw-telegram-avatar-radius': '999px'
            })
        },
        'telegram.composer': {
            componentId: 'telegram.composer',
            variant: 'telegram',
            cssVars: ({ resolvedAppearance }) => ({
                '--lw-chat-input-surface': resolvedAppearance === 'dark'
                    ? 'rgba(26, 48, 70, 0.84)'
                    : 'rgba(255, 255, 255, 0.86)',
                '--lw-chat-input-border': 'var(--lw-border-base)',
                '--lw-chat-input-radius': '999px'
            })
        },
        'shell.mainSurface': {
            ...base['shell.mainSurface'],
            cssVars: mergeCssVars(base['shell.mainSurface']?.cssVars, ({ resolvedAppearance }) => ({
                '--lw-shell-main-bg': resolvedAppearance === 'dark'
                    ? 'linear-gradient(180deg, rgba(20, 38, 56, 0.86), rgba(15, 28, 42, 0.84))'
                    : 'linear-gradient(180deg, rgba(255, 255, 255, 0.82), rgba(245, 251, 255, 0.74))',
                '--lw-shell-main-border': 'var(--lw-border-base)',
                '--lw-shell-main-radius': '28px',
                '--lw-shell-main-shadow': 'var(--lw-telegram-panel-shadow)'
            }))
        },
        'shell.widget': {
            ...base['shell.widget'],
            cssVars: mergeCssVars(base['shell.widget']?.cssVars, ({ resolvedAppearance }) => ({
                '--lw-shell-widget-bg': resolvedAppearance === 'dark'
                    ? 'linear-gradient(180deg, rgba(24, 45, 65, 0.90), rgba(15, 28, 42, 0.88))'
                    : 'linear-gradient(180deg, rgba(255, 255, 255, 0.84), rgba(245, 251, 255, 0.76))',
                '--lw-shell-widget-border': 'var(--lw-border-base)',
                '--lw-shell-widget-radius': '28px',
                '--lw-shell-widget-header-bg': 'rgba(255, 255, 255, 0.10)',
                '--lw-shell-widget-pane-bg': resolvedAppearance === 'dark'
                    ? 'linear-gradient(180deg, rgba(24, 45, 65, 0.90), rgba(15, 28, 42, 0.78))'
                    : 'linear-gradient(180deg, rgba(255, 255, 255, 0.78), rgba(245, 251, 255, 0.70))',
                '--lw-shell-widget-dropdown-bg': 'color-mix(in srgb, var(--lw-surface-container-high) 88%, transparent)',
                '--lw-shell-widget-dropdown-border': 'var(--lw-border-subtle)',
                '--lw-shell-widget-content-overlay': 'radial-gradient(circle at 50% 0%, color-mix(in srgb, var(--lw-primary) 12%, transparent), transparent 34%)'
            }))
        },
        'shell.characterRail': {
            ...base['shell.characterRail'],
            cssVars: mergeCssVars(base['shell.characterRail']?.cssVars, ({ resolvedAppearance }) => ({
                '--lw-character-rail-bg': resolvedAppearance === 'dark'
                    ? 'rgba(18, 34, 50, 0.72)'
                    : 'rgba(255, 255, 255, 0.58)',
                '--lw-character-rail-border': 'var(--lw-border-base)',
                '--lw-character-rail-width': 'var(--lw-telegram-chat-list-width, 292px)'
            }))
        },
        'shell.characterCard': {
            ...base['shell.characterCard'],
            cssVars: (context: ComponentThemeContext) => ({
                ...resolveThemeValueMap(base['shell.characterCard']?.cssVars, context),
                '--lw-character-card-bg': context.resolvedAppearance === 'dark'
                    ? 'rgba(25, 45, 64, 0.64)'
                    : 'rgba(255, 255, 255, 0.58)',
                '--lw-character-card-border': 'rgba(255, 255, 255, 0.22)',
                '--lw-character-card-active-border': 'rgba(var(--lw-primary-rgb), 0.42)',
                '--lw-character-card-avatar-radius': '999px',
                '--lw-character-card-avatar-shadow': context.resolvedAppearance === 'dark'
                    ? '0 8px 18px rgba(0, 0, 0, 0.18)'
                    : '0 8px 18px rgba(44, 92, 130, 0.10)',
                '--lw-character-card-menu-shadow': context.resolvedAppearance === 'dark'
                    ? '0 18px 34px rgba(0, 0, 0, 0.24)'
                    : '0 18px 34px rgba(44, 92, 130, 0.16)',
                '--lw-character-rail-logo-bg': context.resolvedAppearance === 'dark'
                    ? 'linear-gradient(135deg, #2a9bd8, #0f6ea8)'
                    : 'linear-gradient(135deg, #58c4ff, #168bd4)',
                '--lw-character-card-shadow': context.resolvedAppearance === 'dark'
                    ? '0 16px 34px rgba(0, 0, 0, 0.20)'
                    : '0 16px 34px rgba(57, 108, 150, 0.12)',
                '--lw-character-rail-mobile-shadow': context.resolvedAppearance === 'dark'
                    ? '0 -22px 40px rgba(0, 0, 0, 0.36)'
                    : '0 -22px 40px rgba(0, 0, 0, 0.28)',
                '--lw-character-session-bg': context.resolvedAppearance === 'dark'
                    ? 'rgba(42, 72, 101, 0.54)'
                    : 'rgba(255, 255, 255, 0.62)'
            })
        },
        'chat.stream': {
            ...base['chat.stream'],
            cssVars: (context: ComponentThemeContext) => {
                const density = getThemeSettingValue(context.activeSettings, context.themePackId, 'messageDensity');
                return {
                    ...resolveThemeValueMap(base['chat.stream']?.cssVars, context),
                    '--lw-chat-stream-bg': context.resolvedAppearance === 'dark'
                        ? 'radial-gradient(circle at 20% 0%, rgba(74, 163, 255, 0.12), transparent 26%), rgba(15, 28, 42, 0.66)'
                        : 'radial-gradient(circle at 18% 0%, rgba(73, 164, 230, 0.16), transparent 30%), rgba(238, 248, 255, 0.44)',
                    '--lw-chat-scroll-bg': 'linear-gradient(135deg, color-mix(in srgb, var(--lw-text-main) 4%, transparent) 1px, transparent 1px), linear-gradient(45deg, color-mix(in srgb, var(--lw-text-main) 3%, transparent) 1px, transparent 1px)',
                    '--lw-chat-scroll-padding': density === 'compact' ? '18px 26px' : '24px 36px',
                    '--lw-chat-content-gap': density === 'compact' ? '14px' : '20px',
                    '--lw-chat-avatar-radius': '999px',
                    '--lw-chat-avatar-shadow': context.resolvedAppearance === 'dark'
                        ? '0 10px 24px rgba(0, 0, 0, 0.22)'
                        : '0 10px 24px rgba(44, 92, 130, 0.12)',
                    '--lw-chat-bubble-radius': '20px',
                    '--lw-chat-bubble': 'var(--lw-telegram-ai-bubble)',
                    '--lw-chat-user-bubble': 'var(--lw-telegram-user-bubble)',
                    '--lw-chat-border': 'rgba(255, 255, 255, 0.22)',
                    '--lw-chat-user-bubble-border': 'color-mix(in srgb, var(--lw-success, #6ccf7d) 26%, transparent)',
                    '--lw-chat-color': 'var(--lw-text-main)',
                    '--lw-chat-message-hover-bg': 'transparent',
                    '--lw-chat-input-area-bg': 'transparent',
                    '--lw-chat-input-surface': context.resolvedAppearance === 'dark'
                        ? 'rgba(26, 48, 70, 0.84)'
                        : 'rgba(255, 255, 255, 0.82)',
                    '--lw-chat-input-border': 'var(--lw-border-base)',
                    '--lw-chat-input-radius': '999px',
                    '--lw-chat-input-toolbar-bg': 'color-mix(in srgb, var(--lw-surface-container-highest) 84%, transparent)',
                    '--lw-chat-input-toolbar-shadow': context.resolvedAppearance === 'dark'
                        ? '0 12px 26px rgba(0, 0, 0, 0.24)'
                        : '0 12px 26px rgba(44, 92, 130, 0.12)',
                    '--lw-chat-input-shadow': context.resolvedAppearance === 'dark'
                        ? '0 12px 30px rgba(0, 0, 0, 0.20)'
                        : '0 12px 30px rgba(44, 92, 130, 0.10)',
                    '--lw-chat-menu-shadow': context.resolvedAppearance === 'dark'
                        ? '0 18px 34px rgba(0, 0, 0, 0.24)'
                        : '0 18px 34px rgba(44, 92, 130, 0.16)',
                    '--lw-chat-empty-mark-bg': context.resolvedAppearance === 'dark'
                        ? 'linear-gradient(135deg, #2a9bd8, #0f6ea8)'
                        : 'linear-gradient(135deg, #58c4ff, #168bd4)',
                    '--lw-chat-empty-mark-shadow': context.resolvedAppearance === 'dark'
                        ? '0 18px 34px rgba(0, 0, 0, 0.24)'
                        : '0 18px 34px rgba(44, 92, 130, 0.16)',
                    '--lw-chat-bubble-shadow': context.resolvedAppearance === 'dark'
                        ? '0 12px 28px rgba(0, 0, 0, 0.22)'
                        : '0 12px 28px rgba(62, 113, 150, 0.13)',
                    '--lw-chat-streaming-surface': 'rgba(var(--lw-primary-rgb), 0.12)',
                    '--lw-chat-streaming-border': 'rgba(var(--lw-primary-rgb), 0.22)',
                    '--lw-chat-font-size': `${Number(getThemeSettingValue(context.activeSettings, context.themePackId, 'chatFontSize', 12))}px`,
                    '--lw-chat-line-height': Number(getThemeSettingValue(context.activeSettings, context.themePackId, 'chatLineHeight', 1.45)),
                    '--lw-chat-paragraph-spacing': `${Number(getThemeSettingValue(context.activeSettings, context.themePackId, 'chatParagraphSpacing', 12))}px`,
                    '--lw-chat-page-width': String(getThemeSettingValue(context.activeSettings, context.themePackId, 'chatPageWidth', 900))
                };
            }
        },
        'chat.preview': {
            ...base['chat.preview'],
            cssVars: mergeCssVars(base['chat.preview']?.cssVars, ({ resolvedAppearance }) => ({
                '--lw-chat-preview-bg': resolvedAppearance === 'dark'
                    ? 'rgba(18, 34, 50, 0.72)'
                    : 'rgba(255, 255, 255, 0.56)',
                '--lw-chat-preview-bubble-bg': 'var(--lw-telegram-ai-bubble)',
                '--lw-chat-preview-user-bubble-bg': 'var(--lw-telegram-user-bubble)'
            }))
        },
        'settings.root': {
            ...base['settings.root'],
            cssVars: mergeCssVars(base['settings.root']?.cssVars, ({ resolvedAppearance }) => ({
                '--lw-settings-shell-bg': resolvedAppearance === 'dark'
                    ? 'rgba(15, 28, 42, 0.74)'
                    : 'rgba(238, 248, 255, 0.58)',
                '--lw-settings-shell-overlay': 'radial-gradient(circle at 12% 8%, color-mix(in srgb, var(--lw-primary) 12%, transparent), transparent 30%)',
                '--lw-settings-sidebar-bg': resolvedAppearance === 'dark'
                    ? 'rgba(18, 34, 50, 0.82)'
                    : 'rgba(255, 255, 255, 0.62)',
                '--lw-settings-header-bg': resolvedAppearance === 'dark'
                    ? 'rgba(31, 56, 80, 0.76)'
                    : 'rgba(255, 255, 255, 0.70)',
                '--lw-settings-card-radius': '24px'
            }))
        },
        'settings.unified': {
            ...base['settings.unified'],
            cssVars: mergeCssVars(base['settings.unified']?.cssVars, () => ({
                '--lw-settings-block-bg': 'var(--lw-surface-container-high)',
                '--lw-settings-block-border': 'var(--lw-border-base)',
                '--lw-settings-block-shadow': '0 10px 24px rgba(44, 92, 130, 0.08)',
                '--lw-settings-inner-card-bg': 'color-mix(in srgb, var(--lw-surface-container) 72%, transparent)',
                '--lw-settings-inner-card-border': 'var(--lw-border-subtle)'
            }))
        },
        'settings.detailed': {
            ...base['settings.detailed'],
            cssVars: mergeCssVars(base['settings.detailed']?.cssVars, () => ({
                '--lw-settings-detail-bg': 'var(--lw-surface-container-high)',
                '--lw-settings-detail-border': 'var(--lw-border-subtle)',
                '--lw-settings-detail-shadow': 'var(--lw-telegram-panel-shadow, var(--lw-shadow-card))',
                '--lw-settings-detail-radius': '24px'
            }))
        },
        'settings.control': {
            ...base['settings.control'],
            cssVars: (context: ComponentThemeContext) => ({
                ...resolveThemeValueMap(base['settings.control']?.cssVars, context),
                '--lw-setting-row-hover-bg': 'var(--lw-bg-hover)',
                '--lw-setting-control-bg': 'var(--lw-surface-container)',
                '--lw-setting-control-border': 'var(--lw-border-base)',
                '--lw-setting-control-active-bg': 'var(--lw-surface-container-highest)',
                '--lw-setting-control-active-shadow': '0 8px 18px rgba(44, 92, 130, 0.1)',
                '--lw-setting-slider-track': 'var(--lw-surface-container-low)'
            })
        },
        'timeline.root': {
            ...base['timeline.root'],
            cssVars: mergeCssVars(base['timeline.root']?.cssVars, ({ resolvedAppearance }) => ({
                '--lw-timeline-canvas-bg': resolvedAppearance === 'dark'
                    ? 'radial-gradient(circle at 50% 0%, rgba(255, 255, 255, 0.08), transparent 34%), rgba(15, 28, 42, 0.58)'
                    : 'radial-gradient(circle at 50% 0%, rgba(255, 255, 255, 0.72), transparent 34%), rgba(232, 245, 255, 0.58)',
                '--lw-timeline-header-bg': resolvedAppearance === 'dark'
                    ? 'rgba(24, 45, 65, 0.78)'
                    : 'rgba(255, 255, 255, 0.74)',
                '--lw-timeline-header-border': resolvedAppearance === 'dark'
                    ? 'rgba(143, 192, 232, 0.22)'
                    : 'rgba(148, 190, 219, 0.38)',
                '--lw-timeline-card-bg': resolvedAppearance === 'dark'
                    ? 'rgba(24, 45, 65, 0.78)'
                    : 'rgba(255, 255, 255, 0.74)',
                '--lw-timeline-card-border': resolvedAppearance === 'dark'
                    ? 'rgba(143, 192, 232, 0.22)'
                    : 'rgba(148, 190, 219, 0.38)',
                '--lw-timeline-card-shadow': 'var(--lw-telegram-panel-shadow, 0 18px 42px rgba(44, 92, 130, 0.12))',
                '--lw-timeline-card-active-bg': resolvedAppearance === 'dark'
                    ? 'rgba(31, 56, 80, 0.84)'
                    : 'rgba(255, 255, 255, 0.86)',
                '--lw-timeline-card-active-border': resolvedAppearance === 'dark'
                    ? 'rgba(82, 171, 233, 0.42)'
                    : 'rgba(82, 171, 233, 0.52)',
                '--lw-timeline-chip-bg': resolvedAppearance === 'dark'
                    ? 'rgba(31, 56, 80, 0.70)'
                    : 'rgba(255, 255, 255, 0.68)',
                '--lw-timeline-chip-border': resolvedAppearance === 'dark'
                    ? 'rgba(143, 192, 232, 0.22)'
                    : 'rgba(148, 190, 219, 0.34)',
                '--lw-timeline-chip-active-bg': resolvedAppearance === 'dark'
                    ? 'rgba(32, 78, 114, 0.72)'
                    : 'rgba(227, 244, 255, 0.82)',
                '--lw-timeline-chip-active-border': resolvedAppearance === 'dark'
                    ? 'rgba(82, 171, 233, 0.38)'
                    : 'rgba(82, 171, 233, 0.46)',
                '--lw-timeline-modal-overlay-bg': resolvedAppearance === 'dark'
                    ? 'rgba(4, 12, 20, 0.42)'
                    : 'rgba(212, 235, 250, 0.42)',
                '--lw-timeline-modal-bg': resolvedAppearance === 'dark'
                    ? 'rgba(24, 45, 65, 0.84)'
                    : 'rgba(255, 255, 255, 0.74)',
                '--lw-timeline-modal-border': resolvedAppearance === 'dark'
                    ? 'rgba(143, 192, 232, 0.22)'
                    : 'rgba(148, 190, 219, 0.38)',
                '--lw-timeline-modal-body-bg': resolvedAppearance === 'dark'
                    ? 'rgba(18, 34, 50, 0.72)'
                    : 'rgba(255, 255, 255, 0.62)',
                '--lw-timeline-mini-avatar-radius': '999px'
            }))
        },
        'lorebook.workspace': {
            ...base['lorebook.workspace'],
            cssVars: mergeCssVars(base['lorebook.workspace']?.cssVars, ({ resolvedAppearance }) => ({
                '--lw-lorebook-workspace-bg': resolvedAppearance === 'dark'
                    ? 'radial-gradient(circle at 50% 0%, rgba(255, 255, 255, 0.08), transparent 34%), rgba(15, 28, 42, 0.58)'
                    : 'radial-gradient(circle at 50% 0%, rgba(255, 255, 255, 0.72), transparent 34%), rgba(232, 245, 255, 0.58)',
                '--lw-lorebook-header-bg': resolvedAppearance === 'dark'
                    ? 'rgba(24, 45, 65, 0.74)'
                    : 'rgba(255, 255, 255, 0.62)',
                '--lw-lorebook-header-border': resolvedAppearance === 'dark'
                    ? 'rgba(143, 192, 232, 0.22)'
                    : 'rgba(148, 190, 219, 0.34)',
                '--lw-lorebook-panel-bg': resolvedAppearance === 'dark'
                    ? 'rgba(24, 45, 65, 0.74)'
                    : 'rgba(255, 255, 255, 0.72)',
                '--lw-lorebook-panel-border': resolvedAppearance === 'dark'
                    ? 'rgba(143, 192, 232, 0.22)'
                    : 'rgba(148, 190, 219, 0.30)',
                '--lw-lorebook-panel-hover-bg': resolvedAppearance === 'dark'
                    ? 'rgba(31, 56, 80, 0.82)'
                    : 'rgba(255, 255, 255, 0.88)',
                '--lw-lorebook-control-bg': resolvedAppearance === 'dark'
                    ? 'rgba(31, 56, 80, 0.72)'
                    : 'rgba(255, 255, 255, 0.70)',
                '--lw-lorebook-control-border': resolvedAppearance === 'dark'
                    ? 'rgba(143, 192, 232, 0.24)'
                    : 'rgba(148, 190, 219, 0.34)',
                '--lw-lorebook-item-bg': resolvedAppearance === 'dark'
                    ? 'rgba(24, 45, 65, 0.72)'
                    : 'rgba(255, 255, 255, 0.72)',
                '--lw-lorebook-item-border': resolvedAppearance === 'dark'
                    ? 'rgba(143, 192, 232, 0.20)'
                    : 'rgba(148, 190, 219, 0.30)',
                '--lw-lorebook-item-hover-bg': resolvedAppearance === 'dark'
                    ? 'rgba(31, 56, 80, 0.82)'
                    : 'rgba(255, 255, 255, 0.88)',
                '--lw-lorebook-overlay-bg': 'rgba(var(--lw-primary-rgb), 0.10)'
            }))
        },
        'lorebook.editor': {
            ...base['lorebook.editor'],
            cssVars: mergeCssVars(base['lorebook.editor']?.cssVars, ({ resolvedAppearance }) => ({
                '--lw-lorebook-editor-bg': resolvedAppearance === 'dark'
                    ? 'radial-gradient(circle at 50% 0%, rgba(255, 255, 255, 0.08), transparent 34%), rgba(15, 28, 42, 0.58)'
                    : 'radial-gradient(circle at 50% 0%, rgba(255, 255, 255, 0.72), transparent 34%), rgba(232, 245, 255, 0.58)',
                '--lw-lorebook-editor-header-bg': resolvedAppearance === 'dark'
                    ? 'rgba(24, 45, 65, 0.74)'
                    : 'rgba(255, 255, 255, 0.68)',
                '--lw-lorebook-editor-header-border': resolvedAppearance === 'dark'
                    ? 'rgba(143, 192, 232, 0.22)'
                    : 'rgba(148, 190, 219, 0.34)',
                '--lw-lorebook-editor-control-bg': resolvedAppearance === 'dark'
                    ? 'rgba(31, 56, 80, 0.72)'
                    : 'rgba(255, 255, 255, 0.76)',
                '--lw-lorebook-editor-control-border': resolvedAppearance === 'dark'
                    ? 'rgba(143, 192, 232, 0.24)'
                    : 'rgba(148, 190, 219, 0.36)',
                '--lw-lorebook-editor-section-bg': resolvedAppearance === 'dark'
                    ? 'rgba(24, 45, 65, 0.74)'
                    : 'rgba(255, 255, 255, 0.74)',
                '--lw-lorebook-editor-section-border': resolvedAppearance === 'dark'
                    ? 'rgba(143, 192, 232, 0.22)'
                    : 'rgba(148, 190, 219, 0.34)',
                '--lw-lorebook-editor-accent-bg': 'rgba(var(--lw-primary-rgb), 0.12)',
                '--lw-lorebook-editor-save-bg': 'var(--lw-primary)',
                '--lw-lorebook-editor-save-color': '#ffffff'
            }))
        },
        'stats.panel': {
            ...base['stats.panel'],
            cssVars: mergeCssVars(base['stats.panel']?.cssVars, ({ resolvedAppearance }) => ({
                '--lw-stats-panel-bg': resolvedAppearance === 'dark'
                    ? 'rgba(15, 28, 42, 0.58)'
                    : 'rgba(232, 245, 255, 0.58)',
                '--lw-stats-panel-highlight': resolvedAppearance === 'dark'
                    ? 'radial-gradient(circle at 50% 0%, rgba(255, 255, 255, 0.08), transparent 34%)'
                    : 'radial-gradient(circle at 50% 0%, rgba(255, 255, 255, 0.72), transparent 34%)',
                '--lw-stats-shell-bg': resolvedAppearance === 'dark'
                    ? 'rgba(24, 45, 65, 0.78)'
                    : 'rgba(255, 255, 255, 0.74)',
                '--lw-stats-shell-border': resolvedAppearance === 'dark'
                    ? 'rgba(143, 192, 232, 0.22)'
                    : 'rgba(148, 190, 219, 0.42)',
                '--lw-stats-shell-shadow': 'var(--lw-telegram-panel-shadow, 0 18px 42px rgba(44, 92, 130, 0.12))',
                '--lw-stats-card-bg': resolvedAppearance === 'dark'
                    ? 'rgba(31, 56, 80, 0.74)'
                    : 'rgba(255, 255, 255, 0.76)',
                '--lw-stats-card-border': resolvedAppearance === 'dark'
                    ? 'rgba(143, 192, 232, 0.20)'
                    : 'rgba(148, 190, 219, 0.34)',
                '--lw-stats-badge-bg': resolvedAppearance === 'dark'
                    ? 'rgba(32, 78, 114, 0.62)'
                    : 'rgba(227, 244, 255, 0.76)',
                '--lw-stats-badge-border': resolvedAppearance === 'dark'
                    ? 'rgba(118, 184, 230, 0.28)'
                    : 'rgba(118, 184, 230, 0.36)',
                '--lw-stats-metric-fill-bg': 'linear-gradient(90deg, #35a8eb, #77cdf6)',
                '--lw-stats-tag-bg': resolvedAppearance === 'dark'
                    ? 'rgba(31, 56, 80, 0.72)'
                    : 'rgba(255, 255, 255, 0.72)',
                '--lw-stats-tag-border': resolvedAppearance === 'dark'
                    ? 'rgba(143, 192, 232, 0.20)'
                    : 'rgba(148, 190, 219, 0.32)',
                '--lw-stats-helper-bg': resolvedAppearance === 'dark'
                    ? 'rgba(24, 45, 65, 0.58)'
                    : 'rgba(255, 255, 255, 0.58)',
                '--lw-stats-helper-border': resolvedAppearance === 'dark'
                    ? 'rgba(143, 192, 232, 0.20)'
                    : 'rgba(148, 190, 219, 0.30)'
            }))
        },
        'director.panel': {
            ...base['director.panel'],
            cssVars: mergeCssVars(base['director.panel']?.cssVars, ({ resolvedAppearance }) => ({
                '--lw-director-panel-bg': resolvedAppearance === 'dark'
                    ? 'rgba(15, 28, 42, 0.58)'
                    : 'rgba(232, 245, 255, 0.58)',
                '--lw-director-panel-highlight': resolvedAppearance === 'dark'
                    ? 'radial-gradient(circle at 50% 0%, rgba(255, 255, 255, 0.08), transparent 34%)'
                    : 'radial-gradient(circle at 50% 0%, rgba(255, 255, 255, 0.72), transparent 34%)',
                '--lw-director-header-bg': resolvedAppearance === 'dark'
                    ? 'rgba(24, 45, 65, 0.74)'
                    : 'rgba(255, 255, 255, 0.62)',
                '--lw-director-header-border': resolvedAppearance === 'dark'
                    ? 'rgba(143, 192, 232, 0.22)'
                    : 'rgba(148, 190, 219, 0.34)',
                '--lw-director-section-bg': resolvedAppearance === 'dark'
                    ? 'rgba(24, 45, 65, 0.78)'
                    : 'rgba(255, 255, 255, 0.74)',
                '--lw-director-section-border': resolvedAppearance === 'dark'
                    ? 'rgba(143, 192, 232, 0.22)'
                    : 'rgba(148, 190, 219, 0.38)',
                '--lw-director-section-shadow': 'var(--lw-telegram-panel-shadow, 0 18px 42px rgba(44, 92, 130, 0.1))',
                '--lw-director-control-bg': resolvedAppearance === 'dark'
                    ? 'rgba(31, 56, 80, 0.72)'
                    : 'rgba(255, 255, 255, 0.70)',
                '--lw-director-control-border': resolvedAppearance === 'dark'
                    ? 'rgba(143, 192, 232, 0.20)'
                    : 'rgba(148, 190, 219, 0.32)',
                '--lw-director-control-header-bg': resolvedAppearance === 'dark'
                    ? 'rgba(32, 78, 114, 0.46)'
                    : 'rgba(227, 244, 255, 0.50)',
                '--lw-director-input-bg': resolvedAppearance === 'dark'
                    ? 'rgba(24, 45, 65, 0.74)'
                    : 'rgba(255, 255, 255, 0.72)',
                '--lw-director-input-border': resolvedAppearance === 'dark'
                    ? 'rgba(143, 192, 232, 0.22)'
                    : 'rgba(148, 190, 219, 0.36)',
                '--lw-director-table-border': resolvedAppearance === 'dark'
                    ? 'rgba(143, 192, 232, 0.18)'
                    : 'rgba(148, 190, 219, 0.22)'
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
        id: 'telegram',
        name: 'Telegram 桌面',
        description: '以聊天为中心的 Liquid Glass 桌面模式，支持浅色/深色、角色列表、会话资料页与移动端四项底栏。',
        preferredAppearance: 'follow-setting',
        shell: {
            kind: 'traditional'
        },
        navigationPreset: {
            traditional: {
                headerVariant: 'telegram',
                leftRail: 'character-rail',
                widgetVariant: 'telegram',
                headerDesktopPosition: 'top',
                headerMobilePosition: 'bottom',
            },
        },
        surfacePreset: {
            mainSurfaceVariant: 'telegram',
            widgetSurfaceVariant: 'telegram',
            chatVariant: 'telegram',
            settingsVariant: 'telegram',
            timelineVariant: 'telegram',
        },
        designTokens: resolveTelegramDesignTokens,
        surfaceSkins: createTelegramSurfaceSkinMap(),
        rendererVariants: {
            'telegram.frame': 'telegram',
            'telegram.chatList': 'telegram',
            'telegram.conversation': 'telegram',
            'telegram.infoPanel': 'telegram',
            'telegram.composer': 'telegram',
            'shell.header': 'telegram',
            'shell.widget': 'telegram',
            'shell.mainSurface': 'telegram',
            'shell.characterRail': 'telegram',
            'shell.characterCard': 'telegram',
            'chat.stream': 'telegram',
            'chat.preview': 'telegram',
            'settings.root': 'telegram',
            'settings.unified': 'telegram',
            'settings.detailed': 'telegram',
            'settings.control': 'telegram',
            'timeline.root': 'telegram',
            'lorebook.workspace': 'telegram',
            'lorebook.editor': 'telegram',
            'stats.panel': 'telegram',
            'director.panel': 'telegram'
        },
        settingsManifest: telegramThemeSettings
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
            'shell.header': 'discord',
            'shell.widget': 'discord',
            'shell.mobileDiscord': 'discord',
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
