import { describe, expect, it, vi } from 'vitest';
import { PluginManager } from '../../../core/PluginManager.js';
import { createTestInitContextHarness } from '../../../core/__tests__/testInitContext.js';
import { createRuntimePlugin } from '../createRuntimePlugin.js';

describe('createRuntimePlugin', () => {
    it('hands manifest.init to PluginManager with an init context', async () => {
        const manager = new PluginManager();
        manager.setInitContextFactory(createTestInitContextHarness().factory);
        const init = vi.fn();
        const plugin = createRuntimePlugin({ id: 'runtime-ctx-plugin', name: 'Runtime', init });

        expect(plugin.platformManifest?.init).toBe(init);
        const handle = await manager.registerAndInitialize(plugin);

        expect(init).toHaveBeenCalledWith(expect.objectContaining({ pluginId: 'runtime-ctx-plugin' }));
        handle.dispose();
    });
});
