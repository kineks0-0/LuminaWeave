<template>
  <aside
    class="lw-discord-rail"
    :data-skin-variant="railVariant || 'default'"
    :style="railStyle"
  >
    <div class="lw-discord-rail__header">
      <span class="lw-discord-rail__eyebrow">Direct Messages</span>
      <strong>角色频道</strong>
      <span>点击头像直达最近一次会话，点击卡片主体展开这个角色的历史分支。</span>
    </div>

    <div v-if="characterGroups.length === 0" class="lw-discord-rail__empty">
      <strong>暂无角色会话</strong>
      <span>开始一段聊天后，这里会聚合角色卡和最近对话。</span>
    </div>

    <div v-else class="lw-discord-rail__list">
      <article
        v-for="group in characterGroups"
        :key="group.key"
        class="lw-discord-card"
        :class="{
          'is-active': activeCharacterKey === group.key,
          'is-expanded': expandedCharacterKey === group.key,
          'is-compact': cardDensity === 'compact'
        }"
        :style="cardStyle"
      >
        <div class="lw-discord-card__main" @click="toggleGroup(group.key)">
          <button
            class="lw-discord-card__avatar"
            type="button"
            :title="`打开 ${group.characterName} 最近一次对话`"
            @click.stop="openRecentSession(group)"
          >
            <img
              v-if="group.characterAvatarUrl"
              :src="group.characterAvatarUrl"
              :alt="group.characterName"
            >
            <span v-else>{{ group.characterInitial }}</span>
          </button>

          <div class="lw-discord-card__body">
            <div class="lw-discord-card__title-row">
              <strong>{{ group.characterName }}</strong>
              <span>{{ group.sessions.length }} 段</span>
            </div>
            <p
              class="lw-discord-card__preview"
              :style="{ WebkitLineClamp: String(previewLines) }"
            >
              {{ group.recentPreview }}
            </p>
          </div>

          <button class="lw-discord-card__chevron" type="button" tabindex="-1" aria-hidden="true">
            <svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" stroke-width="2.4" fill="none">
              <polyline points="9 6 15 12 9 18"></polyline>
            </svg>
          </button>
        </div>

        <div v-if="expandedCharacterKey === group.key" class="lw-discord-card__sessions">
          <button
            v-for="session in group.sessions"
            :key="session.id"
            class="lw-discord-card__session"
            :class="{ 'is-active': activeSessionId === session.id }"
            type="button"
            @click="emit('openSession', session.id)"
          >
            <span class="lw-discord-card__session-title">{{ session.title }}</span>
            <span class="lw-discord-card__session-meta">{{ formatSessionTime(session.updatedAt) }}</span>
          </button>
        </div>
      </article>
    </div>
  </aside>
</template>

<script setup lang="ts">
import { computed, ref, watch, type CSSProperties } from 'vue';
import { useConversationContextStore } from '../stores/useConversationContextStore';
import { activeSettings, useSettings } from '../plugins/settings/useSettings';
import { getThemeSettingValue } from '../theme/themeRegistry';
import { useComponentSkin } from '../theme/useComponentSkin';
import type { ChatSessionRef } from '../types/SessionTypes';
import type { ConversationSessionRef } from '../types/ConversationContextTypes';

type CharacterGroup = {
  key: string;
  characterId: string | number | null;
  characterName: string;
  characterAvatarUrl: string | null;
  characterInitial: string;
  sessions: ChatSessionRef[];
  recentSession: ChatSessionRef | null;
  recentPreview: string;
};

const props = withDefaults(defineProps<{
  fallbackCharacterName?: string;
  fallbackCharacterAvatarUrl?: string | null;
}>(), {
  fallbackCharacterName: 'Assistant',
  fallbackCharacterAvatarUrl: null
});

const emit = defineEmits<{
  (e: 'openSession', sessionId: string): void;
}>();

useSettings();

const contextStore = useConversationContextStore();
const { cssVars: railSkinVars, variant: railVariant, desktopModeId } = useComponentSkin('shell.characterRail');
const { cssVars: cardSkinVars } = useComponentSkin('shell.characterCard');

const railStyle = computed<CSSProperties>(() => railSkinVars.value as CSSProperties);
const cardStyle = computed<CSSProperties>(() => cardSkinVars.value as CSSProperties);
const previewLines = computed(() => {
  const value = Number(getThemeSettingValue(activeSettings, desktopModeId.value, 'sidebarPreviewLines', 2));
  return Number.isFinite(value) && value > 0 ? value : 2;
});
const cardDensity = computed(() => String(
  getThemeSettingValue(activeSettings, desktopModeId.value, 'sidebarCardDensity', 'cozy')
));
const activeSessionId = computed(() => contextStore.activeSourceId === 'chat' ? contextStore.activeSessionId : null);
const isChatSessionRef = (session: ConversationSessionRef): session is ChatSessionRef & { sourceId: 'chat' } => {
  return session.sourceId === 'chat';
};

