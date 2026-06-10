<template>
  <section class="lw-telegram-character-overview" :class="{ 'is-mobile': isMobile }" aria-label="Telegram character overview">
    <div class="lw-telegram-character-overview__hero">
      <div class="lw-telegram-character-overview__avatar">
        <img v-if="profile.avatarUrl" :src="profile.avatarUrl" :alt="profile.name">
        <span v-else>{{ profile.initial }}</span>
      </div>
      <div class="lw-telegram-character-overview__identity">
        <h2>{{ profile.name }} <span>★</span></h2>
        <p>{{ statusLine }}</p>
      </div>
      <button
        class="lw-telegram-character-overview__new"
        type="button"
        :disabled="!activeGroup"
        @click="createSession"
      >
        <span>+</span>
        新聊天
      </button>
    </div>

    <nav class="lw-telegram-character-overview__tabs" aria-label="Telegram character sections">
      <button
        v-for="tab in tabs"
        :key="tab"
        type="button"
        :class="{ active: tab === activeTab }"
        @click="activeTab = tab"
      >
        {{ tab }}
      </button>
    </nav>

    <div class="lw-telegram-character-overview__content">
      <section class="lw-telegram-character-overview__section">
        <header>
          <h3>最近聊天</h3>
          <button type="button" :disabled="recentSessions.length === 0" @click="openFirstRecent">
            <span>›</span>
          </button>
        </header>
        <div v-if="recentSessions.length > 0" class="lw-telegram-character-overview__recent">
          <button
            v-for="session in recentSessions"
            :key="session.id"
            type="button"
            @click="emit('openSession', session.id)"
          >
            <strong>{{ session.title }}</strong>
            <small>{{ session.previewMessage || session.summary || session.recentHistoryPreview || '暂无预览' }}</small>
            <time>{{ formatSessionTime(session.updatedAt) }}</time>
          </button>
        </div>
        <p v-else class="lw-telegram-character-overview__empty">还没有最近聊天。点击新聊天开始第一段会话。</p>
      </section>

      <section class="lw-telegram-character-overview__section">
        <header>
          <h3>所有聊天记录</h3>
          <button type="button" :disabled="allSessions.length === 0" @click="openFirstRecent">
            <span>›</span>
          </button>
        </header>
        <div v-if="allSessions.length > 0" class="lw-telegram-character-overview__history">
          <button
            v-for="session in allSessions"
            :key="session.id"
            type="button"
            @click="emit('openSession', session.id)"
          >
            <strong>{{ session.title }}</strong>
            <span>{{ formatMessageCount(session.messageCount) }}</span>
          </button>
        </div>
        <p v-else class="lw-telegram-character-overview__empty">这个角色还没有历史记录。</p>
      </section>

      <section class="lw-telegram-character-overview__section lw-telegram-character-overview__tools">
        <header>
          <h3>上下文工具</h3>
        </header>
        <button
          v-for="tool in contextTools"
          :key="tool.id"
          type="button"
          @click="emit('openTool', tool.panelId)"
        >
          <span>{{ tool.icon }}</span>
          <strong>{{ tool.label }}</strong>
          <small>›</small>
        </button>
      </section>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import type {
  CharacterChannelGroup,
  CharacterChannelSessionItem,
  CharacterChannelState,
  CreateChatConversationInput
} from '../../../types/ConversationContextTypes.js';

const props = defineProps<{
  state: CharacterChannelState;
  selectedCharacterKey: string | null;
  isMobile?: boolean;
}>();

const emit = defineEmits<{
  (e: 'openSession', sessionId: string): void;
  (e: 'createSession', payload: CreateChatConversationInput): void;
  (e: 'openTool', panelId: string): void;
}>();

const tabs = ['聊天', '概览', '设定', '文件'] as const;
const activeTab = ref<typeof tabs[number]>('聊天');

const activeGroup = computed<CharacterChannelGroup | null>(() => {
  const selectedKey = props.selectedCharacterKey || props.state.expandedCharacterKey;
  const activeSessionId = props.state.activeSessionId || props.state.selectedViewSessionId;
  return props.state.characterGroups.find((group) => group.key === selectedKey)
    || props.state.characterGroups.find((group) => activeSessionId && group.sessions.some((session) => session.id === activeSessionId))
    || props.state.characterGroups[0]
    || null;
});

const allSessions = computed<CharacterChannelSessionItem[]>(() => (
  [...(activeGroup.value?.sessions || [])]
    .sort((left, right) => right.updatedAt - left.updatedAt)
));

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

const statusLine = computed(() => {
  if (props.state.status.kind === 'switching') return '正在切换会话';
  if (props.state.status.kind === 'loading') return '正在加载上下文';
  if (props.state.status.kind === 'error') return props.state.status.text || '同步需要处理';
  const latest = allSessions.value[0];
  return latest ? `在线 · 最近活跃 ${formatSessionTime(latest.updatedAt)}` : '在线 · 等待第一段会话';
});

