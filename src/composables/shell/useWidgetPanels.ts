import { computed, onUnmounted, ref, watch, type Component, type ComputedRef, type Ref } from 'vue';
import { lwStorage } from '../../api/storage';
import { luminaWeaveApi as lwApi } from '../../api/index';
import { pluginManager } from '../../core/PluginManager';
import type { LuminaPlugin } from '../../types/plugin';
import type { RegisteredPanelEntry, WidgetPanelGroup, WidgetPanelItem, WidgetPluginEntry } from '../../shell/types';

const FORGE_AUX_PANEL_PATTERN = /^forge_(lorebook|memory|export|post_tracks|test_chat)$/;

const toRegisteredPanelEntry = (panelId: string): RegisteredPanelEntry | null => {
  const panel = lwApi.registeredPanels.get(panelId);
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
  workspaceAppMap: ComputedRef<Map<string, unknown>>;
  openWorkspaceApp: (appId: string) => void;
  getPluginName: (pluginId: string | null) => string;
}) => {
  const widgetWidth = ref(lwStorage.get('luminaWeave.widgetWidth', 400, 'Global'));
  const isResizing = ref(false);

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

    for (const [id, panel] of lwApi.registeredPanels) {
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
      lwApi.openTab({
        id: `mobile-widget:${panelId}`,
        name: plugin.name,
        icon: plugin.icon,
        component: plugin.component,
        props: { mode: 'small', isMobile: true, isTemporaryWidgetTab: true }
      });
      return;
    }

    const registered = toRegisteredPanelEntry(panelId);
    if (registered) {
      lwApi.openTab({
        id: `mobile-widget:${panelId}`,
        name: registered.config.title,
        icon: registered.config.icon || '',
        component: registered.component,
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
    const newWidth = window.innerWidth - event.clientX;
    if (newWidth >= 300 && newWidth <= 800) {
      widgetWidth.value = newWidth;
    }
  };

  const stopResize = () => {
    if (!isResizing.value) return;
    isResizing.value = false;
    document.removeEventListener('mousemove', handleResize);
    document.removeEventListener('mouseup', stopResize);
    document.body.style.cursor = '';
    document.body.style.userSelect = '';
    lwStorage.set('luminaWeave.widgetWidth', widgetWidth.value, 'Global');
  };

  const initResize = () => {
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

  watch(showNexus, (value) => {
    lwStorage.set('luminaWeave.showNexus', value, 'Global');
  });

  onUnmounted(() => {
    stopResize();
  });

  return {
    activeRightPanel,
    lastKnownRightPanel,
    showWidgetDropdown,
    showNexus,
    widgetWidth,
    isResizing,
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
    getPluginName
  };
};
