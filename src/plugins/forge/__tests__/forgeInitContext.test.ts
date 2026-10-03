import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { PluginManager } from '../../../core/PluginManager.js';
import { createTestInitContextHarness } from '../../../core/__tests__/testInitContext.js';
import { initializeSurfaceRuntime } from '../../../platform/surface/initializeSurfaceRuntime.js';
import { FORGE_AUX_PANEL_META, FORGE_AUX_PANEL_ORDER } from '../forgeAuxPanels.js';
import forgePlugin from '../index.js';

describe('forge plugin init(context)', () => {
    const manager = new PluginManager();
    const harness = createTestInitContextHarness();
    manager.setInitContextFactory(harness.factory);

    beforeAll(() => {
        initializeSurfaceRuntime();
    });
    afterEach(() => {
        manager.unregister(forgePlugin.id);
    });

    it('does not keep a legacy init and exposes init through the platform manifest', () => {
        expect(forgePlugin.init).toBeUndefined();
        expect(typeof forgePlugin.platformManifest?.init).toBe('function');
    });

    it('registers the card maker and aux panels through the context and removes them on unregister', async () => {
        setActivePinia(createPinia());
        await manager.registerAndInitialize(forgePlugin);

        const panels = harness.desktopSurface.registeredPanels;
        expect(panels.has('card_maker')).toBe(true);
        FORGE_AUX_PANEL_ORDER.forEach(kind => {
            expect(panels.has(FORGE_AUX_PANEL_META[kind].id)).toBe(true);
        });

        manager.unregister(forgePlugin.id);

        expect(panels.has('card_maker')).toBe(false);
        FORGE_AUX_PANEL_ORDER.forEach(kind => {
            expect(panels.has(FORGE_AUX_PANEL_META[kind].id)).toBe(false);
        });
    });
});
