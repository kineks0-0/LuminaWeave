import { onMounted, onUnmounted, type Ref } from 'vue';
import { luminaWeaveApi as lwApi } from '../../api/index.js';
import { registerLuminaPlugins } from '../../bootstrap/registerPlugins.js';
import type { DynamicTabConfig } from '../../shell/types.js';
import { legacyPanelDefinitions } from '../../shell/legacyPanelRegistry.js';

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
  initSettings,
  onOpenTelegramProfile,
  onOpenTelegramCharacters
}: {
  isApiReady: Ref<boolean>;
  initStatusText: Ref<string>;
  settingsRevision: Ref<number>;
  handleOpenTab: (tabConfig: DynamicTabConfig) => void;
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
  onOpenTelegramProfile?: () => void;
  onOpenTelegramCharacters?: () => void;
}) => {
  const themeMedia = window.matchMedia('(prefers-color-scheme: dark)');
  const desktopSurfaceService = lwApi.services.desktopSurface;

  registerLuminaPlugins();

  const handleTelegramContextTool = (panelId: string) => {
    if (panelId === 'characters') {
      onOpenTelegramCharacters?.();
      return;
    }

    if (panelId === 'lumina-chat') {
      handleSwitchMainView('lumina-chat');
      return;
    }

    if (panelId === 'telegram-profile') {
      onOpenTelegramProfile?.();
      return;
    }

    if (panelId.startsWith('lumina-')) {
      handleSwitchWidgetPanel(panelId);
    }
  };

  onMounted(async () => {
    themeMedia.addEventListener('change', onThemeChange);
    window.addEventListener('keydown', onWorkspaceKeydown);

    legacyPanelDefinitions.forEach((panel) => {
      desktopSurfaceService.registerPanel(panel.id, panel.component, {
        title: panel.title,
        icon: panel.icon
      });
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
    lwApi.on('TELEGRAM_CONTEXT_TOOL', handleTelegramContextTool);
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
