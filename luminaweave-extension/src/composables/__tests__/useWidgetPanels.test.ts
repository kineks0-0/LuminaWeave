import { afterEach, describe, expect, it, vi } from 'vitest';
import { computed, effectScope, ref } from 'vue';
import { luminaWeaveApi as lwApi } from '../../api/index.js';
import { useWidgetPanels } from '../shell/useWidgetPanels.js';

describe('useWidgetPanels', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  const installResizeDocument = () => {
    const listeners: Partial<Record<'mousemove' | 'mouseup', (event: MouseEvent) => void>> = {};
    vi.stubGlobal('document', {
      body: {
        style: {
          cursor: '',
          userSelect: ''
        }
      },
      addEventListener: vi.fn((event: 'mousemove' | 'mouseup', listener: (payload: MouseEvent) => void) => {
        listeners[event] = listener;
      }),
      removeEventListener: vi.fn((event: 'mousemove' | 'mouseup') => {
        delete listeners[event];
      })
    });
    return listeners;
  };

  it('should open workspace apps in freeform layout', () => {
    const openWorkspaceApp = vi.fn();
    const scope = effectScope();
    const panels = scope.run(() => useWidgetPanels({
      activeRightPanel: ref('lumina-settings'),
      lastKnownRightPanel: ref('lumina-settings'),
      showWidgetDropdown: ref(false),
      showNexus: ref(true),
      widgetPlugins: computed(() => []),
      layoutMode: ref<'traditional' | 'freeform'>('freeform'),
      isMobile: ref(false),
      workspaceAppMap: computed(() => new Map([['widget:lumina-settings', {}]])),
      openWorkspaceApp,
      getPluginName: (pluginId) => pluginId || ''
    }))!;

    panels.switchRightPanel('lumina-settings');
    expect(openWorkspaceApp).toHaveBeenCalledWith('widget:lumina-settings');
    scope.stop();
  });

  it('should open temporary widget tabs on mobile', () => {
    const openTabSpy = vi.spyOn(lwApi.services.desktopSurface, 'openTab').mockImplementation(() => {});
    const scope = effectScope();
    const panels = scope.run(() => useWidgetPanels({
      activeRightPanel: ref('lumina-settings'),
      lastKnownRightPanel: ref('lumina-settings'),
      showWidgetDropdown: ref(false),
      showNexus: ref(true),
      widgetPlugins: computed(() => [{
        id: 'lumina-settings',
        name: '设置',
        icon: 'S',
        component: {} as never,
        platformManifest: {
          id: 'lumina-settings',
          name: '设置面板',
          primarySurface: 'settings.root' as const
        }
      }]),
      layoutMode: ref<'traditional' | 'freeform'>('traditional'),
      isMobile: ref(true),
      workspaceAppMap: computed(() => new Map()),
      openWorkspaceApp: vi.fn(),
      getPluginName: (pluginId) => pluginId || ''
    }))!;

    panels.switchRightPanel('lumina-settings');
    expect(openTabSpy).toHaveBeenCalledTimes(1);
    expect(openTabSpy.mock.calls[0]?.[0].id).toBe('mobile-widget:lumina-settings');
    scope.stop();
  });

  it('derives registered panel navigation and mobile input from panel metadata', () => {
    const desktopSurface = lwApi.services.desktopSurface;
    const openTabSpy = vi.spyOn(desktopSurface, 'openTab').mockImplementation(() => {});
    desktopSurface.registerPanel('test_aux_panel', {} as never, {
      title: 'Auxiliary panel',
      icon: 'A',
      navigation: { group: 'Auxiliary' },
      defaultInput: { kind: 'memory' }
    });
    desktopSurface.registerPanel('test_hidden_panel', {} as never, {
      title: 'Hidden panel',
      navigation: { hidden: true }
    });

    const scope = effectScope();
    const panels = scope.run(() => useWidgetPanels({
      activeRightPanel: ref('lumina-settings'),
      lastKnownRightPanel: ref('lumina-settings'),
      showWidgetDropdown: ref(false),
      showNexus: ref(true),
      widgetPlugins: computed(() => []),
      layoutMode: ref<'traditional' | 'freeform'>('traditional'),
      isMobile: ref(true),
      workspaceAppMap: computed(() => new Map()),
      openWorkspaceApp: vi.fn(),
      getPluginName: (pluginId) => pluginId || ''
    }))!;

    expect(panels.widgetGroups.value).toContainEqual({
      label: 'Auxiliary',
      items: [{ id: 'test_aux_panel', name: 'Auxiliary panel', icon: 'A' }]
    });
    expect(panels.widgetPanelList.value.some((item) => item.id === 'test_hidden_panel')).toBe(false);

    panels.switchRightPanel('test_aux_panel');
    expect(openTabSpy).toHaveBeenLastCalledWith(expect.objectContaining({
      id: 'mobile-widget:test_aux_panel',
      props: expect.objectContaining({ kind: 'memory' })
    }));

    scope.stop();
    desktopSurface.registeredPanels.delete('test_aux_panel');
    desktopSurface.registeredPanels.delete('test_hidden_panel');
  });

  it('should switch the active right panel on desktop traditional layout', () => {
    const activeRightPanel = ref('lumina-settings');
    const scope = effectScope();
    const panels = scope.run(() => useWidgetPanels({
      activeRightPanel,
      lastKnownRightPanel: ref('lumina-settings'),
      showWidgetDropdown: ref(true),
      showNexus: ref(true),
      widgetPlugins: computed(() => []),
      layoutMode: ref<'traditional' | 'freeform'>('traditional'),
      isMobile: ref(false),
      workspaceAppMap: computed(() => new Map()),
      openWorkspaceApp: vi.fn(),
      getPluginName: (pluginId) => pluginId || ''
    }))!;

    panels.switchRightPanel('lumina-stats');
    expect(activeRightPanel.value).toBe('lumina-stats');
    expect(panels.showWidgetDropdown.value).toBe(false);
    scope.stop();
  });

  it('allows telegram right panel resize beyond the old fixed 800px cap', () => {
    const listeners = installResizeDocument();
    Object.defineProperty(window, 'innerWidth', { value: 2000, configurable: true });
    const scope = effectScope();
    const panels = scope.run(() => useWidgetPanels({
      activeRightPanel: ref('telegram-profile'),
      lastKnownRightPanel: ref('telegram-profile'),
      showWidgetDropdown: ref(false),
      showNexus: ref(true),
      widgetPlugins: computed(() => []),
      layoutMode: ref<'traditional' | 'freeform'>('traditional'),
      isMobile: ref(false),
      activeDesktopModeId: ref('telegram'),
      workspaceAppMap: computed(() => new Map()),
      openWorkspaceApp: vi.fn(),
      getPluginName: (pluginId) => pluginId || ''
    }))!;

    panels.initResize();
    listeners.mousemove?.({ clientX: 1100 } as MouseEvent);
    expect(panels.widgetWidth.value).toBe(900);
    listeners.mouseup?.({} as MouseEvent);
    scope.stop();
  });

  it('keeps telegram left and right panel resizing from covering the main chat width', () => {
    const listeners = installResizeDocument();
    Object.defineProperty(window, 'innerWidth', { value: 1200, configurable: true });
    const scope = effectScope();
    const panels = scope.run(() => useWidgetPanels({
      activeRightPanel: ref('telegram-profile'),
      lastKnownRightPanel: ref('telegram-profile'),
      showWidgetDropdown: ref(false),
      showNexus: ref(true),
      widgetPlugins: computed(() => []),
      layoutMode: ref<'traditional' | 'freeform'>('traditional'),
      isMobile: ref(false),
      activeDesktopModeId: ref('telegram'),
      workspaceAppMap: computed(() => new Map()),
      openWorkspaceApp: vi.fn(),
      getPluginName: (pluginId) => pluginId || ''
    }))!;

    panels.widgetWidth.value = 360;
    panels.initLeftRailResize();
    listeners.mousemove?.({ clientX: 900 } as MouseEvent);
    expect(panels.telegramLeftRailWidth.value).toBeLessThanOrEqual(1200 - panels.widgetWidth.value - 520);
    expect(panels.telegramLeftRailWidth.value).toBeGreaterThanOrEqual(260);
    listeners.mouseup?.({} as MouseEvent);
    scope.stop();
  });
});
