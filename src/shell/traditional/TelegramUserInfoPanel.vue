<template>
  <aside
    class="lw-telegram-profile"
    :class="{ 'is-mobile': isMobile }"
    :style="infoPanelStyle"
    aria-label="Telegram role profile"
  >
    <header class="lw-telegram-profile__topbar">
      <button type="button" title="返回" @click="emit('openTool', 'none')">
        <component :is="getTelegramIconComponent('back')" :size="22" :stroke-width="TELEGRAM_ICON_STROKE_WIDTH" aria-hidden="true" />
      </button>
      <div>
        <strong>{{ isMobile ? profile.name : '角色资料' }}</strong>
        <span>{{ syncText }}</span>
      </div>
      <button type="button" title="更多" @click="handleTopbarTrailingClick">
        <component
          :is="getTelegramIconComponent(isMobile ? 'more' : 'close')"
          :size="22"
          :stroke-width="TELEGRAM_ICON_STROKE_WIDTH"
          aria-hidden="true"
        />
      </button>
    </header>

    <section class="lw-telegram-profile__hero">
      <div class="lw-telegram-profile__avatar" :style="getTelegramAvatarStyle(profile.name)">
        <img v-if="profile.avatarUrl" :src="profile.avatarUrl" :alt="profile.name" @error="hideBrokenTelegramAvatar">
        <span v-else>{{ getTelegramInitial(profile.name) }}</span>
      </div>
      <div class="lw-telegram-profile__identity">
        <div>
          <h2>{{ profile.name }}</h2>
          <span class="lw-telegram-profile__badge">角色</span>
        </div>
        <p>{{ profileDescription }}</p>
        <div class="lw-telegram-profile__sync">
          <span>
            <component :is="getTelegramIconComponent('check')" :size="14" :stroke-width="TELEGRAM_ICON_STROKE_WIDTH" aria-hidden="true" />
            已同步
          </span>
          <small>最后同步：{{ lastSyncText }}</small>
        </div>
      </div>
    </section>

    <div class="lw-telegram-profile__actions" aria-label="角色操作">
      <button type="button" :disabled="!activeGroup" @click="createSession">
        <component :is="getTelegramIconComponent('chat')" :size="26" :stroke-width="TELEGRAM_ICON_STROKE_WIDTH" aria-hidden="true" />
        <span>{{ isMobile ? '消息' : '新聊天' }}</span>
      </button>
      <button type="button" @click="activeTab = 'history'">
        <component :is="getTelegramIconComponent('history')" :size="26" :stroke-width="TELEGRAM_ICON_STROKE_WIDTH" aria-hidden="true" />
        <span>历史</span>
      </button>
      <button type="button" @click="activeTab = 'tools'">
        <component :is="getTelegramIconComponent('grid')" :size="26" :stroke-width="TELEGRAM_ICON_STROKE_WIDTH" aria-hidden="true" />
        <span>工具</span>
      </button>
    </div>

    <nav class="lw-telegram-profile__tabs" aria-label="角色资料分区">
      <button type="button" :class="{ active: activeTab === 'history' }" @click="activeTab = 'history'">历史</button>
      <button type="button" :class="{ active: activeTab === 'tools' }" @click="activeTab = 'tools'">工具</button>
    </nav>

    <section v-if="activeTab === 'tools'" class="lw-telegram-profile__section">
      <h3>上下文工具</h3>
      <div class="lw-telegram-profile__quick">
        <button
          v-for="tool in contextTools"
          :key="tool.id"
          type="button"
          @click="emit('openTool', tool.panelId)"
        >
          <span class="tool-icon">
            <component :is="getTelegramIconComponent(tool.icon)" :size="22" :stroke-width="TELEGRAM_ICON_STROKE_WIDTH" aria-hidden="true" />
          </span>
          <strong>{{ tool.label }}</strong>
        </button>
      </div>
    </section>

    <section v-else class="lw-telegram-profile__section">
      <header>
        <h3>最近聊天</h3>
        <button type="button" :disabled="allSessions.length === 0" @click="openFirstSession">查看全部</button>
      </header>
      <div v-if="recentSessions.length > 0" class="lw-telegram-profile__recent">
        <button
          v-for="session in recentSessions"
          :key="session.id"
          type="button"
          @click="emit('openSession', session.id)"
        >
          <span class="chat-icon">
            <component :is="getTelegramIconComponent('chat')" :size="20" :stroke-width="TELEGRAM_ICON_STROKE_WIDTH" aria-hidden="true" />
          </span>
          <span>
            <strong>{{ session.title }}</strong>
            <small>{{ session.previewMessage || session.summary || session.recentHistoryPreview || '暂无预览' }}</small>
          </span>
          <time>{{ formatSessionTime(session.updatedAt) }}</time>
        </button>
      </div>
      <p v-else class="lw-telegram-profile__empty">还没有最近聊天。</p>
      <div v-if="allSessions.length > recentSessions.length" class="lw-telegram-profile__history">
        <button
          v-for="session in allSessions.slice(recentSessions.length)"
          :key="session.id"
          type="button"
          @click="emit('openSession', session.id)"
        >
          <span class="history-icon">
            <component :is="getTelegramIconComponent('chat')" :size="18" :stroke-width="TELEGRAM_ICON_STROKE_WIDTH" aria-hidden="true" />
          </span>
          <strong>{{ session.title }}</strong>
          <small>{{ formatSessionTime(session.updatedAt) }}</small>
          <span>
            <component :is="getTelegramIconComponent('chevronRight')" :size="18" :stroke-width="TELEGRAM_ICON_STROKE_WIDTH" aria-hidden="true" />
          </span>
        </button>
      </div>
    </section>
  </aside>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import type { CSSProperties } from 'vue';
