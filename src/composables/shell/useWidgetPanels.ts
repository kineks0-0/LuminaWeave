import { computed, onUnmounted, ref, watch, getCurrentInstance, type Component, type ComputedRef, type Ref } from 'vue';
import { lwStorage } from '../../api/storage.js';
import { luminaWeaveApi as lwApi } from '../../api/index.js';
import { pluginManager } from '../../core/PluginManager.js';
import { getPrimarySurfaceContractIdForPlugin } from '../../platform/plugin/officialPluginSurfaces.js';
import type { LuminaPlugin } from '../../types/plugin.js';
import type { RegisteredPanelEntry, WidgetPanelGroup, WidgetPanelItem, WidgetPluginEntry } from '../../shell/types.js';

const RIGHT_PANEL_STORAGE_KEY = 'luminaWeave.widgetWidth';
const RIGHT_PANEL_DEFAULT_WIDTH = 360;
const RIGHT_PANEL_MIN_WIDTH = 300;
const RIGHT_PANEL_MAX_WIDTH = 800;
const desktopSurfaceService = lwApi.services.desktopSurface;

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), Math.max(min, max));
type ResizeStartState = {
  pointerX: number;
  width: number;
};

const toRegisteredPanelEntry = (panelId: string): RegisteredPanelEntry | null => {
  const panel = desktopSurfaceService.registeredPanels.get(panelId);
  if (!panel) {
    return null;
  }

  return {
    id: panel.id,
    component: panel.component as Component,
    config: panel.config
  };
};

