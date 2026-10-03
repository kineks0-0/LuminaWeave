<template>
  <aside
    class="lw-telegram-profile"
    :class="{ 'is-mobile': props.isMobile }"
    :style="infoPanelStyle"
    aria-label="角色资料"
  >
    <header class="lw-telegram-profile__topbar">
      <button
        v-if="props.isMobile"
        type="button"
        class="lw-telegram-profile__bar-button"
        title="返回"
        aria-label="返回"
        @click="props.onOpenTool('none')"
      >
        <ArrowLeft :size="24" />
      </button>
      <strong v-else>角色资料</strong>
      <button
        v-if="!props.isMobile"
        type="button"
        class="lw-telegram-profile__bar-button"
        title="关闭"
        aria-label="关闭角色资料"
        @click="props.onOpenTool('none')"
      >
        <X :size="22" />
      </button>
    </header>

    <section class="lw-telegram-profile__hero">
      <div class="lw-telegram-profile__avatar" :style="getTelegramAvatarStyle(profile.name)">
        <img v-if="profile.avatarUrl" :src="profile.avatarUrl" :alt="profile.name" @error="hideBrokenTelegramAvatar">
        <span v-else>{{ getTelegramInitial(profile.name) }}</span>
      </div>
      <h2>{{ profile.name }}</h2>
      <p>{{ statusText }}</p>
    </section>

    <div class="lw-telegram-profile__actions" aria-label="角色操作">
      <button
        v-for="action in actions"
        :key="action.id"
        type="button"
        :disabled="action.disabled"
        @click="action.run"
      >
        <component :is="action.icon" :size="24" :stroke-width="2.2" aria-hidden="true" />
        <span>{{ action.label }}</span>
      </button>
    </div>

    <section class="lw-telegram-profile__card">
      <div class="lw-telegram-profile__field">
        <p class="lw-telegram-profile__bio">{{ bioText }}</p>
        <small>最近消息</small>
      </div>
      <div v-if="currentSession" class="lw-telegram-profile__field">
        <p>{{ currentSession.title }}</p>
        <small>当前会话</small>
      </div>
    </section>

    <section class="lw-telegram-profile__card is-list" aria-label="更多工具">
      <button
        v-for="tool in extraTools"
        :key="tool.panelId"
        type="button"
        class="lw-telegram-profile__link"
        @click="props.onOpenTool(tool.panelId)"
      >
        <span class="lw-telegram-profile__link-icon" :data-tone="tool.tone">
          <component :is="tool.icon" :size="20" :stroke-width="2.2" aria-hidden="true" />
        </span>
        <span>{{ tool.label }}</span>
        <ChevronRight :size="20" aria-hidden="true" />
      </button>
    </section>

    <h3 class="lw-telegram-profile__section-title">会话 · {{ allSessions.length }}</h3>
    <section class="lw-telegram-profile__card is-list" aria-label="会话">
      <button
        v-for="session in allSessions"
        :key="session.id"
        type="button"
        class="lw-telegram-profile__session"
        :class="{ 'is-current': session.id === currentSession?.id }"
        @click="props.onOpenSession(session.id)"
      >
        <span class="lw-telegram-profile__session-copy">
          <strong>{{ session.title }}</strong>
          <small>{{ session.recentHistoryPreview || session.previewMessage || session.summary || '暂无消息' }}</small>
        </span>
        <time>{{ formatSessionTime(session.updatedAt) }}</time>
      </button>
      <button type="button" class="lw-telegram-profile__session is-new" :disabled="!activeGroup" @click="createSession">
        <MessageCirclePlus :size="20" :stroke-width="2.2" aria-hidden="true" />
        <strong>新建会话</strong>
      </button>
    </section>
  </aside>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import type { Component, CSSProperties } from 'vue';
import {
  Activity,
  ArrowLeft,
  BookOpen,
  ChevronRight,
  Clapperboard,
  MessageCircle,
  MessageCirclePlus,
  Waypoints,
  X
} from 'lucide-vue-next';
import { useSurfaceSkin } from '../../../desktop-modes/core/useSurfaceSkin.js';
import type {
  CharacterChannelGroup,
  CharacterChannelSessionItem
} from '../../../types/ConversationContextTypes.js';
import { useSurfaceInput } from '../../../platform/surface/useSurfaceRuntimeContext.js';
import {
  getTelegramAvatarStyle,
  getTelegramInitial,
  hideBrokenTelegramAvatar
} from './telegramVisual.js';

interface ProfileAction {
  id: string;
  label: string;
  icon: Component;
  disabled: boolean;
  run: () => void;
}

const props = useSurfaceInput('telegram.infoPanel');

const { cssVars: infoPanelVars } = useSurfaceSkin('telegram.infoPanel');
const infoPanelStyle = computed<CSSProperties>(() => infoPanelVars.value as CSSProperties);

