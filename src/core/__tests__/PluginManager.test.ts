import { defineComponent } from 'vue';
import { describe, expect, it, vi } from 'vitest';
import { PluginManager } from '../PluginManager.js';
import type { LuminaPlugin } from '../../types/plugin.js';
import { pluginDomainRegistry } from '../../platform/plugin/PluginDomainRegistry.js';
import type { SurfaceRendererDefinition } from '../../platform/surface/types.js';

const StubComponent = defineComponent({ name: 'StubPluginRoot', template: '<div />' });

const createRenderer = (contractId: string, ownerId: string): SurfaceRendererDefinition => ({
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
                businessRenderers: {
                    main: createRenderer(contractId, 'owner-plugin')
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
                    main: createRenderer(contractId, 'conflicting-plugin')
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
                    businessRenderer: createRenderer(contractId, 'duplicate-manifest-plugin')
                }],
                businessRenderers: {
                    main: createRenderer(contractId, 'duplicate-manifest-plugin')
                }
            }
        })).toThrow(/Duplicate business renderer in manifest/);

        expect(manager.getPlugin('duplicate-manifest-plugin')).toBeUndefined();
        expect(pluginDomainRegistry.get('duplicate-manifest-plugin')).toBeUndefined();
    });
});
