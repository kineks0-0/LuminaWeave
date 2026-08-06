import { defineComponent } from 'vue';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { DesktopModeRuntimeRegistry } from '../DesktopModeRuntimeRegistry.js';
import { desktopModeRuntimeRegistry } from '../DesktopModeRuntimeRegistry.js';
import { initializeDesktopModeRuntime } from '../initializeDesktopModeRuntime.js';
import { SurfaceRegistry } from '../../surface/SurfaceRegistry.js';
import { OFFICIAL_SURFACE_INPUT_SCHEMAS } from '../../surface/officialContracts.js';
import { initializeSurfaceRuntime } from '../../surface/initializeSurfaceRuntime.js';
import type { SurfaceRendererDefinition } from '../../surface/types.js';
import { getDesktopMode, registerDesktopMode } from '../../../desktop-modes/core/registry.js';
import type { DesktopModeManifest } from '../../../desktop-modes/core/types.js';

vi.mock('../../../shell/modes/telegram/TelegramUserInfoPanel.vue', () => ({
    default: defineComponent({ name: 'TelegramUserInfoPanelStub', template: '<div />' })
}));
vi.mock('../../../shell/traditional/TraditionalShell.vue', () => ({
    default: defineComponent({ name: 'TraditionalShellStub', template: '<div />' })
}));
vi.mock('../../../shell/freeform/FreeformShell.vue', () => ({
    default: defineComponent({ name: 'FreeformShellStub', template: '<div />' })
}));

const createRenderer = (ownerId: string): SurfaceRendererDefinition<'settings.root'> => ({
    contractId: 'settings.root',
    component: defineComponent({ name: `${ownerId}SettingsRoot`, template: '<div />' }),
    ownerId,
    kind: 'desktop-override'
});

const createChatRenderer = (ownerId: string): SurfaceRendererDefinition<'chat.main'> => ({
    contractId: 'chat.main',
    component: defineComponent({ name: `${ownerId}ChatMain`, template: '<div />' }),
    ownerId,
    kind: 'desktop-override'
});

