<template>
  <div
    class="lw-main-wrapper lw-telegram-mobile-stack"
    :class="{ 'has-telegram-mobile-nav': showBottomNavPadding }"
    :data-surface-variant="mainSurfaceVariant"
    :style="[mainSurfaceStyle, mobileMainStyle]"
  >
    <Transition :name="transitionName">
      <div :key="pageKey" class="lw-telegram-mobile-page">
        <header v-if="showStackBar" class="lw-telegram-mobile-stack__bar">
          <button type="button" title="返回" @click="onPopRoute">
            <svg viewBox="0 0 24 24" width="18" height="18" stroke="currentColor" stroke-width="2.4" fill="none">
              <polyline points="15 18 9 12 15 6"></polyline>
            </svg>
          </button>
          <strong>{{ routeTitle }}</strong>
        </header>

        <ThemedSurfaceOutlet
          v-if="route.name === 'conversationList'"
          contract-id="conversation.sessionList"
          :input="{ compact: true, onOpenSession, onStartNewChat: () => onSelectBottomNav('characters') }"
          :desktop-mode-id="activeDesktopModeId"
        />
        <ThemedSurfaceOutlet
          v-else-if="route.name === 'roleList'"
          contract-id="character.roster"
          :input="{ compact: true, onOpenSession, onCreateSession }"
          :desktop-mode-id="activeDesktopModeId"
        />
        <ThemedSurfaceOutlet
          v-else-if="route.name === 'roleProfile'"
          contract-id="telegram.infoPanel"
          :input="{
            state,
            isMobile: true,
            onOpenSession,
            onCreateSession,
            onRenameSession,
            onDuplicateSession,
            onDeleteSession,
            onOpenTool: onHandleRoleProfileTool
          }"
          :desktop-mode-id="activeDesktopModeId"
        />
        <ThemedSurfaceOutlet
          v-else-if="route.name === 'chat'"
          contract-id="chat.main"
          :input="{
            isMobile: true,
            enterTransitionMs: enterTransitionMs,
            onBack: onPopRoute,
            onOpenRoleProfile: onOpenRoleProfile,
            onOpenPanel: onOpenPanel
          }"
          :desktop-mode-id="activeDesktopModeId"
        />
        <ThemedSurfaceOutlet
          v-else-if="route.name === 'settings'"
          contract-id="settings.root"
          :input="{ activity: { size: 'small', pageType: 'standalone' } }"
          :desktop-mode-id="activeDesktopModeId"
        />
        <TelegramUserProfilePage
          v-else-if="route.name === 'profile'"
          :desktopModes="desktopModes"
          :activeDesktopModeId="activeDesktopModeId"
          :widgetGroups="widgetGroups"
          @setDesktopMode="onUpdateDesktopMode"
          @openSettings="onSelectBottomNav('settings')"
          @openPanel="onOpenPanel"
          @close="onClose"
        />
        <ThemedSurfaceOutlet
          v-else-if="route.name === 'tool' && toolContractId"
          :contract-id="toolContractId"
          :input="projectSurfaceInput(toolContractId, toolProps, {
            activity: toolActivity,
            isMobile: true,
            auxSidebarMode: toolAuxSidebarMode
          })"
          :desktop-mode-id="activeDesktopModeId"
        />
        <SurfaceFailure
          v-else-if="route.name === 'tool'"
          contract-id="tool-surface-unavailable"
        />
      </div>
    </Transition>
  </div>
</template>

<script setup lang="ts">
import { computed, type CSSProperties } from 'vue';
import type { ActivityDescriptor } from '../../../../platform/activity/types.js';
import type { SurfaceContractId } from '../../../../platform/surface/types.js';
import ThemedSurfaceOutlet from '../../../../platform/surface/ThemedSurfaceOutlet.vue';
import SurfaceFailure from '../../../../platform/surface/SurfaceFailure.vue';
import { projectSurfaceInput } from '../../../../platform/surface/surfaceInputProjection.js';
import type { CharacterChannelState } from '../../../../types/ConversationContextTypes.js';
import type { WidgetPanelGroup } from '../../../../shell/types.js';
import type { CreateChatConversationInput } from '../../../../types/ConversationContextTypes.js';
import TelegramUserProfilePage from './TelegramUserProfilePage.vue';
import {
  resolveTelegramStackPageKey,
  resolveTelegramStackTransitionName
} from './telegramRouteViewModel.js';
import type { TelegramStackNavDirection, TelegramStackRoute } from './types.js';

