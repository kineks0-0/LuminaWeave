import { onMounted, onUnmounted, type Component, type Ref } from 'vue';
import { luminaWeaveApi as lwApi } from '../../api/index';
import { registerLuminaPlugins } from '../../bootstrap/registerPlugins';
import ConflictDiffViewer from '../../plugins/chat/ConflictDiffViewer.vue';
import SyncReportViewer from '../../plugins/chat/SyncReportViewer.vue';
import ContextSwitcherPanel from '../../components/ContextSwitcherPanel.vue';

export const useShellBootstrap = ({
  isApiReady,
  initStatusText,
  settingsRevision,
  handleOpenTab,
  handleSwitchMainView,
  handleSwitchWidgetPanel,
  handleToggleWidgetPanel,
  setSidebarMode,
  onWorkspaceKeydown,
  onThemeChange,
  onReady,
  onShowConflictPanel,
  onShowSyncReportPanel,
  onLayoutReady,
  initSettings
}: {
  isApiReady: Ref<boolean>;
  initStatusText: Ref<string>;
  settingsRevision: Ref<number>;
  handleOpenTab: (tabConfig: { id: string; name: string; icon: string; component: Component; props?: Record<string, unknown> }) => void;
  handleSwitchMainView: (tabId: string) => void;
  handleSwitchWidgetPanel: (panelId: string) => void;
  handleToggleWidgetPanel: (panelId: string) => void;
  setSidebarMode: (mode: 'left' | 'right' | 'widget') => void;
  onWorkspaceKeydown: (event: KeyboardEvent) => void;
  onThemeChange: (event: MediaQueryListEvent) => void;
  onReady: () => void;
  onShowConflictPanel: () => void;
  onShowSyncReportPanel: () => void;
  onLayoutReady: () => void;
  initSettings: () => void;
}) => {
  const themeMedia = window.matchMedia('(prefers-color-scheme: dark)');

  registerLuminaPlugins();

  onMounted(async () => {
    themeMedia.addEventListener('change', onThemeChange);
    window.addEventListener('keydown', onWorkspaceKeydown);

    lwApi.registerPanel('conflict', ConflictDiffViewer, {
      title: '版本分歧比对',
      icon: '⚡'
    });
    lwApi.registerPanel('sync_report', SyncReportViewer, {
      title: '同步对比报告',
      icon: '🧾'
    });
    lwApi.registerPanel('context-switcher', ContextSwitcherPanel, {
      title: '会话切换',
      icon: '🔄'
    });

    lwApi.on('OPEN_TAB', handleOpenTab);
    lwApi.on('SWITCH_MAIN_VIEW', handleSwitchMainView);
    lwApi.on('SWITCH_WIDGET_PANEL', handleSwitchWidgetPanel);
    lwApi.on('TOGGLE_WIDGET_PANEL', handleToggleWidgetPanel);
    lwApi.on('INIT_PROGRESS', (text: string) => {
      initStatusText.value = text;
    });
    lwApi.on('SETTINGS_CHANGED', () => {
      settingsRevision.value++;
    });
    lwApi.on('SWITCH_AUX_SIDEBAR_MODE', (mode: 'left' | 'right' | 'widget') => {
      setSidebarMode(mode);
    });
    lwApi.on('OPEN_PANEL_CONFLICT', onShowConflictPanel);
    lwApi.on('OPEN_PANEL_SYNC_REPORT', onShowSyncReportPanel);

    initSettings();

    await lwApi.init();
    isApiReady.value = true;
    onReady();
    onLayoutReady();
    console.log('[LuminaWeave] Global API initialization complete. UI Render unblocked.');
  });

  onUnmounted(() => {
    themeMedia.removeEventListener('change', onThemeChange);
    window.removeEventListener('keydown', onWorkspaceKeydown);
  });
};
