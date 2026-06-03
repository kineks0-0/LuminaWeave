import { getDesktopModeSettingValue } from '../../core/registry.js';
import type { ComponentThemeContext, DesktopModeManifest } from '../../core/types.js';
import { createSurfaceSkinMap, mergeCssVars, resolveThemeValueMap } from '../shared.js';

export const createTelegramSurfaceSkinMap = (): DesktopModeManifest['surfaceSkins'] => {
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
                const isFloating = getDesktopModeSettingValue(
                    context.activeSettings,
                    context.desktopModeId,
                    'panelChromeStyle',
                    'floating-rounded'
                ) !== 'edge-to-edge';
                const hasTopBlankSpace = getDesktopModeSettingValue(
                    context.activeSettings,
                    context.desktopModeId,
                    'topBlankSpace',
                    true
                ) !== false;

                return {
                '--lw-telegram-frame-bg': context.resolvedAppearance === 'dark'
                        ? 'var(--lw-telegram-diffuse-bg), rgba(16, 24, 32, 0.82)'
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
                    ? 'rgba(16, 24, 32, 0.82)'
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
                    ? 'rgba(16, 24, 32, 0.74)'
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
                    ? 'rgba(27, 39, 52, 0.84)'
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
                const density = getDesktopModeSettingValue(context.activeSettings, context.desktopModeId, 'messageDensity');
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
                    '--lw-chat-font-size': `${Number(getDesktopModeSettingValue(context.activeSettings, context.desktopModeId, 'chatFontSize', 12))}px`,
                    '--lw-chat-line-height': Number(getDesktopModeSettingValue(context.activeSettings, context.desktopModeId, 'chatLineHeight', 1.45)),
                    '--lw-chat-paragraph-spacing': `${Number(getDesktopModeSettingValue(context.activeSettings, context.desktopModeId, 'chatParagraphSpacing', 12))}px`,
                    '--lw-chat-page-width': String(getDesktopModeSettingValue(context.activeSettings, context.desktopModeId, 'chatPageWidth', 900))
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
