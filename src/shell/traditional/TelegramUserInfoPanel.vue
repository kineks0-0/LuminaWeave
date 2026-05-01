<template>
  <aside
    class="lw-telegram-profile"
    :class="{ 'is-mobile': isMobile }"
    :style="infoPanelStyle"
    aria-label="Telegram role profile"
  >
    <header class="lw-telegram-profile__topbar">
      <button type="button" title="返回" @click="emit('openTool', 'none')">
        <svg viewBox="0 0 24 24" width="18" height="18" stroke="currentColor" stroke-width="2.4" fill="none">
          <polyline points="15 18 9 12 15 6"></polyline>
        </svg>
      </button>
      <div>
        <strong>{{ isMobile ? profile.name : '角色资料' }}</strong>
        <span>{{ syncText }}</span>
      </div>
      <button type="button" title="更多" @click="handleTopbarTrailingClick">
        <svg v-if="!isMobile" viewBox="0 0 24 24" width="18" height="18" stroke="currentColor" stroke-width="2.2" fill="none">
          <line x1="18" y1="6" x2="6" y2="18"></line>
          <line x1="6" y1="6" x2="18" y2="18"></line>
        </svg>
        <svg v-else viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
          <circle cx="5" cy="12" r="1.7"></circle>
          <circle cx="12" cy="12" r="1.7"></circle>
          <circle cx="19" cy="12" r="1.7"></circle>
        </svg>
      </button>
    </header>

    <section class="lw-telegram-profile__hero">
      <div class="lw-telegram-profile__avatar">
        <img v-if="profile.avatarUrl" :src="profile.avatarUrl" :alt="profile.name">
        <span v-else>{{ profile.initial }}</span>
      </div>
      <div class="lw-telegram-profile__identity">
        <div>
          <h2>{{ profile.name }}</h2>
          <span class="lw-telegram-profile__badge">角色</span>
        </div>
        <p>{{ profileDescription }}</p>
        <div class="lw-telegram-profile__sync">
          <span>
            <svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" stroke-width="2.5" fill="none">
              <path d="M20 6 9 17l-5-5"></path>
            </svg>
            已同步
          </span>
          <small>最后同步：{{ lastSyncText }}</small>
        </div>
      </div>
    </section>

    <section class="lw-telegram-profile__section">
      <h3>快速操作</h3>
      <div class="lw-telegram-profile__quick">
        <button
          v-for="tool in contextTools"
          :key="tool.id"
          type="button"
          @click="emit('openTool', tool.panelId)"
        >
          <span class="tool-icon">{{ tool.icon }}</span>
          <strong>{{ tool.label }}</strong>
        </button>
      </div>
    </section>

    <section class="lw-telegram-profile__section">
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
            <svg viewBox="0 0 24 24" width="18" height="18" stroke="currentColor" stroke-width="2" fill="none">
              <path d="M21 15a4 4 0 0 1-4 4H8l-5 3V7a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4z"></path>
            </svg>
          </span>
          <span>
            <strong>{{ session.title }}</strong>
            <small>{{ session.previewMessage || session.summary || session.recentHistoryPreview || '暂无预览' }}</small>
          </span>
          <time>{{ formatSessionTime(session.updatedAt) }}</time>
        </button>
      </div>
      <p v-else class="lw-telegram-profile__empty">还没有最近聊天。</p>
    </section>

    <section class="lw-telegram-profile__section">
      <header>
        <h3>所有聊天记录</h3>
        <button type="button" disabled>筛选</button>
      </header>
      <div class="lw-telegram-profile__history">
        <button
          v-for="item in historyGroups"
          :key="item.id"
          type="button"
          :disabled="item.count === 0"
          @click="openHistoryGroup(item.id)"
        >
          <span class="history-icon">{{ item.icon }}</span>
          <strong>{{ item.label }}</strong>
          <small>{{ item.count }}</small>
          <span>›</span>
        </button>
      </div>
    </section>

    <button
      class="lw-telegram-profile__primary"
      type="button"
      :disabled="!activeGroup"
      @click="createSession"
    >
      <svg viewBox="0 0 24 24" width="20" height="20" stroke="currentColor" stroke-width="2.2" fill="none">
        <path d="M21 15a4 4 0 0 1-4 4H9l-6 3V7a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4z"></path>
        <path d="M12 8v6"></path>
        <path d="M9 11h6"></path>
      </svg>
      {{ isMobile ? '开始新聊天' : '新聊天' }}
    </button>
  </aside>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import type { CSSProperties } from 'vue';
import { useComponentSkin } from '../../theme/useComponentSkin';
import type {
  CharacterChannelGroup,
  CharacterChannelSessionItem,
  CharacterChannelState,
  CreateChatConversationInput
} from '../../types/ConversationContextTypes';