export const useWidgetPanels = ({
  activeRightPanel,
  lastKnownRightPanel,
  showWidgetDropdown,
  widgetPlugins,
  layoutMode,
  isMobile,
  workspaceAppMap,
  openWorkspaceApp,
  getPluginName
}: {
  activeRightPanel: Ref<string>;
  lastKnownRightPanel: Ref<string>;
  showWidgetDropdown: Ref<boolean>;
  widgetPlugins: ComputedRef<LuminaPlugin[]>;
  layoutMode: Ref<'traditional' | 'freeform'> | ComputedRef<'traditional' | 'freeform'>;
  isMobile: Ref<boolean>;
  workspaceAppMap: ComputedRef<Map<string, unknown>>;
  openWorkspaceApp: (appId: string) => void;
  getPluginName: (pluginId: string | null) => string;
}) => {
  const widgetWidth = ref(Number(lwStorage.get(RIGHT_PANEL_STORAGE_KEY, RIGHT_PANEL_DEFAULT_WIDTH, 'Global')));
  const isResizing = ref(false);
  let rightResizeStart: ResizeStartState | null = null;

  const activeWidgetPlugin = computed<WidgetPluginEntry | null>(() => (
    pluginManager.getPlugin(activeRightPanel.value) ?? null
  ));

  const activeRegisteredPanel = computed<RegisteredPanelEntry | null>(() => {
    if (activeWidgetPlugin.value) return null;
    return toRegisteredPanelEntry(activeRightPanel.value);
  });

  const registeredPanelItems = computed<WidgetPanelItem[]>(() => {
    const items: WidgetPanelItem[] = [];

    for (const [id, panel] of desktopSurfaceService.registeredPanels) {
      if (panel.config.navigation?.hidden) continue;
      items.push({
        id,
        name: panel.config.title,
        icon: panel.config.icon || ''
      });
    }

    return items;
  });

  const widgetPanelList = computed<WidgetPanelItem[]>(() => {
    const widgetItems = widgetPlugins.value.map((plugin) => ({
      id: plugin.id,
      name: plugin.name,
      icon: plugin.icon
    }));
    const merged = [...widgetItems];
    const seen = new Set(merged.map((item) => item.id));
    const extraItems = registeredPanelItems.value;

    for (const item of extraItems) {
      if (seen.has(item.id)) continue;
      merged.push(item);
      seen.add(item.id);
    }

    return merged;
  });

  const widgetGroups = computed<WidgetPanelGroup[]>(() => {
    const groups: WidgetPanelGroup[] = [];
    const pluginItems = widgetPlugins.value.map((plugin) => ({
      id: plugin.id,
      name: plugin.name,
      icon: plugin.icon
    }));
    const panelGroups = new Map<string, WidgetPanelItem[]>();
    for (const item of registeredPanelItems.value) {
      const panel = desktopSurfaceService.registeredPanels.get(item.id);
      const group = panel?.config.navigation?.group || '面板';
      const items = panelGroups.get(group) || [];
      items.push(item);
      panelGroups.set(group, items);
    }

    if (pluginItems.length > 0) {
      groups.push({ label: '插件', items: pluginItems });
    }
    panelGroups.forEach((items, label) => groups.push({ label, items }));

    return groups;
  });

  const createMobileWidgetTabProps = (panelId: string): Record<string, unknown> => {
    return toRegisteredPanelEntry(panelId)?.config.defaultInput || {};
  };

  const openTemporaryWidgetTab = (panelId: string) => {
    const plugin = widgetPlugins.value.find((item) => item.id === panelId);
    if (plugin) {
      const surfaceContractId = getPrimarySurfaceContractIdForPlugin(plugin);
      if (!surfaceContractId) {
        console.error('[SurfaceRuntime] Plugin primary surface unavailable', { pluginId: plugin.id });
        return;
      }
      activeRightPanel.value = panelId;
      desktopSurfaceService.openTab({
        id: `mobile-widget:${panelId}`,
        name: plugin.name,
        icon: plugin.icon,
        surfaceContractId,
        props: {
          activity: { size: 'small', pageType: 'nested' },
          isMobile: true,
          isTemporaryWidgetTab: true
        }
      });
      return;
    }

    const registered = toRegisteredPanelEntry(panelId);
    if (registered) {
      const surfaceContractId = registered.config.surfaceContractId;
      desktopSurfaceService.openTab({
        id: `mobile-widget:${panelId}`,
        name: registered.config.title,
        icon: registered.config.icon || '',
        ...(surfaceContractId ? { surfaceContractId } : { component: registered.component }),
        props: {
          activity: { size: 'small', pageType: 'nested' },
          isMobile: true,
          isTemporaryWidgetTab: true,
          ...createMobileWidgetTabProps(panelId)
        }
      });
    }
  };

  const resolveWorkspacePanelAppId = (panelId: string) => {
    const widgetId = `widget:${panelId}`;
    const pluginId = `plugin:${panelId}`;
    return workspaceAppMap.value.has(widgetId) ? widgetId : pluginId;
  };

  const switchRightPanel = (panelId: string) => {
    if (layoutMode.value === 'freeform') {
      openWorkspaceApp(resolveWorkspacePanelAppId(panelId));
      return;
    }
    if (isMobile.value) {
      openTemporaryWidgetTab(panelId);
      return;
    }
    activeRightPanel.value = panelId;
    showWidgetDropdown.value = false;
  };

  const handleOpenWidget = (panelId: string) => {
    if (isMobile.value) {
      openTemporaryWidgetTab(panelId);
      return;
    }

    switchRightPanel(panelId);
  };

  const closeWidgetPanel = () => {
    activeRightPanel.value = 'none';
    showWidgetDropdown.value = false;
  };

  const handleResize = (event: MouseEvent) => {
    if (!isResizing.value) return;
    const newWidth = rightResizeStart
      ? rightResizeStart.width + (rightResizeStart.pointerX - event.clientX)
      : window.innerWidth - event.clientX;
    widgetWidth.value = clamp(newWidth, RIGHT_PANEL_MIN_WIDTH, RIGHT_PANEL_MAX_WIDTH);
  };

  const stopResize = () => {
    if (!isResizing.value) return;
    isResizing.value = false;
    rightResizeStart = null;
    document.removeEventListener('mousemove', handleResize);
    document.removeEventListener('mouseup', stopResize);
    document.body.style.cursor = '';
    document.body.style.userSelect = '';
    lwStorage.set(RIGHT_PANEL_STORAGE_KEY, widgetWidth.value, 'Global');
  };

  const initResize = (event?: MouseEvent) => {
    rightResizeStart = event
      ? { pointerX: event.clientX, width: widgetWidth.value }
      : null;
    isResizing.value = true;
    document.addEventListener('mousemove', handleResize);
    document.addEventListener('mouseup', stopResize);
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
  };

  watch(activeRightPanel, (value) => {
    if (value !== 'none') {
      lastKnownRightPanel.value = value;
      lwStorage.set('luminaWeave.activeRightPanel', value, 'Global');
    }
  });

  if (getCurrentInstance()) {
    onUnmounted(() => {
      stopResize();
    });
  }

  return {
    activeRightPanel,
    lastKnownRightPanel,
    showWidgetDropdown,
    widgetWidth,
    isResizing,
    activeWidgetPlugin,
    activeRegisteredPanel,
    registeredPanelItems,
    widgetPanelList,
    widgetGroups,
    openTemporaryWidgetTab,
    switchRightPanel,
    handleOpenWidget,
    closeWidgetPanel,
    initResize,
    stopResize,
    getPluginName
  };
};