const normalizedSessions = computed(() => {
  return [...contextStore.chatSessions]
    .filter(isChatSessionRef)
    .sort((left, right) => right.updatedAt - left.updatedAt)
    .map((session) => {
      const fallbackName = session.source === 'st-current' ? props.fallbackCharacterName : '';
      const fallbackAvatar = session.source === 'st-current' ? props.fallbackCharacterAvatarUrl : null;
      return {
        ...session,
        characterId: session.characterId ?? null,
        characterName: session.characterName || fallbackName || session.title || '未命名角色',
        characterAvatarUrl: session.characterAvatarUrl || fallbackAvatar || null
      };
    });
});

const characterGroups = computed<CharacterGroup[]>(() => {
  const grouped = new Map<string, CharacterGroup>();

  normalizedSessions.value.forEach((session) => {
    const key = session.characterId != null
      ? String(session.characterId)
      : session.characterName || session.id;
    const existing = grouped.get(key);
    const recentPreview = session.previewMessage || session.summary || '暂无最近对话';
    if (existing) {
      existing.sessions.push(session);
      return;
    }

    grouped.set(key, {
      key,
      characterId: session.characterId ?? null,
      characterName: session.characterName || '未命名角色',
      characterAvatarUrl: session.characterAvatarUrl || null,
      characterInitial: (session.characterName || '角').trim().slice(0, 1).toUpperCase(),
      sessions: [session],
      recentSession: session,
      recentPreview,
    });
  });

  return Array.from(grouped.values()).map((group) => ({
    ...group,
    sessions: [...group.sessions].sort((left, right) => right.updatedAt - left.updatedAt),
    recentSession: [...group.sessions].sort((left, right) => right.updatedAt - left.updatedAt)[0] || null,
    recentPreview: ([...group.sessions].sort((left, right) => right.updatedAt - left.updatedAt)[0]?.previewMessage
      || [...group.sessions].sort((left, right) => right.updatedAt - left.updatedAt)[0]?.summary
      || '暂无最近对话')
  }));
});

const activeCharacterKey = computed(() => {
  const sessionId = activeSessionId.value;
  if (!sessionId) return null;
  return characterGroups.value.find((group) => group.sessions.some((session) => session.id === sessionId))?.key || null;
});

const expandedCharacterKey = ref<string | null>(null);

watch(activeCharacterKey, (nextKey) => {
  if (nextKey) {
    expandedCharacterKey.value = nextKey;
  } else if (!characterGroups.value.some((group) => group.key === expandedCharacterKey.value)) {
    expandedCharacterKey.value = characterGroups.value[0]?.key || null;
  }
}, { immediate: true });

const toggleGroup = (groupKey: string) => {
  expandedCharacterKey.value = expandedCharacterKey.value === groupKey ? null : groupKey;
};

const openRecentSession = (group: CharacterGroup) => {
  if (!group.recentSession) return;
  emit('openSession', group.recentSession.id);
};

const formatSessionTime = (timestamp: number) => {
  const delta = Date.now() - timestamp;
  if (delta < 60_000) return '刚刚';
  if (delta < 3_600_000) return `${Math.floor(delta / 60_000)} 分钟前`;
  if (delta < 86_400_000) return `${Math.floor(delta / 3_600_000)} 小时前`;
  return new Date(timestamp).toLocaleDateString([], {
    month: 'numeric',
    day: 'numeric'
  });
};
</script>

<style scoped>
.lw-discord-rail {
  width: var(--lw-character-rail-width, 288px);
  min-width: var(--lw-character-rail-width, 288px);
  max-width: var(--lw-character-rail-width, 288px);
  display: flex;
  flex-direction: column;
  gap: 14px;
  padding: 16px 14px;
  border-right: 1px solid var(--lw-character-rail-border, var(--lw-border-base));
  background: var(--lw-character-rail-bg, var(--lw-bg-subtle));
  overflow: hidden;
}

.lw-discord-rail__header {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 6px 8px 4px;
}

.lw-discord-rail__eyebrow {
  font-size: 10px;
  font-weight: 800;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: var(--lw-text-muted);
}

.lw-discord-rail__header strong {
  font-size: 14px;
  font-weight: 800;
  color: var(--lw-text-main);
}

.lw-discord-rail__header span:last-child {
  font-size: 11px;
  line-height: 1.5;
  color: var(--lw-text-secondary);
}