interface ContextTool {
  id: string;
  label: string;
  panelId: string;
  icon: string;
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

const { cssVars: infoPanelVars } = useComponentSkin('telegram.infoPanel');
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

const recentSessions = computed<CharacterChannelSessionItem[]>(() => allSessions.value.slice(0, 3));

const profile = computed(() => {
  const group = activeGroup.value;
  const name = group?.characterName?.trim() || '未选择角色';
  return {
    name,
    avatarUrl: group?.characterAvatarUrl || '',
    initial: group?.characterInitial || name.slice(0, 1).toUpperCase()
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
  { id: 'timeline', label: '时间线', panelId: 'lumina-timeline', icon: '◈' },
  { id: 'stats', label: '状态', panelId: 'lumina-stats', icon: '▮' },
  { id: 'director', label: '导演', panelId: 'lumina-director', icon: '▰' },
  { id: 'lorebook', label: '世界书', panelId: 'lumina-lorebook', icon: '▤' }
]);

const historyGroups = computed(() => [
  { id: 'all', label: '全部对话', count: allSessions.value.length, icon: '▱' },
  { id: 'favorites', label: '已收藏', count: allSessions.value.filter((session) => session.title.includes('★')).length, icon: '☆' },
  { id: 'archive', label: '归档', count: 0, icon: '▣' }
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

const openHistoryGroup = (groupId: string) => {
  if (groupId === 'all') {
    openFirstSession();
    return;
  }
  if (groupId === 'favorites') {
    const favorite = allSessions.value.find((session) => session.title.includes('★'));
    if (favorite) {
      emit('openSession', favorite.id);
    }
  }
};

const handleTopbarTrailingClick = () => {
  if (!props.isMobile) {
    emit('openTool', 'none');
  }
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
  background: color-mix(in srgb, var(--lw-surface-container-highest) 72%, transparent);
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
  font-size: 17px;
  font-weight: 900;
}

.lw-telegram-profile__topbar span {
  color: var(--lw-text-secondary);
  font-size: 12px;
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
  background: #82c7f5;
  border: 3px solid color-mix(in srgb, var(--lw-surface-container-highest) 92%, transparent);
  color: #102338;
  font-size: 34px;
  font-weight: 900;
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
  font-size: 26px;
  line-height: 1.1;
  font-weight: 950;
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
  font-weight: 850;
}

.lw-telegram-profile__badge {
  padding: 4px 9px;
}

.lw-telegram-profile__identity p {
  color: var(--lw-text-secondary);
  font-size: 13px;
  line-height: 1.6;
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
  font-size: 12px;
}

.lw-telegram-profile__section {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 16px;
  border: 1px solid color-mix(in srgb, var(--lw-border-base) 64%, transparent);
  border-radius: 22px;
  background: color-mix(in srgb, var(--lw-surface-container-highest) 72%, transparent);
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
  font-weight: 950;
}

.lw-telegram-profile__section header button {
  border: none;
  background: transparent;
  color: var(--lw-primary);
  font-size: 12px;
  font-weight: 800;
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
  border: 1px solid color-mix(in srgb, var(--lw-border-base) 60%, transparent);
  border-radius: 18px;
  background: color-mix(in srgb, var(--lw-surface-container-highest) 68%, transparent);
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
  font-size: 18px;
}

.lw-telegram-profile__quick strong {
  font-size: 13px;
  font-weight: 900;
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
  font-weight: 900;
}

.lw-telegram-profile__recent small,
.lw-telegram-profile__recent time,
.lw-telegram-profile__empty {
  color: var(--lw-text-secondary);
  font-size: 12px;
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
  font-size: 15px;
}

.lw-telegram-profile__history strong {
  font-size: 13px;
  font-weight: 850;
}

.lw-telegram-profile__history small,
.lw-telegram-profile__history span:last-child {
  color: var(--lw-text-muted);
  font-size: 13px;
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
  font-size: 14px;
  font-weight: 950;
  cursor: pointer;
  box-shadow: 0 14px 30px rgba(38, 133, 238, 0.24);
}

.lw-telegram-profile__primary:disabled {
  opacity: 0.58;
  cursor: default;
}

.lw-telegram-profile.is-mobile {
  gap: 24px;
  padding: calc(20px + var(--lw-safe-top, 0px)) 22px calc(100px + var(--lw-safe-bottom, 0px));
}

.lw-telegram-profile.is-mobile .lw-telegram-profile__topbar {
  min-height: 58px;
}

.lw-telegram-profile.is-mobile .lw-telegram-profile__topbar strong {
  font-size: 22px;
}

.lw-telegram-profile.is-mobile .lw-telegram-profile__hero {
  grid-template-columns: minmax(0, 0.9fr) minmax(0, 1.1fr);
  gap: 24px;
}

.lw-telegram-profile.is-mobile .lw-telegram-profile__avatar {
  width: min(32vw, 148px);
  height: min(32vw, 148px);
}

.lw-telegram-profile.is-mobile .lw-telegram-profile__identity h2 {
  font-size: 34px;
}

.lw-telegram-profile.is-mobile .lw-telegram-profile__identity p {
  font-size: 18px;
}

.lw-telegram-profile.is-mobile .lw-telegram-profile__section {
  padding: 20px;
  border-radius: 28px;
}

.lw-telegram-profile.is-mobile .lw-telegram-profile__section h3 {
  font-size: 22px;
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
  font-size: 18px;
}

.lw-telegram-profile.is-mobile .lw-telegram-profile__recent small,
.lw-telegram-profile.is-mobile .lw-telegram-profile__recent time,
.lw-telegram-profile.is-mobile .lw-telegram-profile__history small,
.lw-telegram-profile.is-mobile .lw-telegram-profile__history span:last-child {
  font-size: 16px;
}

.lw-telegram-profile.is-mobile .lw-telegram-profile__primary {
  min-height: 64px;
  border-radius: 20px;
  font-size: 20px;
  position: sticky;
  bottom: calc(10px + var(--lw-safe-bottom, 0px));
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