import { useSurfaceSkin } from '../../desktop-modes/core/useSurfaceSkin.js';
import type {
  CharacterChannelGroup,
  CharacterChannelSessionItem,
  CharacterChannelState,
  CreateChatConversationInput
} from '../../types/ConversationContextTypes.js';
import {
  TELEGRAM_ICON_STROKE_WIDTH,
  type TelegramIconName,
  getTelegramAvatarStyle,
  getTelegramIconComponent,
  getTelegramInitial,
  hideBrokenTelegramAvatar
} from './telegramVisual.js';

interface ContextTool {
  id: string;
  label: string;
  panelId: string;
  icon: TelegramIconName;
}

const props = withDefaults(defineProps<{
  state: CharacterChannelState;
  isMobile?: boolean;
}>(), {
  isMobile: false
});

const emit = defineEmits<{
  (e: 'openTool', panelId: string): void;
  (e: 'createSession', payload: CreateChatConversationInput): void;
  (e: 'openSession', sessionId: string): void;
}>();

const { cssVars: infoPanelVars } = useSurfaceSkin('telegram.infoPanel');
const infoPanelStyle = computed<CSSProperties>(() => infoPanelVars.value as CSSProperties);
const activeTab = ref<'history' | 'tools'>('history');

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

const recentSessions = computed<CharacterChannelSessionItem[]>(() => allSessions.value.slice(0, 3));

const profile = computed(() => {
  const group = activeGroup.value;
  const name = group?.characterName?.trim() || '未选择角色';
  return {
    name,
    avatarUrl: group?.characterAvatarUrl || '',
    initial: group?.characterInitial || getTelegramInitial(name)
  };
});

const profileDescription = computed(() => (
  activeGroup.value?.recentPreview
  || currentSession.value?.summary
  || currentSession.value?.previewMessage
  || '当前角色资料已就绪，可从这里进入聊天和上下文工具。'
));

