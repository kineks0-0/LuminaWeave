import { computed, ref, watch, type ComputedRef, type Ref } from 'vue';
import { getThemeSettingValue } from '../../theme/themeRegistry';
import type { DynamicTabConfig } from '../../shell/types';
import type { CharacterChannelState, CreateChatConversationInput } from '../../types/ConversationContextTypes';

export const useTelegramShell = ({
  activeDesktopModeId,
  layoutMode,
  isMobile,
  activeSettings,
  viewportWidthPx,
  widgetWidth,
  showNexus,
  activeRightPanel,
  characterChannelState,
  showCharacterRail,
  handleOpenTab,
  switchRightPanel,
  createMobileChatSession,
  openMobileChatSession,
  openSettingsPanel,
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
  characterChannelState: Ref<CharacterChannelState> | ComputedRef<CharacterChannelState>;
  showCharacterRail: Ref<boolean>;
  handleOpenTab: (tabConfig: DynamicTabConfig) => void;
  switchRightPanel: (panelId: string) => void;
  createMobileChatSession: (payload: CreateChatConversationInput) => void;
  openMobileChatSession: (sessionId: string) => void;
  openSettingsPanel: () => void;
  switchMainView: (tabId: string) => void;
}) => {
  const isTelegramMobileMode = computed(() =>
    layoutMode.value === 'traditional' && activeDesktopModeId.value === 'telegram' && isMobile.value
  );

  const rightInfoPanelMode = computed(() => String(
    getThemeSettingValue(activeSettings, activeDesktopModeId.value, 'rightInfoPanel', 'auto')
  ));
  const isRightPanelExplicitlyOpened = ref(false);

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

  const openMobileContextTool = (panelId: string) => {
    const toolMap: Record<string, { name: string; icon: string; surfaceContractId: DynamicTabConfig['surfaceContractId'] }> = {
      'lumina-timeline': { name: '时间线', icon: '□', surfaceContractId: 'timeline.navigator' },
      'lumina-stats': { name: '状态', icon: '☺', surfaceContractId: 'stats.panel' },
      'lumina-director': { name: '导演', icon: '▣', surfaceContractId: 'director.panel' },
      'lumina-lorebook': { name: '世界书', icon: '▤', surfaceContractId: 'lorebook.workspace' },
      'lumina-settings': { name: '设置', icon: '⚙', surfaceContractId: 'settings.root' }
    };
    const tool = toolMap[panelId];
    if (!tool) {
      switchRightPanel(panelId);
      return;
    }
    handleOpenTab({
      id: `mobile-widget:${panelId}`,
      name: tool.name,
      icon: tool.icon,
      surfaceContractId: tool.surfaceContractId
    });
  };

  const openProfilePanel = () => {
    if (isMobile.value) {
      handleOpenTab({
        id: 'mobile-widget:telegram-profile',
        name: '个人资料',
        icon: '👤',
        surfaceContractId: 'telegram.infoPanel',
        props: {
          state: characterChannelState.value,
          isMobile: true,
          onOpenTool: openMobileContextTool,
          onCreateSession: createMobileChatSession,
          onOpenSession: openMobileChatSession
        }
      });
      return;
    }

    activeRightPanel.value = 'telegram-profile';
    isRightPanelExplicitlyOpened.value = true;
  };

  const openCharacters = () => {
    showCharacterRail.value = true;
    switchMainView('lumina-chat');
  };

  const selectBottomNav = (itemId: 'chat' | 'characters' | 'settings' | 'profile') => {
    if (itemId === 'chat') {
      showCharacterRail.value = false;
      switchMainView('lumina-chat');
      return;
    }

    if (itemId === 'characters') {
      showCharacterRail.value = !showCharacterRail.value;
      return;
    }

    showCharacterRail.value = false;

    if (itemId === 'settings') {
      openSettingsPanel();
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
    openProfilePanel,
    openCharacters,
    selectBottomNav
  };
};
