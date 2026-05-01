import { describe, expect, it, vi } from 'vitest';
import type { Component } from 'vue';
import { DesktopSurfaceService } from '../DesktopSurfaceService';

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

    it('opens a registered panel as a dynamic tab with the official surface contract when one exists', () => {
        const emit = vi.fn();
        const service = new DesktopSurfaceService(emit);

        service.registerPanel('card_maker', DummyPanel, { title: 'Card Maker', icon: 'id-card', defaultMode: 'tab' });
        service.openPanel('card_maker', { source: 'test' });

        expect(emit).toHaveBeenCalledWith('OPEN_TAB', {
            id: 'card_maker',
            name: 'Card Maker',
            icon: 'id-card',
            surfaceContractId: 'forge.workspace',
            props: { source: 'test', isTabMode: true }
        });
    });

    it('opens a registered panel as a dynamic tab with its component when no surface contract exists', () => {
        const emit = vi.fn();
        const service = new DesktopSurfaceService(emit);

        service.registerPanel('custom_panel', DummyPanel, { title: 'Custom', defaultMode: 'tab' });
        service.openPanel('custom_panel');

        expect(emit).toHaveBeenCalledWith('OPEN_TAB', {
            id: 'custom_panel',
            name: 'Custom',
            icon: '',
            component: DummyPanel,
            props: { isTabMode: true }
        });
    });

    it('opens a registered panel as a modal event by default', () => {
        const emit = vi.fn();
        const service = new DesktopSurfaceService(emit);

        service.registerPanel('sync_report', DummyPanel, { title: 'Sync Report' });
        service.openPanel('sync_report', { nodeId: 'node-1' });

        expect(emit).toHaveBeenCalledWith('OPEN_PANEL_SYNC_REPORT', { nodeId: 'node-1' });
    });
});
