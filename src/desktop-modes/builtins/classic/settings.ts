import type { SettingDefinition } from '../../../types/plugin.js';
import { createChatTypographySettings, createRoleMessageSettings } from '../shared.js';

export const classicDesktopModeSettings: Record<string, SettingDefinition> = {
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
