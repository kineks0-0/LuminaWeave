import type { SettingDefinition } from '../../../types/plugin.js';
import { createChatTypographySettings, createRoleMessageSettings } from '../shared.js';

export const telegramDesktopModeSettings: Record<string, SettingDefinition> = {
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