const syncText = computed(() => {
  if (props.state.status.kind === 'switching') return '正在切换';
  if (props.state.status.kind === 'loading') return '正在加载';
  if (props.state.status.kind === 'error') return '需要同步';
  return '已同步';
});

const lastSyncText = computed(() => (
  currentSession.value ? formatSessionTime(currentSession.value.updatedAt) : '9:41'
));

const contextTools = computed<ContextTool[]>(() => [
  { id: 'timeline', label: '时间线', panelId: 'lumina-timeline', icon: 'timeline' },
  { id: 'stats', label: '状态', panelId: 'lumina-stats', icon: 'spark' },
  { id: 'director', label: '导演', panelId: 'lumina-director', icon: 'bot' },
  { id: 'lorebook', label: '世界书', panelId: 'lumina-lorebook', icon: 'book' }
]);

const createSession = () => {
  const group = activeGroup.value;
  if (!group) return;
  emit('createSession', {
    characterId: group.characterId,
    characterName: group.characterName,
    characterAvatarUrl: group.characterAvatarUrl
  });
};

const openFirstSession = () => {
  const session = allSessions.value[0];
  if (session) {
    emit('openSession', session.id);
  }
};

const handleTopbarTrailingClick = () => {
  if (!props.isMobile) {
    emit('openTool', 'none');
    return;
  }
  activeTab.value = activeTab.value === 'tools' ? 'history' : 'tools';
};

const formatSessionTime = (timestamp: number) => {
  const delta = Date.now() - timestamp;
  if (delta < 60_000) return '刚刚';
  if (delta < 3_600_000) return `${Math.floor(delta / 60_000)} 分钟前`;
  if (delta < 86_400_000) return `${Math.floor(delta / 3_600_000)} 小时前`;
  return new Date(timestamp).toLocaleDateString([], { month: 'numeric', day: 'numeric' });
};
</script>

<style scoped>
.lw-telegram-profile {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding: 18px 16px 20px;
  color: var(--lw-text-main);
  overflow: auto;
}

.lw-telegram-profile__topbar {
  min-height: 46px;
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  align-items: center;
  gap: 10px;
}

.lw-telegram-profile__topbar button {
  width: 38px;
  height: 38px;
  border: none;
  border-radius: 999px;
  background: var(--lw-telegram-glass-bg, color-mix(in srgb, var(--lw-surface-container-highest) 72%, transparent));
  color: var(--lw-text-main);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
}

.lw-telegram-profile__topbar div {
  min-width: 0;
  text-align: center;
}

.lw-telegram-profile__topbar strong {
  display: block;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: var(--lw-type-title-medium-size);
  line-height: var(--lw-type-title-medium-line-height);
  font-weight: var(--lw-type-title-medium-weight);
  letter-spacing: var(--lw-type-title-medium-tracking);
}

.lw-telegram-profile__topbar span {
  color: var(--lw-text-secondary);
  font-size: var(--lw-type-body-small-size);
  line-height: var(--lw-type-body-small-line-height);
  font-weight: var(--lw-type-body-small-weight);
  letter-spacing: var(--lw-type-body-small-tracking);
}

.lw-telegram-profile__hero {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr);
  align-items: center;
  gap: 18px;
  padding: 10px 0 6px;
}

