import { shallowReactive } from 'vue';
import type { ThemeableComponentContract } from './types';

class ThemeComponentRegistry {
    public readonly contracts = shallowReactive<Record<string, ThemeableComponentContract>>(
        {} as Record<string, ThemeableComponentContract>
    );

    register(contract: ThemeableComponentContract) {
        this.contracts[contract.componentId] = contract;
    }

    get(componentId: string) {
        return this.contracts[componentId];
    }

    list() {
        return Object.values(this.contracts);
    }
}

export const themeComponentRegistry = new ThemeComponentRegistry();

[
    {
        componentId: 'shell.app',
        exposedCssVars: ['--lw-shell-panel-bg', '--lw-shell-panel-overlay'],
        supportedVariants: ['default', 'discord', 'telegram']
    },
    {
        componentId: 'shell.panelBody',
        exposedCssVars: ['--lw-shell-body-bg', '--lw-shell-freeform-gap'],
        supportedVariants: ['default', 'discord', 'telegram']
    },
    {
        componentId: 'shell.header',
        exposedCssVars: [
            '--lw-header-bg',
            '--lw-header-border',
            '--lw-header-shadow',
            '--lw-header-bottom-shadow',
            '--lw-header-control-bg',
            '--lw-header-control-border',
            '--lw-header-control-shadow',
            '--lw-header-control-hover-bg',
            '--lw-header-avatar-shadow',
            '--lw-header-tab-bg',
            '--lw-header-tab-hover-bg',
            '--lw-header-tab-active-bg',
            '--lw-header-channel-mark-bg',
            '--lw-header-channel-mark-color',
            '--lw-header-channel-mark-active-bg',
            '--lw-header-channel-mark-active-color',
            '--lw-header-channel-mark-active-border'
        ],
        supportedVariants: ['default', 'discord', 'telegram']
    },
    {
        componentId: 'shell.mainSurface',
        exposedCssVars: [
            '--lw-shell-main-bg',
            '--lw-shell-main-mobile-bg',
            '--lw-shell-main-border',
            '--lw-shell-main-radius'
        ],
        supportedVariants: ['default', 'discord', 'telegram']
    },
    {
        componentId: 'shell.widget',
        exposedCssVars: [
            '--lw-shell-widget-bg',
            '--lw-shell-widget-border',
            '--lw-shell-widget-divider-border',
            '--lw-shell-widget-header-bg',
            '--lw-shell-widget-pane-bg',
            '--lw-shell-widget-dropdown-bg',
            '--lw-shell-widget-dropdown-border',
            '--lw-shell-widget-content-overlay'
        ],
        supportedVariants: ['default', 'discord', 'telegram']
    },
    {
        componentId: 'shell.workspaceStage',
        exposedCssVars: ['--lw-shell-stage-bg', '--lw-shell-stage-border', '--lw-shell-stage-radius'],
        supportedVariants: ['default', 'stage', 'discord', 'telegram']
    },
    {
        componentId: 'shell.workspaceMenu',
        exposedCssVars: ['--lw-shell-workspace-menu-bg', '--lw-shell-workspace-menu-border'],
        supportedVariants: ['default', 'discord', 'telegram']
    },
    {
        componentId: 'shell.characterRail',
        exposedCssVars: ['--lw-character-rail-bg', '--lw-character-rail-border', '--lw-character-rail-width'],
        supportedVariants: ['default', 'discord', 'telegram']
    },
    {
        componentId: 'shell.guildRail',
        exposedCssVars: [
            '--lw-guild-rail-bg',
            '--lw-guild-rail-border',
            '--lw-guild-rail-width',
            '--lw-guild-rail-item-bg',
            '--lw-guild-rail-item-active-bg'
        ],
        supportedVariants: ['default', 'discord', 'telegram']
    },
    {
        componentId: 'shell.characterCard',
        exposedCssVars: [
            '--lw-character-card-bg',
            '--lw-character-card-border',
            '--lw-character-card-avatar-radius',
            '--lw-character-card-avatar-shadow',
            '--lw-character-card-menu-shadow',
            '--lw-character-rail-logo-bg',
            '--lw-character-rail-mobile-shadow'
        ],
        supportedVariants: ['default', 'discord', 'telegram']
    },
    {
        componentId: 'shell.mobileDiscord',
        exposedCssVars: [
            '--lw-discord-mobile-shell-bg',
            '--lw-discord-mobile-shell-border',
            '--lw-discord-mobile-shell-shadow',
            '--lw-discord-mobile-toggle-bg',
            '--lw-discord-mobile-toggle-border',
            '--lw-discord-mobile-toggle-shadow',
            '--lw-discord-mobile-toggle-active-bg',
            '--lw-discord-mobile-toggle-active-border',
            '--lw-discord-mobile-toggle-mark-bg',
            '--lw-discord-mobile-toggle-mark-color',
            '--lw-discord-mobile-sheet-bg',
            '--lw-discord-mobile-sheet-backdrop'
        ],
        supportedVariants: ['discord']
    },
    {
        componentId: 'telegram.frame',
        exposedCssVars: [
            '--lw-telegram-frame-bg',
            '--lw-telegram-frame-border',
            '--lw-telegram-frame-radius',
            '--lw-telegram-frame-shadow',
            '--lw-telegram-diffuse-bg',
            '--lw-telegram-mobile-sheet-bg',
            '--lw-telegram-mobile-sheet-backdrop'
        ],
        supportedVariants: ['telegram']
    },
    {
        componentId: 'telegram.chatList',
        exposedCssVars: [
            '--lw-telegram-chat-list-bg',
            '--lw-telegram-chat-list-width',
            '--lw-telegram-chat-list-compact-width'
        ],
        supportedVariants: ['telegram']
    },
    {
        componentId: 'telegram.conversation',
        exposedCssVars: [
            '--lw-telegram-conversation-bg',
            '--lw-chat-bubble',
            '--lw-chat-user-bubble',
            '--lw-chat-message-max-width'
        ],
        supportedVariants: ['telegram']
    },
    {
        componentId: 'telegram.infoPanel',
        exposedCssVars: [
            '--lw-telegram-info-panel-bg',
            '--lw-telegram-info-panel-border',
            '--lw-telegram-avatar-radius'
        ],
        supportedVariants: ['telegram']
    },
    {
        componentId: 'telegram.composer',
        exposedCssVars: [
            '--lw-chat-input-surface',
            '--lw-chat-input-border',
            '--lw-chat-input-radius'
        ],
        supportedVariants: ['telegram']
    },
    {
        componentId: 'chat.stream',
        exposedCssVars: [
            '--lw-chat-stream-bg',
            '--lw-chat-scroll-bg',
            '--lw-chat-avatar-shadow',
            '--lw-chat-bubble',
            '--lw-chat-user-bubble',
            '--lw-chat-user-bubble-border',
            '--lw-chat-message-hover-bg',
            '--lw-chat-input-toolbar-bg',
            '--lw-chat-input-toolbar-shadow',
            '--lw-chat-input-shadow',
            '--lw-chat-menu-shadow',
            '--lw-chat-empty-mark-bg',
            '--lw-chat-empty-mark-shadow',
            '--lw-chat-input-focus-border',
            '--lw-chat-input-focus-shadow'
        ],
        supportedVariants: ['default', 'discord', 'telegram']
    },
    {
        componentId: 'chat.preview',
        exposedCssVars: ['--lw-chat-preview-bg', '--lw-chat-preview-bubble-bg'],
        supportedVariants: ['default', 'discord', 'telegram']
    },
    {
        componentId: 'settings.root',
        exposedCssVars: [
            '--lw-settings-shell-bg',
            '--lw-settings-shell-overlay',
            '--lw-settings-sidebar-bg',
            '--lw-settings-sidebar-border',
            '--lw-settings-header-bg',
            '--lw-settings-header-border',
            '--lw-settings-nav-item-color',
            '--lw-settings-nav-hover-bg',
            '--lw-settings-nav-hover-color',
            '--lw-settings-nav-active-bg',
            '--lw-settings-nav-active-color',
            '--lw-settings-nav-active-shadow',
            '--lw-settings-muted-color',
            '--lw-settings-breadcrumb-hover-color'
        ],
        supportedVariants: ['default', 'discord-panel', 'telegram']
    },
    {
        componentId: 'settings.unified',
        exposedCssVars: [
            '--lw-settings-grid-gap',
            '--lw-settings-block-bg',
            '--lw-settings-block-border',
            '--lw-settings-block-shadow',
            '--lw-settings-inner-card-bg',
            '--lw-settings-inner-card-border'
        ],
        supportedVariants: ['default', 'discord', 'telegram']
    },
    {
        componentId: 'settings.detailed',
        exposedCssVars: [
            '--lw-settings-detail-bg',
            '--lw-settings-detail-border',
            '--lw-settings-detail-shadow',
            '--lw-settings-detail-radius'
        ],
        supportedVariants: ['default', 'discord', 'telegram']
    },
    {
        componentId: 'settings.control',
        exposedCssVars: [
            '--lw-setting-control-bg',
            '--lw-setting-control-border',
            '--lw-setting-control-active-bg',
            '--lw-setting-control-active-shadow'
        ],
        supportedVariants: ['default', 'discord', 'telegram']
    },
    {
        componentId: 'timeline.root',
        exposedCssVars: [
            '--lw-timeline-canvas-bg',
            '--lw-timeline-header-bg',
            '--lw-timeline-header-border',
            '--lw-timeline-card-bg',
            '--lw-timeline-card-border',
            '--lw-timeline-card-shadow',
            '--lw-timeline-card-active-bg',
            '--lw-timeline-card-active-border',
            '--lw-timeline-chip-bg',
            '--lw-timeline-chip-border',
            '--lw-timeline-chip-active-bg',
            '--lw-timeline-chip-active-border',
            '--lw-timeline-modal-overlay-bg',
            '--lw-timeline-modal-bg',
            '--lw-timeline-modal-border',
            '--lw-timeline-modal-body-bg'
        ],
        supportedVariants: ['default', 'discord', 'telegram']
    },
    {
        componentId: 'lorebook.workspace',
        exposedCssVars: [
            '--lw-lorebook-workspace-bg',
            '--lw-lorebook-header-bg',
            '--lw-lorebook-header-border',
            '--lw-lorebook-panel-bg',
            '--lw-lorebook-panel-border',
            '--lw-lorebook-panel-hover-bg',
            '--lw-lorebook-control-bg',
            '--lw-lorebook-control-border',
            '--lw-lorebook-item-bg',
            '--lw-lorebook-item-border',
            '--lw-lorebook-item-hover-bg',
            '--lw-lorebook-overlay-bg'
        ],
        supportedVariants: ['default', 'discord', 'telegram']
    },
    {
        componentId: 'lorebook.editor',
        exposedCssVars: [
            '--lw-lorebook-editor-bg',
            '--lw-lorebook-editor-header-bg',
            '--lw-lorebook-editor-header-border',
            '--lw-lorebook-editor-control-bg',
            '--lw-lorebook-editor-control-border',
            '--lw-lorebook-editor-section-bg',
            '--lw-lorebook-editor-section-border',
            '--lw-lorebook-editor-accent-bg'
        ],
        supportedVariants: ['default', 'discord', 'telegram']
    },
    {
        componentId: 'stats.panel',
        exposedCssVars: [
            '--lw-stats-panel-bg',
            '--lw-stats-panel-highlight',
            '--lw-stats-shell-bg',
            '--lw-stats-shell-border',
            '--lw-stats-shell-shadow',
            '--lw-stats-card-bg',
            '--lw-stats-badge-bg',
            '--lw-stats-badge-border'
        ],
        supportedVariants: ['default', 'telegram']
    },
    {
        componentId: 'director.panel',
        exposedCssVars: [
            '--lw-director-panel-bg',
            '--lw-director-panel-highlight',
            '--lw-director-header-bg',
            '--lw-director-header-border',
            '--lw-director-section-bg',
            '--lw-director-section-border',
            '--lw-director-section-shadow',
            '--lw-director-control-bg',
            '--lw-director-control-border',
            '--lw-director-control-header-bg',
            '--lw-director-input-bg',
            '--lw-director-input-border',
            '--lw-director-table-border'
        ],
        supportedVariants: ['default', 'telegram']
    }
].forEach(contract => themeComponentRegistry.register(contract));

export const getThemeableComponentContract = (componentId: string) => themeComponentRegistry.get(componentId);
