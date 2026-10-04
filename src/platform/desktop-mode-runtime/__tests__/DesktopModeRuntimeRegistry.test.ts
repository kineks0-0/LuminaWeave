import { computed, defineComponent } from 'vue';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { DesktopModeRuntimeRegistry } from '../DesktopModeRuntimeRegistry.js';
import { desktopModeRuntimeRegistry } from '../DesktopModeRuntimeRegistry.js';
import { initializeDesktopModeRuntime } from '../initializeDesktopModeRuntime.js';
import { SurfaceRegistry } from '../../surface/SurfaceRegistry.js';
import { OFFICIAL_SURFACE_INPUT_SCHEMAS } from '../../surface/officialContracts.js';
import { initializeSurfaceRuntime } from '../../surface/initializeSurfaceRuntime.js';
import type { SurfaceRendererDefinition } from '../../surface/types.js';
import {
    getDesktopMode,
    getDesktopModeOwnerPluginId,
    registerDesktopMode,
    unregisterDesktopMode
} from '../../../desktop-modes/core/registry.js';
import type { DesktopModeManifest } from '../../../desktop-modes/core/types.js';
import type { DesktopModeRuntimeDescriptor } from '../types.js';

vi.mock('../../../desktop-modes/builtins/telegram/shell/TelegramUserInfoPanel.vue', () => ({
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

const createTestDescriptor = (
    id: string,
    overrides: Partial<DesktopModeRuntimeDescriptor> = {}
): DesktopModeRuntimeDescriptor => {
    const composition = {
        version: 1 as const,
        desktop: { id: `${id}-desktop`, kind: 'activity-slot' as const, size: 'fill' as const, visibility: 'visible' as const },
        mobile: { id: `${id}-mobile`, kind: 'activity-slot' as const, size: 'fill' as const, visibility: 'visible' as const }
    };
    return {
        manifest: { id, name: id, shell: { kind: 'traditional' }, composition },
        id,
        name: id,
        shellKind: 'traditional',
        navigationModel: { id: `${id}.navigation` },
        interactionPolicy: { id: `${id}.policy` },
        composition,
        ...overrides
    };
};

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
                shell: { kind: 'traditional' },
                composition: {
                    version: 1,
                    desktop: { id: 'telegram-desktop', kind: 'activity-slot', size: 'fill', visibility: 'visible' },
                    mobile: { id: 'telegram-mobile', kind: 'activity-slot', size: 'fill', visibility: 'visible' }
                }
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
            },
            composition: {
                version: 1,
                desktop: { id: 'telegram-desktop', kind: 'activity-slot', size: 'fill', visibility: 'visible' },
                mobile: { id: 'telegram-mobile', kind: 'activity-slot', size: 'fill', visibility: 'visible' }
            }
        });

        const mode = desktopRegistry.get('telegram');

        expect(mode?.navigationModel.primarySurfaces).toEqual([]);
        expect(mode?.componentOverrides?.['settings.root']?.ownerId).toBe('telegram');
    });

    it('rejects duplicate desktop mode ids', () => {
        const desktopRegistry = new DesktopModeRuntimeRegistry();
        const manifest = {
            manifest: {
                id: 'stage',
                name: '自由工作台',
                shell: { kind: 'freeform' as const },
                composition: {
                    version: 1 as const,
                    desktop: { id: 'stage-desktop', kind: 'activity-slot' as const, size: 'fill' as const, visibility: 'visible' as const },
                    mobile: { id: 'stage-mobile', kind: 'activity-slot' as const, size: 'fill' as const, visibility: 'visible' as const }
                }
            },
            id: 'stage',
            name: '自由工作台',
            shellKind: 'freeform' as const,
            navigationModel: { id: 'stage.navigation' },
            interactionPolicy: { id: 'stage.policy', supportsOverlappingWindows: true },
            composition: {
                version: 1 as const,
                desktop: { id: 'stage-desktop', kind: 'activity-slot' as const, size: 'fill' as const, visibility: 'visible' as const },
                mobile: { id: 'stage-mobile', kind: 'activity-slot' as const, size: 'fill' as const, visibility: 'visible' as const }
            }
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
                shell: { kind: 'traditional' },
                composition: {
                    version: 1,
                    desktop: { id: 'atomic-desktop', kind: 'activity-slot', size: 'fill', visibility: 'visible' },
                    mobile: { id: 'atomic-mobile', kind: 'activity-slot', size: 'fill', visibility: 'visible' }
                }
            },
            id: 'atomic-mode',
            name: 'Atomic Mode',
            shellKind: 'traditional',
            navigationModel: { id: 'atomic-mode.navigation' },
            componentOverrides: {
                'chat.main': createChatRenderer('atomic-chat'),
                'settings.root': createRenderer('conflicting-settings')
            },
            interactionPolicy: { id: 'atomic-mode.policy' },
            composition: {
                version: 1,
                desktop: { id: 'atomic-desktop', kind: 'activity-slot', size: 'fill', visibility: 'visible' },
                mobile: { id: 'atomic-mobile', kind: 'activity-slot', size: 'fill', visibility: 'visible' }
            }
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

    it('resolves classic and stage through explicit desktop and mobile compositions', () => {
        desktopModeRuntimeRegistry.clearForTests();
        initializeDesktopModeRuntime();

        for (const modeId of ['classic', 'stage']) {
            expect(desktopModeRuntimeRegistry.resolveComposition(modeId, 'desktop')).toMatchObject({
                id: `${modeId}-desktop-activity`,
                kind: 'activity-slot',
                size: 'fill',
                visibility: 'visible'
            });
            expect(desktopModeRuntimeRegistry.resolveComposition(modeId, 'mobile')).toMatchObject({
                id: `${modeId}-mobile-activity`,
                kind: 'activity-slot',
                size: 'fill',
                visibility: 'visible'
            });
        }
    });

    it('resolves discord and telegram through their declared surface compositions', () => {
        desktopModeRuntimeRegistry.clearForTests();
        initializeDesktopModeRuntime();

        expect(desktopModeRuntimeRegistry.resolveComposition('discord', 'desktop')).toMatchObject({
            id: 'discord-desktop-layout',
            kind: 'group',
            direction: 'row',
            size: 'fill',
            visibility: 'visible',
            children: [
                {
                    id: 'discord-desktop-roster',
                    kind: 'surface',
                    contractId: 'character.roster',
                    input: { compact: true },
                    size: 'content',
                    visibility: 'visible'
                },
                {
                    id: 'discord-desktop-activity',
                    kind: 'activity-slot',
                    size: 'fill',
                    visibility: 'visible'
                }
            ]
        });
        expect(desktopModeRuntimeRegistry.resolveComposition('discord', 'mobile')).toMatchObject({
            id: 'discord-mobile-activity',
            kind: 'activity-slot',
            size: 'fill',
            visibility: 'visible'
        });

        for (const viewport of ['desktop', 'mobile'] as const) {
            expect(desktopModeRuntimeRegistry.resolveComposition('telegram', viewport)).toMatchObject({
                id: `telegram-${viewport}-activity`,
                kind: 'activity-slot',
                size: 'fill',
                visibility: 'visible'
            });
        }
    });

    it('keeps the runtime registry synchronized with custom modes registered after initialization', () => {
        desktopModeRuntimeRegistry.clearForTests();
        initializeDesktopModeRuntime();

        const customId = `runtime-custom-${Math.random().toString(36).slice(2, 8)}`;
        const customManifest: DesktopModeManifest = {
            id: customId,
            name: 'Runtime Custom Desktop',
            description: 'Verifies single-source desktop mode registration.',
            shell: {
                kind: 'freeform'
            },
            composition: {
                version: 1,
                desktop: { id: `${customId}-desktop`, kind: 'activity-slot', size: 'fill', visibility: 'visible' },
                mobile: { id: `${customId}-mobile`, kind: 'activity-slot', size: 'fill', visibility: 'visible' }
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
        };
        registerDesktopMode(customManifest);
        try {
            const runtimeMode = desktopModeRuntimeRegistry.get(customId);

            expect(runtimeMode?.manifest.id).toBe(customId);
            expect(runtimeMode?.shellKind).toBe('freeform');
            expect(runtimeMode?.shellRenderer).toBeDefined();
            expect(runtimeMode?.interactionPolicy.supportsOverlappingWindows).toBe(true);
            expect(runtimeMode?.settingsSchema?.density?.default).toBe('compact');
        } finally {
            unregisterDesktopMode(customId, customManifest);
        }
    });

    it('adapts a mode package with a custom shell renderer and component overrides', () => {
        desktopModeRuntimeRegistry.clearForTests();
        initializeDesktopModeRuntime();

        const customId = `runtime-package-${Math.random().toString(36).slice(2, 8)}`;
        const ShellStub = defineComponent({ name: 'CustomModeShell', render: () => null });
        const overrideComponent = defineComponent({ name: 'CustomSettingsRoot', render: () => null });
        const manifest: DesktopModeManifest = {
            id: customId,
            name: 'Runtime Package Desktop',
            shell: { kind: 'traditional' },
            composition: {
                version: 1,
                desktop: { id: `${customId}-desktop`, kind: 'activity-slot', size: 'fill', visibility: 'visible' },
                mobile: { id: `${customId}-mobile`, kind: 'activity-slot', size: 'fill', visibility: 'visible' }
            }
        };

        registerDesktopMode({
            manifest,
            shellRenderer: ShellStub,
            componentOverrides: [
                { contractId: 'settings.root', component: overrideComponent }
            ]
        });

        try {
            const descriptor = desktopModeRuntimeRegistry.get(customId);

            expect(descriptor?.shellRenderer).toBe(ShellStub);
            expect(descriptor?.componentOverrides?.['settings.root']?.component).toBe(overrideComponent);
            expect(descriptor?.componentOverrides?.['settings.root']?.kind).toBe('desktop-override');
            expect(descriptor?.componentOverrides?.['settings.root']?.ownerId).toBe(customId);
        } finally {
            unregisterDesktopMode(customId, manifest);
        }
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

    it('unregisters runtime descriptors and their surface overrides', () => {
        const isolated = new SurfaceRegistry();
        isolated.registerContract({ id: 'settings.root', inputSchema: OFFICIAL_SURFACE_INPUT_SCHEMAS['settings.root'] });
        const registry = new DesktopModeRuntimeRegistry(isolated);
        registry.register(createTestDescriptor('unreg-rt', {
            componentOverrides: { 'settings.root': createRenderer('unreg-rt') }
        }));
        expect(isolated.resolve({ contractId: 'settings.root', desktopModeId: 'unreg-rt' }).source).toBe('desktop-override');

        registry.unregister('unreg-rt');

        expect(registry.get('unreg-rt')).toBeUndefined();
        expect(() => isolated.resolve({ contractId: 'settings.root', desktopModeId: 'unreg-rt' })).toThrow();
    });

    it('drops the runtime descriptor when a custom mode is unregistered from the public registry', () => {
        desktopModeRuntimeRegistry.clearForTests();
        initializeDesktopModeRuntime();
        const customId = `runtime-unreg-${Math.random().toString(36).slice(2, 8)}`;
        const manifest: DesktopModeManifest = {
            id: customId,
            name: 'Unreg',
            shell: { kind: 'traditional' },
            composition: {
                version: 1,
                desktop: { id: `${customId}-d`, kind: 'activity-slot', size: 'fill', visibility: 'visible' },
                mobile: { id: `${customId}-m`, kind: 'activity-slot', size: 'fill', visibility: 'visible' }
            }
        };
        registerDesktopMode(manifest);
        try {
            expect(desktopModeRuntimeRegistry.get(customId)).toBeDefined();
        } finally {
            unregisterDesktopMode(customId, manifest);
        }
        expect(desktopModeRuntimeRegistry.get(customId)).toBeUndefined();
    });

    it('is reactive: a computed reading a descriptor sees unregister and same-id re-register', () => {
        const registry = new DesktopModeRuntimeRegistry(new SurfaceRegistry());
        const first = createTestDescriptor('reactive-rt');
        registry.register(first);
        const descriptor = computed(() => registry.get('reactive-rt'));
        const composition = computed(() => registry.resolveComposition('reactive-rt', 'desktop').id);
        expect(descriptor.value?.id).toBe('reactive-rt');
        expect(composition.value).toBe('reactive-rt-desktop');

        registry.unregister('reactive-rt');
        expect(descriptor.value).toBeUndefined();

        const second = createTestDescriptor('reactive-rt');
        // register 以 manifest.composition 为准，两处都改成 v2。
        const v2Composition = {
            ...second.composition,
            desktop: { id: 'reactive-rt-desktop-v2', kind: 'activity-slot' as const, size: 'fill' as const, visibility: 'visible' as const }
        };
        second.composition = v2Composition;
        second.manifest = { ...second.manifest, composition: v2Composition };
        registry.register(second);
        expect(descriptor.value).not.toBe(first);
        expect(descriptor.value?.composition.desktop.id).toBe('reactive-rt-desktop-v2');
        expect(composition.value).toBe('reactive-rt-desktop-v2');
    });

    it('applies the new override after unregister and same-id re-register', () => {
        const isolated = new SurfaceRegistry();
        isolated.registerContract({ id: 'settings.root', inputSchema: OFFICIAL_SURFACE_INPUT_SCHEMAS['settings.root'] });
        const registry = new DesktopModeRuntimeRegistry(isolated);
        registry.register(createTestDescriptor('chain-rt', {
            componentOverrides: { 'settings.root': createRenderer('old-owner') }
        }));

        registry.unregister('chain-rt');
        registry.register(createTestDescriptor('chain-rt', {
            componentOverrides: { 'settings.root': createRenderer('new-owner') }
        }));

        expect(isolated.resolve({ contractId: 'settings.root', desktopModeId: 'chain-rt' }).renderer.ownerId)
            .toBe('new-owner');
    });
    it('lists modes whose composition references any of the given contracts', () => {
        const isolated = new SurfaceRegistry();
        isolated.registerContract({ id: 'settings.root', inputSchema: OFFICIAL_SURFACE_INPUT_SCHEMAS['settings.root'] });
        const registry = new DesktopModeRuntimeRegistry(isolated);
        const surfaceNode = {
            id: 'ref-surface',
            kind: 'surface' as const,
            contractId: 'settings.root' as const,
            input: {},
            size: 'fill' as const,
            visibility: 'visible' as const
        };
        const slot = { id: 'ref-slot', kind: 'activity-slot' as const, size: 'fill' as const, visibility: 'visible' as const };
        const composition = { version: 1 as const, desktop: surfaceNode, mobile: slot };
        registry.register(createTestDescriptor('ref-mode', {
            manifest: { id: 'ref-mode', name: 'ref-mode', shell: { kind: 'traditional' }, composition },
            composition
        }));
        registry.register(createTestDescriptor('plain-mode'));

        expect(registry.listModesReferencingContracts(['settings.root'])).toEqual(['ref-mode']);
        expect(registry.listModesReferencingContracts(['chat.main'])).toEqual([]);
        expect(registry.listModesReferencingContracts([])).toEqual([]);
    });
    it('excludes modes owned by the given plugin from contract reference queries', () => {
        const isolated = new SurfaceRegistry();
        isolated.registerContract({ id: 'settings.root', inputSchema: OFFICIAL_SURFACE_INPUT_SCHEMAS['settings.root'] });
        const registry = new DesktopModeRuntimeRegistry(isolated);
        const slot = { id: 'own-slot', kind: 'activity-slot' as const, size: 'fill' as const, visibility: 'visible' as const };
        const referencing = (id: string, ownerPluginId?: string) => {
            const composition = {
                version: 1 as const,
                desktop: {
                    id: `${id}-node`,
                    kind: 'surface' as const,
                    contractId: 'settings.root' as const,
                    input: {},
                    size: 'fill' as const,
                    visibility: 'visible' as const
                },
                mobile: { ...slot, id: `${id}-slot` }
            };
            return createTestDescriptor(id, {
                manifest: { id, name: id, shell: { kind: 'traditional' }, composition },
                composition,
                ownerPluginId
            });
        };
        registry.register(referencing('mode-a', 'plugin-a'));
        registry.register(referencing('mode-b', 'plugin-b'));
        registry.register(referencing('mode-builtin'));

        expect(registry.listModesReferencingContracts(['settings.root'])).toEqual(['mode-a', 'mode-b', 'mode-builtin']);
        expect(registry.listModesReferencingContracts(['settings.root'], { excludeOwnerPluginId: 'plugin-a' }))
            .toEqual(['mode-b', 'mode-builtin']);
    });

    it('passes the mode owner to surface overrides so the owner is not its own dependent', () => {
        const isolated = new SurfaceRegistry();
        isolated.registerBatch({
            contracts: [{
                id: 'settings.root',
                ownerPluginId: 'plugin-a',
                inputSchema: OFFICIAL_SURFACE_INPUT_SCHEMAS['settings.root']
            }]
        });
        const registry = new DesktopModeRuntimeRegistry(isolated);
        registry.register(createTestDescriptor('override-own', {
            ownerPluginId: 'plugin-a',
            componentOverrides: { 'settings.root': createRenderer('whatever') }
        }));
        expect(isolated.findForeignDependents('plugin-a')).toEqual([]);

        registry.register(createTestDescriptor('override-foreign', {
            ownerPluginId: 'plugin-b',
            componentOverrides: { 'settings.root': createRenderer('plugin-a') }
        }));
        expect(isolated.findForeignDependents('plugin-a')).toEqual([
            { contractId: 'settings.root', kind: 'desktop-override', modeId: 'override-foreign' }
        ]);
    });

    it('records the plugin that registered a public desktop mode on its runtime descriptor', () => {
        desktopModeRuntimeRegistry.clearForTests();
        initializeDesktopModeRuntime();
        const customId = `runtime-owned-${Math.random().toString(36).slice(2, 8)}`;
        const manifest: DesktopModeManifest = {
            id: customId,
            name: 'Owned',
            shell: { kind: 'traditional' },
            composition: {
                version: 1,
                desktop: { id: `${customId}-d`, kind: 'activity-slot', size: 'fill', visibility: 'visible' },
                mobile: { id: `${customId}-m`, kind: 'activity-slot', size: 'fill', visibility: 'visible' }
            }
        };
        registerDesktopMode(manifest, 'owner-plugin');
        try {
            expect(desktopModeRuntimeRegistry.get(customId)?.ownerPluginId).toBe('owner-plugin');
        } finally {
            unregisterDesktopMode(customId, manifest);
        }
        expect(desktopModeRuntimeRegistry.get(customId)).toBeUndefined();
        expect(getDesktopModeOwnerPluginId(customId)).toBeUndefined();
    });
});