.lw-telegram-profile__avatar {
  width: 96px;
  height: 96px;
  border-radius: 999px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  background: var(--lw-telegram-avatar-bg, #82c7f5);
  border: 3px solid color-mix(in srgb, var(--lw-surface-container-highest) 92%, transparent);
  color: #102338;
  font-size: var(--lw-type-headline-large-size);
  line-height: var(--lw-type-headline-large-line-height);
  font-weight: var(--lw-type-headline-large-weight);
  letter-spacing: var(--lw-type-headline-large-tracking);
  box-shadow: 0 18px 34px rgba(44, 92, 130, 0.16);
}

.lw-telegram-profile__avatar img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.lw-telegram-profile__identity {
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.lw-telegram-profile__identity > div {
  display: flex;
  align-items: center;
  gap: 8px;
}

.lw-telegram-profile__identity h2,
.lw-telegram-profile__identity p {
  margin: 0;
}

.lw-telegram-profile__identity h2 {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 24px;
  line-height: 30px;
  font-weight: 700;
  letter-spacing: 0;
}

.lw-telegram-profile__badge,
.lw-telegram-profile__sync span {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  border-radius: 999px;
  background: color-mix(in srgb, var(--lw-primary) 14%, transparent);
  color: var(--lw-primary);
  font-size: 12px;
  line-height: 17px;
  font-weight: 650;
  letter-spacing: 0;
}

.lw-telegram-profile__badge {
  padding: 4px 9px;
}

.lw-telegram-profile__identity p {
  color: var(--lw-text-secondary);
  font-size: 13px;
  line-height: 19px;
  font-weight: 450;
  letter-spacing: 0;
}

.lw-telegram-profile__sync {
  display: flex;
  flex-direction: column;
  gap: 5px;
}

.lw-telegram-profile__sync span {
  width: max-content;
  padding: 5px 9px;
  color: #188c45;
  background: color-mix(in srgb, #53d17a 18%, transparent);
}

.lw-telegram-profile__sync small {
  color: var(--lw-text-muted);
  font-size: var(--lw-type-body-small-size);
  line-height: var(--lw-type-body-small-line-height);
  font-weight: var(--lw-type-body-small-weight);
  letter-spacing: var(--lw-type-body-small-tracking);
}

.lw-telegram-profile__section {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 14px;
  border: 0;
  border-radius: 22px;
  background: var(--lw-telegram-glass-bg, color-mix(in srgb, var(--lw-surface-container-highest) 72%, transparent));
  box-shadow: none;
  backdrop-filter: var(--lw-telegram-glass-blur, blur(18px));
  -webkit-backdrop-filter: var(--lw-telegram-glass-blur, blur(18px));
}

.lw-telegram-profile__actions {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 10px;
}

.lw-telegram-profile__actions button {
  min-height: 62px;
  border: 0;
  border-radius: 18px;
  background: var(--lw-telegram-glass-bg, color-mix(in srgb, var(--lw-surface-container-highest) 62%, transparent));
  color: var(--lw-text-main);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  box-shadow: none;
  font-size: 13px;
  line-height: 18px;
  font-weight: 650;
  letter-spacing: 0;
}

.lw-telegram-profile__actions button:disabled {
  opacity: 0.54;
  cursor: default;
}

.lw-telegram-profile__tabs {
  width: max-content;
  max-width: 100%;
  align-self: center;
  display: grid;
  grid-template-columns: repeat(2, minmax(90px, 1fr));
  padding: 5px;
  border: 0.5px solid var(--lw-telegram-tab-rim, color-mix(in srgb, var(--lw-border-base) 42%, transparent));
  border-radius: 999px;
  background: var(--lw-telegram-tab-bg, color-mix(in srgb, var(--lw-surface-container-highest) 52%, transparent));
  box-shadow: none;
}

.lw-telegram-profile__tabs button {
  min-height: 34px;
  border: 0;
  border-radius: 999px;
  background: transparent;
  color: var(--lw-text-secondary);
  font-size: 13px;
  line-height: 18px;
  font-weight: 650;
  letter-spacing: 0;
}

.lw-telegram-profile__tabs button.active {
  color: var(--lw-primary);
  background: var(--lw-telegram-active-pill, color-mix(in srgb, var(--lw-primary) 16%, transparent));
}

.lw-telegram-profile__section > header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
}

.lw-telegram-profile__section h3 {
  margin: 0;
  font-size: 15px;
  line-height: 20px;
  font-weight: 700;
  letter-spacing: 0;
}

.lw-telegram-profile__section header button {
  border: none;
  background: transparent;
  color: var(--lw-primary);
  font-size: var(--lw-type-label-medium-size);
  line-height: var(--lw-type-label-medium-line-height);
  font-weight: var(--lw-type-label-medium-weight);
  letter-spacing: var(--lw-type-label-medium-tracking);
}

.lw-telegram-profile__quick {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
}

.lw-telegram-profile__quick button {
  min-height: 78px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 9px;
  border: 0;
  border-radius: 18px;
  background: color-mix(in srgb, var(--lw-surface-container-highest) 38%, transparent);
  color: var(--lw-text-main);
  cursor: pointer;
}

.tool-icon,
.history-icon,
.chat-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  color: var(--lw-primary);
  background: color-mix(in srgb, var(--lw-primary) 13%, transparent);
}

.tool-icon {
  width: 34px;
  height: 34px;
  border-radius: 12px;
  font-size: 16px;
  line-height: 22px;
  font-weight: var(--lw-type-title-large-weight);
  letter-spacing: var(--lw-type-title-large-tracking);
}

.lw-telegram-profile__quick strong {
  font-size: 13px;
  line-height: 18px;
  font-weight: 650;
  letter-spacing: 0;
}

.lw-telegram-profile__recent,
.lw-telegram-profile__history {
  display: flex;
  flex-direction: column;
}

.lw-telegram-profile__recent button,
.lw-telegram-profile__history button {
  width: 100%;
  min-width: 0;
  border: none;
  background: transparent;
  color: var(--lw-text-main);
  text-align: left;
  cursor: pointer;
}

.lw-telegram-profile__recent button {
  min-height: 62px;
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  align-items: center;
  gap: 12px;
  padding: 10px 0;
  border-bottom: 1px solid color-mix(in srgb, var(--lw-border-base) 62%, transparent);
}

.lw-telegram-profile__recent button:last-child,
.lw-telegram-profile__history button:last-child {
  border-bottom: none;
}

.chat-icon {
  width: 42px;
  height: 42px;
  border-radius: 14px;
}

.lw-telegram-profile__recent span:nth-child(2) {
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.lw-telegram-profile__recent strong,
.lw-telegram-profile__recent small {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.lw-telegram-profile__recent strong {
  font-size: 14px;
  line-height: 20px;
  font-weight: 650;
  letter-spacing: 0;
}

.lw-telegram-profile__recent small,
.lw-telegram-profile__recent time,
.lw-telegram-profile__empty {
  color: var(--lw-text-secondary);
  font-size: 12px;
  line-height: 17px;
  font-weight: 450;
  letter-spacing: 0;
}

.lw-telegram-profile__history button {
  min-height: 52px;
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto auto;
  align-items: center;
  gap: 12px;
  padding: 9px 0;
  border-bottom: 1px solid color-mix(in srgb, var(--lw-border-base) 62%, transparent);
}

.lw-telegram-profile__history button:disabled {
  opacity: 0.56;
  cursor: default;
}

.history-icon {
  width: 34px;
  height: 34px;
  border-radius: 11px;
  font-size: var(--lw-type-title-small-size);
  line-height: var(--lw-type-title-small-line-height);
  font-weight: var(--lw-type-title-small-weight);
  letter-spacing: var(--lw-type-title-small-tracking);
}

.lw-telegram-profile__history strong {
  font-size: var(--lw-type-title-small-size);
  line-height: var(--lw-type-title-small-line-height);
  font-weight: var(--lw-type-title-small-weight);
  letter-spacing: var(--lw-type-title-small-tracking);
}

.lw-telegram-profile__history small,
.lw-telegram-profile__history span:last-child {
  color: var(--lw-text-muted);
  font-size: var(--lw-type-body-small-size);
  line-height: var(--lw-type-body-small-line-height);
  font-weight: var(--lw-type-body-small-weight);
  letter-spacing: var(--lw-type-body-small-tracking);
}

.lw-telegram-profile__primary {
  min-height: 48px;
  flex-shrink: 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  border: none;
  border-radius: 16px;
  background: linear-gradient(135deg, #48b9ff, #2685ee);
  color: white;
  font-size: var(--lw-type-label-large-size);
  line-height: var(--lw-type-label-large-line-height);
  font-weight: var(--lw-type-label-large-weight);
  letter-spacing: var(--lw-type-label-large-tracking);
  cursor: pointer;
  box-shadow: 0 14px 30px rgba(38, 133, 238, 0.24);
}

.lw-telegram-profile__primary:disabled {
  opacity: 0.58;
  cursor: default;
}

.lw-telegram-profile.is-mobile {
  gap: 22px;
  padding: calc(24px + var(--lw-content-safe-top, var(--lw-safe-top, 0px))) 22px calc(100px + var(--lw-content-safe-bottom, var(--lw-safe-bottom, 0px)));
}

.lw-telegram-profile.is-mobile .lw-telegram-profile__topbar {
  min-height: 58px;
}

.lw-telegram-profile.is-mobile .lw-telegram-profile__topbar strong {
  font-size: 18px;
  line-height: 24px;
}

.lw-telegram-profile.is-mobile .lw-telegram-profile__hero {
  display: flex;
  flex-direction: column;
  gap: 12px;
  text-align: center;
}

.lw-telegram-profile.is-mobile .lw-telegram-profile__avatar {
  width: 104px;
  height: 104px;
}

.lw-telegram-profile.is-mobile .lw-telegram-profile__identity,
.lw-telegram-profile.is-mobile .lw-telegram-profile__identity > div,
.lw-telegram-profile.is-mobile .lw-telegram-profile__sync {
  align-items: center;
}

.lw-telegram-profile.is-mobile .lw-telegram-profile__identity h2 {
  font-size: 24px;
  line-height: 30px;
}

.lw-telegram-profile.is-mobile .lw-telegram-profile__identity p {
  font-size: 13px;
  line-height: 19px;
}

.lw-telegram-profile.is-mobile .lw-telegram-profile__section {
  padding: 20px;
  border-radius: 28px;
}

.lw-telegram-profile.is-mobile .lw-telegram-profile__section h3 {
  font-size: 15px;
  line-height: 20px;
}

.lw-telegram-profile.is-mobile .lw-telegram-profile__quick {
  grid-template-columns: repeat(4, minmax(0, 1fr));
}

.lw-telegram-profile.is-mobile .lw-telegram-profile__quick button {
  min-height: 96px;
}

.lw-telegram-profile.is-mobile .lw-telegram-profile__recent button {
  min-height: 78px;
}

.lw-telegram-profile.is-mobile .lw-telegram-profile__recent strong,
.lw-telegram-profile.is-mobile .lw-telegram-profile__history strong {
  font-size: 14px;
  line-height: 20px;
}

.lw-telegram-profile.is-mobile .lw-telegram-profile__recent small,
.lw-telegram-profile.is-mobile .lw-telegram-profile__recent time,
.lw-telegram-profile.is-mobile .lw-telegram-profile__history small,
.lw-telegram-profile.is-mobile .lw-telegram-profile__history span:last-child {
  font-size: 12px;
  line-height: 17px;
}

.lw-telegram-profile.is-mobile .lw-telegram-profile__primary {
  min-height: 64px;
  border-radius: 20px;
  font-size: 14px;
  line-height: 20px;
  position: sticky;
  bottom: calc(10px + var(--lw-content-safe-bottom, var(--lw-safe-bottom, 0px)));
  z-index: 4;
}

@media (max-width: 520px) {
  .lw-telegram-profile.is-mobile .lw-telegram-profile__hero {
    grid-template-columns: 1fr;
  }

  .lw-telegram-profile.is-mobile .lw-telegram-profile__quick {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
</style>
