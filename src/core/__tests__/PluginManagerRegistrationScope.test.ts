import { defineComponent } from 'vue';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { PluginManager } from '../PluginManager.js';
import type { LuminaPlugin } from '../../types/plugin.js';
import { pluginDomainRegistry } from '../../platform/plugin/PluginDomainRegistry.js';
import type { PluginInitContext } from '../../platform/plugin/PluginInitContext.js';
import { createTestInitContextHarness } from './testInitContext.js';
import { PromptSlot } from '../../api/core/hal/prompt/PromptRegistry.js';
import { surfaceRegistry } from '../../platform/surface/SurfaceRegistry.js';
import type { EmptySurfaceData, SurfaceContractSpec, SurfaceRendererDefinition } from '../../platform/surface/types.js';

declare module '../../platform/surface/types.js' {
    interface SurfaceContractMap {
        'test.scope.owned': SurfaceContractSpec<EmptySurfaceData>;
        'test.scope.enriched': SurfaceContractSpec<EmptySurfaceData>;
    }
}

const Stub = defineComponent({ name: 'ScopeStub', render: () => null });

const renderer = <K extends 'test.scope.owned' | 'test.scope.enriched'>(
    contractId: K,
    ownerId: string
): SurfaceRendererDefinition<K> => ({ contractId, component: Stub, ownerId, kind: 'plugin-business' });

// 先注册一个无 owner 的 contract，模拟 initializeSurfaceRuntime 预注册的官方 contract。
surfaceRegistry.registerContract({ id: 'test.scope.enriched', inputSchema: z.object({}).strict() });

const snapshot = (manager: PluginManager) => ({
    contracts: surfaceRegistry.listContracts().map(contract => ({ ...contract })),
    enrichedContract: surfaceRegistry.getContract('test.scope.enriched'),
    defaultRenderers: [...surfaceRegistry.listRenderers('core-default')],
    businessRenderers: [...surfaceRegistry.listRenderers('plugin-business')],
    manifests: [...pluginDomainRegistry.list()],
    plugins: { ...manager.plugins },
    slots: Object.fromEntries(Object.entries(manager.slots).map(([slot, plugins]) => [slot, [...plugins]])),
    settings: { ...manager.registeredSettings }
});

const createFullPlugin = (init?: (context: PluginInitContext) => void | Promise<void>): LuminaPlugin => ({
    id: 'scope-plugin',
    name: 'Scope Plugin',
    icon: '',
    component: Stub,
    slots: ['mainView', 'widget'],
    settingsManifest: { enabled: { type: 'boolean', label: 'Enabled', default: true } },
    hooks: { onGenerationEnded: vi.fn() },
    platformManifest: {
        id: 'scope-plugin',
        name: 'Scope Plugin',
        primarySurface: 'test.scope.owned',
        settingsSchema: { mode: { type: 'text', label: 'Mode', default: 'a' } },
        surfaces: [
            {
                id: 'test.scope.owned',
                ownerPluginId: 'scope-plugin',
                inputSchema: z.object({}).strict(),
                defaultRenderer: renderer('test.scope.owned', 'scope-plugin')
            },
            { id: 'test.scope.enriched', ownerPluginId: 'scope-plugin' }
        ],
        businessRenderers: {
            'test.scope.owned': renderer('test.scope.owned', 'scope-plugin'),
            'test.scope.enriched': renderer('test.scope.enriched', 'scope-plugin')
        },
        init
    }
});