.lw-discord-rail__empty {
  display: flex;
  flex-direction: column;
  gap: 4px;
  margin: 8px;
  padding: 16px;
  border-radius: 18px;
  border: 1px solid var(--lw-character-card-border, var(--lw-border-base));
  background: var(--lw-character-card-bg, var(--lw-bg-surface));
}

.lw-discord-rail__empty strong {
  font-size: 13px;
  color: var(--lw-text-main);
}

.lw-discord-rail__empty span {
  font-size: 12px;
  line-height: 1.6;
  color: var(--lw-text-secondary);
}

.lw-discord-rail__list {
  flex: 1;
  min-height: 0;
  overflow: auto;
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding-right: 2px;
}

.lw-discord-card {
  border-radius: var(--lw-character-card-radius, 20px);
  border: 1px solid var(--lw-character-card-border, var(--lw-border-base));
  background: var(--lw-character-card-bg, var(--lw-bg-surface));
  box-shadow: var(--lw-character-card-shadow, none);
  overflow: hidden;
}

.lw-discord-card.is-active {
  border-color: var(--lw-character-card-active-border, rgba(var(--lw-primary-rgb), 0.32));
}

.lw-discord-card__main {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  align-items: center;
  gap: 10px;
  width: 100%;
  padding: 12px;
  background: transparent;
  cursor: pointer;
}

.lw-discord-card__avatar {
  width: var(--lw-character-card-avatar-size, 46px);
  height: var(--lw-character-card-avatar-size, 46px);
  border: none;
  border-radius: var(--lw-character-card-avatar-radius, 16px);
  background: color-mix(in srgb, var(--lw-primary) 16%, var(--lw-bg-surface));
  color: var(--lw-text-main);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  cursor: pointer;
  font-size: 16px;
  font-weight: 800;
}

.lw-discord-card__avatar img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.lw-discord-card__body {
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.lw-discord-card__title-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.lw-discord-card__title-row strong {
  min-width: 0;
  font-size: 13px;
  font-weight: 800;
  color: var(--lw-text-main);
}

.lw-discord-card__title-row span {
  flex-shrink: 0;
  font-size: 11px;
  font-weight: 700;
  color: var(--lw-text-muted);
}

.lw-discord-card__preview {
  margin: 0;
  font-size: 12px;
  line-height: 1.55;
  color: var(--lw-text-secondary);
  display: -webkit-box;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.lw-discord-card__chevron {
  width: 28px;
  height: 28px;
  border: none;
  background: transparent;
  color: var(--lw-text-muted);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  pointer-events: none;
  transition: transform 180ms cubic-bezier(0.22, 1, 0.36, 1);
}

.lw-discord-card.is-expanded .lw-discord-card__chevron {
  transform: rotate(90deg);
}

.lw-discord-card__sessions {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 0 12px 12px 68px;
}

.lw-discord-card__session {
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  padding: 10px 12px;
  border: 1px solid transparent;
  border-radius: 14px;
  background: var(--lw-character-session-bg, color-mix(in srgb, var(--lw-bg-elevated) 76%, transparent));
  color: var(--lw-text-secondary);
  cursor: pointer;
  text-align: left;
}

.lw-discord-card__session.is-active {
  border-color: rgba(var(--lw-primary-rgb), 0.28);
  color: var(--lw-text-main);
}

.lw-discord-card__session-title {
  min-width: 0;
  font-size: 12px;
  font-weight: 700;
}

.lw-discord-card__session-meta {
  flex-shrink: 0;
  font-size: 10px;
  color: var(--lw-text-muted);
}

.lw-discord-card.is-compact .lw-discord-card__main {
  padding: 10px;
}

.lw-discord-card.is-compact .lw-discord-card__sessions {
  padding: 0 10px 10px 60px;
}

.lw-discord-rail[data-skin-variant='discord'] {
  gap: 10px;
  padding: 10px 8px 12px;
}

.lw-discord-rail[data-skin-variant='discord'] .lw-discord-rail__header {
  padding: 8px 10px 6px;
}

.lw-discord-rail[data-skin-variant='discord'] .lw-discord-card {
  background: #2b2d31;
  border-color: #3f4147;
}

.lw-discord-rail[data-skin-variant='discord'] .lw-discord-card__main:hover {
  background: rgba(255, 255, 255, 0.03);
}

.lw-discord-rail[data-skin-variant='discord'] .lw-discord-card.is-active {
  background: #313338;
}

.lw-discord-rail[data-skin-variant='discord'] .lw-discord-card__session {
  background: #383a40;
}

.lw-discord-rail[data-skin-variant='discord'] .lw-discord-card__session:hover {
  background: #404249;
}
</style>
