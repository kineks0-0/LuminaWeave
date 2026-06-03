import { getDesktopModeSettingValue } from '../../core/registry.js';
import type { ComponentThemeContext, ThemeValueMap } from '../../core/types.js';

export const resolveTelegramDesignTokens = ({ activeSettings, resolvedAppearance, desktopModeId }: ComponentThemeContext): ThemeValueMap => {
    const isDark = resolvedAppearance === 'dark';
    const glassIntensity = getDesktopModeSettingValue(activeSettings, desktopModeId, 'glassIntensity', 'medium');
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
            '--lw-bg-app': '#101820',
            '--lw-bg-surface': '#17212c',
            '--lw-bg-elevated': '#202b38',
            '--lw-bg-subtle': '#172330',
            '--lw-bg-hover': 'rgba(115, 177, 255, 0.12)',
            '--lw-bg-active': 'rgba(115, 177, 255, 0.18)',
            '--lw-text-main': '#eaf5ff',
            '--lw-text-secondary': '#a9c4dc',
            '--lw-text-muted': '#7897b2',
            '--lw-border-base': 'rgba(143, 192, 232, 0.18)',
            '--lw-border-strong': 'rgba(176, 216, 255, 0.26)',
            '--lw-border-active': 'rgba(98, 178, 255, 0.44)',
            '--lw-surface-container-lowest': 'rgba(18, 28, 39, 0.78)',
            '--lw-surface-container-low': 'rgba(27, 39, 52, 0.76)',
            '--lw-surface-container': 'rgba(34, 50, 66, 0.78)',
            '--lw-surface-container-high': 'rgba(43, 61, 78, 0.82)',
            '--lw-surface-container-highest': 'rgba(53, 73, 94, 0.88)',
            '--lw-theme-accent-soft': 'rgba(74, 163, 255, 0.18)',
            '--lw-telegram-diffuse-bg': 'radial-gradient(ellipse 112% 62% at 48% 38%, rgba(107, 171, 255, 0.58) 0%, rgba(107, 171, 255, 0.26) 42%, transparent 78%), radial-gradient(ellipse 52% 30% at 25% 26%, rgba(255, 255, 255, 0.20) 0%, transparent 68%), radial-gradient(ellipse 18% 22% at 56% 24%, rgba(255, 255, 255, 0.26) 0%, transparent 70%)',
            '--lw-telegram-glass-blur': glassBlur,
            '--lw-telegram-glass-bg': 'rgba(34, 50, 66, 0.58)',
            '--lw-telegram-glass-bg-strong': 'rgba(38, 56, 73, 0.72)',
            '--lw-telegram-hairline': 'rgba(143, 192, 232, 0.16)',
            '--lw-telegram-tab-bg': 'rgba(45, 63, 82, 0.48)',
            '--lw-telegram-tab-rim': 'rgba(132, 164, 194, 0.16)',
            '--lw-telegram-tab-top-light': 'transparent',
            '--lw-telegram-tab-bottom-shade': 'transparent',
            '--lw-telegram-glass-highlight': 'rgba(255, 255, 255, 0.12)',
            '--lw-telegram-glass-shade': 'rgba(0, 7, 14, 0.24)',
            '--lw-telegram-active-pill': 'rgba(74, 163, 255, 0.16)',
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
            '--lw-telegram-glass-bg': 'rgba(240, 249, 255, 0.58)',
            '--lw-telegram-glass-bg-strong': 'rgba(247, 252, 255, 0.76)',
            '--lw-telegram-hairline': 'rgba(84, 136, 178, 0.16)',
            '--lw-telegram-tab-bg': 'rgba(231, 243, 252, 0.58)',
            '--lw-telegram-tab-rim': 'rgba(84, 136, 178, 0.16)',
            '--lw-telegram-tab-top-light': 'transparent',
            '--lw-telegram-tab-bottom-shade': 'transparent',
            '--lw-telegram-glass-highlight': 'rgba(255, 255, 255, 0.76)',
            '--lw-telegram-glass-shade': 'rgba(69, 126, 164, 0.12)',
            '--lw-telegram-active-pill': 'rgba(46, 159, 232, 0.16)',
            '--lw-telegram-panel-shadow': panelShadow,
            '--lw-telegram-user-bubble': 'linear-gradient(135deg, #dff7d6, #c9f0bf)',
            '--lw-telegram-ai-bubble': 'rgba(255, 255, 255, 0.92)'
        };
};
