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
        supportedVariants: ['default', 'discord']
    },
    {
        componentId: 'shell.panelBody',
        exposedCssVars: ['--lw-shell-body-bg', '--lw-shell-freeform-gap'],
        supportedVariants: ['default', 'discord']
    },
    {
        componentId: 'shell.mainSurface',
        exposedCssVars: ['--lw-shell-main-bg', '--lw-shell-main-border', '--lw-shell-main-radius'],
        supportedVariants: ['default', 'discord']
    },
    {
        componentId: 'shell.widget',
        exposedCssVars: ['--lw-shell-widget-bg', '--lw-shell-widget-border', '--lw-shell-widget-header-bg'],
        supportedVariants: ['default', 'discord']
    },
    {
        componentId: 'shell.workspaceStage',
        exposedCssVars: ['--lw-shell-stage-bg', '--lw-shell-stage-border', '--lw-shell-stage-radius'],
        supportedVariants: ['default', 'stage', 'discord']
    },
    {
        componentId: 'shell.workspaceMenu',
        exposedCssVars: ['--lw-shell-workspace-menu-bg', '--lw-shell-workspace-menu-border'],
        supportedVariants: ['default', 'discord']
    },
    {
        componentId: 'shell.characterRail',
        exposedCssVars: ['--lw-character-rail-bg', '--lw-character-rail-border', '--lw-character-rail-width'],
        supportedVariants: ['default', 'discord']
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
        supportedVariants: ['default', 'discord']
    },
    {
        componentId: 'shell.characterCard',
        exposedCssVars: ['--lw-character-card-bg', '--lw-character-card-border', '--lw-character-card-avatar-radius'],
        supportedVariants: ['default', 'discord']
    },
    {
        componentId: 'chat.stream',
        exposedCssVars: ['--lw-chat-stream-bg', '--lw-chat-bubble', '--lw-chat-user-bubble'],
        supportedVariants: ['default', 'discord']
    },
    {
        componentId: 'chat.preview',
        exposedCssVars: ['--lw-chat-preview-bg', '--lw-chat-preview-bubble-bg'],
        supportedVariants: ['default', 'discord']
    },
    {
        componentId: 'settings.root',
        exposedCssVars: ['--lw-settings-shell-bg', '--lw-settings-sidebar-bg'],
        supportedVariants: ['default', 'discord-panel']
    },
    {
        componentId: 'settings.unified',
        exposedCssVars: ['--lw-settings-grid-gap', '--lw-settings-block-bg'],
        supportedVariants: ['default', 'discord']
    },
    {
        componentId: 'settings.detailed',
        exposedCssVars: ['--lw-settings-detail-bg', '--lw-settings-detail-radius'],
        supportedVariants: ['default', 'discord']
    },
    {
        componentId: 'settings.control',
        exposedCssVars: ['--lw-setting-control-bg', '--lw-setting-control-border'],
        supportedVariants: ['default', 'discord']
    },
    {
        componentId: 'timeline.root',
        exposedCssVars: ['--lw-timeline-header-bg', '--lw-timeline-card-bg'],
        supportedVariants: ['default', 'discord']
    },
    {
        componentId: 'lorebook.workspace',
        exposedCssVars: [
            '--lw-lorebook-workspace-bg',
            '--lw-lorebook-header-bg',
            '--lw-lorebook-panel-bg',
            '--lw-lorebook-overlay-bg'
        ],
        supportedVariants: ['default', 'discord']
    },
    {
        componentId: 'lorebook.editor',
        exposedCssVars: [
            '--lw-lorebook-editor-bg',
            '--lw-lorebook-editor-header-bg',
            '--lw-lorebook-editor-control-bg',
            '--lw-lorebook-editor-accent-bg'
        ],
        supportedVariants: ['default', 'discord']
    }
].forEach(contract => themeComponentRegistry.register(contract));

export const getThemeableComponentContract = (componentId: string) => themeComponentRegistry.get(componentId);
