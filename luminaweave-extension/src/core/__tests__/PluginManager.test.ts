import { defineComponent } from 'vue';
import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { PluginManager } from '../PluginManager.js';
import type { LuminaPlugin } from '../../types/plugin.js';
import { pluginDomainRegistry } from '../../platform/plugin/PluginDomainRegistry.js';
import { surfaceRegistry } from '../../platform/surface/SurfaceRegistry.js';
import type {
    EmptySurfaceData,
    SurfaceContractSpec,
    SurfaceRendererDefinition
} from '../../platform/surface/types.js';

declare module '../../platform/surface/types.js' {
    interface SurfaceContractMap {
        'test.conflict.surface': SurfaceContractSpec<EmptySurfaceData>;
        'test.duplicate-within-manifest.surface': SurfaceContractSpec<EmptySurfaceData>;
        'test.atomic-contract.surface': SurfaceContractSpec<EmptySurfaceData>;
        'test.activity-only.surface': SurfaceContractSpec<EmptySurfaceData>;
    }
}

const StubComponent = defineComponent({ name: 'StubPluginRoot', template: '<div />' });

const createRenderer = <K extends 'test.conflict.surface' | 'test.duplicate-within-manifest.surface'>(
    contractId: K,
    ownerId: string
): SurfaceRendererDefinition<K> => ({
    contractId,
    component: StubComponent,
    ownerId,
    kind: 'plugin-business'
});

describe('PluginManager', () => {
    it('initializes both legacy plugins and manifest v2 plugins', async () => {
        const manager = new PluginManager();
        const legacyInit = vi.fn();
        const manifestInit = vi.fn();
        const plugin: LuminaPlugin = {
            id: 'test-plugin',
            name: 'Test Plugin',
            icon: '',
            component: StubComponent,
            init: legacyInit,
            platformManifest: {
                id: 'test-plugin',
                name: 'Test Plugin',
                init: manifestInit
            }
        };

        manager.register(plugin);
        await manager.initializeAllPlugins();

        expect(legacyInit).toHaveBeenCalledTimes(1);
        expect(manifestInit).toHaveBeenCalledTimes(1);
    });

    it('does not run the same initializer twice when legacy and manifest share it', async () => {
        const manager = new PluginManager();
        const init = vi.fn();
        const plugin: LuminaPlugin = {
            id: 'shared-init-plugin',
            name: 'Shared Init Plugin',
            icon: '',
            component: StubComponent,
            init,
            platformManifest: {
                id: 'shared-init-plugin',
                name: 'Shared Init Plugin',
                init
            }
        };

        manager.register(plugin);
        await manager.initializeAllPlugins();

        expect(init).toHaveBeenCalledTimes(1);
    });

    it('lists enabled plugins even when they do not declare a navigation slot', () => {
        const manager = new PluginManager();
        const contractId = 'test.activity-only.surface';
        const plugin: LuminaPlugin = {
            id: 'activity-only-plugin',
            name: 'Activity Only',
            icon: '',
            component: StubComponent,
            platformManifest: {
                id: 'activity-only-plugin',
                name: 'Activity Only',
                primarySurface: contractId,
                activity: {
                    size: 'small',
                    pageType: 'standalone'
                },
                surfaces: [{
                    id: contractId,
                    ownerPluginId: 'activity-only-plugin',
                    inputSchema: z.object({}).strict(),
                    businessRenderer: {
                        contractId,
                        component: StubComponent,
                        ownerId: 'activity-only-plugin',
                        kind: 'plugin-business'
                    }
                }]
            }
        };

        manager.register(plugin);

        expect(manager.getPlugins()).toEqual([plugin]);
        expect(manager.getPluginsInSlot('mainView')).toEqual([]);
        expect(manager.getPluginsInSlot('widget')).toEqual([]);
    });

    it('does not leave a plugin domain or legacy registry entry when platform registration fails', () => {
        const manager = new PluginManager();
        const contractId = 'test.conflict.surface';

        manager.register({
            id: 'owner-plugin',
            name: 'Owner Plugin',
            icon: '',
            component: StubComponent,
            platformManifest: {
                id: 'owner-plugin',
                name: 'Owner Plugin',
                surfaces: [{
                    id: contractId,
                    ownerPluginId: 'owner-plugin',
                    inputSchema: z.object({}).strict()
                }],
                businessRenderers: {
                    [contractId]: createRenderer(contractId, 'owner-plugin')
                }
            }
        });

        expect(() => manager.register({
            id: 'conflicting-plugin',
            name: 'Conflicting Plugin',
            icon: '',
            component: StubComponent,
            platformManifest: {
                id: 'conflicting-plugin',
                name: 'Conflicting Plugin',
                businessRenderers: {
                    [contractId]: createRenderer(contractId, 'conflicting-plugin')
                }
            }
        })).toThrow(/Duplicate plugin business renderer/);

        expect(manager.getPlugin('conflicting-plugin')).toBeUndefined();
        expect(pluginDomainRegistry.get('conflicting-plugin')).toBeUndefined();
    });

    it('prevents duplicate renderers declared across contracts and business renderers before writing the plugin', () => {
        const manager = new PluginManager();
        const contractId = 'test.duplicate-within-manifest.surface';

        expect(() => manager.register({
            id: 'duplicate-manifest-plugin',
            name: 'Duplicate Manifest Plugin',
            icon: '',
            component: StubComponent,
            platformManifest: {
                id: 'duplicate-manifest-plugin',
                name: 'Duplicate Manifest Plugin',
                surfaces: [{
                    id: contractId,
                    inputSchema: z.object({}).strict(),
                    businessRenderer: createRenderer(contractId, 'duplicate-manifest-plugin')
                }],
                businessRenderers: {
                    [contractId]: createRenderer(contractId, 'duplicate-manifest-plugin')
                }
            }
        })).toThrow(/Duplicate business renderer in manifest/);

        expect(manager.getPlugin('duplicate-manifest-plugin')).toBeUndefined();
        expect(pluginDomainRegistry.get('duplicate-manifest-plugin')).toBeUndefined();
    });

    it('rejects duplicate contract ids before writing any manifest state', () => {
        const manager = new PluginManager();
        const contractId = 'test.atomic-contract.surface';

        expect(() => manager.register({
            id: 'atomic-contract-plugin',
            name: 'Atomic Contract Plugin',
            icon: '',
            component: StubComponent,
            platformManifest: {
                id: 'atomic-contract-plugin',
                name: 'Atomic Contract Plugin',
                surfaces: [
                    {
                        id: contractId,
                        ownerPluginId: 'atomic-contract-plugin',
                        inputSchema: z.object({}).strict()
                    },
                    {
                        id: contractId,
                        ownerPluginId: 'atomic-contract-plugin',
                        inputSchema: z.object({}).strict()
                    }
                ]
            }
        })).toThrow(/Duplicate surface contract in manifest/);

        expect(surfaceRegistry.hasContract(contractId)).toBe(false);
        expect(manager.getPlugin('atomic-contract-plugin')).toBeUndefined();
        expect(pluginDomainRegistry.get('atomic-contract-plugin')).toBeUndefined();
        expect(manager.registeredSettings['atomic-contract-plugin']).toBeUndefined();
    });
});