const contextTools = [
  { id: 'timeline', label: '时间线', panelId: 'lumina-timeline', icon: '□' },
  { id: 'stats', label: '状态', panelId: 'lumina-stats', icon: '☺' },
  { id: 'director', label: '导演', panelId: 'lumina-director', icon: '▣' },
  { id: 'lorebook', label: '世界书', panelId: 'lumina-lorebook', icon: '▤' }
];

const createSession = () => {
  const group = activeGroup.value;
  if (!group) return;
  emit('createSession', {
    characterId: group.characterId,
    characterName: group.characterName,
    characterAvatarUrl: group.characterAvatarUrl
  });
};

const openFirstRecent = () => {
  const session = allSessions.value[0];
  if (session) {
    emit('openSession', session.id);
  }
};

const formatMessageCount = (count?: number) => `${count || 0} 条消息`;

const formatSessionTime = (timestamp: number) => {
  const delta = Date.now() - timestamp;
  if (delta < 60_000) return '刚刚';
  if (delta < 3_600_000) return `${Math.floor(delta / 60_000)} 分钟前`;
  if (delta < 86_400_000) return `${Math.floor(delta / 3_600_000)} 小时前`;
  return new Date(timestamp).toLocaleDateString([], { month: 'numeric', day: 'numeric' });
};
</script>

<style scoped>
.lw-telegram-character-overview {
  flex: 1;
  min-width: 0;
  min-height: 0;
  display: flex;
  flex-direction: column;
  overflow: auto;
  padding: 54px 48px 44px;
  color: var(--lw-text-main);
  background: var(--lw-telegram-conversation-bg, transparent);
}

.lw-telegram-character-overview__hero {
  min-height: 142px;
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  align-items: center;
  gap: 24px;
  padding: 10px 12px 34px;
}

.lw-telegram-character-overview__avatar {
  width: 96px;
  height: 96px;
  border-radius: 999px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  color: #102338;
  font-size: var(--lw-type-headline-large-size);
  line-height: var(--lw-type-headline-large-line-height);
  font-weight: var(--lw-type-headline-large-weight);
  letter-spacing: var(--lw-type-headline-large-tracking);
  background: #82c7f5;
  border: 3px solid rgba(255, 255, 255, 0.86);
}

.lw-telegram-character-overview__avatar img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.lw-telegram-character-overview__identity {
  min-width: 0;
}

.lw-telegram-character-overview__identity h2 {
  margin: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: var(--lw-type-headline-small-size);
  line-height: var(--lw-type-headline-small-line-height);
  font-weight: var(--lw-type-headline-small-weight);
  letter-spacing: var(--lw-type-headline-small-tracking);
}

.lw-telegram-character-overview__identity h2 span {
  color: var(--lw-primary);
}

.lw-telegram-character-overview__identity p {
  margin: 6px 0 0;
  color: var(--lw-primary);
  font-size: var(--lw-type-label-large-size);
  line-height: var(--lw-type-label-large-line-height);
  font-weight: var(--lw-type-label-large-weight);
  letter-spacing: var(--lw-type-label-large-tracking);
}

.lw-telegram-character-overview__new {
  min-width: 112px;
  min-height: 44px;
  border: none;
  border-radius: 999px;
  background: var(--lw-primary);
  color: white;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  font-size: var(--lw-type-label-large-size);
  line-height: var(--lw-type-label-large-line-height);
  font-weight: var(--lw-type-label-large-weight);
  letter-spacing: var(--lw-type-label-large-tracking);
  cursor: pointer;
}

.lw-telegram-character-overview__new:disabled {
  opacity: 0.56;
  cursor: default;
}

.lw-telegram-character-overview__tabs {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  border-bottom: 1px solid color-mix(in srgb, var(--lw-border-base) 72%, transparent);
  margin-bottom: 32px;
}

.lw-telegram-character-overview__tabs button {
  min-height: 46px;
  border: none;
  background: transparent;
  color: var(--lw-text-secondary);
  font-size: var(--lw-type-label-large-size);
  line-height: var(--lw-type-label-large-line-height);
  font-weight: var(--lw-type-label-large-weight);
  letter-spacing: var(--lw-type-label-large-tracking);
  cursor: pointer;
}

.lw-telegram-character-overview__tabs button.active {
  color: var(--lw-primary);
  box-shadow: inset 0 -2px 0 var(--lw-primary);
}

.lw-telegram-character-overview__content {
  width: min(760px, 100%);
  display: flex;
  flex-direction: column;
  gap: 34px;
}

