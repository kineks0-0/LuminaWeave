import { describe, expect, it } from 'vitest';
import {
    ACTIVE_DESKTOP_MODE_STORAGE_KEY,
    LEGACY_ACTIVE_THEME_PACK_STORAGE_KEY,
    getActiveDesktopModeIdFromSettings,
    getCanonicalSettingsStorageKey,
    getDesktopModeOptions,
    getDesktopModeOrDefault,
    getDesktopModeShell,
    getLegacySettingsStorageKey,
    listDesktopModes,
    registerDesktopMode,
    resolveComponentSkin,
    resolveThemeValues,
} from '../themeRegistry.js';
import { getThemeableComponentContract } from '../themeComponentRegistry.js';
import type { DesktopModeManifest } from '../types.js';

describe('themeRegistry desktop mode model', () => {
    it('resolves built-in desktop modes by shell kind', () => {
        expect(getDesktopModeShell('classic').kind).toBe('traditional');
        expect(getDesktopModeShell('stage').kind).toBe('freeform');
        expect(getDesktopModeShell('telegram').kind).toBe('traditional');
        expect(getDesktopModeShell('discord').kind).toBe('traditional');
    });

    it('prefers activeDesktopMode and falls back to legacy activeThemePack', () => {
        expect(getActiveDesktopModeIdFromSettings({
            [ACTIVE_DESKTOP_MODE_STORAGE_KEY]: 'stage',
            [LEGACY_ACTIVE_THEME_PACK_STORAGE_KEY]: 'discord'
        })).toBe('stage');

        expect(getActiveDesktopModeIdFromSettings({
            [LEGACY_ACTIVE_THEME_PACK_STORAGE_KEY]: 'discord'
        })).toBe('discord');
    });

    it('maps desktop mode setting keys to legacy theme-pack keys', () => {
        expect(getLegacySettingsStorageKey(ACTIVE_DESKTOP_MODE_STORAGE_KEY)).toBe(LEGACY_ACTIVE_THEME_PACK_STORAGE_KEY);
        expect(getLegacySettingsStorageKey('desktop-mode-discord.messageDensity')).toBe('theme-pack-discord.messageDensity');
        expect(getCanonicalSettingsStorageKey('theme-pack-discord.messageDensity')).toBe('desktop-mode-discord.messageDensity');
    });

    it('rejects duplicate desktop mode ids', () => {
        expect(() => registerDesktopMode(getDesktopModeOrDefault('classic'))).toThrow(/Duplicate desktop mode id: classic/);
    });

    it('resolves discord desktop mode tokens for both light and dark appearance', () => {
        const discordMode = getDesktopModeOrDefault('discord');
        expect(discordMode.preferredAppearance).toBe('follow-setting');

        const lightTokens = resolveThemeValues(discordMode.designTokens, {
            activeSettings: {},
            resolvedAppearance: 'light',
            themePackId: 'discord',
            desktopModeId: 'discord'
        });
        const darkTokens = resolveThemeValues(discordMode.designTokens, {
            activeSettings: {},
            resolvedAppearance: 'dark',
            themePackId: 'discord',
            desktopModeId: 'discord'
        });

        expect(lightTokens['--lw-bg-app']).not.toBe(darkTokens['--lw-bg-app']);
        expect(lightTokens['--lw-surface-container-lowest']).toBeDefined();
        expect(lightTokens['--lw-surface-container-highest']).toBeDefined();
        expect(darkTokens['--lw-surface-container-lowest']).toBeDefined();
        expect(darkTokens['--lw-surface-container-highest']).toBeDefined();
    });

    it('registers telegram desktop mode with theme settings and shell presets', () => {
        const telegramMode = getDesktopModeOrDefault('telegram');

        expect(listDesktopModes().some(mode => mode.id === 'telegram')).toBe(true);
        expect(getDesktopModeOptions().some(option => option.value === 'telegram')).toBe(true);
        expect(telegramMode.shell.kind).toBe('traditional');
        expect(telegramMode.navigationPreset?.traditional?.headerVariant).toBe('telegram');
        expect(telegramMode.navigationPreset?.traditional?.leftRail).toBe('character-rail');
        expect(telegramMode.surfacePreset?.chatVariant).toBe('telegram');
        expect(telegramMode.settingsManifest?.appearanceMode).toBeDefined();
        expect(telegramMode.settingsManifest?.panelChromeStyle?.default).toBe('floating-rounded');
        expect(telegramMode.settingsManifest?.topBlankSpace?.default).toBe(true);
        expect(telegramMode.settingsManifest?.rightInfoPanel).toBeDefined();
    });

    it('exposes per-role chat rendering settings through desktop mode manifests', () => {
        const classicMode = getDesktopModeOrDefault('classic');
        const stageMode = getDesktopModeOrDefault('stage');
        const discordMode = getDesktopModeOrDefault('discord');
        const telegramMode = getDesktopModeOrDefault('telegram');

        for (const mode of [classicMode, stageMode, discordMode, telegramMode]) {
            expect(mode.settingsManifest?.assistantMessageShape).toBeDefined();
            expect(mode.settingsManifest?.userMessageShape).toBeDefined();
            expect(mode.settingsManifest?.assistantAvatarPlacement).toBeDefined();
            expect(mode.settingsManifest?.userAvatarPlacement).toBeDefined();
            expect(mode.settingsManifest?.chatFontFamily).toBeDefined();
            expect(mode.settingsManifest?.chatFontWeight).toBeDefined();
            expect(mode.settingsManifest?.chatFontSize).toBeDefined();
            expect(mode.settingsManifest?.chatPageWidth).toBeDefined();
            expect(mode.settingsManifest?.chatLineHeight).toBeDefined();
            expect(mode.settingsManifest?.chatParagraphSpacing).toBeDefined();
            expect(mode.settingsManifest?.chatLetterSpacing).toBeDefined();
        }

        expect(discordMode.settingsManifest?.assistantMessageShape?.default).toBe('document');
        expect(discordMode.settingsManifest?.userMessageShape?.default).toBe('document');
        expect(discordMode.settingsManifest?.assistantAvatarPlacement?.default).toBe('inline');
        expect(telegramMode.settingsManifest?.assistantAvatarPlacement?.default).toBe('topbar');
        expect(telegramMode.settingsManifest?.userAvatarPlacement?.default).toBe('hidden');
        expect(classicMode.settingsManifest?.assistantMessageShape?.default).toBe('bubble');
        expect(stageMode.settingsManifest?.userMessageShape?.default).toBe('bubble');
    });

    it('resolves telegram desktop mode tokens for both light and dark appearance', () => {
        const telegramMode = getDesktopModeOrDefault('telegram');

        const lightTokens = resolveThemeValues(telegramMode.designTokens, {
            activeSettings: {},
            resolvedAppearance: 'light',
            themePackId: 'telegram',
            desktopModeId: 'telegram'
        });
        const darkTokens = resolveThemeValues(telegramMode.designTokens, {
            activeSettings: {},
            resolvedAppearance: 'dark',
            themePackId: 'telegram',
            desktopModeId: 'telegram'
        });

        expect(lightTokens['--lw-bg-app']).not.toBe(darkTokens['--lw-bg-app']);
        expect(lightTokens['--lw-telegram-user-bubble']).toBeDefined();
        expect(darkTokens['--lw-telegram-ai-bubble']).toBeDefined();
    });

    it('resolves telegram skins for chat settings and context surfaces', () => {
        const context = {
            activeSettings: {},
            resolvedAppearance: 'light' as const,
            themePackId: 'telegram',
            desktopModeId: 'telegram'
        };

        expect(resolveComponentSkin('telegram', 'chat.stream', context).variant).toBe('telegram');
        expect(resolveComponentSkin('telegram', 'telegram.frame', context).variant).toBe('telegram');
        expect(resolveComponentSkin('telegram', 'telegram.chatList', context).variant).toBe('telegram');
        expect(resolveComponentSkin('telegram', 'telegram.conversation', context).variant).toBe('telegram');
        expect(resolveComponentSkin('telegram', 'telegram.infoPanel', context).variant).toBe('telegram');
        expect(resolveComponentSkin('telegram', 'telegram.composer', context).variant).toBe('telegram');
        expect(resolveComponentSkin('telegram', 'shell.header', context).variant).toBe('telegram');
        expect(resolveComponentSkin('telegram', 'shell.widget', context).variant).toBe('telegram');
        expect(resolveComponentSkin('telegram', 'telegram.frame', context).cssVars['--lw-telegram-frame-bg']).toBeDefined();
        expect(resolveComponentSkin('telegram', 'telegram.frame', context).cssVars['--lw-telegram-frame-gap']).toBe('10px');
        expect(resolveComponentSkin('telegram', 'telegram.frame', context).cssVars['--lw-telegram-frame-padding-top']).toBe('28px');
        expect(resolveComponentSkin('telegram', 'telegram.frame', context).cssVars['--lw-telegram-mobile-sheet-bg']).toBeDefined();
        expect(resolveComponentSkin('telegram', 'shell.header', context).cssVars['--lw-header-bg']).toBeDefined();
        expect(resolveComponentSkin('telegram', 'shell.widget', context).cssVars['--lw-shell-widget-pane-bg']).toBeDefined();
        expect(resolveComponentSkin('telegram', 'telegram.frame', {
            ...context,
            activeSettings: {
                'desktop-mode-telegram.panelChromeStyle': 'edge-to-edge',
                'desktop-mode-telegram.topBlankSpace': false
            }
        }).cssVars['--lw-telegram-frame-gap']).toBe('0px');
        expect(resolveComponentSkin('telegram', 'settings.root', context).variant).toBe('telegram');
        expect(resolveComponentSkin('telegram', 'settings.control', context).variant).toBe('telegram');
        expect(resolveComponentSkin('telegram', 'timeline.root', context).variant).toBe('telegram');
        expect(resolveComponentSkin('telegram', 'lorebook.workspace', context).variant).toBe('telegram');
        expect(resolveComponentSkin('telegram', 'timeline.root', context).cssVars['--lw-timeline-card-active-bg']).toBeDefined();
        expect(resolveComponentSkin('telegram', 'lorebook.workspace', context).cssVars['--lw-lorebook-control-bg']).toBeDefined();
        expect(resolveComponentSkin('telegram', 'lorebook.editor', context).cssVars['--lw-lorebook-editor-section-bg']).toBeDefined();
        expect(resolveComponentSkin('telegram', 'stats.panel', context).cssVars['--lw-stats-badge-bg']).toBeDefined();
        expect(resolveComponentSkin('telegram', 'director.panel', context).cssVars['--lw-director-input-bg']).toBeDefined();
    });

    it('derives chat stream and preview css vars from desktop mode role settings', () => {
        const context = {
            activeSettings: {},
            resolvedAppearance: 'light' as const,
            themePackId: 'discord',
            desktopModeId: 'discord'
        };

        const discordStreamSkin = resolveComponentSkin('discord', 'chat.stream', context);
        const telegramPreviewSkin = resolveComponentSkin('telegram', 'chat.preview', {
            ...context,
            themePackId: 'telegram',
            desktopModeId: 'telegram'
        });

        expect(discordStreamSkin.cssVars['--lw-chat-assistant-shape']).toBe('document');
        expect(discordStreamSkin.cssVars['--lw-chat-user-shape']).toBe('document');
        expect(discordStreamSkin.cssVars['--lw-chat-assistant-avatar-placement']).toBe('inline');
        expect(discordStreamSkin.cssVars['--lw-chat-font']).toBeDefined();
        expect(discordStreamSkin.cssVars['--lw-chat-page-width']).toBeDefined();
        expect(telegramPreviewSkin.cssVars['--lw-chat-preview-assistant-avatar-placement']).toBe('topbar');
        expect(telegramPreviewSkin.cssVars['--lw-chat-preview-user-avatar-placement']).toBe('hidden');
        expect(telegramPreviewSkin.cssVars['--lw-chat-preview-font-size']).toBeDefined();
        expect(telegramPreviewSkin.cssVars['--lw-chat-preview-line-height']).toBeDefined();
    });

    it('resolves discord shell surface vars from desktop mode skins', () => {
        const context = {
            activeSettings: {},
            resolvedAppearance: 'dark' as const,
            themePackId: 'discord',
            desktopModeId: 'discord'
        };

        const headerSkin = resolveComponentSkin('discord', 'shell.header', context);
        const mainSurfaceSkin = resolveComponentSkin('discord', 'shell.mainSurface', context);
        const widgetSkin = resolveComponentSkin('discord', 'shell.widget', context);
        const chatSkin = resolveComponentSkin('discord', 'chat.stream', context);
        const settingsSkin = resolveComponentSkin('discord', 'settings.root', context);
        const mobileSkin = resolveComponentSkin('discord', 'shell.mobileDiscord', context);

        expect(headerSkin.variant).toBe('discord');
        expect(headerSkin.cssVars['--lw-header-bg']).toBeDefined();
        expect(headerSkin.cssVars['--lw-header-control-bg']).toBeDefined();
        expect(headerSkin.cssVars['--lw-header-channel-mark-bg']).toBeDefined();
        expect(headerSkin.cssVars['--lw-header-channel-mark-active-border']).toBeDefined();
        expect(mainSurfaceSkin.cssVars['--lw-shell-main-mobile-bg']).toBeDefined();
        expect(widgetSkin.variant).toBe('discord');
        expect(widgetSkin.cssVars['--lw-shell-widget-bg']).toBeDefined();
        expect(widgetSkin.cssVars['--lw-shell-widget-divider-border']).toBeDefined();
        expect(chatSkin.cssVars['--lw-chat-input-focus-border']).toBeDefined();
        expect(chatSkin.cssVars['--lw-chat-input-focus-shadow']).toBeDefined();
        expect(settingsSkin.variant).toBe('discord-panel');
        expect(settingsSkin.cssVars['--lw-settings-nav-hover-bg']).toBeDefined();
        expect(settingsSkin.cssVars['--lw-settings-breadcrumb-hover-color']).toBeDefined();
        expect(mobileSkin.variant).toBe('discord');
        expect(mobileSkin.cssVars['--lw-discord-mobile-toggle-bg']).toBeDefined();
        expect(mobileSkin.cssVars['--lw-discord-mobile-toggle-shadow']).toBeDefined();
        expect(mobileSkin.cssVars['--lw-discord-mobile-sheet-bg']).toBeDefined();
        expect(mobileSkin.cssVars['--lw-discord-mobile-sheet-backdrop']).toBeDefined();
    });

    it('exposes statusbar background through shell app skins', () => {
        expect(getThemeableComponentContract('shell.app')?.exposedCssVars).toContain('--lw-shell-statusbar-bg');

        for (const desktopModeId of ['classic', 'discord', 'telegram']) {
            const skin = resolveComponentSkin(desktopModeId, 'shell.app', {
                activeSettings: {},
                resolvedAppearance: 'light',
                themePackId: desktopModeId,
                desktopModeId
            });

            expect(skin.cssVars['--lw-shell-statusbar-bg']).toBeDefined();
        }
    });

    it('resolves lorebook workspace and editor skins for discord variant', () => {
        const context = {
            activeSettings: {},
            resolvedAppearance: 'light' as const,
            themePackId: 'discord',
            desktopModeId: 'discord'
        };

        const workspaceSkin = resolveComponentSkin('discord', 'lorebook.workspace', context);
        const editorSkin = resolveComponentSkin('discord', 'lorebook.editor', context);

        expect(workspaceSkin.variant).toBe('discord');
        expect(editorSkin.variant).toBe('discord');
        expect(workspaceSkin.cssVars['--lw-lorebook-panel-bg']).toBeDefined();
        expect(workspaceSkin.cssVars['--lw-lorebook-overlay-bg']).toBeDefined();
        expect(editorSkin.cssVars['--lw-lorebook-editor-bg']).toBeDefined();
        expect(editorSkin.cssVars['--lw-lorebook-editor-save-bg']).toBeDefined();
    });

    it('registers a custom desktop mode and exposes it through settings options', async () => {
        const customId = `spec-custom-desktop-${Math.random().toString(36).slice(2, 8)}`;
        const manifest: DesktopModeManifest = {
            id: customId,
            name: 'Spec Custom Desktop',
            description: '用于验证自定义桌面模式注册链路。',
            preferredAppearance: 'dark',
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
                }
            },
            surfacePreset: {
                mainSurfaceVariant: 'default',
                widgetSurfaceVariant: 'default',
                chatVariant: 'default',
                settingsVariant: 'default',
                timelineVariant: 'default',
            },
            settingsManifest: {
                accentDepth: {
                    default: 'medium',
                    label: '强调层级',
                    type: 'options',
                    allowedScopes: ['Global'],
                    options: [
                        { value: 'soft', label: '柔和' },
                        { value: 'medium', label: '中等' },
                        { value: 'high', label: '强烈' },
                    ]
                }
            }
        };

        registerDesktopMode(manifest);

        expect(listDesktopModes().some(mode => mode.id === customId)).toBe(true);
        expect(getDesktopModeShell(customId).kind).toBe('freeform');
        expect(getDesktopModeOptions().some(option => option.value === customId)).toBe(true);

        (globalThis as any).window = {
            ...(globalThis as any).window,
            matchMedia: () => ({
                matches: false,
                addEventListener: () => {},
                removeEventListener: () => {},
            }),
        };

        const settingsPlugin = (await import('../../plugins/settings/index.js')).default;
        const desktopModeSetting = settingsPlugin.settingsManifest?.activeDesktopMode;
        const options = typeof desktopModeSetting?.options === 'function'
            ? desktopModeSetting.options()
            : desktopModeSetting?.options || [];

        expect(options.some(option => option.value === customId)).toBe(true);
    });
});
