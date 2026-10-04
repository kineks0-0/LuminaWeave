<template>
  <TraditionalShell
    :runtime-context="runtimeContext"
    :runtime-surfaces="runtimeSurfaces"
    :runtime-actions="runtimeActions"
    :runtime-frame="runtimeFrame"
    :root-style="telegramFrameStyle"
    :surface-input-resolver="resolveSurfaceInput"
    :activity-component="resolvedActivityComponent"
    :activity-component-props="resolvedActivityComponentProps"
  >
    <template #composition="compositionProps">
      <slot name="composition" v-bind="compositionProps" />
    </template>

    <template v-if="showDesktopPane" #lead>
      <TelegramDesktopPane
        :activeDesktopModeId="runtimeContext.activeDesktopModeId"
        :leftRoute="telegramDesktopLeftRoute"
        :widgetWidth="runtimeContext.traditional.widgetWidth"
        :onSetLeftRoute="setTelegramDesktopLeftRoute"
      />
    </template>

    <template #widget>
      <TelegramInfoPanelHost
        v-if="showWidget && isProfilePanel"
        :desktopModeId="runtimeContext.activeDesktopModeId"
        :isMobile="runtimeContext.isMobile"
        :surfaceVariant="runtimeSurfaces.traditional.widgetSurfaceVariant"
        :widgetStyle="runtimeSurfaces.traditional.widgetStyle"
        :widgetWidth="visibleWidgetWidth"
        :isResizing="runtimeContext.traditional.isResizing"
        :state="runtimeContext.characterChannelState"
        :onResizeStart="runtimeActions.traditional.resizeStart"
        :onOpenTool="runtimeActions.traditional.switchRightPanel"
        :onCreateSession="runtimeActions.traditional.createConversationSession"
        :onOpenSession="runtimeActions.traditional.openConversationSession"
      />
      <WidgetPanelHost
        v-else-if="showWidget"
        :activeRightPanel="runtimeContext.traditional.activeRightPanel"
        :desktopModeId="runtimeContext.activeDesktopModeId"
        :isMobile="runtimeContext.isMobile"
        :surfaceVariant="runtimeSurfaces.traditional.widgetSurfaceVariant"
        :widgetStyle="runtimeSurfaces.traditional.widgetStyle"
        :widgetWidth="visibleWidgetWidth"
        :isResizing="runtimeContext.traditional.isResizing"
        :saveStatus="runtimeContext.saveStatus"
        :auxSidebarMode="runtimeContext.traditional.sidebarMode"
        :activeWidgetPlugin="runtimeContext.traditional.activeWidgetPlugin"
        :activeRegisteredPanel="runtimeContext.traditional.activeRegisteredPanel"
        :activeRightPanelActivity="runtimeContext.traditional.activeRightPanelActivity"
        :widgetGroups="runtimeContext.widgetGroups"
        :showWidgetDropdown="runtimeContext.traditional.showWidgetDropdown"
        @resizeStart="runtimeActions.traditional.resizeStart"
        @toggleWidgetDropdown="runtimeActions.traditional.toggleWidgetDropdown"
        @switchRightPanel="onClearAndSwitchRightPanel"
        @closePanel="runtimeActions.traditional.closePanel"
      />
    </template>

    <template v-if="showBottomNav" #trailing>
      <TelegramBottomNav
        :activeMainTab="runtimeContext.activeMainTab"
        :characterSheetOpen="telegramMobileActiveTab === 'roles'"
        :settingsPanelOpen="telegramMobileActiveTab === 'settings'"
        :profilePanelOpen="telegramMobileActiveTab === 'profile'"
        @select="onSelectBottomNav"
      />
    </template>
  </TraditionalShell>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, type Component } from 'vue';