const activeGroup = computed<CharacterChannelGroup | null>(() => {
  const activeSessionId = props.state.activeSessionId || props.state.selectedViewSessionId;
  return props.state.characterGroups.find((group) => (
    activeSessionId
      ? group.sessions.some((session) => session.id === activeSessionId)
      : group.key === props.state.expandedCharacterKey
  )) || props.state.characterGroups[0] || null;
});

const allSessions = computed<CharacterChannelSessionItem[]>(() => (
  [...(activeGroup.value?.sessions || [])]
    .sort((left, right) => right.updatedAt - left.updatedAt)
));

const currentSession = computed<CharacterChannelSessionItem | null>(() => {
  const sessionId = props.state.activeSessionId || props.state.selectedViewSessionId;
  return allSessions.value.find((session) => session.id === sessionId)
    || allSessions.value[0]
    || null;
});

const profile = computed(() => {
  const group = activeGroup.value;
  return {
    name: group?.characterName?.trim() || '未选择角色',
    avatarUrl: group?.characterAvatarUrl || ''
  };
});

const statusText = computed(() => {
  if (props.state.status.kind === 'switching') return '正在切换…';
  if (props.state.status.kind === 'loading') return '正在加载…';
  if (props.state.status.kind === 'error') return '需要同步';
  return `${allSessions.value.length} 个会话`;
});

const bioText = computed(() => (
  activeGroup.value?.recentPreview
  || currentSession.value?.summary
  || currentSession.value?.previewMessage
  || '还没有聊天记录'
));

const openLatestSession = (): void => {
  const session = currentSession.value;
  if (session) props.onOpenSession(session.id);
  else createSession();
};

const createSession = (): void => {
  const group = activeGroup.value;
  if (!group) return;
  props.onCreateSession({
    characterId: group.characterId,
    characterName: group.characterName,
    characterAvatarUrl: group.characterAvatarUrl
  });
};

// 原版的“消息 / 静音 / 分享 / 停用”在这里换成角色常用的四个入口
const actions = computed<ProfileAction[]>(() => [
  { id: 'message', label: '消息', icon: MessageCircle, disabled: !activeGroup.value, run: openLatestSession },
  { id: 'new', label: '新会话', icon: MessageCirclePlus, disabled: !activeGroup.value, run: createSession },
  { id: 'timeline', label: '时间线', icon: Waypoints, disabled: false, run: () => props.onOpenTool('lumina-timeline') },
  { id: 'lorebook', label: '世界书', icon: BookOpen, disabled: false, run: () => props.onOpenTool('lumina-lorebook') }
]);

const extraTools = [
  { panelId: 'lumina-director', label: '导演面板', icon: Clapperboard, tone: 'violet' },
  { panelId: 'lumina-stats', label: '状态', icon: Activity, tone: 'green' }
] as const;

const pad = (value: number): string => String(value).padStart(2, '0');

const formatSessionTime = (timestamp: number): string => {
  const date = new Date(timestamp);
  const today = new Date();
  if (date.toDateString() === today.toDateString()) return `${pad(date.getHours())}:${pad(date.getMinutes())}`;
  return date.getFullYear() === today.getFullYear()
    ? `${date.getMonth() + 1}月${date.getDate()}日`
    : `${pad(date.getFullYear() % 100)}.${pad(date.getMonth() + 1)}.${pad(date.getDate())}`;
};
</script>

<style scoped>
.lw-telegram-profile {
  flex: 1;
  min-width: 0;
  min-height: 0;
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 0 12px calc(24px + var(--lw-content-safe-bottom, 0px));
  background: var(--lw-telegram-info-panel-bg, var(--lw-bg-app));
  color: var(--lw-text-main);
  overflow: auto;
}

.lw-telegram-profile > * {
  /* 整页滚动，各区块保持自身高度 */
  flex-shrink: 0;
}

.lw-telegram-profile__topbar {
  position: sticky;
  top: 0;
  z-index: 1;
  display: flex;
  min-height: 56px;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  margin: 0 -12px;
  padding: calc(6px + var(--lw-content-safe-top, 0px)) 8px 6px;
  background: var(--lw-telegram-info-panel-bg, var(--lw-bg-app));
}

.lw-telegram-profile__topbar strong {
  padding-left: 10px;
  font-size: 1.125rem;
  font-weight: 600;
}

.lw-telegram-profile__bar-button {
  display: grid;
  width: 44px;
  height: 44px;
  place-items: center;
  border: 0;
  border-radius: 999px;
  background: transparent;
  color: var(--lw-text-main);
  cursor: pointer;
}

.lw-telegram-profile__bar-button:hover {
  background: var(--lw-bg-hover);
}

