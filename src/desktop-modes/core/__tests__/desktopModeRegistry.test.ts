import { computed, defineComponent } from 'vue';
import { describe, expect, it, vi } from 'vitest';
import {
    ACTIVE_DESKTOP_MODE_STORAGE_KEY,
    getActiveDesktopModeIdFromSettings,
    getDesktopModeOptions,
    getDesktopModeOrDefault,
    getDesktopModePackage,
    getDesktopModeSettingStorageKey,
    getDesktopModeShell,
    listDesktopModePackages,
    listDesktopModes,
    registerDesktopMode,
    unregisterDesktopMode,
    onDesktopModeUnregistered,
    desktopModeRegistrationVersion,
    getDesktopMode,
    resolveRegisteredDesktopModeId,
    resolveSurfaceSkin,
    resolveDesktopModeValues,
} from '../registry.js';
import { getSurfaceSkinContract } from '../surfaceSkinContracts.js';
import type { DesktopModeManifest } from '../types.js';

const expectNoHardcodedLightSurfaceEndpoint = (value: string | number | undefined): void => {
    expect(String(value)).not.toContain('rgba(255, 255, 255');
    expect(String(value)).not.toContain('rgba(244, 248, 254');
    expect(String(value)).not.toContain('rgba(245, 249, 255');
    expect(String(value)).not.toMatch(/(^|[^-\w])white(?![-\w])/);
};