import TraditionalShell from '../../../../shell/traditional/TraditionalShell.vue';
import WidgetPanelHost from '../../../../shell/traditional/WidgetPanelHost.vue';
import { useSurfaceSkin } from '../../../core/useSurfaceSkin.js';
import { createDesktopModeShellRuntime } from '../../../../platform/desktop-mode-runtime/shellContracts.js';
import type { DesktopModeShellProps } from '../../../../platform/desktop-mode-runtime/shellContracts.js';
import type { CreateChatConversationInput } from '../../../../types/ConversationContextTypes.js';
import type { SurfaceContractId } from '../../../../platform/surface/types.js';
import { useTelegramShell } from './useTelegramShell.js';
import { createTelegramActivityModeHandler } from './telegramActivityPlacement.js';
import TelegramBottomNav from './TelegramBottomNav.vue';
import TelegramDesktopPane from './TelegramDesktopPane.vue';
import TelegramInfoPanelHost from './TelegramInfoPanelHost.vue';
import TelegramMobileStack from './TelegramMobileStack.vue';
import {
  resolveTelegramMobileRouteTitle,
  resolveTelegramMobileToolActivity,
  resolveTelegramMobileToolAuxSidebarMode,
  resolveTelegramMobileToolContractId,
  resolveTelegramMobileToolProps,
  shouldShowTelegramMobileBottomNav as resolveShouldShowTelegramMobileBottomNav,
  shouldShowTelegramMobileStackBar as resolveShouldShowTelegramMobileStackBar
} from './telegramRouteViewModel.js';

const props = defineProps<DesktopModeShellProps>();
const shell = createDesktopModeShellRuntime(props);

const {
  isTelegramMobileMode,
  shouldShowRightPanel,
  telegramDesktopLeftRoute,
  telegramMobileActiveTab,
  telegramMobileCurrentRoute,
  openProfilePanel,
  openCharacters,
  selectBottomNav,
  setTelegramDesktopLeftRoute,
  pushTelegramMobileRoute,
  popTelegramMobileRoute
} = useTelegramShell(shell);

const { cssVars: telegramFrameVars } = useSurfaceSkin('telegram.frame');
const telegramFrameStyle = computed(() => telegramFrameVars.value);

const showDesktopPane = computed(() =>
  !props.runtimeContext.isMobile && props.runtimeContext.shellKind === 'traditional'
);
const showWidget = computed(() =>
  !props.runtimeContext.isMobile
  && shouldShowRightPanel.value
  && props.runtimeContext.traditional.activeRightPanel !== 'none'
);
const isProfilePanel = computed(() => props.runtimeContext.traditional.activeRightPanel === 'telegram-profile');
const visibleWidgetWidth = computed(() => Math.max(280, props.runtimeContext.traditional.widgetWidth));

const showBottomNav = computed(() =>
  resolveShouldShowTelegramMobileBottomNav(isTelegramMobileMode.value, telegramMobileCurrentRoute.value)
);
const mobileStackShowsBar = computed(() =>
  resolveShouldShowTelegramMobileStackBar(telegramMobileCurrentRoute.value)
);
const mobileStackTitle = computed(() =>
  resolveTelegramMobileRouteTitle(telegramMobileCurrentRoute.value)
);
const mobileToolContractId = computed(() =>
  resolveTelegramMobileToolContractId(telegramMobileCurrentRoute.value, {
    resolveRegisteredPanelContractId: props.runtimeActions.resolveRegisteredPanelSurface,
    resolvePluginContractId: props.runtimeActions.resolvePluginPrimarySurface
  })
);
const mobileToolActivity = computed(() =>
  resolveTelegramMobileToolActivity(telegramMobileCurrentRoute.value)
);
const mobileToolProps = computed(() =>
  resolveTelegramMobileToolProps(telegramMobileCurrentRoute.value)
);
const mobileToolAuxSidebarMode = computed(() =>
  mobileToolContractId.value
    ? resolveTelegramMobileToolAuxSidebarMode(mobileToolContractId.value)
    : undefined
);