const props = defineProps<{
  route: TelegramStackRoute;
  navDirection: TelegramStackNavDirection;
  routeTitle: string;
  showStackBar: boolean;
  showBottomNavPadding: boolean;
  mainSurfaceVariant: string;
  mainSurfaceStyle: CSSProperties;
  mobileMainStyle: CSSProperties;
  state: CharacterChannelState;
  desktopModes: Array<{ value: string; label: string; description?: string }>;
  activeDesktopModeId: string;
  widgetGroups: WidgetPanelGroup[];
  toolContractId: SurfaceContractId | null;
  toolProps: Record<string, unknown>;
  toolActivity: ActivityDescriptor;
  toolAuxSidebarMode?: 'hidden';
  onPopRoute: () => void;
  onOpenSession: (sessionId: string) => void;
  onCreateSession: (payload: CreateChatConversationInput) => void;
  onRenameSession: (sessionId: string, nextTitle: string) => void;
  onDuplicateSession: (sessionId: string, title?: string) => void;
  onDeleteSession: (sessionId: string) => void;
  onOpenPanel: (panelId: string) => void;
  onHandleRoleProfileTool: (panelId: string) => void;
  onOpenRoleProfile: () => void;
  onUpdateDesktopMode: (desktopModeId: string) => void;
  onSelectBottomNav: (itemId: 'chat' | 'characters' | 'settings' | 'profile') => void;
  onClose: () => void;
}>();

const pageKey = computed(() => resolveTelegramStackPageKey(props.route));
const transitionName = computed(() => resolveTelegramStackTransitionName(props.navDirection));

/** 与下方 keyframes 时长保持一致；聊天 surface 会在过渡结束前先不挂载消息 */
const STACK_ANIMATION_MS: Record<TelegramStackNavDirection, number> = {
  forward: 280,
  back: 260,
  fade: 160
};
const enterTransitionMs = computed(() => STACK_ANIMATION_MS[props.navDirection] ?? 0);
</script>

<style>
/* 底部导航悬浮在内容之上：整页不再为它预留 padding，底部留白由各页自身承担 */
.lw-main-wrapper.has-telegram-mobile-nav {
  padding-bottom: 0;
}

.lw-telegram-mobile-stack {
  position: relative;
}

/* 移动端一级页脱离壁纸，按原版使用纯色列表底；桌面三栏保持通透玻璃 */
.lw-main-wrapper.lw-telegram-mobile-stack {
  /* 移动端满幅：基础 .lw-main-wrapper 的边框只保留了左右 1px，这里一并去掉 */
  border: 0;
  --lw-telegram-pane-list-bg: transparent;
  --lw-telegram-mobile-page-bg: #ffffff;
  --lw-telegram-search-bg: #f1f2f4;
  --lw-border-base: rgba(0, 0, 0, 0.08);
  --lw-text-secondary: #707579;
  --lw-text-muted: #a2acb4;
  background: var(--lw-telegram-mobile-page-bg, var(--lw-bg-surface));
}

[data-theme='dark'] .lw-main-wrapper.lw-telegram-mobile-stack {
  --lw-telegram-mobile-page-bg: #17212b;
  --lw-telegram-search-bg: #242f3d;
  --lw-border-base: rgba(255, 255, 255, 0.08);
  --lw-text-secondary: #708499;
  --lw-text-muted: #6c7883;
  --lw-primary: #5eb5f7;
  --lw-primary-rgb: 94, 181, 247;
}

/* 移动端设置页与资料页同层级：自铺 layer-base 灰底，白色卡片在其上 */
.lw-main-wrapper.lw-telegram-mobile-stack .lw-settings-root[data-skin-variant='telegram'] {
  background: var(--lw-telegram-layer-base, var(--lw-bg-app));
}

