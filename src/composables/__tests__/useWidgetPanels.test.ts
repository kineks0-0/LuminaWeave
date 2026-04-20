import { afterEach, describe, expect, it, vi } from 'vitest';
import { computed, effectScope, ref } from 'vue';
import { luminaWeaveApi as lwApi } from '../../api/index';
import { useWidgetPanels } from '../shell/useWidgetPanels';

describe('useWidgetPanels', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

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
    const openTabSpy = vi.spyOn(lwApi, 'openTab').mockImplementation(() => {});
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
        slots: ['widget'],
        component: {} as never
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
});
