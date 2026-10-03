import { defineComponent } from 'vue';
import { z } from 'zod';
import { describe, expect, it, vi } from 'vitest';
import type { EmptySurfaceData, SurfaceContractSpec } from '../../../platform/surface/types.js';
import { PluginManager } from '../../../core/PluginManager.js';
import { PluginDomainRegistry, pluginDomainRegistry } from '../../../platform/plugin/PluginDomainRegistry.js';
import { desktopModeRuntimeRegistry } from '../../../platform/desktop-mode-runtime/DesktopModeRuntimeRegistry.js';
import { surfaceRegistry } from '../../../platform/surface/SurfaceRegistry.js';
import { createPluginRuntimeApi } from '../PluginRuntimeService.js';

declare module '../../../platform/surface/types.js' {
    interface SurfaceContractMap {
        'rt-custom.main': SurfaceContractSpec<EmptySurfaceData>;
        'rt-dep.main': SurfaceContractSpec<EmptySurfaceData>;
    }
}

const ready = () => Promise.resolve(true);

describe('PluginRuntimeService', () => {
    it('registers a manifest through the plugin manager and removes it again', async () => {
        const manager = new PluginManager();
        const api = createPluginRuntimeApi(manager, pluginDomainRegistry, ready);

        const handle = await api.register({
            id: 'runtime-demo',
            name: 'Runtime Demo',
            icon: 'R',
            settingsSchema: { mode: { type: 'text', label: 'Mode', default: 'a' } }
        });
        const plugin = manager.getPlugin('runtime-demo');
        expect(plugin?.name).toBe('Runtime Demo');
        expect(plugin?.icon).toBe('R');
        expect(plugin?.platformManifest?.id).toBe('runtime-demo');
        // 运行时插件的设置要能在设置面板中显示
        expect(plugin?.settingsManifest).toBe(plugin?.platformManifest?.settingsSchema);
        expect(api.list().map(manifest => manifest.id)).toContain('runtime-demo');

        expect(api.unregister('runtime-demo')).toBe(true);
        expect(manager.getPlugin('runtime-demo')).toBeUndefined();
        expect(api.list().map(manifest => manifest.id)).not.toContain('runtime-demo');
        expect(handle.pluginId).toBe('runtime-demo');
    });

    it('lists manifests from the domain registry', () => {
        const domainRegistry = new PluginDomainRegistry();
        domainRegistry.register({ id: 'listed', name: 'Listed' });
        const api = createPluginRuntimeApi(new PluginManager(), domainRegistry, ready);

        expect(api.list().map(manifest => manifest.id)).toEqual(['listed']);
    });

    it('does not touch the manager until the host is ready', async () => {
        const registerAndInitialize = vi.fn(async () => ({ pluginId: 'late', dispose: () => undefined }));
        let release: () => void = () => undefined;
        const gate = new Promise<void>(resolve => {
            release = resolve;
        });
        const api = createPluginRuntimeApi(
            { registerAndInitialize, unregister: vi.fn() },
            new PluginDomainRegistry(),
            () => gate
        );

        const pending = api.register({ id: 'late', name: 'Late' });
        await Promise.resolve();
        expect(registerAndInitialize).not.toHaveBeenCalled();

        release();
        await pending;
        expect(registerAndInitialize).toHaveBeenCalledTimes(1);
    });

    it('refuses to unregister plugins that were not registered through this api', () => {
        const unregister = vi.fn(() => true);
        const api = createPluginRuntimeApi(
            { registerAndInitialize: vi.fn(), unregister },
            new PluginDomainRegistry(),
            ready
        );

        expect(api.unregister('builtin-plugin')).toBe(false);
        expect(unregister).not.toHaveBeenCalled();
    });

    it('rejects manifests that declare header slots', async () => {
        const registerAndInitialize = vi.fn();
        const api = createPluginRuntimeApi(
            { registerAndInitialize, unregister: vi.fn() },
            new PluginDomainRegistry(),
            ready
        );

        await expect(api.register({ id: 'hdr', name: 'Header', navigationSlots: ['headerCenter'] }))
            .rejects.toThrow(/header/i);
        await expect(api.register({ id: 'hdr', name: 'Header', navigationSlots: ['mainView', 'headerRight'] }))
            .rejects.toThrow(/header/i);
        expect(registerAndInitialize).not.toHaveBeenCalled();
    });

    it('forgets the plugin id once its handle is disposed', async () => {
        const manager = new PluginManager();
        const api = createPluginRuntimeApi(manager, pluginDomainRegistry, ready);

        const handle = await api.register({ id: 'runtime-handle', name: 'Handle' });
        handle.dispose();

        expect(manager.getPlugin('runtime-handle')).toBeUndefined();
        expect(api.unregister('runtime-handle')).toBe(false);
    });

    it('ignores a stale handle after the same id was registered again', async () => {
        const manager = new PluginManager();
        const api = createPluginRuntimeApi(manager, pluginDomainRegistry, ready);

        const first = await api.register({ id: 'runtime-stale', name: 'Stale' });
        expect(api.unregister('runtime-stale')).toBe(true);
        await api.register({ id: 'runtime-stale', name: 'Stale' });

        first.dispose();

        expect(manager.getPlugin('runtime-stale')).toBeDefined();
        expect(api.unregister('runtime-stale')).toBe(true);
        expect(manager.getPlugin('runtime-stale')).toBeUndefined();
    });

    describe('official contract namespace', () => {
        const makeApi = () => createPluginRuntimeApi(new PluginManager(), new PluginDomainRegistry(), ready);
        const Stub = defineComponent({ name: 'RuntimeStub', render: () => null });

        it('rejects runtime manifests that declare an official contract', async () => {
            await expect(
                makeApi().register({
                    id: 'rt-declare',
                    name: 'X',
                    surfaces: [{ id: 'chat.main', inputSchema: z.object({}) }]
                })
            ).rejects.toThrow(/chat\.main/);
        });

        it('rejects business renderers bound to an official contract', async () => {
            await expect(
                makeApi().register({
                    id: 'rt-business',
                    name: 'X',
                    businessRenderers: { 'chat.composer': { contractId: 'chat.composer', component: Stub } }
                })
            ).rejects.toThrow(/chat\.composer/);
        });

        it('rejects fallback renderers bound to an official contract', async () => {
            await expect(
                makeApi().register({
                    id: 'rt-fallback',
                    name: 'X',
                    fallbackRenderers: { 'settings.root': { contractId: 'settings.root', component: Stub } as never }
                })
            ).rejects.toThrow(/settings\.root/);
        });

        it('rejects a renderer whose contractId is official even under another key', async () => {
            await expect(
                makeApi().register({
                    id: 'rt-contract-id',
                    name: 'X',
                    businessRenderers: { custom: { contractId: 'stats.panel', component: Stub } } as never
                })
            ).rejects.toThrow(/stats\.panel/);
        });

        it('still accepts custom contracts', async () => {
            const handle = await makeApi().register({
                id: 'rt-custom',
                name: 'X',
                surfaces: [{ id: 'rt-custom.main', inputSchema: z.object({}) }]
            });
            expect(handle.pluginId).toBe('rt-custom');
        });
    });

    describe('cross-plugin contract dependencies', () => {
        const Stub = defineComponent({ name: 'DepStub', render: () => null });
        const providerManifest = {
            id: 'rt-dep-a',
            name: 'A',
            surfaces: [{ id: 'rt-dep.main' as const, inputSchema: z.object({}).strict() }]
        };
        const dependentManifest = {
            id: 'rt-dep-b',
            name: 'B',
            businessRenderers: { 'rt-dep.main': { contractId: 'rt-dep.main' as const, component: Stub } }
        };

        it('refuses to unregister a plugin while another plugin renders its contract, then allows it', async () => {
            const manager = new PluginManager();
            const api = createPluginRuntimeApi(manager, new PluginDomainRegistry(), ready);
            await api.register(providerManifest);
            await api.register(dependentManifest);

            expect(() => api.unregister('rt-dep-a')).toThrow(/rt-dep-b/);
            expect(manager.getPlugin('rt-dep-a')).toBeDefined();
            expect(surfaceRegistry.hasContract('rt-dep.main')).toBe(true);

            expect(api.unregister('rt-dep-b')).toBe(true);
            expect(api.unregister('rt-dep-a')).toBe(true);
            expect(manager.getPlugin('rt-dep-a')).toBeUndefined();
        });

        it('applies the same check to handle.dispose()', async () => {
            const manager = new PluginManager();
            const api = createPluginRuntimeApi(manager, new PluginDomainRegistry(), ready);
            const handleA = await api.register(providerManifest);
            const handleB = await api.register(dependentManifest);

            expect(() => handleA.dispose()).toThrow(/rt-dep-b/);
            expect(manager.getPlugin('rt-dep-a')).toBeDefined();

            handleB.dispose();
            handleA.dispose();
            expect(manager.getPlugin('rt-dep-a')).toBeUndefined();
        });

        it('does not count the plugin own renderers as dependents', async () => {
            const api = createPluginRuntimeApi(new PluginManager(), new PluginDomainRegistry(), ready);
            await api.register({
                ...providerManifest,
                businessRenderers: { 'rt-dep.main': { contractId: 'rt-dep.main' as const, component: Stub } }
            });
            expect(api.unregister('rt-dep-a')).toBe(true);
        });

        const registerReferencingMode = (modeId: string, ownerPluginId?: string): void => {
            const composition = {
                version: 1 as const,
                desktop: {
                    id: `${modeId}-node`,
                    kind: 'surface' as const,
                    contractId: 'rt-dep.main' as const,
                    input: {},
                    size: 'fill' as const,
                    visibility: 'visible' as const
                },
                mobile: { id: `${modeId}-slot`, kind: 'activity-slot' as const, size: 'fill' as const, visibility: 'visible' as const }
            };
            desktopModeRuntimeRegistry.register({
                manifest: { id: modeId, name: 'M', shell: { kind: 'traditional' }, composition },
                id: modeId,
                name: 'M',
                shellKind: 'traditional',
                navigationModel: { id: `${modeId}.nav` },
                interactionPolicy: { id: `${modeId}.policy` },
                composition,
                ownerPluginId
            });
        };

        it('refuses to unregister while a mode without owner or owned by another plugin references its contract', async () => {
            for (const ownerPluginId of [undefined, 'rt-dep-b']) {
                const manager = new PluginManager();
                const api = createPluginRuntimeApi(manager, new PluginDomainRegistry(), ready);
                await api.register(providerManifest);
                registerReferencingMode('rt-dep-mode', ownerPluginId);
                try {
                    expect(() => api.unregister('rt-dep-a')).toThrow(/rt-dep-mode/);
                    expect(manager.getPlugin('rt-dep-a')).toBeDefined();
                } finally {
                    desktopModeRuntimeRegistry.unregister('rt-dep-mode');
                }
                expect(api.unregister('rt-dep-a')).toBe(true);
            }
        });

        it('lets a plugin unregister while only its own desktop mode references its contract', async () => {
            const manager = new PluginManager();
            const api = createPluginRuntimeApi(manager, new PluginDomainRegistry(), ready);
            await api.register(providerManifest);
            registerReferencingMode('rt-dep-own-mode', 'rt-dep-a');
            try {
                expect(api.unregister('rt-dep-a')).toBe(true);
            } finally {
                desktopModeRuntimeRegistry.unregister('rt-dep-own-mode');
            }
        });

        it('leaves the internal manager.unregister (rollback path) unchecked', async () => {
            const manager = new PluginManager();
            const api = createPluginRuntimeApi(manager, new PluginDomainRegistry(), ready);
            await api.register(providerManifest);
            await api.register(dependentManifest);

            expect(manager.unregister('rt-dep-a')).toBe(true);
            expect(manager.getPlugin('rt-dep-a')).toBeUndefined();
            api.unregister('rt-dep-b');
        });
    });
});
