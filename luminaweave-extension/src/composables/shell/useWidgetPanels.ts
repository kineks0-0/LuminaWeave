import { computed, onUnmounted, ref, watch, getCurrentInstance, type Component, type ComputedRef, type Ref } from 'vue';
import { lwStorage } from '../../api/storage.js';
import { luminaWeaveApi as lwApi } from '../../api/index.js';
import { pluginManager } from '../../core/PluginManager.js';
import { getPrimarySurfaceContractIdForPlugin } from '../../platform/plugin/officialPluginSurfaces.js';
import { getSurfaceContractIdForRegisteredPanel } from '../../platform/plugin/officialPanelSurfaces.js';
import type { LuminaPlugin } from '../../types/plugin.js';
import type { RegisteredPanelEntry, WidgetPanelGroup, WidgetPanelItem, WidgetPluginEntry } from '../../shell/types.js';

const FORGE_AUX_PANEL_PATTERN = /^forge_(lorebook|memory|export|post_tracks|test_chat)$/;
const TELEGRAM_LEFT_RAIL_STORAGE_KEY = 'luminaWeave.telegram.leftRailWidth';
const RIGHT_PANEL_STORAGE_KEY = 'luminaWeave.widgetWidth';
const TELEGRAM_LEFT_RAIL_DEFAULT_WIDTH = 320;
const TELEGRAM_LEFT_RAIL_MIN_WIDTH = 260;
const TELEGRAM_RIGHT_PANEL_DEFAULT_WIDTH = 360;
const TELEGRAM_RIGHT_PANEL_MIN_WIDTH = 280;
const TELEGRAM_MAIN_MIN_WIDTH = 520;
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
  showNexus,
  widgetPlugins,
  layoutMode,
  isMobile,
  activeDesktopModeId,
  workspaceAppMap,
  openWorkspaceApp,
  getPluginName
}: {
  activeRightPanel: Ref<string>;
  lastKnownRightPanel: Ref<string>;
  showWidgetDropdown: Ref<boolean>;
  showNexus: Ref<boolean>;
  widgetPlugins: ComputedRef<LuminaPlugin[]>;
  layoutMode: Ref<'traditional' | 'freeform'> | ComputedRef<'traditional' | 'freeform'>;
  isMobile: Ref<boolean>;
  activeDesktopModeId?: Ref<string> | ComputedRef<string>;
  workspaceAppMap: ComputedRef<Map<string, unknown>>;
  openWorkspaceApp: (appId: string) => void;
  getPluginName: (pluginId: string | null) => string;
}) => {
  const widgetWidth = ref(Number(lwStorage.get(RIGHT_PANEL_STORAGE_KEY, TELEGRAM_RIGHT_PANEL_DEFAULT_WIDTH, 'Global')));
  const telegramLeftRailWidth = ref(Number(lwStorage.get(TELEGRAM_LEFT_RAIL_STORAGE_KEY, TELEGRAM_LEFT_RAIL_DEFAULT_WIDTH, 'Global')));
  const isResizing = ref(false);
  const isTelegramLeftRailResizing = ref(false);
  let rightResizeStart: ResizeStartState | null = null;
  let leftResizeStart: ResizeStartState | null = null;
  const isTelegramDesktopMode = () => (
    activeDesktopModeId?.value === 'telegram'
    && layoutMode.value === 'traditional'
    && !isMobile.value
  );

  const getTelegramRightPanelMaxWidth = () => (
    window.innerWidth - telegramLeftRailWidth.value - TELEGRAM_MAIN_MIN_WIDTH
  );

  const getTelegramLeftRailMaxWidth = () => (
    window.innerWidth - widgetWidth.value - TELEGRAM_MAIN_MIN_WIDTH
  );

  const activeWidgetPlugin = computed<WidgetPluginEntry | null>(() => (
    pluginManager.getPlugin(activeRightPanel.value) ?? null
  ));

  const activeRegisteredPanel = computed<RegisteredPanelEntry | null>(() => {
    if (activeWidgetPlugin.value) return null;
    return toRegisteredPanelEntry(activeRightPanel.value);
  });

  const activeForgeAuxKind = computed<string | null>(() => {
    const match = activeRightPanel.value.match(FORGE_AUX_PANEL_PATTERN);
    return match ? match[1] : null;
  });

  const forgeAuxPanelItems = computed<WidgetPanelItem[]>(() => {
    const items: WidgetPanelItem[] = [];
    const forgeAuxKinds = ['lorebook', 'memory', 'export', 'post_tracks', 'test_chat'] as const;

    for (const kind of forgeAuxKinds) {
      const panelId = `forge_${kind}`;
      const registered = toRegisteredPanelEntry(panelId);
      if (registered) {
        items.push({
          id: panelId,
          name: registered.config.title,
          icon: registered.config.icon || ''
        });
      }
    }

    return items;
  });

  const registeredPanelItems = computed<WidgetPanelItem[]>(() => {
    const items: WidgetPanelItem[] = [];
    const excludeIds = new Set(['card_maker', 'conflict', 'sync_report', ...forgeAuxPanelItems.value.map((item) => item.id)]);

    for (const [id, panel] of desktopSurfaceService.registeredPanels) {
      if (excludeIds.has(id)) continue;
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
    const cardMakerPanel = toRegisteredPanelEntry('card_maker');
    const merged = [...widgetItems];
    const seen = new Set(merged.map((item) => item.id));
    const extraItems = [
      ...(cardMakerPanel ? [{
        id: 'card_maker',
        name: cardMakerPanel.config.title,
        icon: cardMakerPanel.config.icon || ''
      }] : []),
      ...registeredPanelItems.value,
      ...forgeAuxPanelItems.value
    ];

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
    const cardMakerPanel = toRegisteredPanelEntry('card_maker');
    const panelItems = [
      ...(cardMakerPanel ? [{
        id: 'card_maker',
        name: cardMakerPanel.config.title,
        icon: cardMakerPanel.config.icon || ''
      }] : []),
      ...registeredPanelItems.value
    ];

    if (pluginItems.length > 0) {
      groups.push({ label: '插件', items: pluginItems });
    }
    if (forgeAuxPanelItems.value.length > 0) {
      groups.push({ label: '制卡辅助', items: forgeAuxPanelItems.value });
    }
    if (panelItems.length > 0) {
      groups.push({ label: '面板', items: panelItems });
    }

    return groups;
  });

  const createMobileWidgetTabProps = (panelId: string): Record<string, unknown> => {
    const auxKindMatch = panelId.match(FORGE_AUX_PANEL_PATTERN);
    return auxKindMatch ? { kind: auxKindMatch[1] } : {};
  };

  const openTemporaryWidgetTab = (panelId: string) => {
    const plugin = widgetPlugins.value.find((item) => item.id === panelId);
    if (plugin) {
      activeRightPanel.value = panelId;
      desktopSurfaceService.openTab({
        id: `mobile-widget:${panelId}`,
        name: plugin.name,
        icon: plugin.icon,
        surfaceContractId: getPrimarySurfaceContractIdForPlugin(plugin.id),
        props: {
          mode: 'small',
          isMobile: true,
          isTemporaryWidgetTab: true
        }
      });
      return;
    }

    const registered = toRegisteredPanelEntry(panelId);
    if (registered) {
      const surfaceContractId = getSurfaceContractIdForRegisteredPanel(panelId);
      desktopSurfaceService.openTab({
        id: `mobile-widget:${panelId}`,
        name: registered.config.title,
        icon: registered.config.icon || '',
        ...(surfaceContractId ? { surfaceContractId } : { component: registered.component }),
        props: {
          mode: 'small',
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

  const toggleAuxWindow = () => {
    if (layoutMode.value === 'freeform') {
      openWorkspaceApp('plugin:lumina-launcher');
      return;
    }

    if (isMobile.value) {
      openTemporaryWidgetTab(lastKnownRightPanel.value || activeRightPanel.value || 'lumina-settings');
      return;
    }

    if (activeRightPanel.value === 'none') {
      activeRightPanel.value = lastKnownRightPanel.value || 'lumina-settings';
      return;
    }

    activeRightPanel.value = 'none';
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
    if (isTelegramDesktopMode()) {
      widgetWidth.value = clamp(newWidth, TELEGRAM_RIGHT_PANEL_MIN_WIDTH, getTelegramRightPanelMaxWidth());
      return;
    }
    widgetWidth.value = clamp(newWidth, 300, 800);
  };

  const handleLeftRailResize = (event: MouseEvent) => {
    if (!isTelegramLeftRailResizing.value) return;
    const newWidth = leftResizeStart
      ? leftResizeStart.width + (event.clientX - leftResizeStart.pointerX)
      : event.clientX;
    telegramLeftRailWidth.value = clamp(newWidth, TELEGRAM_LEFT_RAIL_MIN_WIDTH, getTelegramLeftRailMaxWidth());
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
    if (isTelegramLeftRailResizing.value) {
      stopLeftRailResize();
    }
    rightResizeStart = event
      ? { pointerX: event.clientX, width: widgetWidth.value }
      : null;
    isResizing.value = true;
    document.addEventListener('mousemove', handleResize);
    document.addEventListener('mouseup', stopResize);
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
  };

  const stopLeftRailResize = () => {
    if (!isTelegramLeftRailResizing.value) return;
    isTelegramLeftRailResizing.value = false;
    leftResizeStart = null;
    document.removeEventListener('mousemove', handleLeftRailResize);
    document.removeEventListener('mouseup', stopLeftRailResize);
    document.body.style.cursor = '';
    document.body.style.userSelect = '';
    lwStorage.set(TELEGRAM_LEFT_RAIL_STORAGE_KEY, telegramLeftRailWidth.value, 'Global');
  };

  const initLeftRailResize = (event?: MouseEvent) => {
    if (!isTelegramDesktopMode()) return;
    if (isResizing.value) {
      stopResize();
    }
    leftResizeStart = event
      ? { pointerX: event.clientX, width: telegramLeftRailWidth.value }
      : null;
    isTelegramLeftRailResizing.value = true;
    document.addEventListener('mousemove', handleLeftRailResize);
    document.addEventListener('mouseup', stopLeftRailResize);
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
  };

  watch(activeRightPanel, (value) => {
    if (value !== 'none') {
      lastKnownRightPanel.value = value;
      lwStorage.set('luminaWeave.activeRightPanel', value, 'Global');
    }
  });

  watch(showNexus, (value) => {
    lwStorage.set('luminaWeave.showNexus', value, 'Global');
  });

  if (getCurrentInstance()) {
    onUnmounted(() => {
      stopResize();
      stopLeftRailResize();
    });
  }

  return {
    activeRightPanel,
    lastKnownRightPanel,
    showWidgetDropdown,
    showNexus,
    widgetWidth,
    isResizing,
    telegramLeftRailWidth,
    isTelegramLeftRailResizing,
    activeWidgetPlugin,
    activeRegisteredPanel,
    activeForgeAuxKind,
    forgeAuxPanelItems,
    registeredPanelItems,
    widgetPanelList,
    widgetGroups,
    openTemporaryWidgetTab,
    switchRightPanel,
    handleOpenWidget,
    toggleAuxWindow,
    closeWidgetPanel,
    initResize,
    stopResize,
    initLeftRailResize,
    stopLeftRailResize,
    getPluginName
  };
};
