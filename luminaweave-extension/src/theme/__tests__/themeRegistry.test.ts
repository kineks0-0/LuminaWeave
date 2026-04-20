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
import type { DesktopModeManifest } from '../types.js';

describe('themeRegistry desktop mode model', () => {
    it('resolves built-in desktop modes by shell kind', () => {
        expect(getDesktopModeShell('classic').kind).toBe('traditional');
        expect(getDesktopModeShell('stage').kind).toBe('freeform');
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
