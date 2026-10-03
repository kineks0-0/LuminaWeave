import type { SettingDefinition } from '../../../types/plugin.js';
import { createChatTypographySettings, createRoleMessageSettings } from '../shared.js';

export const discordDesktopModeSettings: Record<string, SettingDefinition> = {
    messageDensity: {
        default: 'compact',
        label: '消息密度',
        description: '控制聊天消息之间的垂直间距与整体紧凑度。',
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
        fontWeight: 400,
        fontSize: 16,
        pageWidth: 'auto',
        lineHeight: 1.6,
        paragraphSpacing: 10,
        letterSpacing: 0
    }),
    avatarShape: {
        default: 'rounded',
        label: '头像形状',
        description: '控制角色卡和聊天头像的圆角风格。',
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
        type: 'boolean' as const,
        allowedScopes: ['Global']
    },
    sidebarCardDensity: {
        default: 'cozy',
        label: '角色卡密度',
        description: '用于 Discord 风格角色卡侧栏的留白密度。',
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
        type: 'stepper' as const,
        min: 1,
        max: 4,
        allowedScopes: ['Global']
    },
    'discord-channel-mark': {
        default: true,
        label: '显示侧栏与角色列表',
        description: '控制 Discord 桌面模式左侧的服务器栏与角色列表是否显示；也可点击顶栏的 # 切换。',
        type: 'boolean' as const,
        allowedScopes: ['Global']
    },
    mobileGuildRailPosition: {
        default: 'top',
        label: '移动端 Guild Rail 位置',
        description: '控制 Discord 移动端主导航条固定在哪个边缘。',
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