const onOpenMobileSession = (sessionId: string) => {
  props.runtimeActions.traditional.openConversationSession(sessionId);
  pushTelegramMobileRoute({ name: 'chat', sessionId });
};
const onCreateMobileSession = (payload: CreateChatConversationInput) => {
  props.runtimeActions.traditional.createConversationSession(payload);
  pushTelegramMobileRoute({ name: 'chat' });
};
const onOpenMobilePanel = (panelId: string) => {
  props.runtimeActions.navigation.clearActivityMetadata();
  pushTelegramMobileRoute({ name: 'tool', panelId });
};
const onHandleRoleProfileTool = (panelId: string) => {
  if (panelId === 'none') {
    popTelegramMobileRoute();
    return;
  }
  onOpenMobilePanel(panelId);
};
const onSelectBottomNav = (itemId: 'chat' | 'characters' | 'settings' | 'profile') => {
  props.runtimeActions.navigation.clearActivityMetadata();
  selectBottomNav(itemId);
};
const onClearAndSwitchRightPanel = (panelId: string) => {
  props.runtimeActions.navigation.clearActivityMetadata();
  props.runtimeActions.traditional.switchRightPanel(panelId);
};

const resolveSurfaceInput = (contractId: SurfaceContractId): Record<string, unknown> => {
  if (contractId === 'chat.main' && !props.runtimeContext.isMobile) {
    return {
      onOpenRoleProfile: openProfilePanel,
      onOpenPanel: onClearAndSwitchRightPanel
    };
  }
  return {};
};

// 宿主上下文工具事件由 Telegram 模式自己接管，不再经过 App / useShellBootstrap。
const onTelegramContextTool = (...args: unknown[]) => {
  const panelId = String(args[0] ?? '');
  if (panelId === 'characters') {
    openCharacters();
    return;
  }
  if (panelId === 'lumina-chat') {
    props.runtimeActions.navigation.switchMainView('lumina-chat');
    return;
  }
  if (panelId === 'telegram-profile') {
    openProfilePanel();
    return;
  }
  if (panelId.startsWith('lumina-')) {
    onClearAndSwitchRightPanel(panelId);
  }
};

let disposeContextToolListener: (() => void) | null = null;
let disposeActivityModeHandler: (() => void) | null = null;
onMounted(() => {
  disposeContextToolListener = props.runtimeActions.events.on('TELEGRAM_CONTEXT_TOOL', onTelegramContextTool);
  disposeActivityModeHandler = props.runtimeActions.traditional.registerActivityModeHandler(
    createTelegramActivityModeHandler(pushTelegramMobileRoute)
  );
});
onUnmounted(() => {
  disposeContextToolListener?.();
  disposeContextToolListener = null;
  disposeActivityModeHandler?.();
  disposeActivityModeHandler = null;
});

const resolvedActivityComponent = computed<Component | undefined>(() =>
  isTelegramMobileMode.value ? TelegramMobileStack : undefined
);
const resolvedActivityComponentProps = computed<Record<string, unknown> | undefined>(() => {
  if (!isTelegramMobileMode.value) return undefined;
  return {
    route: telegramMobileCurrentRoute.value,
    routeTitle: mobileStackTitle.value,
    showStackBar: mobileStackShowsBar.value,
    showBottomNavPadding: showBottomNav.value,
    mainSurfaceVariant: props.runtimeSurfaces.traditional.mainSurfaceVariant,
    mainSurfaceStyle: props.runtimeSurfaces.traditional.mainSurfaceStyle,
    mobileMainStyle: {},
    state: props.runtimeContext.characterChannelState,
    desktopModes: props.runtimeContext.desktopModeOptions,
    activeDesktopModeId: props.runtimeContext.activeDesktopModeId,
    widgetGroups: props.runtimeContext.widgetGroups,
    toolContractId: mobileToolContractId.value,
    toolProps: mobileToolProps.value,
    toolActivity: mobileToolActivity.value,
    toolAuxSidebarMode: mobileToolAuxSidebarMode.value,
    onPopRoute: popTelegramMobileRoute,
    onOpenSession: onOpenMobileSession,
    onCreateSession: onCreateMobileSession,
    onOpenPanel: onOpenMobilePanel,
    onHandleRoleProfileTool,
    onOpenRoleProfile: () => pushTelegramMobileRoute({ name: 'roleProfile' }),
    onUpdateDesktopMode: props.runtimeActions.navigation.updateDesktopMode,
    onSelectBottomNav,
    onClose: props.runtimeActions.navigation.close
  };
});
</script>