.lw-telegram-mobile-stack__bar {
  min-height: 52px;
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  align-items: center;
  gap: 10px;
  padding: calc(6px + var(--lw-content-safe-top, var(--lw-safe-top, 0px))) 14px 6px;
  border-bottom: 1px solid color-mix(in srgb, var(--lw-border-base) 72%, transparent);
  background: color-mix(in srgb, var(--lw-surface-container-high) 76%, transparent);
}

.lw-telegram-mobile-stack__bar button {
  width: 40px;
  height: 40px;
  border: none;
  border-radius: 999px;
  background: color-mix(in srgb, var(--lw-surface-container-highest) 72%, transparent);
  color: var(--lw-text-main);
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

.lw-telegram-mobile-stack__bar strong {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: var(--lw-type-title-small-size);
  line-height: var(--lw-type-title-small-line-height);
  font-weight: var(--lw-type-title-small-weight);
  letter-spacing: var(--lw-type-title-small-tracking);
}

/* 页面栈过渡：push 从右滑入、pop 反向、tab 切换只淡入；退出页绝对定位，两页同时在动。
   两页都用不透明页底，且按"被推走 / 被揭走"的层次压叠，避免滑到一半时透视出下层页面文字。 */
.lw-telegram-mobile-page {
  flex: 1 1 auto;
  min-width: 0;
  min-height: 0;
  display: flex;
  flex-direction: column;
  background: var(--lw-telegram-mobile-page-bg, var(--lw-bg-surface));
}

.lw-telegram-stack-forward-enter-active,
.lw-telegram-stack-back-enter-active,
.lw-telegram-stack-fade-enter-active {
  position: relative;
  z-index: 2;
  will-change: transform, opacity;
}

.lw-telegram-stack-forward-leave-active,
.lw-telegram-stack-back-leave-active,
.lw-telegram-stack-fade-leave-active {
  position: absolute;
  inset: 0;
  z-index: 1;
  will-change: transform, opacity;
}

/* pop 时退场的聊天页盖在入场列表之上，滑走才露出列表，符合系统返回手势的层次 */
.lw-telegram-stack-back-leave-active {
  z-index: 3;
}

.lw-telegram-stack-forward-enter-active {
  animation: lw-telegram-stack-forward-enter 280ms cubic-bezier(0.2, 0, 0, 1) both;
}

.lw-telegram-stack-forward-leave-active {
  animation: lw-telegram-stack-forward-leave 260ms cubic-bezier(0.2, 0, 0, 1) both;
}

.lw-telegram-stack-back-enter-active {
  animation: lw-telegram-stack-back-enter 260ms cubic-bezier(0.2, 0, 0, 1) both;
}

.lw-telegram-stack-back-leave-active {
  animation: lw-telegram-stack-back-leave 240ms cubic-bezier(0.2, 0, 0, 1) both;
}

.lw-telegram-stack-fade-enter-active {
  animation: lw-telegram-stack-fade-in 160ms cubic-bezier(0.2, 0, 0, 1) both;
}

.lw-telegram-stack-fade-leave-active {
  animation: lw-telegram-stack-fade-out 130ms cubic-bezier(0.2, 0, 0, 1) both;
}

/* 用 keyframes 而不是 transition：动画在入场类挂上的当帧即开始，不等 Vue 的双 rAF */
@keyframes lw-telegram-stack-forward-enter {
  from { transform: translateX(100%); }
}

@keyframes lw-telegram-stack-forward-leave {
  to { transform: translateX(-28%); opacity: 0.7; }
}

@keyframes lw-telegram-stack-back-enter {
  from { transform: translateX(-28%); }
}

@keyframes lw-telegram-stack-back-leave {
  to { transform: translateX(100%); }
}

@keyframes lw-telegram-stack-fade-in {
  from { opacity: 0; }
}

@keyframes lw-telegram-stack-fade-out {
  to { opacity: 0; }
}

@media (prefers-reduced-motion: reduce) {
  .lw-telegram-mobile-page {
    animation: none !important;
    transition: none !important;
  }
}

[data-motion='none'] .lw-telegram-mobile-page {
  animation: none !important;
  transition: none !important;
}
</style>
