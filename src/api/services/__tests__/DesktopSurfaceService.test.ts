import { describe, expect, it, vi } from 'vitest';
import type { Component } from 'vue';
import { DesktopSurfaceService } from '../DesktopSurfaceService.js';
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

    it('keeps registered panel tab compatibility as a primary default Activity with the official surface contract', () => {
        const emit = vi.fn();
        const service = new DesktopSurfaceService(emit);

        service.registerPanel('card_maker', DummyPanel, { title: 'Card Maker', icon: 'id-card', defaultMode: 'tab' });
        service.openPanel('card_maker', { source: 'test' });

        expect(emit).toHaveBeenCalledWith('LAUNCH_ACTIVITY', {
            id: 'card_maker',
            title: 'Card Maker',
            icon: 'id-card',
            role: 'primary',
            target: {
                kind: 'surface',
                contractId: 'forge.workspace'
            },
            activity: {
                size: 'default',
                pageType: 'nested'
            },
            props: { source: 'test', isTabMode: true },
            dedupeKey: 'panel:card_maker'
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
