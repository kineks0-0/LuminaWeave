import { computed, nextTick, ref, watch, type CSSProperties, type ComputedRef, type Ref } from 'vue';
import { CharacterChannelService } from '../../api/core/CharacterChannelService';
import { luminaWeaveApi as lwApi } from '../../api/index';
import { getThemeSettingValue } from '../../theme/themeRegistry';
import { useConversationContextStore } from '../../stores/useConversationContextStore';
import type { DynamicTabConfig } from '../../shell/types';
import type { LuminaPlugin } from '../../types/plugin';
import type {
  CharacterChannelState,
  CreateChatConversationInput,
  DeleteChatConversationInput,
  RenameChatConversationInput
} from '../../types/ConversationContextTypes';

type DiscordMobileEdge = 'top' | 'bottom' | 'left' | 'right';
type PendingDiscordAction =
  | { kind: 'open'; sessionId: string }
  | { kind: 'create'; target: CreateChatConversationInput };

const resolveDiscordMobileEdge = (value: unknown, fallback: DiscordMobileEdge): DiscordMobileEdge => {
  return value === 'top' || value === 'bottom' || value === 'left' || value === 'right'
    ? value
    : fallback;
};

export const useDiscordShell = ({
  activeDesktopModeId,
  layoutMode,
  isMobile,
  activeSettings,
  traditionalLeftRail,
  mainPlugins,
  dynamicTabs,
  activeMainTab,
  shouldShowForgeSidebar,
  onSwitchMainView
}: {
  activeDesktopModeId: Ref<string> | ComputedRef<string>;
  layoutMode: Ref<'traditional' | 'freeform'> | ComputedRef<'traditional' | 'freeform'>;
  isMobile: Ref<boolean>;
  activeSettings: Record<string, unknown>;
  traditionalLeftRail: Ref<string> | ComputedRef<string>;
  mainPlugins: ComputedRef<LuminaPlugin[]>;
  dynamicTabs: Ref<DynamicTabConfig[]>;
  activeMainTab: Ref<string>;
  shouldShowForgeSidebar: ComputedRef<boolean>;
  onSwitchMainView: (tabId: string) => void;
}) => {
  const contextStore = useConversationContextStore();
  const characterChannelService = new CharacterChannelService(lwApi as any, contextStore as any);
  const pendingDiscordAction = ref<PendingDiscordAction | null>(null);
  const showDiscordMobileCharacterRail = ref(false);

  const discordChannelMarkVisible = computed(() =>
    getThemeSettingValue(activeSettings, activeDesktopModeId.value, 'discord-channel-mark', true) !== false
  );

  const isDiscordMobileMode = computed(() =>
    layoutMode.value === 'traditional'
    && activeDesktopModeId.value === 'discord'
    && isMobile.value
  );

  const shouldShowDiscordMobileShell = computed(() =>
    isDiscordMobileMode.value && discordChannelMarkVisible.value
  );

  const shouldShowDiscordGuildRail = computed(() =>
    layoutMode.value === 'traditional'
    && activeDesktopModeId.value === 'discord'
    && discordChannelMarkVisible.value
    && !isMobile.value
  );

  const discordMobileGuildRailPosition = computed<DiscordMobileEdge>(() =>
    resolveDiscordMobileEdge(
      getThemeSettingValue(activeSettings, activeDesktopModeId.value, 'mobileGuildRailPosition', 'top'),
      'top'
    )
  );

  const discordMobileCharacterEntryPosition = computed<DiscordMobileEdge>(() =>
    resolveDiscordMobileEdge(
      getThemeSettingValue(activeSettings, activeDesktopModeId.value, 'mobileCharacterEntryPosition', 'top'),
      'top'
    )
  );

  const shouldShowDiscordCharacterRail = computed(() =>
    layoutMode.value === 'traditional'
    && traditionalLeftRail.value === 'character-rail'
    && !isMobile.value
    && !shouldShowForgeSidebar.value
  );

  const discordGuildEntries = computed(() => {
    const pluginEntries = mainPlugins.value
      .filter((plugin) => plugin.id !== 'lumina-launcher')
      .map((plugin) => ({
        id: plugin.id,
        name: plugin.name,
        icon: plugin.icon
      }));
    const dynamicEntries = dynamicTabs.value.map((tab) => ({
      id: tab.id,
      name: tab.name,
      icon: tab.icon || ''
    }));
    return [...pluginEntries, ...dynamicEntries];
  });

  const getDiscordMobileSafeArea = (edge: DiscordMobileEdge) => {
    let total = 0;

    if (shouldShowDiscordMobileShell.value && discordMobileGuildRailPosition.value === edge) {
      total += edge === 'left' || edge === 'right' ? 76 : 82;
    }

    if (discordMobileCharacterEntryPosition.value === edge) {
      total += edge === 'left' || edge === 'right' ? 78 : 74;
    }

    return total;
  };

  const discordMobileMainStyle = computed<CSSProperties>(() => {
    if (!shouldShowDiscordMobileShell.value) {
      return {};
    }

    return {
      '--lw-discord-mobile-safe-top': `${getDiscordMobileSafeArea('top')}px`,
      '--lw-discord-mobile-safe-bottom': `${getDiscordMobileSafeArea('bottom')}px`,
      '--lw-discord-mobile-safe-left': `${getDiscordMobileSafeArea('left')}px`,
      '--lw-discord-mobile-safe-right': `${getDiscordMobileSafeArea('right')}px`
    };
  });

  const discordMobileCharacterEntryStyle = computed<CSSProperties>(() => {
    if (!shouldShowDiscordMobileShell.value) {
      return {};
    }

    const style: CSSProperties = {};
    if (discordMobileCharacterEntryPosition.value === discordMobileGuildRailPosition.value) {
      const edge = discordMobileCharacterEntryPosition.value;
      const offset = edge === 'left' || edge === 'right' ? '82px' : '88px';
      style[`--lw-discord-mobile-entry-offset-${edge}`] = offset;
    }

    return style;
  });

  const handleDiscordMobileMainViewSwitch = (tabId: string) => {
    showDiscordMobileCharacterRail.value = false;
    onSwitchMainView(tabId);
  };

  const logDiscordSwitch = (message: string, payload?: unknown) => {
    if (payload === undefined) {
      console.info(`[LuminaWeave][DiscordSwitch][App] ${message}`);
      return;
    }

    console.info(`[LuminaWeave][DiscordSwitch][App] ${message}`, payload);
  };

  const openDiscordChatSessionNow = async (sessionId: string) => {
    logDiscordSwitch('openDiscordChatSessionNow:start', {
      sessionId,
      activeMainTab: activeMainTab.value,
      currentContext: {
        sourceId: contextStore.activeSourceId,
        sessionId: contextStore.activeSessionId,
        selectedViewSessionId: contextStore.selectedViewSessionId
      }
    });

    await characterChannelService.openSession(sessionId);
  };

  const openDiscordChatSession = async (sessionId: string) => {
    if (!sessionId) return;

    logDiscordSwitch('openDiscordChatSession:received', {
      sessionId,
      activeMainTab: activeMainTab.value
    });

    if (activeMainTab.value === 'lumina-chat') {
      await openDiscordChatSessionNow(sessionId);
      return;
    }

    pendingDiscordAction.value = {
      kind: 'open',
      sessionId
    };
    logDiscordSwitch('openDiscordChatSession:queue-and-switch-tab', {
      sessionId,
      fromTab: activeMainTab.value
    });
    onSwitchMainView('lumina-chat');
    await nextTick();
  };

  const openDiscordMobileChatSession = async (sessionId: string) => {
    showDiscordMobileCharacterRail.value = false;
    await openDiscordChatSession(sessionId);
  };

  const createDiscordChatSessionNow = async (target: CreateChatConversationInput) => {
    logDiscordSwitch('createDiscordChatSessionNow:start', {
      target,
      activeMainTab: activeMainTab.value,
      currentContext: {
        sourceId: contextStore.activeSourceId,
        sessionId: contextStore.activeSessionId,
        selectedViewSessionId: contextStore.selectedViewSessionId
      }
    });

    await characterChannelService.createSession(target);
  };

  const createDiscordChatSession = async (target: CreateChatConversationInput) => {
    logDiscordSwitch('createDiscordChatSession:received', {
      target,
      activeMainTab: activeMainTab.value
    });

    if (activeMainTab.value === 'lumina-chat') {
      await createDiscordChatSessionNow(target);
      return;
    }

    pendingDiscordAction.value = {
      kind: 'create',
      target
    };
    logDiscordSwitch('createDiscordChatSession:queue-and-switch-tab', {
      target,
      fromTab: activeMainTab.value
    });
    onSwitchMainView('lumina-chat');
    await nextTick();
  };

  const createDiscordMobileChatSession = async (target: CreateChatConversationInput) => {
    showDiscordMobileCharacterRail.value = false;
    await createDiscordChatSession(target);
  };

  const renameDiscordChatSession = async (input: RenameChatConversationInput) => {
    const nextTitle = (input.nextTitle || '').trim();
    if (!input.sessionId || !nextTitle) {
      return;
    }

    logDiscordSwitch('renameDiscordChatSession:start', {
      input,
      currentContext: {
        sourceId: contextStore.activeSourceId,
        sessionId: contextStore.activeSessionId,
        selectedViewSessionId: contextStore.selectedViewSessionId
      }
    });

    await characterChannelService.renameSession({
      ...input,
      nextTitle
    });
    showDiscordMobileCharacterRail.value = false;
    logDiscordSwitch('renameDiscordChatSession:success', {
      input
    });
  };

  const deleteDiscordChatSession = async (input: DeleteChatConversationInput & { title?: string }) => {
    if (!input.sessionId) {
      return;
    }

    logDiscordSwitch('deleteDiscordChatSession:start', {
      input,
      currentContext: {
        sourceId: contextStore.activeSourceId,
        sessionId: contextStore.activeSessionId,
        selectedViewSessionId: contextStore.selectedViewSessionId
      }
    });

    await characterChannelService.deleteSession(input);
    showDiscordMobileCharacterRail.value = false;
    logDiscordSwitch('deleteDiscordChatSession:success', {
      input
    });
  };

  watch(activeMainTab, async (value) => {
    if (value !== 'lumina-chat' || !pendingDiscordAction.value) {
      return;
    }

    const action = pendingDiscordAction.value;
    pendingDiscordAction.value = null;
    logDiscordSwitch('watch:activeMainTab:drain-pending-action', action);

    if (action.kind === 'open') {
      await openDiscordChatSessionNow(action.sessionId);
      return;
    }

    await createDiscordChatSessionNow(action.target);
  });

  watch(isMobile, (mobile, wasMobile) => {
    if (!mobile) {
      showDiscordMobileCharacterRail.value = false;
      return;
    }

    if (!wasMobile) {
      showDiscordMobileCharacterRail.value = false;
    }
  });

  const characterChannelState = computed<CharacterChannelState>(() => characterChannelService.state.value);

  const toggleDiscordCharacterGroup = (groupKey: string) => {
    characterChannelService.toggleGroup(groupKey);
  };

  const toggleDiscordCharacterSessionExpansion = (groupKey: string) => {
    characterChannelService.toggleGroupSessionExpansion(groupKey);
  };

  return {
    contextStore,
    characterChannelState,
    discordChannelMarkVisible,
    isDiscordMobileMode,
    shouldShowDiscordMobileShell,
    shouldShowDiscordGuildRail,
    discordMobileGuildRailPosition,
    discordMobileCharacterEntryPosition,
    shouldShowDiscordCharacterRail,
    discordGuildEntries,
    showDiscordMobileCharacterRail,
    discordMobileMainStyle,
    discordMobileCharacterEntryStyle,
    handleDiscordMobileMainViewSwitch,
    openDiscordChatSession,
    openDiscordMobileChatSession,
    createDiscordChatSession,
    createDiscordMobileChatSession,
    renameDiscordChatSession,
    deleteDiscordChatSession,
    toggleDiscordCharacterGroup,
    toggleDiscordCharacterSessionExpansion
  };
};
