import { computed, ref, watch } from 'vue';
import { getDesktopModeSettingValue } from '../../../core/registry.js';
import { activeSettings } from '../../../../stores/settingsState.js';
import type { DesktopModeShellRuntime } from '../../../../platform/desktop-mode-runtime/shellContracts.js';
import type {
  TelegramDesktopLeftRoute,
  TelegramMobileTabId,
  TelegramStackNavDirection,
  TelegramStackRoute
} from './types.js';

const rootRouteForMobileTab = (tabId: TelegramMobileTabId): TelegramStackRoute => {
  if (tabId === 'roles') return { name: 'roleList' };
  if (tabId === 'settings') return { name: 'settings' };
  if (tabId === 'profile') return { name: 'profile' };
  return { name: 'conversationList' };
};

/**
 * Telegram 模式自有导航状态：桌面左栏路由、移动端四标签页栈、右侧资料面板显隐。
 * 只通过通用 shell runtime 读写平台状态，不引用 App。
 */
export const useTelegramShell = (shell: DesktopModeShellRuntime) => {
  const activeDesktopModeId = computed(() => shell.context.value.activeDesktopModeId);
  const layoutMode = computed(() => shell.context.value.shellKind);
  const isMobile = computed(() => shell.context.value.isMobile);
  const viewportWidthPx = computed(() => shell.context.value.viewportWidthPx);
  const activeRightPanel = computed(() => shell.context.value.traditional.activeRightPanel);

  const isTelegramMobileMode = computed(() =>
    layoutMode.value === 'traditional' && activeDesktopModeId.value === 'telegram' && isMobile.value
  );

  const rightInfoPanelMode = computed(() => String(
    getDesktopModeSettingValue(activeSettings, activeDesktopModeId.value, 'rightInfoPanel', 'auto')
  ));
  const isRightPanelExplicitlyOpened = ref(false);
  const telegramDesktopLeftRoute = ref<TelegramDesktopLeftRoute>('conversationList');
  const telegramMobileActiveTab = ref<TelegramMobileTabId>('conversations');
  const telegramMobileNavDirection = ref<TelegramStackNavDirection>('fade');
  const telegramMobileStacks = ref<Record<TelegramMobileTabId, TelegramStackRoute[]>>({
    conversations: [{ name: 'conversationList' }],
    roles: [{ name: 'roleList' }],
    settings: [{ name: 'settings' }],
    profile: [{ name: 'profile' }]
  });

  const telegramMobileCurrentRoute = computed<TelegramStackRoute>(() => {
    const stack = telegramMobileStacks.value[telegramMobileActiveTab.value];
    return stack[stack.length - 1] || rootRouteForMobileTab(telegramMobileActiveTab.value);
  });

  const shouldShowRightPanel = computed(() => {
    if (layoutMode.value !== 'traditional' || activeDesktopModeId.value !== 'telegram' || isMobile.value) {
      return false;
    }
    if (isRightPanelExplicitlyOpened.value && activeRightPanel.value === 'telegram-profile') {
      return true;
    }
    if (rightInfoPanelMode.value === 'hidden') {
      return false;
    }
    if (rightInfoPanelMode.value === 'always') {
      return true;
    }
    return viewportWidthPx.value >= 1180;
  });

  const setTelegramDesktopLeftRoute = (route: TelegramDesktopLeftRoute) => {
    telegramDesktopLeftRoute.value = route;
  };

  const pushTelegramMobileRoute = (route: TelegramStackRoute) => {
    const tabId = telegramMobileActiveTab.value;
    const stack = telegramMobileStacks.value[tabId] || [rootRouteForMobileTab(tabId)];
    const current = stack[stack.length - 1];
    if (
      current?.name === route.name
      && current.groupKey === route.groupKey
      && current.sessionId === route.sessionId
      && current.panelId === route.panelId
      && current.toolId === route.toolId
    ) {
      return;
    }
    telegramMobileNavDirection.value = 'forward';
    telegramMobileStacks.value = {
      ...telegramMobileStacks.value,
      [tabId]: [...stack, route]
    };
  };

  const replaceTelegramMobileRoot = (tabId: TelegramMobileTabId) => {
    telegramMobileStacks.value = {
      ...telegramMobileStacks.value,
      [tabId]: telegramMobileStacks.value[tabId]?.length
        ? telegramMobileStacks.value[tabId]
        : [rootRouteForMobileTab(tabId)]
    };
  };

  const popTelegramMobileRoute = () => {
    const tabId = telegramMobileActiveTab.value;
    const stack = telegramMobileStacks.value[tabId] || [rootRouteForMobileTab(tabId)];
    if (stack.length <= 1) {
      return;
    }
    telegramMobileNavDirection.value = 'back';
    telegramMobileStacks.value = {
      ...telegramMobileStacks.value,
      [tabId]: stack.slice(0, -1)
    };
  };

  const openProfilePanel = () => {
    if (isMobile.value) {
      telegramMobileNavDirection.value = 'fade';
      telegramMobileActiveTab.value = 'profile';
      replaceTelegramMobileRoot('profile');
      return;
    }

    isRightPanelExplicitlyOpened.value = true;
    shell.actions.traditional.switchRightPanel('telegram-profile');
  };

  const openCharacters = () => {
    if (isMobile.value) {
      telegramMobileNavDirection.value = 'fade';
      telegramMobileActiveTab.value = 'roles';
      replaceTelegramMobileRoot('roles');
      return;
    }
    telegramDesktopLeftRoute.value = 'roleList';
  };

  const selectBottomNav = (itemId: 'chat' | 'characters' | 'settings' | 'profile') => {
    if (itemId === 'chat') {
      telegramMobileNavDirection.value = 'fade';
      telegramMobileActiveTab.value = 'conversations';
      replaceTelegramMobileRoot('conversations');
      shell.actions.navigation.switchMainView('lumina-chat');
      return;
    }

    if (itemId === 'characters') {
      telegramMobileNavDirection.value = 'fade';
      telegramMobileActiveTab.value = 'roles';
      replaceTelegramMobileRoot('roles');
      return;
    }

    if (itemId === 'settings') {
      telegramMobileNavDirection.value = 'fade';
      telegramMobileActiveTab.value = 'settings';
      replaceTelegramMobileRoot('settings');
      return;
    }

    openProfilePanel();
  };

  watch(
    [activeDesktopModeId, isMobile, shouldShowRightPanel],
    ([modeId, mobile, shouldShowPanel]) => {
      if (modeId !== 'telegram' || mobile || !shouldShowPanel) {
        return;
      }
      const panelId = activeRightPanel.value;
      if (panelId === 'none' || panelId === 'lumina-settings') {
        shell.actions.traditional.switchRightPanel('telegram-profile');
      }
    },
    { immediate: true }
  );

  watch(activeRightPanel, (panelId) => {
    if (panelId !== 'telegram-profile') {
      isRightPanelExplicitlyOpened.value = false;
    }
  });

  return {
    activeDesktopModeId,
    isMobile,
    isTelegramMobileMode,
    shouldShowRightPanel,
    telegramDesktopLeftRoute,
    telegramMobileActiveTab,
    telegramMobileCurrentRoute,
    telegramMobileNavDirection,
    openProfilePanel,
    openCharacters,
    selectBottomNav,
    setTelegramDesktopLeftRoute,
    pushTelegramMobileRoute,
    popTelegramMobileRoute
  };
};
