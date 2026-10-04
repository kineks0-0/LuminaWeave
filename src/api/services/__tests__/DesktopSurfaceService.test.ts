import { describe, expect, it, vi } from 'vitest';
import { computed, type Component } from 'vue';
import { z } from 'zod';
import { DesktopSurfaceService } from '../DesktopSurfaceService.js';
import { getDesktopMode } from '../../../desktop-modes/core/registry.js';
import type { DesktopModeManifest } from '../../../desktop-modes/core/types.js';
import { surfaceRegistry } from '../../../platform/surface/SurfaceRegistry.js';
import type { EmptySurfaceData, SurfaceContractSpec } from '../../../platform/surface/types.js';

declare module '../../../platform/surface/types.js' {
    interface SurfaceContractMap {
        'custom.surface': SurfaceContractSpec<EmptySurfaceData>;
    }
}

const DummyPanel = { name: 'DummyPanel' } as Component;

describe('DesktopSurfaceService', () => {
    it('keeps registered panels in the service registry', () => {
        const service = new DesktopSurfaceService(vi.fn());

        service.registerPanel('panel-a', DummyPanel, { title: 'Panel A', icon: 'box' });

        expect(service.registeredPanels.get('panel-a')).toEqual({
            id: 'panel-a',
            component: DummyPanel,
            config: { title: 'Panel A', icon: 'box' }
        });
    });

    it('does not infer a surface contract from a registered panel id', () => {
        const emit = vi.fn();
        const service = new DesktopSurfaceService(emit);

        surfaceRegistry.registerContract({
            id: 'custom.surface',
            inputSchema: z.object({}).strict()
        });
        service.registerPanel('custom.surface', DummyPanel, { title: 'Custom', icon: 'id-card', defaultMode: 'tab' });
        service.openPanel('custom.surface', { source: 'test' });

        expect(emit).toHaveBeenCalledWith('LAUNCH_ACTIVITY', {
            id: 'custom.surface',
            title: 'Custom',
            icon: 'id-card',
            role: 'primary',
            target: {
                kind: 'component',
                component: DummyPanel
            },
            activity: {
                size: 'default',
                pageType: 'nested'
            },
            props: { source: 'test', isTabMode: true },
            dedupeKey: 'panel:custom.surface'
        });
    });

    it('keeps registered panel tab compatibility as a primary component Activity when no surface contract exists', () => {
        const emit = vi.fn();
        const service = new DesktopSurfaceService(emit);

        service.registerPanel('custom_panel', DummyPanel, { title: 'Custom', defaultMode: 'tab' });
        service.openPanel('custom_panel');

        expect(emit).toHaveBeenCalledWith('LAUNCH_ACTIVITY', {
            id: 'custom_panel',
            title: 'Custom',
            icon: '',
            role: 'primary',
            target: {
                kind: 'component',
                component: DummyPanel
            },
            activity: {
                size: 'default',
                pageType: 'nested'
            },
            props: { isTabMode: true },
            dedupeKey: 'panel:custom_panel'
        });
    });

    it('launches a registered panel with an explicit surface contract', () => {
        const emit = vi.fn();
        const service = new DesktopSurfaceService(emit);

        service.registerPanel('custom_panel', DummyPanel, {
            title: 'Custom',
            defaultMode: 'tab',
            surfaceContractId: 'custom.surface'
        });
        service.openPanel('custom_panel');

        expect(emit).toHaveBeenCalledWith('LAUNCH_ACTIVITY', {
            id: 'custom_panel',
            title: 'Custom',
            icon: '',
            role: 'primary',
            target: {
                kind: 'surface',
                contractId: 'custom.surface'
            },
            activity: {
                size: 'default',
                pageType: 'nested'
            },
            props: { isTabMode: true },
            dedupeKey: 'panel:custom_panel'
        });
    });

    it('opens a registered panel as a modal event by default', () => {
        const emit = vi.fn();
        const service = new DesktopSurfaceService(emit);

        service.registerPanel('sync_report', DummyPanel, { title: 'Sync Report' });
        service.openPanel('sync_report', { nodeId: 'node-1' });

        expect(emit).toHaveBeenCalledWith('OPEN_PANEL_SYNC_REPORT', { nodeId: 'node-1' });
    });

    it('wraps legacy openTab calls as primary Activity intents', () => {
        const emit = vi.fn();
        const service = new DesktopSurfaceService(emit);

        service.openTab({
            id: 'settings-tab',
            name: 'Settings',
            icon: 'gear',
            surfaceContractId: 'settings.root',
            props: { activity: { size: 'default', pageType: 'standalone' } }
        });

        expect(emit).toHaveBeenCalledWith('LAUNCH_ACTIVITY', {
            id: 'settings-tab',
            title: 'Settings',
            icon: 'gear',
            role: 'primary',
            target: {
                kind: 'surface',
                contractId: 'settings.root'
            },
            activity: {
                size: 'default',
                pageType: 'standalone'
            },
            props: { activity: { size: 'default', pageType: 'standalone' } },
            dedupeKey: 'tab:settings-tab'
        });
    });

    it('maps legacy small tab mode to support Activity intents', () => {
        const emit = vi.fn();
        const service = new DesktopSurfaceService(emit);

        service.openTab({
            id: 'stats-tab',
            name: 'Stats',
            icon: '',
            surfaceContractId: 'stats.panel',
            props: { mode: 'small' }
        });

        expect(emit).toHaveBeenCalledWith('LAUNCH_ACTIVITY', expect.objectContaining({
            id: 'stats-tab',
            role: 'support',
            activity: {
                size: 'small',
                pageType: 'nested'
            }
        }));
    });

    it('rejects tabs without an explicit surface contract or component', () => {
        const emit = vi.fn();
        const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
        const service = new DesktopSurfaceService(emit);

        service.openTab({
            id: 'unregistered-tab',
            name: 'Unregistered',
            icon: ''
        });

        expect(emit).not.toHaveBeenCalled();
        expect(consoleError).toHaveBeenCalledWith(
            '[DesktopSurfaceService] Tab target unavailable',
            { tabId: 'unregistered-tab' }
        );
        consoleError.mockRestore();
    });
});