.lw-telegram-character-overview__section {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.lw-telegram-character-overview__section header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.lw-telegram-character-overview__section h3 {
  margin: 0;
  font-size: var(--lw-type-title-large-size);
  line-height: var(--lw-type-title-large-line-height);
  font-weight: var(--lw-type-title-large-weight);
  letter-spacing: var(--lw-type-title-large-tracking);
}

.lw-telegram-character-overview__section header button {
  width: 30px;
  height: 30px;
  border: none;
  border-radius: 999px;
  background: transparent;
  color: var(--lw-text-main);
  font-size: var(--lw-type-headline-large-size);
  line-height: var(--lw-type-headline-large-line-height);
  font-weight: var(--lw-type-headline-large-weight);
  letter-spacing: var(--lw-type-headline-large-tracking);
  cursor: pointer;
}

.lw-telegram-character-overview__recent,
.lw-telegram-character-overview__history,
.lw-telegram-character-overview__tools {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.lw-telegram-character-overview__recent button,
.lw-telegram-character-overview__history button,
.lw-telegram-character-overview__tools button {
  width: 100%;
  min-width: 0;
  border: 0;
  border-radius: 16px;
  background: color-mix(in srgb, var(--lw-surface-container-highest) 76%, transparent);
  color: var(--lw-text-main);
  cursor: pointer;
}

.lw-telegram-character-overview__recent button {
  min-height: 64px;
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: center;
  gap: 4px 14px;
  padding: 12px 18px;
  text-align: left;
}

.lw-telegram-character-overview__recent strong,
.lw-telegram-character-overview__recent small,
.lw-telegram-character-overview__history strong {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.lw-telegram-character-overview__recent strong {
  font-size: var(--lw-type-title-small-size);
  line-height: var(--lw-type-title-small-line-height);
  font-weight: var(--lw-type-title-small-weight);
  letter-spacing: var(--lw-type-title-small-tracking);
}

.lw-telegram-character-overview__recent small {
  grid-column: 1;
  color: var(--lw-text-secondary);
  font-size: var(--lw-type-body-small-size);
  line-height: var(--lw-type-body-small-line-height);
  font-weight: var(--lw-type-body-small-weight);
  letter-spacing: var(--lw-type-body-small-tracking);
}

.lw-telegram-character-overview__recent time {
  grid-row: 1 / span 2;
  grid-column: 2;
  color: var(--lw-text-muted);
  font-size: var(--lw-type-body-small-size);
  line-height: var(--lw-type-body-small-line-height);
  font-weight: var(--lw-type-body-small-weight);
  letter-spacing: var(--lw-type-body-small-tracking);
}

.lw-telegram-character-overview__history button,
.lw-telegram-character-overview__tools button {
  min-height: 52px;
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: center;
  gap: 12px;
  padding: 0 18px;
  text-align: left;
}

.lw-telegram-character-overview__history span {
  color: var(--lw-text-secondary);
  font-size: var(--lw-type-body-small-size);
  line-height: var(--lw-type-body-small-line-height);
  font-weight: var(--lw-type-body-small-weight);
  letter-spacing: var(--lw-type-body-small-tracking);
}

.lw-telegram-character-overview__tools button {
  grid-template-columns: auto minmax(0, 1fr) auto;
}

.lw-telegram-character-overview__tools button > span {
  color: var(--lw-primary);
  font-size: var(--lw-type-title-medium-size);
  line-height: var(--lw-type-title-medium-line-height);
  font-weight: var(--lw-type-title-medium-weight);
  letter-spacing: var(--lw-type-title-medium-tracking);
}

.lw-telegram-character-overview__tools small {
  color: var(--lw-text-muted);
  font-size: var(--lw-type-label-large-size);
  line-height: var(--lw-type-label-large-line-height);
  font-weight: var(--lw-type-label-large-weight);
  letter-spacing: var(--lw-type-label-large-tracking);
}

.lw-telegram-character-overview__empty {
  margin: 0;
  padding: 18px;
  border-radius: 16px;
  background: color-mix(in srgb, var(--lw-surface-container-highest) 58%, transparent);
  color: var(--lw-text-secondary);
  font-size: var(--lw-type-body-medium-size);
  line-height: var(--lw-type-body-medium-line-height);
  font-weight: var(--lw-type-body-medium-weight);
  letter-spacing: var(--lw-type-body-medium-tracking);
}

@media (max-width: 760px) {
  .lw-telegram-character-overview,
  .lw-telegram-character-overview.is-mobile {
    padding: 28px 18px calc(96px + var(--lw-content-safe-bottom, var(--lw-safe-bottom, 0px)));
  }

  .lw-telegram-character-overview__hero {
    grid-template-columns: auto minmax(0, 1fr);
    gap: 18px;
    padding-bottom: 24px;
  }

  .lw-telegram-character-overview__avatar {
    width: 78px;
    height: 78px;
    font-size: var(--lw-type-headline-small-size);
  }

  .lw-telegram-character-overview__identity h2 {
    font-size: var(--lw-type-title-large-size);
    line-height: var(--lw-type-title-large-line-height);
  }

  .lw-telegram-character-overview__new {
    grid-column: 2;
    justify-self: start;
    min-width: 138px;
  }
}
</style>
