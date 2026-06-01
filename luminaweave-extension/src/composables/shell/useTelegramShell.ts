import { computed, ref, watch, type ComputedRef, type Ref } from 'vue';
import { lwStorage } from '../../api/storage.js';
import { getDesktopModeSettingValue } from '../../desktop-modes/core/registry.js';
import type {
  TelegramConversationListMode,
  TelegramDesktopLeftRoute,
  TelegramMobileTabId,
  TelegramStackRoute
} from '../../shell/types.js';

const TELEGRAM_LIST_MODE_STORAGE_KEY = 'luminaWeave.telegram.conversationListMode';

const getStoredConversationListMode = (): TelegramConversationListMode => {
  return lwStorage.get(TELEGRAM_LIST_MODE_STORAGE_KEY, 'groupedByRole', 'Global') === 'conversationFiles'
    ? 'conversationFiles'
    : 'groupedByRole';
};

const rootRouteForMobileTab = (tabId: TelegramMobileTabId): TelegramStackRoute => {
  if (tabId === 'roles') return { name: 'roleList' };
  if (tabId === 'settings') return { name: 'settings' };
  if (tabId === 'profile') return { name: 'profile' };
  return { name: 'conversationList' };
};

export const useTelegramShell = ({
  activeDesktopModeId,
  layoutMode,
  isMobile,
  activeSettings,
  viewportWidthPx,
  widgetWidth,
  showNexus,
  activeRightPanel,
  showCharacterRail,
  switchMainView
}: {
  activeDesktopModeId: Ref<string> | ComputedRef<string>;
  layoutMode: Ref<'traditional' | 'freeform'> | ComputedRef<'traditional' | 'freeform'>;
  isMobile: Ref<boolean>;
  activeSettings: Record<string, unknown>;
  viewportWidthPx: Ref<number> | ComputedRef<number>;
  widgetWidth: Ref<number>;
  showNexus: Ref<boolean>;
  activeRightPanel: Ref<string>;
  showCharacterRail: Ref<boolean>;
  switchMainView: (tabId: string) => void;
}) => {
  const isTelegramMobileMode = computed(() =>
    layoutMode.value === 'traditional' && activeDesktopModeId.value === 'telegram' && isMobile.value
  );

  const rightInfoPanelMode = computed(() => String(
    getDesktopModeSettingValue(activeSettings, activeDesktopModeId.value, 'rightInfoPanel', 'auto')
  ));
  const isRightPanelExplicitlyOpened = ref(false);
  const telegramConversationListMode = ref<TelegramConversationListMode>(getStoredConversationListMode());
  const telegramDesktopLeftRoute = ref<TelegramDesktopLeftRoute>('conversationList');
  const telegramMobileActiveTab = ref<TelegramMobileTabId>('conversations');
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

  const visibleRightPanel = computed(() => {
    if (activeDesktopModeId.value !== 'telegram') {
      return activeRightPanel.value;
    }
    if (!shouldShowRightPanel.value) {
      return 'none';
    }
    return activeRightPanel.value;
  });

  const visibleWidgetWidth = computed(() => {
    if (activeDesktopModeId.value !== 'telegram') {
      return widgetWidth.value;
    }
    return Math.max(280, widgetWidth.value);
  });

  const visibleShowNexus = computed(() => (
    activeDesktopModeId.value === 'telegram' ? false : showNexus.value
  ));

  const setTelegramConversationListMode = (mode: TelegramConversationListMode) => {
    telegramConversationListMode.value = mode;
    void lwStorage.set(TELEGRAM_LIST_MODE_STORAGE_KEY, mode, 'Global');
  };

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
    telegramMobileStacks.value = {
      ...telegramMobileStacks.value,
      [tabId]: stack.slice(0, -1)
    };
  };

  const openProfilePanel = () => {
    if (isMobile.value) {
      telegramMobileActiveTab.value = 'profile';
      replaceTelegramMobileRoot('profile');
      return;
    }

    activeRightPanel.value = 'telegram-profile';
    isRightPanelExplicitlyOpened.value = true;
  };

  const openCharacters = () => {
    if (isMobile.value) {
      telegramMobileActiveTab.value = 'roles';
      replaceTelegramMobileRoot('roles');
      return;
    }
    telegramDesktopLeftRoute.value = 'roleList';
  };

  const selectBottomNav = (itemId: 'chat' | 'characters' | 'settings' | 'profile') => {
    if (itemId === 'chat') {
      showCharacterRail.value = false;
      telegramMobileActiveTab.value = 'conversations';
      replaceTelegramMobileRoot('conversations');
      switchMainView('lumina-chat');
      return;
    }

    if (itemId === 'characters') {
      showCharacterRail.value = false;
      telegramMobileActiveTab.value = 'roles';
      replaceTelegramMobileRoot('roles');
      return;
    }

    showCharacterRail.value = false;

    if (itemId === 'settings') {
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
      if (activeRightPanel.value === 'none' || activeRightPanel.value === 'lumina-settings') {
        activeRightPanel.value = 'telegram-profile';
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
    isTelegramMobileMode,
    visibleRightPanel,
    visibleWidgetWidth,
    visibleShowNexus,
    telegramConversationListMode,
    telegramDesktopLeftRoute,
    telegramMobileActiveTab,
    telegramMobileCurrentRoute,
    openProfilePanel,
    openCharacters,
    selectBottomNav,
    setTelegramConversationListMode,
    setTelegramDesktopLeftRoute,
    pushTelegramMobileRoute,
    popTelegramMobileRoute
  };
};