describe('PluginManager registration scope', () => {
    // 各用例使用独立 manager，但 surface/domain 注册表是全局单例，失败用例也要清理。
    const managers: PluginManager[] = [];
    const harness = createTestInitContextHarness();
    const createManager = (): PluginManager => {
        const manager = new PluginManager();
        manager.setInitContextFactory(harness.factory);
        managers.push(manager);
        return manager;
    };
    afterEach(() => {
        managers.splice(0).forEach(manager => manager.unregister('scope-plugin'));
    });

    it('returns every registry to its baseline after unregister', () => {
        const manager = createManager();
        const baseline = snapshot(manager);

        const handle = manager.register(createFullPlugin());
        expect(handle?.pluginId).toBe('scope-plugin');
        expect(manager.getPluginsInSlot('mainView').map(plugin => plugin.id)).toContain('scope-plugin');
        expect(surfaceRegistry.getContract('test.scope.enriched')?.ownerPluginId).toBe('scope-plugin');

        expect(manager.unregister('scope-plugin')).toBe(true);
        expect(manager.unregister('scope-plugin')).toBe(false);

        expect(snapshot(manager)).toEqual(baseline);
        expect(surfaceRegistry.getContract('test.scope.enriched')).toBe(baseline.enrichedContract);
    });

    it('allows the same plugin to register again after unregister', () => {
        const manager = createManager();
        manager.register(createFullPlugin());
        manager.unregister('scope-plugin');

        expect(() => manager.register(createFullPlugin())).not.toThrow();
        expect(manager.getPlugin('scope-plugin')).toBeDefined();
        manager.unregister('scope-plugin');
    });

    it('ignores a stale handle after the plugin registered again', () => {
        const manager = createManager();
        const staleHandle = manager.register(createFullPlugin());
        manager.unregister('scope-plugin');
        manager.register(createFullPlugin());

        staleHandle?.dispose();

        expect(manager.getPlugin('scope-plugin')).toBeDefined();
        manager.unregister('scope-plugin');
    });

    it('initializes runtime plugins immediately and only once', async () => {
        const manager = createManager();
        const init = vi.fn();
        const handle = await manager.registerAndInitialize(createFullPlugin(init));
        await manager.initializeAllPlugins();

        expect(init).toHaveBeenCalledTimes(1);
        handle.dispose();
        expect(manager.getPlugin('scope-plugin')).toBeUndefined();
    });

    it('rolls back every registration when runtime init fails', async () => {
        const manager = createManager();
        const baseline = snapshot(manager);

        await expect(manager.registerAndInitialize(createFullPlugin(() => {
            throw new Error('init failed');
        }))).rejects.toThrow('init failed');

        expect(snapshot(manager)).toEqual(baseline);
    });

    it('rejects duplicate runtime registration without touching the existing plugin', async () => {
        const manager = createManager();
        await manager.registerAndInitialize(createFullPlugin());

        await expect(manager.registerAndInitialize(createFullPlugin())).rejects.toThrow(/Duplicate plugin id/);
        expect(manager.getPlugin('scope-plugin')).toBeDefined();
        manager.unregister('scope-plugin');
    });

    it('does not unregister a newer same-id plugin when an older runtime init fails', async () => {
        const manager = createManager();
        let rejectInit: (error: Error) => void = () => undefined;
        const pending = manager.registerAndInitialize(createFullPlugin(() => new Promise<void>((_, reject) => {
            rejectInit = reject;
        })));
        const pendingResult = pending.then(() => 'resolved', (error: Error) => error.message);

        manager.unregister('scope-plugin');
        const newer = createFullPlugin();
        manager.register(newer);
        rejectInit(new Error('old init failed'));

        expect(await pendingResult).toBe('old init failed');
        expect(manager.getPlugin('scope-plugin')).toBe(newer);
    });

    it('rejects when the plugin is unregistered while init is pending', async () => {
        const manager = createManager();
        let resolveInit: () => void = () => undefined;
        const pending = manager.registerAndInitialize(createFullPlugin(() => new Promise<void>(resolve => {
            resolveInit = resolve;
        })));
        const assertion = expect(pending).rejects.toThrow('unregistered during init');

        manager.unregister('scope-plugin');
        resolveInit();

        await assertion;
        expect(manager.getPlugin('scope-plugin')).toBeUndefined();
    });

    it('does not hand out a handle for a different plugin object with the same id', () => {
        const manager = createManager();
        const original = createFullPlugin();
        const handle = manager.register(original);
        expect(handle).toBeDefined();

        expect(manager.register(createFullPlugin())).toBeUndefined();
        expect(manager.getPlugin('scope-plugin')).toBe(original);
        expect(manager.register(original)?.pluginId).toBe('scope-plugin');
    });

    it('resolves whenBuiltinsInitialized only after the first initializeAllPlugins', async () => {
        const manager = createManager();
        const pendingMarker = Symbol('pending');
        // 不对 whenBuiltinsInitialized() 再套 then，避免多出的微任务让哨兵抢先；已 resolve 的 promise 排在前面会先胜出。
        const state = () => Promise.race([
            manager.whenBuiltinsInitialized(),
            Promise.resolve(pendingMarker)
        ]);

        expect(await state()).toBe(pendingMarker);

        await manager.initializeAllPlugins();

        expect(await state()).toBeUndefined();
    });
    it('passes a context with the right pluginId to manifest init and still calls legacy init', async () => {
        const manager = createManager();
        const manifestInit = vi.fn();
        const legacyInit = vi.fn();
        const plugin = createFullPlugin(manifestInit);
        plugin.init = legacyInit;

        await manager.registerAndInitialize(plugin);

        expect(manifestInit).toHaveBeenCalledWith(expect.objectContaining({ pluginId: 'scope-plugin' }));
        expect(legacyInit).toHaveBeenCalledTimes(1);
    });

    it('passes a context to initializeAllPlugins initializers', async () => {
        const manager = createManager();
        const init = vi.fn();
        manager.register(createFullPlugin(init));

        await manager.initializeAllPlugins();

        expect(init).toHaveBeenCalledWith(expect.objectContaining({ pluginId: 'scope-plugin' }));
    });

    it('revokes registrations made through the context after unregister', async () => {
        const manager = createManager();
        await manager.registerAndInitialize(createFullPlugin(context => {
            context.prompts.register({ id: 'ctx-frag', slot: PromptSlot.ST_MAIN, priority: 1, getFragment: () => null });
            context.panels.register('ctx-panel', Stub, { title: 'Ctx' });
        }));
        expect(harness.promptRegistry.getAllFragments().map(f => f.id)).toContain('ctx-frag');
        expect(harness.desktopSurface.registeredPanels.has('ctx-panel')).toBe(true);

        manager.unregister('scope-plugin');

        expect(harness.promptRegistry.getAllFragments().map(f => f.id)).not.toContain('ctx-frag');
        expect(harness.desktopSurface.registeredPanels.has('ctx-panel')).toBe(false);
    });

    it('revokes context registrations when runtime init fails', async () => {
        const manager = createManager();

        await expect(manager.registerAndInitialize(createFullPlugin(context => {
            context.panels.register('ctx-panel-fail', Stub, { title: 'Ctx' });
            throw new Error('init failed after register');
        }))).rejects.toThrow('init failed after register');

        expect(harness.desktopSurface.registeredPanels.has('ctx-panel-fail')).toBe(false);
    });

    it('fails fast when no init context factory is configured', async () => {
        const manager = new PluginManager();
        managers.push(manager);

        await expect(manager.registerAndInitialize(createFullPlugin(vi.fn()))).rejects.toThrow('init context factory');
        expect(manager.getPlugin('scope-plugin')).toBeUndefined();
    });
});
