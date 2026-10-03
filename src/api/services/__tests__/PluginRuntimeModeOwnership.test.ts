import { defineComponent } from 'vue';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { PluginManager } from '../../../core/PluginManager.js';
import { createTestInitContextHarness } from '../../../core/__tests__/testInitContext.js';
import { getDesktopMode } from '../../../desktop-modes/core/registry.js';
import type { DesktopModeManifest } from '../../../desktop-modes/core/types.js';
import { desktopModeRuntimeRegistry } from '../../../platform/desktop-mode-runtime/DesktopModeRuntimeRegistry.js';
import { initializeDesktopModeRuntime } from '../../../platform/desktop-mode-runtime/initializeDesktopModeRuntime.js';
import { initializeSurfaceRuntime } from '../../../platform/surface/initializeSurfaceRuntime.js';
import type { EmptySurfaceData, SurfaceContractSpec } from '../../../platform/surface/types.js';
import type { LuminaPlugin } from '../../../types/plugin.js';
import { queryPluginDependents } from '../PluginRuntimeService.js';

vi.mock('../../../shell/modes/telegram/TelegramUserInfoPanel.vue', () => ({
    default: defineComponent({ name: 'TelegramUserInfoPanelStub', template: '<div />' })
}));
vi.mock('../../../shell/traditional/TraditionalShell.vue', () => ({
    default: defineComponent({ name: 'TraditionalShellStub', template: '<div />' })
}));
vi.mock('../../../shell/freeform/FreeformShell.vue', () => ({
    default: defineComponent({ name: 'FreeformShellStub', template: '<div />' })
}));

declare module '../../../platform/surface/types.js' {
    interface SurfaceContractMap {
        'own-mode.main': SurfaceContractSpec<EmptySurfaceData>;
    }
}

const Stub = defineComponent({ name: 'OwnModeStub', render: () => null });

const createModeManifest = (id: string): DesktopModeManifest => ({
    id,
    name: id,
    shell: { kind: 'traditional' },
    composition: {
        version: 1,
        desktop: { id: `${id}-node`, kind: 'surface', contractId: 'own-mode.main', input: {}, size: 'fill', visibility: 'visible' },
        mobile: { id: `${id}-slot`, kind: 'activity-slot', size: 'fill', visibility: 'visible' }
    }
});

describe('plugin-registered desktop modes and contract dependency checks', () => {
    beforeAll(() => {
        initializeSurfaceRuntime();
        initializeDesktopModeRuntime();
    });

    const createPlugin = (id: string, modeId: string, declaresContract: boolean): LuminaPlugin => ({
        id,
        name: id,
        icon: '',
        component: Stub,
        platformManifest: {
            id,
            name: id,
            surfaces: declaresContract ? [{ id: 'own-mode.main', inputSchema: z.object({}).strict() }] : [],
            init: context => {
                context.desktopModes.register(createModeManifest(modeId));
            }
        }
    });

    it('does not block a plugin that registered the referencing mode itself, and revokes that mode with it', async () => {
        const harness = createTestInitContextHarness();
        const manager = new PluginManager();
        manager.setInitContextFactory(harness.factory);
        const handle = await manager.registerAndInitialize(createPlugin('own-mode-a', 'own-mode-a-mode', true));
        expect(getDesktopMode('own-mode-a-mode')).toBeDefined();
        expect(desktopModeRuntimeRegistry.get('own-mode-a-mode')?.ownerPluginId).toBe('own-mode-a');

        expect(queryPluginDependents('own-mode-a')).toEqual([]);
        handle.dispose();

        expect(getDesktopMode('own-mode-a-mode')).toBeUndefined();
        expect(desktopModeRuntimeRegistry.get('own-mode-a-mode')).toBeUndefined();
    });

    it('blocks a plugin whose contract is referenced by a mode that another plugin registered', async () => {
        const harness = createTestInitContextHarness();
        const manager = new PluginManager();
        manager.setInitContextFactory(harness.factory);
        const providerPlugin = createPlugin('own-mode-provider', 'unused', true);
        const providerHandle = await manager.registerAndInitialize({
            ...providerPlugin,
            platformManifest: providerPlugin.platformManifest && { ...providerPlugin.platformManifest, init: undefined }
        });
        const consumerHandle = await manager.registerAndInitialize(createPlugin('own-mode-b', 'own-mode-b-mode', false));

        expect(queryPluginDependents('own-mode-provider')).toEqual(['desktop mode "own-mode-b-mode" composition']);

        consumerHandle.dispose();
        expect(queryPluginDependents('own-mode-provider')).toEqual([]);
        providerHandle.dispose();
    });
});
