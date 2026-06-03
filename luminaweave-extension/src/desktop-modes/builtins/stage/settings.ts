import type { SettingDefinition } from '../../../types/plugin.js';
import { classicDesktopModeSettings } from '../classic/settings.js';
import { createChatTypographySettings, createRoleMessageSettings } from '../shared.js';

export const stageDesktopModeSettings: Record<string, SettingDefinition> = {
    messageDensity: classicDesktopModeSettings.messageDensity,
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
        ...classicDesktopModeSettings.avatarShape,
        default: 'rounded'
    },
    bubbleStyle: {
        ...classicDesktopModeSettings.bubbleStyle,
        default: 'soft'
    },
    showUsernames: classicDesktopModeSettings.showUsernames
};