.lw-telegram-profile__hero {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  padding: 4px 0 8px;
  text-align: center;
}

.lw-telegram-profile__avatar {
  display: grid;
  width: 108px;
  height: 108px;
  margin-bottom: 12px;
  place-items: center;
  overflow: hidden;
  border-radius: 999px;
  background: var(--lw-telegram-avatar-bg);
  color: var(--lw-text-inverse);
  font-size: 2.5rem;
  font-weight: 600;
}

.lw-telegram-profile__avatar img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.lw-telegram-profile__hero h2 {
  max-width: 100%;
  margin: 0;
  overflow: hidden;
  font-size: 1.5rem;
  font-weight: 600;
  line-height: 1.25;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.lw-telegram-profile__hero p {
  margin: 0;
  color: var(--lw-text-muted);
  font-size: 1rem;
}

.lw-telegram-profile__actions {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 8px;
}

.lw-telegram-profile__actions button {
  display: flex;
  min-width: 0;
  min-height: 62px;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 4px;
  border: 0;
  border-radius: 14px;
  background: var(--lw-telegram-info-card-bg, var(--lw-bg-surface));
  color: var(--lw-text-main);
  font: inherit;
  font-size: 0.8125rem;
  font-weight: 500;
  cursor: pointer;
  transition: background-color var(--lw-transition);
}

.lw-telegram-profile__actions button:hover:not(:disabled) {
  background: color-mix(in srgb, var(--lw-text-main) 6%, var(--lw-telegram-info-card-bg, var(--lw-bg-surface)));
}

.lw-telegram-profile__actions button:disabled {
  cursor: not-allowed;
  opacity: 0.45;
}

.lw-telegram-profile__card {
  display: flex;
  flex-direction: column;
  overflow: hidden;
  border-radius: 16px;
  background: var(--lw-telegram-info-card-bg, var(--lw-bg-surface));
}

.lw-telegram-profile__field {
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: 12px 18px;
}

.lw-telegram-profile__field p {
  margin: 0;
  font-size: 1.0625rem;
  line-height: 1.4;
  overflow-wrap: anywhere;
}

.lw-telegram-profile__bio {
  display: -webkit-box;
  overflow: hidden;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 3;
}

.lw-telegram-profile__field small {
  color: var(--lw-text-muted);
  font-size: 0.875rem;
}

.lw-telegram-profile__link,
.lw-telegram-profile__session {
  display: flex;
  min-height: 56px;
  align-items: center;
  gap: 16px;
  border: 0;
  background: transparent;
  color: var(--lw-text-main);
  padding: 8px 14px 8px 16px;
  font: inherit;
  font-size: 1.0625rem;
  text-align: left;
  cursor: pointer;
  transition: background-color var(--lw-transition);
}

.lw-telegram-profile__link:hover,
.lw-telegram-profile__session:hover:not(:disabled) {
  background: var(--lw-bg-hover);
}

.lw-telegram-profile__link > span:nth-child(2) {
  flex: 1;
}

.lw-telegram-profile__link > svg {
  color: var(--lw-text-muted);
}

.lw-telegram-profile__link-icon {
  display: grid;
  width: 34px;
  height: 34px;
  place-items: center;
  border-radius: 10px;
  background: var(--lw-primary);
  color: var(--lw-text-inverse);
}

.lw-telegram-profile__link-icon[data-tone='violet'] {
  background: color-mix(in srgb, var(--lw-primary) 40%, oklch(0.6 0.2 300));
}

.lw-telegram-profile__link-icon[data-tone='green'] {
  background: oklch(0.68 0.16 150);
}

.lw-telegram-profile__section-title {
  margin: 8px 6px -4px;
  color: var(--lw-primary);
  font-size: 0.9375rem;
  font-weight: 600;
}

.lw-telegram-profile__session-copy {
  display: flex;
  min-width: 0;
  flex: 1;
  flex-direction: column;
  gap: 2px;
}

.lw-telegram-profile__session-copy strong,
.lw-telegram-profile__session-copy small {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.lw-telegram-profile__session-copy strong {
  font-weight: 500;
}

.lw-telegram-profile__session-copy small,
.lw-telegram-profile__session time {
  color: var(--lw-text-muted);
  font-size: 0.875rem;
}

.lw-telegram-profile__session.is-current strong {
  color: var(--lw-primary);
}

.lw-telegram-profile__session.is-new {
  color: var(--lw-primary);
}

.lw-telegram-profile__session.is-new strong {
  font-weight: 500;
}

.lw-telegram-profile__session:disabled {
  cursor: not-allowed;
  opacity: 0.45;
}

.lw-telegram-profile__card.is-list > * + * {
  box-shadow: inset 0 1px 0 var(--lw-border-subtle, var(--lw-border-base));
}
</style>
