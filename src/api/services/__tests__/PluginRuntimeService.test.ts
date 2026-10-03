import { describe, expect, it, vi } from 'vitest';
import { PluginManager } from '../../../core/PluginManager.js';
import { PluginDomainRegistry, pluginDomainRegistry } from '../../../platform/plugin/PluginDomainRegistry.js';
import { createPluginRuntimeApi } from '../PluginRuntimeService.js';

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
});