describe('DesktopModeRuntimeRegistry', () => {
    beforeAll(() => {
        initializeSurfaceRuntime();
    });

    it('registers desktop component overrides into the provided surface registry shape', () => {
        const isolatedSurfaceRegistry = new SurfaceRegistry();
        isolatedSurfaceRegistry.registerContract({
            id: 'settings.root',
            inputSchema: OFFICIAL_SURFACE_INPUT_SCHEMAS['settings.root']
        });
        const desktopRegistry = new DesktopModeRuntimeRegistry(isolatedSurfaceRegistry);
        const renderer = createRenderer('telegram');

        desktopRegistry.register({
            manifest: {
                id: 'telegram',
                name: 'Telegram 桌面',
                shell: { kind: 'traditional' }
            },
            id: 'telegram',
            name: 'Telegram 桌面',
            shellKind: 'traditional',
            navigationModel: {
                id: 'telegram.navigation',
                primarySurfaces: ['chat.main'],
                contextualSurfaces: ['settings.root']
            },
            componentOverrides: {
                'settings.root': renderer
            },
            interactionPolicy: {
                id: 'telegram.policy',
                openSurface: 'temporary-tab',
                supportsContextualTools: true
            }
        });

        const mode = desktopRegistry.get('telegram');

        expect(mode?.navigationModel.primarySurfaces).toEqual(['chat.main']);
        expect(mode?.componentOverrides?.['settings.root']?.ownerId).toBe('telegram');
    });

    it('rejects duplicate desktop mode ids', () => {
        const desktopRegistry = new DesktopModeRuntimeRegistry();
        const manifest = {
            manifest: {
                id: 'stage',
                name: '自由工作台',
                shell: { kind: 'freeform' as const }
            },
            id: 'stage',
            name: '自由工作台',
            shellKind: 'freeform' as const,
            navigationModel: { id: 'stage.navigation' },
            interactionPolicy: { id: 'stage.policy', supportsOverlappingWindows: true }
        };

        desktopRegistry.register(manifest);

        expect(() => desktopRegistry.register(manifest)).toThrow(/Duplicate desktop mode id: stage/);
    });

    it('does not retain a mode or earlier overrides when override validation fails', () => {
        const isolatedSurfaceRegistry = new SurfaceRegistry();
        isolatedSurfaceRegistry.registerContract({
            id: 'chat.main',
            inputSchema: OFFICIAL_SURFACE_INPUT_SCHEMAS['chat.main']
        });
        isolatedSurfaceRegistry.registerContract({
            id: 'settings.root',
            inputSchema: OFFICIAL_SURFACE_INPUT_SCHEMAS['settings.root']
        });
        isolatedSurfaceRegistry.registerDesktopOverride('atomic-mode', createRenderer('existing-settings'));
        const desktopRegistry = new DesktopModeRuntimeRegistry(isolatedSurfaceRegistry);

        expect(() => desktopRegistry.register({
            manifest: {
                id: 'atomic-mode',
                name: 'Atomic Mode',
                shell: { kind: 'traditional' }
            },
            id: 'atomic-mode',
            name: 'Atomic Mode',
            shellKind: 'traditional',
            navigationModel: { id: 'atomic-mode.navigation' },
            componentOverrides: {
                'chat.main': createChatRenderer('atomic-chat'),
                'settings.root': createRenderer('conflicting-settings')
            },
            interactionPolicy: { id: 'atomic-mode.policy' }
        })).toThrow(/Duplicate desktop override/);

        expect(desktopRegistry.get('atomic-mode')).toBeUndefined();
        expect(() => isolatedSurfaceRegistry.registerDesktopOverride(
            'atomic-mode',
            createChatRenderer('probe-chat')
        )).not.toThrow();
    });

    it('keeps surface registry override semantics compatible with desktop overrides', () => {
        const surfaceRegistry = new SurfaceRegistry();
        const renderer = createRenderer('discord');

        surfaceRegistry.registerContract({
            id: 'settings.root',
            inputSchema: OFFICIAL_SURFACE_INPUT_SCHEMAS['settings.root']
        });
        surfaceRegistry.registerDesktopOverride('discord', renderer);

        const resolved = surfaceRegistry.resolve({
            contractId: 'settings.root',
            desktopModeId: 'discord'
        });

        expect(resolved.source).toBe('desktop-override');
        expect(resolved.renderer.ownerId).toBe('discord');
    });

    it('adapts current built-in desktop modes into runtime v2 manifests', () => {
        desktopModeRuntimeRegistry.clearForTests();
        initializeDesktopModeRuntime();

        const ids = desktopModeRuntimeRegistry.list().map(mode => mode.id);

        expect(ids).toContain('classic');
        expect(ids).toContain('stage');
        expect(ids).toContain('telegram');
        expect(ids).toContain('discord');
        expect(desktopModeRuntimeRegistry.get('stage')?.interactionPolicy.supportsOverlappingWindows).toBe(true);
        expect(desktopModeRuntimeRegistry.get('classic')?.shellRenderer).toBeDefined();
        expect(desktopModeRuntimeRegistry.get('stage')?.shellRenderer).toBeDefined();
        expect(desktopModeRuntimeRegistry.get('telegram')?.navigationModel.mobileSurfaces).toEqual([]);
        expect(desktopModeRuntimeRegistry.get('telegram')?.componentOverrides?.['telegram.infoPanel']?.ownerId).toBe('telegram');
    });

    it('keeps the runtime registry synchronized with custom modes registered after initialization', () => {
        desktopModeRuntimeRegistry.clearForTests();
        initializeDesktopModeRuntime();

        const customId = `runtime-custom-${Math.random().toString(36).slice(2, 8)}`;
        registerDesktopMode({
            id: customId,
            name: 'Runtime Custom Desktop',
            description: 'Verifies single-source desktop mode registration.',
            shell: {
                kind: 'freeform'
            },
            settingsManifest: {
                density: {
                    default: 'compact',
                    label: 'Density',
                    type: 'options',
                    allowedScopes: ['Global'],
                    options: [
                        { value: 'compact', label: 'Compact' },
                        { value: 'cozy', label: 'Cozy' }
                    ]
                }
            }
        });

        const runtimeMode = desktopModeRuntimeRegistry.get(customId);

        expect(runtimeMode?.manifest.id).toBe(customId);
        expect(runtimeMode?.shellKind).toBe('freeform');
        expect(runtimeMode?.shellRenderer).toBeDefined();
        expect(runtimeMode?.interactionPolicy.supportsOverlappingWindows).toBe(true);
        expect(runtimeMode?.settingsSchema?.density?.default).toBe('compact');
    });

    it('does not retain a public desktop mode when composition preflight fails', () => {
        desktopModeRuntimeRegistry.clearForTests();
        initializeDesktopModeRuntime();
        const customId = `runtime-invalid-${Math.random().toString(36).slice(2, 8)}`;
        const manifest = {
            id: customId,
            name: 'Invalid Runtime Desktop',
            shell: { kind: 'traditional' },
            composition: {
                version: 2,
                desktop: {
                    id: 'desktop-root',
                    kind: 'activity-slot',
                    size: 'fill',
                    visibility: 'visible'
                },
                mobile: {
                    id: 'mobile-root',
                    kind: 'activity-slot',
                    size: 'fill',
                    visibility: 'visible'
                }
            }
        } as unknown as DesktopModeManifest;

        expect(() => registerDesktopMode(manifest))
            .toThrow('[DesktopCompositionRuntime] Unsupported composition version');
        expect(getDesktopMode(customId)).toBeUndefined();
        expect(desktopModeRuntimeRegistry.get(customId)).toBeUndefined();
    });

    it('reports malformed public composition trees as stable invalid-layout errors', () => {
        desktopModeRuntimeRegistry.clearForTests();
        initializeDesktopModeRuntime();
        const customId = `runtime-malformed-${Math.random().toString(36).slice(2, 8)}`;
        const manifest = {
            id: customId,
            name: 'Malformed Runtime Desktop',
            shell: { kind: 'traditional' },
            composition: {
                version: 1,
                desktop: {
                    id: 'desktop-root',
                    kind: 'group',
                    direction: 'row',
                    size: 'fill',
                    visibility: 'visible'
                },
                mobile: {
                    id: 'mobile-root',
                    kind: 'activity-slot',
                    size: 'fill',
                    visibility: 'visible'
                }
            }
        } as unknown as DesktopModeManifest;

        expect(() => registerDesktopMode(manifest))
            .toThrow('[DesktopCompositionRuntime] Invalid composition layout');
        expect(getDesktopMode(customId)).toBeUndefined();
        expect(desktopModeRuntimeRegistry.get(customId)).toBeUndefined();
    });
});
