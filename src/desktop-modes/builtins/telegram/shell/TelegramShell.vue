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
        :collapsed="isLeftPaneHidden"
        :widgetWidth="runtimeContext.traditional.widgetWidth"
        :onSetLeftRoute="setTelegramDesktopLeftRoute"
      />
    </template>

    <template #widget>
      <Transition name="lw-telegram-widget">
        <div
          v-if="showWidget"
          class="lw-telegram-widget-slot"
          :style="widgetSlotStyle"
        >
          <TelegramInfoPanelHost
            v-if="isProfilePanel"
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
            :onRenameSession="runtimeActions.traditional.renameConversationSession"
            :onDuplicateSession="runtimeActions.traditional.duplicateConversationSession"
            :onDeleteSession="runtimeActions.traditional.deleteConversationSession"
          />
          <WidgetPanelHost
            v-else
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
        </div>
      </Transition>
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
import { computed, onMounted, onUnmounted, provide, type Component, type CSSProperties } from 'vue';
import TraditionalShell from '../../../../shell/traditional/TraditionalShell.vue';
import WidgetPanelHost from '../../../../shell/traditional/WidgetPanelHost.vue';
import { useSurfaceSkin } from '../../../core/useSurfaceSkin.js';
import { createDesktopModeShellRuntime } from '../../../../platform/desktop-mode-runtime/shellContracts.js';
import type { DesktopModeShellProps } from '../../../../platform/desktop-mode-runtime/shellContracts.js';
import type { CreateChatConversationInput } from '../../../../types/ConversationContextTypes.js';
import type { SurfaceContractId } from '../../../../platform/surface/types.js';
import { activeSettings, updateSetting } from '../../../../stores/settingsState.js';
import { getDesktopModeSettingStorageKey, getDesktopModeSettingValue } from '../../../core/registry.js';
import { desktopSurfaceInputResolverKey } from '../../../../platform/surface/surfaceInputResolverContext.js';
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
  telegramMobileNavDirection,
  openProfilePanel,
  openCharacters,
  selectBottomNav,
  setTelegramDesktopLeftRoute,
  pushTelegramMobileRoute,
  popTelegramMobileRoute
} = useTelegramShell(shell);

const { cssVars: telegramFrameVars } = useSurfaceSkin('telegram.frame');
const telegramFrameStyle = computed(() => telegramFrameVars.value);

const leftPaneCollapsed = computed(() => getDesktopModeSettingValue(
  activeSettings,
  props.runtimeContext.activeDesktopModeId,
  'leftPaneCollapsed',
  false
) === true);
const toggleLeftPane = async () => {
  const storageKey = getDesktopModeSettingStorageKey(
    props.runtimeContext.activeDesktopModeId,
    'leftPaneCollapsed'
  );
  await updateSetting(storageKey, !leftPaneCollapsed.value);
};
// 折叠只在会话打开时生效：空态仍显示列表，避免折叠后无处选择会话
const isLeftPaneHidden = computed(() =>
  leftPaneCollapsed.value && Boolean(props.runtimeContext.characterChannelState.activeSessionId)
);

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
const widgetSlotStyle = computed<CSSProperties>(() => ({
  '--lw-telegram-widget-width': `${visibleWidgetWidth.value}px`
}));

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

// 点击会话时先推路由并让加载与动画在同一批次里开始；把加载推迟到动画帧内
// 会因其引发的重渲染打断过渡，所以不做延迟调度。
const onOpenMobileSession = (sessionId: string) => {
  pushTelegramMobileRoute({ name: 'chat', sessionId });
  props.runtimeActions.traditional.openConversationSession(sessionId);
};
const onCreateMobileSession = (payload: CreateChatConversationInput) => {
  pushTelegramMobileRoute({ name: 'chat' });
  props.runtimeActions.traditional.createConversationSession(payload);
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
      onToggleSidebar: toggleLeftPane,
      onOpenRoleProfile: openProfilePanel,
      onOpenPanel: onClearAndSwitchRightPanel
    };
  }
  return {};
};
// 桌面组合出口（ShellPrimaryActivityOutlet）不经过 TraditionalShell 的 resolver prop，
// 通过 provide 让主 surface 拿到模式回调（角色顶栏 / 侧栏切换）。
provide(desktopSurfaceInputResolverKey, resolveSurfaceInput);

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
    navDirection: telegramMobileNavDirection.value,
    routeTitle: mobileStackTitle.value,
    showStackBar: mobileStackShowsBar.value,
    showBottomNavPadding: showBottomNav.value,
    mainSurfaceVariant: props.runtimeSurfaces.traditional.mainSurfaceVariant,
    mainSurfaceStyle: props.runtimeSurfaces.traditional.mainSurfaceStyle,
    // 移动端一级页脱离玻璃底：设置/工具页不再叠 shell 主面背景，统一用移动页纯色
    mobileMainStyle: { '--lw-shell-main-bg': 'transparent' },
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
    onRenameSession: props.runtimeActions.traditional.renameConversationSession,
    onDuplicateSession: props.runtimeActions.traditional.duplicateConversationSession,
    onDeleteSession: props.runtimeActions.traditional.deleteConversationSession,
    onOpenPanel: onOpenMobilePanel,
    onHandleRoleProfileTool,
    onOpenRoleProfile: () => pushTelegramMobileRoute({ name: 'roleProfile' }),
    onUpdateDesktopMode: props.runtimeActions.navigation.updateDesktopMode,
    onSelectBottomNav,
    onClose: props.runtimeActions.navigation.close
  };
});
</script>

<style>
/* 右栏显隐：容器宽度从 0 到模式宽度过渡，仅过渡期间裁剪内容 */
.lw-telegram-widget-slot {
  flex: 0 0 auto;
  min-width: 0;
  width: var(--lw-telegram-widget-width, 0px);
}

.lw-telegram-widget-enter-active {
  overflow: hidden;
  transition: width 240ms cubic-bezier(0.16, 1, 0.3, 1);
}

.lw-telegram-widget-leave-active {
  overflow: hidden;
  transition: width 180ms cubic-bezier(0.16, 1, 0.3, 1);
}

.lw-telegram-widget-enter-from,
.lw-telegram-widget-leave-to {
  width: 0;
}

@media (prefers-reduced-motion: reduce) {
  .lw-telegram-widget-enter-active,
  .lw-telegram-widget-leave-active {
    transition: none !important;
  }
}

[data-motion='none'] .lw-telegram-widget-enter-active,
[data-motion='none'] .lw-telegram-widget-leave-active {
  transition: none !important;
}
</style>