describe('desktopModeRegistry', () => {
    it('resolves built-in chat theme through the chat.main surface contract', () => {
        const context = {
            activeSettings: {},
            resolvedAppearance: 'light' as const,
            desktopModeId: 'telegram'
        };

        expect(resolveSurfaceSkin('telegram', 'chat.main', context).variant).toBe('telegram');
        expect(resolveSurfaceSkin('telegram', 'chat.stream', context).skin).toBeUndefined();
        expect(getSurfaceSkinContract('chat.main')?.componentId).toBe('chat.main');
        expect(getSurfaceSkinContract('chat.stream')).toBeUndefined();
    });

    it('uses activeDesktopMode as the only desktop mode selection setting', () => {
        expect(getActiveDesktopModeIdFromSettings({
            [ACTIVE_DESKTOP_MODE_STORAGE_KEY]: 'stage',
            'lumina-settings.activeThemePack': 'discord'
        })).toBe('stage');

        expect(getActiveDesktopModeIdFromSettings({
            'lumina-settings.activeThemePack': 'discord'
        })).toBe('classic');
    });

    it('only exposes desktop-mode setting storage keys', () => {
        expect(getDesktopModeSettingStorageKey('discord', 'messageDensity')).toBe('desktop-mode-discord.messageDensity');
    });

    it('resolves built-in desktop modes by shell kind', () => {
        expect(getDesktopModeShell('classic').kind).toBe('traditional');
        expect(getDesktopModeShell('stage').kind).toBe('freeform');
        expect(getDesktopModeShell('telegram').kind).toBe('traditional');
        expect(getDesktopModeShell('discord').kind).toBe('traditional');
    });

    it('resolves desktop mode tokens without ThemePack context aliases', () => {
        const discordMode = getDesktopModeOrDefault('discord');

        const lightTokens = resolveDesktopModeValues(discordMode.designTokens, {
            activeSettings: {},
            resolvedAppearance: 'light',
            desktopModeId: 'discord'
        });
        const darkTokens = resolveDesktopModeValues(discordMode.designTokens, {
            activeSettings: {},
            resolvedAppearance: 'dark',
            desktopModeId: 'discord'
        });

        expect(lightTokens['--lw-bg-app']).not.toBe(darkTokens['--lw-bg-app']);
        expect(lightTokens['--lw-surface-container-lowest']).toBeDefined();
        expect(darkTokens['--lw-surface-container-highest']).toBeDefined();
    });

    it('resolves surface skins without ThemePack context aliases', () => {
        const context = {
            activeSettings: {},
            resolvedAppearance: 'light' as const,
            desktopModeId: 'telegram'
        };

        expect(resolveSurfaceSkin('telegram', 'chat.main', context).variant).toBe('telegram');
        expect(resolveSurfaceSkin('telegram', 'telegram.frame', context).cssVars['--lw-telegram-frame-bg']).toBeDefined();
        expect(getSurfaceSkinContract('shell.app')?.exposedCssVars).not.toContain('--lw-shell-statusbar-bg');
    });

    it('resolves dark shell surfaces without light endpoints', () => {
        const classicDarkContext = {
            activeSettings: {},
            resolvedAppearance: 'dark' as const,
            desktopModeId: 'classic'
        };
        const stageDarkContext = {
            activeSettings: {},
            resolvedAppearance: 'dark' as const,
            desktopModeId: 'stage'
        };
        const classicMainSurface = resolveSurfaceSkin('classic', 'shell.mainSurface', classicDarkContext).cssVars;
        const classicWidgetSurface = resolveSurfaceSkin('classic', 'shell.widget', classicDarkContext).cssVars;
        const stageMainSurface = resolveSurfaceSkin('stage', 'shell.mainSurface', stageDarkContext).cssVars;
        const stageWidgetSurface = resolveSurfaceSkin('stage', 'shell.widget', stageDarkContext).cssVars;
        const stageWorkspaceMenu = resolveSurfaceSkin('stage', 'shell.workspaceMenu', stageDarkContext).cssVars;

        expectNoHardcodedLightSurfaceEndpoint(classicMainSurface['--lw-shell-main-bg']);
        expectNoHardcodedLightSurfaceEndpoint(classicMainSurface['--lw-shell-main-border']);
        expectNoHardcodedLightSurfaceEndpoint(classicWidgetSurface['--lw-shell-widget-bg']);
        expectNoHardcodedLightSurfaceEndpoint(classicWidgetSurface['--lw-shell-widget-border']);
        expectNoHardcodedLightSurfaceEndpoint(stageMainSurface['--lw-shell-main-bg']);
        expectNoHardcodedLightSurfaceEndpoint(stageWidgetSurface['--lw-shell-widget-bg']);
        expectNoHardcodedLightSurfaceEndpoint(stageWidgetSurface['--lw-shell-widget-border']);
        expectNoHardcodedLightSurfaceEndpoint(stageWorkspaceMenu['--lw-shell-workspace-menu-bg']);
        expectNoHardcodedLightSurfaceEndpoint(stageWorkspaceMenu['--lw-shell-workspace-menu-border']);
        expectNoHardcodedLightSurfaceEndpoint(stageWorkspaceMenu['--lw-shell-workspace-menu-item-bg']);
        expectNoHardcodedLightSurfaceEndpoint(stageWorkspaceMenu['--lw-shell-workspace-menu-item-active-bg']);
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
            composition: {
                version: 1,
                desktop: { id: `${customId}-desktop`, kind: 'activity-slot', size: 'fill', visibility: 'visible' },
                mobile: { id: `${customId}-mobile`, kind: 'activity-slot', size: 'fill', visibility: 'visible' }
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

        const settingsPlugin = (await import('../../../plugins/settings/index.js')).default;
        const desktopModeSetting = settingsPlugin.settingsManifest?.activeDesktopMode;
        const options = typeof desktopModeSetting?.options === 'function'
            ? desktopModeSetting.options()
            : desktopModeSetting?.options || [];

        expect(options.some(option => option.value === customId)).toBe(true);
    });

    describe('unregistration', () => {
        const createMode = (id: string): DesktopModeManifest => ({
            id,
            name: id,
            shell: { kind: 'traditional' },
            composition: {
                version: 1,
                desktop: { id: `${id}-d`, kind: 'activity-slot', size: 'fill', visibility: 'visible' },
                mobile: { id: `${id}-m`, kind: 'activity-slot', size: 'fill', visibility: 'visible' }
            }
        });

        it('removes only the same manifest object, notifies listeners and bumps the version', () => {
            const mode = createMode('unreg-mode-a');
            registerDesktopMode(mode);
            const listener = vi.fn();
            const stop = onDesktopModeUnregistered(listener);
            try {
                const before = desktopModeRegistrationVersion.value;

                expect(unregisterDesktopMode(mode.id, createMode(mode.id))).toBe(false);
                expect(getDesktopMode(mode.id)).toBe(mode);
                expect(desktopModeRegistrationVersion.value).toBe(before);

                expect(unregisterDesktopMode(mode.id, mode)).toBe(true);
                expect(getDesktopMode(mode.id)).toBeUndefined();
                expect(listener).toHaveBeenCalledWith({ manifest: mode });
                expect(desktopModeRegistrationVersion.value).toBe(before + 1);
            } finally {
                stop();
                unregisterDesktopMode(mode.id, mode);
            }
        });

        it('bumps the version on registration', () => {
            const before = desktopModeRegistrationVersion.value;
            const mode = createMode('unreg-mode-b');
            registerDesktopMode(mode);
            expect(desktopModeRegistrationVersion.value).toBe(before + 1);
            unregisterDesktopMode(mode.id, mode);
        });

        it('refuses to unregister built-in modes', () => {
            const classic = getDesktopMode('classic')!;
            expect(() => unregisterDesktopMode('classic', classic)).toThrow(/built-in/i);
            expect(getDesktopMode('classic')).toBe(classic);
        });

        it('falls back to classic for unregistered persisted ids without rewriting them', () => {
            const mode = createMode('unreg-mode-c');
            const settings = { [ACTIVE_DESKTOP_MODE_STORAGE_KEY]: mode.id };
            const resolved = computed(() => resolveRegisteredDesktopModeId(getActiveDesktopModeIdFromSettings(settings)));
            try {
                expect(resolved.value).toBe('classic');
                registerDesktopMode(mode);
                expect(resolved.value).toBe(mode.id);
                unregisterDesktopMode(mode.id, mode);
                expect(resolved.value).toBe('classic');
                expect(getActiveDesktopModeIdFromSettings(settings)).toBe(mode.id);
            } finally {
                unregisterDesktopMode(mode.id, mode);
            }
        });
    });

    describe('mode packages', () => {
        const createMode = (id: string): DesktopModeManifest => ({
            id,
            name: id,
            shell: { kind: 'traditional' },
            composition: {
                version: 1,
                desktop: { id: `${id}-d`, kind: 'activity-slot', size: 'fill', visibility: 'visible' },
                mobile: { id: `${id}-m`, kind: 'activity-slot', size: 'fill', visibility: 'visible' }
            }
        });

        it('keeps manifest as the public fact and exposes the package bindings separately', () => {
            const mode = createMode('pkg-mode-a');
            const ShellStub = defineComponent({ name: 'PkgShellStub', render: () => null });

            registerDesktopMode({
                manifest: mode,
                shellRenderer: ShellStub,
                styles: '[data-desktop-mode="pkg-mode-a"] { color: red; }'
            });

            try {
                expect(getDesktopMode(mode.id)).toBe(mode);
                expect(getDesktopModePackage(mode.id)?.shellRenderer).toBe(ShellStub);
                expect(getDesktopModePackage(mode.id)?.styles).toContain('pkg-mode-a');
                expect(listDesktopModePackages().some(modePackage => modePackage.manifest.id === mode.id)).toBe(true);
            } finally {
                unregisterDesktopMode(mode.id, mode);
            }

            expect(getDesktopModePackage(mode.id)).toBeUndefined();
        });

        it('normalizes manifest-only registrations into a manifest-only package', () => {
            const mode = createMode('pkg-mode-b');
            registerDesktopMode(mode);
            try {
                expect(getDesktopModePackage(mode.id)).toEqual({ manifest: mode });
            } finally {
                unregisterDesktopMode(mode.id, mode);
            }
        });

        it('resolves custom variant names through mode rendererVariants and skin variant', () => {
            const mode: DesktopModeManifest = {
                ...createMode('pkg-mode-variant'),
                rendererVariants: { 'chat.main': 'aurora' },
                surfaceSkins: {
                    'settings.root': { componentId: 'settings.root', variant: 'glass' }
                }
            };
            registerDesktopMode(mode);
            try {
                const context = {
                    activeSettings: {},
                    resolvedAppearance: 'light' as const,
                    desktopModeId: mode.id
                };
                expect(resolveSurfaceSkin(mode.id, 'chat.main', context).variant).toBe('aurora');
                expect(resolveSurfaceSkin(mode.id, 'settings.root', context).variant).toBe('glass');
            } finally {
                unregisterDesktopMode(mode.id, mode);
            }
        });
    });
});