describe('DesktopSurfaceService panel unregistration', () => {
    it('removes a panel only when the entry reference matches', () => {
        const service = new DesktopSurfaceService(vi.fn());
        service.registerPanel('panel-b', DummyPanel, { title: 'B' });
        const stale = service.registeredPanels.get('panel-b')!;
        service.registerPanel('panel-b', DummyPanel, { title: 'B2' });

        service.unregisterPanel('panel-b', stale);
        expect(service.registeredPanels.get('panel-b')?.config.title).toBe('B2');

        service.unregisterPanel('panel-b');
        expect(service.registeredPanels.has('panel-b')).toBe(false);
    });

    it('notifies reactive readers on register and unregister', () => {
        const service = new DesktopSurfaceService(vi.fn());
        const ids = computed(() => Array.from(service.registeredPanels.keys()));
        expect(ids.value).toEqual([]);

        service.registerPanel('panel-c', DummyPanel, { title: 'C' });
        expect(ids.value).toEqual(['panel-c']);

        service.unregisterPanel('panel-c');
        expect(ids.value).toEqual([]);
    });

    it('registerDesktopMode returns a disposer that unregisters the mode and emits change events', () => {
        const emit = vi.fn();
        const service = new DesktopSurfaceService(emit);
        const manifest: DesktopModeManifest = {
            id: 'svc-mode',
            name: 'Svc',
            shell: { kind: 'traditional' },
            composition: {
                version: 1,
                desktop: { id: 'svc-d', kind: 'activity-slot', size: 'fill', visibility: 'visible' },
                mobile: { id: 'svc-m', kind: 'activity-slot', size: 'fill', visibility: 'visible' }
            }
        };

        const dispose = service.registerDesktopMode(manifest);
        expect(getDesktopMode('svc-mode')).toBe(manifest);
        expect(emit).toHaveBeenCalledWith('DESKTOP_MODES_CHANGED', 'svc-mode');
        emit.mockClear();

        dispose();
        dispose();

        expect(getDesktopMode('svc-mode')).toBeUndefined();
        expect(emit).toHaveBeenCalledWith('SETTINGS_CHANGED');
        expect(emit).toHaveBeenCalledWith('DESKTOP_MODES_CHANGED', 'svc-mode');
        expect(emit.mock.calls.filter(call => call[0] === 'DESKTOP_MODES_CHANGED')).toHaveLength(1);
    });

    it('rejects runtime-owned mode packages that override official surface contracts', () => {
        const service = new DesktopSurfaceService(vi.fn());
        const manifest: DesktopModeManifest = {
            id: 'svc-mode-owned-override',
            name: 'Svc Owned Override',
            shell: { kind: 'traditional' },
            composition: {
                version: 1,
                desktop: { id: 'svc-owned-d', kind: 'activity-slot', size: 'fill', visibility: 'visible' },
                mobile: { id: 'svc-owned-m', kind: 'activity-slot', size: 'fill', visibility: 'visible' }
            }
        };

        expect(() => service.registerDesktopMode({
            manifest,
            componentOverrides: [{ contractId: 'telegram.infoPanel', component: DummyPanel }]
        }, 'plugin-x')).toThrow(/official surface contract/i);

        expect(getDesktopMode(manifest.id)).toBeUndefined();
    });

    it('allows builtin-owned mode packages to override official surface contracts when cleaned up', () => {
        const service = new DesktopSurfaceService(vi.fn());
        const manifest: DesktopModeManifest = {
            id: 'svc-mode-builtin-override',
            name: 'Svc Builtin Override',
            shell: { kind: 'traditional' },
            composition: {
                version: 1,
                desktop: { id: 'svc-builtin-d', kind: 'activity-slot', size: 'fill', visibility: 'visible' },
                mobile: { id: 'svc-builtin-m', kind: 'activity-slot', size: 'fill', visibility: 'visible' }
            }
        };

        const dispose = service.registerDesktopMode({
            manifest,
            componentOverrides: [{ contractId: 'telegram.infoPanel', component: DummyPanel }]
        });

        expect(getDesktopMode(manifest.id)).toBe(manifest);
        dispose();
        expect(getDesktopMode(manifest.id)).toBeUndefined();
    });
});
