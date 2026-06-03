import { getDesktopModeSettingValue } from '../../core/registry.js';
import type { ComponentThemeContext, DesktopModeManifest } from '../../core/types.js';
import { createSurfaceSkinMap, mergeCssVars, resolveThemeValueMap } from '../shared.js';

export const createDiscordSurfaceSkinMap = (): DesktopModeManifest['surfaceSkins'] => {
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
