<template>
  <aside
    class="lw-discord-rail"
    :class="[
      { 'is-mobile': isMobile },
      isMobile ? `mobile-${mobilePlacement}` : ''
    ]"
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
            :title="group.recentSession ? `打开 ${group.characterName} 最近一次对话` : `${group.characterName} 暂无对话`"
            :disabled="!group.recentSession"
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
            class="lw-discord-card__session lw-discord-card__session-create"
            type="button"
            :title="`为 ${group.characterName} 新建对话`"
            @click="createSession(group)"
          >
            <span class="lw-discord-card__session-title">+ 新建对话</span>
            <span class="lw-discord-card__session-meta">空会话</span>
          </button>

          <template v-if="group.sessions.length > 0">
            <div
              v-for="session in getVisibleSessions(group)"
              :key="session.id"
              class="lw-discord-card__session-wrap"
            >
              <div
                class="lw-discord-card__session-row"
                :class="{ 'is-menu-open': sessionMenuId === session.id }"
              >
                <button
                  class="lw-discord-card__session lw-discord-card__session-main"
                  :class="{ 'is-active': activeSessionId === session.id }"
                  type="button"
                  :disabled="isSessionBusy(session.id)"
                  @click="onOpenSession?.(session.id)"
                >
                  <span class="lw-discord-card__session-title">{{ session.title }}</span>
                  <span class="lw-discord-card__session-meta">{{ formatSessionTime(session.updatedAt) }}</span>
                </button>

                <button
                  class="lw-discord-card__session-menu-trigger"
                  type="button"
                  :disabled="isSessionBusy(session.id)"
                  :title="`管理 ${session.title}`"
                  @click.stop="toggleSessionMenu(session.id)"
                >
                  <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor" aria-hidden="true">
                    <circle cx="5" cy="12" r="1.7"></circle>
                    <circle cx="12" cy="12" r="1.7"></circle>
                    <circle cx="19" cy="12" r="1.7"></circle>
                  </svg>
                </button>
              </div>

              <div v-if="sessionMenuId === session.id" class="lw-discord-card__session-menu">
                <button
                  class="lw-discord-card__session-menu-item"
                  type="button"
                  :disabled="isSessionBusy(session.id)"
                  @click="startRenameSession(session)"
                >
                  重命名
                </button>
                <button
                  class="lw-discord-card__session-menu-item is-danger"
                  type="button"
                  :disabled="isSessionBusy(session.id)"
                  @click="startDeleteSession(session)"
                >
                  删除
                </button>
              </div>

              <form
                v-if="renameDraftSessionId === session.id"
                class="lw-discord-card__session-editor"
                @submit.prevent="submitRenameSession(session)"
              >
                <input
                  v-model="renameDraftTitle"
                  class="lw-discord-card__session-input"
                  type="text"
                  maxlength="120"
                  placeholder="输入新的会话标题"
                >
                <div class="lw-discord-card__session-editor-actions">
                  <button
                    class="lw-discord-card__session-editor-button"
                    type="button"
                    :disabled="pendingRenameSessionId === session.id"
                    @click="cancelRenameSession()"
                  >
                    取消
                  </button>
                  <button
                    class="lw-discord-card__session-editor-button is-primary"
                    type="submit"
                    :disabled="pendingRenameSessionId === session.id || !renameDraftTitle.trim()"
                  >
                    {{ pendingRenameSessionId === session.id ? '重命名中...' : '保存' }}
                  </button>
                </div>
              </form>

              <div v-if="deleteConfirmSessionId === session.id" class="lw-discord-card__session-delete-confirm">
                <p>删除「{{ session.title }}」后将无法从角色频道恢复。</p>
                <div class="lw-discord-card__session-editor-actions">
                  <button
                    class="lw-discord-card__session-editor-button"
                    type="button"
                    :disabled="pendingDeleteSessionId === session.id"
                    @click="cancelDeleteSession()"
                  >
                    取消
                  </button>
                  <button
                    class="lw-discord-card__session-editor-button is-danger"
                    type="button"
                    :disabled="pendingDeleteSessionId === session.id"
                    @click="confirmDeleteSession(session)"
                  >
                    {{ pendingDeleteSessionId === session.id ? '删除中...' : '确认删除' }}
                  </button>
                </div>
              </div>
            </div>

            <button
              v-if="group.sessions.length > visibleSessionCount"
              class="lw-discord-card__more"
              type="button"
              @click="onToggleSessionExpansion?.(group.key)"
            >
              {{ isGroupShowingAllSessions(group.key)
                ? '收起'
                : `查看更多 ${group.sessions.length - visibleSessionCount} 条` }}
            </button>
          </template>

          <div v-else class="lw-discord-card__session-empty">
            暂无历史对话
          </div>
        </div>
      </article>
    </div>
  </aside>
</template>

<script setup lang="ts">
import { computed, ref, watch, type CSSProperties } from 'vue';
import { activeSettings, useSettings } from '../plugins/settings/useSettings';
import { getThemeSettingValue } from '../theme/themeRegistry';
import { useComponentSkin } from '../theme/useComponentSkin';
import type {
  CharacterChannelGroup,
  CharacterChannelSessionItem,
  CharacterChannelState,
  CreateChatConversationInput,
  DeleteChatConversationInput,
  RenameChatConversationInput
} from '../types/ConversationContextTypes';

const DEFAULT_VISIBLE_SESSION_COUNT = 5;

const props = withDefaults(defineProps<{
  state: CharacterChannelState;
  isMobile?: boolean;
  mobilePlacement?: 'top' | 'bottom' | 'left' | 'right';
  onOpenSession?: (sessionId: string) => void;
  onCreateSession?: (payload: CreateChatConversationInput) => void;
  onRenameSession?: (payload: RenameChatConversationInput) => Promise<void> | void;
  onDeleteSession?: (payload: DeleteChatConversationInput) => Promise<void> | void;
  onToggleGroup?: (groupKey: string) => void;
  onToggleSessionExpansion?: (groupKey: string) => void;
}>(), {
  isMobile: false,
  mobilePlacement: 'bottom',
  onOpenSession: undefined,
  onCreateSession: undefined,
  onRenameSession: undefined,
  onDeleteSession: undefined,
  onToggleGroup: undefined,
  onToggleSessionExpansion: undefined
});

useSettings();

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
const visibleSessionCount = computed(() => {
  const value = Number(getThemeSettingValue(activeSettings, desktopModeId.value, 'discordCharacterRailVisibleSessions', DEFAULT_VISIBLE_SESSION_COUNT));
  return Number.isFinite(value) && value > 0 ? Math.floor(value) : DEFAULT_VISIBLE_SESSION_COUNT;
});

const sessionMenuId = ref<string | null>(null);
const renameDraftSessionId = ref<string | null>(null);
const renameDraftTitle = ref('');
const deleteConfirmSessionId = ref<string | null>(null);
const pendingRenameSessionId = ref<string | null>(null);
const pendingDeleteSessionId = ref<string | null>(null);

const characterGroups = computed<CharacterChannelGroup[]>(() => props.state.characterGroups);
const activeSessionId = computed(() => props.state.activeSessionId);
const expandedCharacterKey = computed(() => props.state.expandedCharacterKey);
const activeCharacterKey = computed(() => {
  const sessionId = activeSessionId.value;
  if (!sessionId) return null;
  return characterGroups.value.find((group) => group.sessions.some((session) => session.id === sessionId))?.key || null;
});

watch(activeCharacterKey, (nextKey) => {
  if (!nextKey || props.state.expandedCharacterKey === nextKey) {
    return;
  }
  props.onToggleGroup?.(nextKey);
}, { immediate: true });

watch(
  () => characterGroups.value.flatMap((group) => group.sessions.map((session) => session.id)).join('|'),
  () => {
    const sessionIds = new Set(characterGroups.value.flatMap((group) => group.sessions.map((session) => session.id)));
    if (sessionMenuId.value && !sessionIds.has(sessionMenuId.value)) {
      sessionMenuId.value = null;
    }
    if (renameDraftSessionId.value && !sessionIds.has(renameDraftSessionId.value)) {
      renameDraftSessionId.value = null;
      renameDraftTitle.value = '';
      pendingRenameSessionId.value = null;
    }
    if (deleteConfirmSessionId.value && !sessionIds.has(deleteConfirmSessionId.value)) {
      deleteConfirmSessionId.value = null;
      pendingDeleteSessionId.value = null;
    }
    if (pendingRenameSessionId.value && !sessionIds.has(pendingRenameSessionId.value)) {
      pendingRenameSessionId.value = null;
    }
    if (pendingDeleteSessionId.value && !sessionIds.has(pendingDeleteSessionId.value)) {
      pendingDeleteSessionId.value = null;
    }
  },
  { immediate: true }
);

const toggleGroup = (groupKey: string) => {
  props.onToggleGroup?.(groupKey);
  sessionMenuId.value = null;
};

const openRecentSession = (group: CharacterChannelGroup) => {
  if (!group.recentSession) return;
  props.onOpenSession?.(group.recentSession.id);
};

const createSession = (group: CharacterChannelGroup) => {
  props.onCreateSession?.({
    characterId: group.characterId,
    characterName: group.characterName,
    characterAvatarUrl: group.characterAvatarUrl
  });
};

const isGroupShowingAllSessions = (groupKey: string): boolean => {
  return Boolean(props.state.expandedSessionGroups[groupKey]);
};

const getVisibleSessions = (group: CharacterChannelGroup): CharacterChannelSessionItem[] => {
  if (group.sessions.length <= visibleSessionCount.value || isGroupShowingAllSessions(group.key)) {
    return group.sessions;
  }
  return group.sessions.slice(0, visibleSessionCount.value);
};

const isSessionBusy = (sessionId: string): boolean => {
  return props.state.busySessionIds.includes(sessionId)
    || pendingRenameSessionId.value === sessionId
    || pendingDeleteSessionId.value === sessionId;
};

const toggleSessionMenu = (sessionId: string) => {
  sessionMenuId.value = sessionMenuId.value === sessionId ? null : sessionId;
  deleteConfirmSessionId.value = null;
  if (renameDraftSessionId.value !== sessionId) {
    renameDraftSessionId.value = null;
    renameDraftTitle.value = '';
  }
};

const startRenameSession = (session: CharacterChannelSessionItem) => {
  sessionMenuId.value = null;
  deleteConfirmSessionId.value = null;
  renameDraftSessionId.value = session.id;
  renameDraftTitle.value = session.title;
};

const cancelRenameSession = () => {
  renameDraftSessionId.value = null;
  renameDraftTitle.value = '';
};

const startDeleteSession = (session: CharacterChannelSessionItem) => {
  sessionMenuId.value = null;
  renameDraftSessionId.value = null;
  renameDraftTitle.value = '';
  deleteConfirmSessionId.value = session.id;
};

const cancelDeleteSession = () => {
  deleteConfirmSessionId.value = null;
};

const submitRenameSession = async (session: CharacterChannelSessionItem) => {
  const nextTitle = renameDraftTitle.value.trim();
  if (!nextTitle || !props.onRenameSession || pendingRenameSessionId.value === session.id) {
    return;
  }

  pendingRenameSessionId.value = session.id;
  try {
    await props.onRenameSession({
      sessionId: session.id,
      nextTitle,
      characterId: session.characterId ?? null,
      characterName: session.characterName || '',
      characterAvatarUrl: session.characterAvatarUrl ?? null
    });
    renameDraftSessionId.value = null;
    renameDraftTitle.value = '';
  } catch (error) {
    console.error('[DiscordCharacterRail] rename session failed', error);
  } finally {
    pendingRenameSessionId.value = null;
  }
};

const confirmDeleteSession = async (session: CharacterChannelSessionItem) => {
  if (!props.onDeleteSession || pendingDeleteSessionId.value === session.id) {
    return;
  }

  pendingDeleteSessionId.value = session.id;
  try {
    await props.onDeleteSession({
      sessionId: session.id,
      characterId: session.characterId ?? null,
      characterName: session.characterName || '',
      characterAvatarUrl: session.characterAvatarUrl ?? null
    });
    deleteConfirmSessionId.value = null;
  } catch (error) {
    console.error('[DiscordCharacterRail] delete session failed', error);
  } finally {
    pendingDeleteSessionId.value = null;
  }
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

.lw-discord-card__avatar:disabled {
  cursor: default;
  opacity: 0.72;
}

.lw-discord-card__session-empty {
  padding: 10px 12px;
  font-size: 12px;
  color: var(--lw-text-muted, rgba(255, 255, 255, 0.56));
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

.lw-discord-card__session-wrap {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.lw-discord-card__session-row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 8px;
}

.lw-discord-card__session-row.is-menu-open .lw-discord-card__session-main {
  border-color: rgba(var(--lw-primary-rgb), 0.24);
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

.lw-discord-card__session:disabled,
.lw-discord-card__session-menu-trigger:disabled,
.lw-discord-card__session-menu-item:disabled,
.lw-discord-card__session-editor-button:disabled {
  opacity: 0.68;
  cursor: default;
}

.lw-discord-card__session.is-active {
  border-color: rgba(var(--lw-primary-rgb), 0.28);
  color: var(--lw-text-main);
}

.lw-discord-card__session-main {
  min-width: 0;
}

.lw-discord-card__session-create {
  border-style: dashed;
  border-color: color-mix(in srgb, var(--lw-primary) 20%, var(--lw-border-base));
  background: color-mix(in srgb, var(--lw-primary) 10%, transparent);
  color: var(--lw-text-main);
}

.lw-discord-card__session-title {
  min-width: 0;
  font-size: 12px;
  font-weight: 700;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.lw-discord-card__session-meta {
  flex-shrink: 0;
  font-size: 10px;
  color: var(--lw-text-muted);
}

.lw-discord-card__session-menu-trigger {
  width: 36px;
  border: 1px solid transparent;
  border-radius: 12px;
  background: var(--lw-character-session-bg, color-mix(in srgb, var(--lw-bg-elevated) 76%, transparent));
  color: var(--lw-text-muted);
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

.lw-discord-card__session-menu {
  display: flex;
  gap: 6px;
}

.lw-discord-card__session-menu-item,
.lw-discord-card__session-editor-button,
.lw-discord-card__more {
  border: 1px solid transparent;
  border-radius: 12px;
  background: color-mix(in srgb, var(--lw-bg-elevated) 82%, transparent);
  color: var(--lw-text-secondary);
  font-size: 11px;
  font-weight: 700;
}

.lw-discord-card__session-menu-item {
  padding: 8px 10px;
}

.lw-discord-card__session-menu-item.is-danger,
.lw-discord-card__session-editor-button.is-danger {
  color: #f87171;
}

.lw-discord-card__session-editor,
.lw-discord-card__session-delete-confirm {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 10px 12px;
  border-radius: 14px;
  border: 1px solid color-mix(in srgb, var(--lw-border-base) 82%, transparent);
  background: color-mix(in srgb, var(--lw-bg-elevated) 88%, transparent);
}

.lw-discord-card__session-delete-confirm p {
  margin: 0;
  font-size: 11px;
  line-height: 1.5;
  color: var(--lw-text-secondary);
}

.lw-discord-card__session-input {
  width: 100%;
  min-width: 0;
  padding: 9px 10px;
  border: 1px solid color-mix(in srgb, var(--lw-border-base) 86%, transparent);
  border-radius: 12px;
  background: var(--lw-bg-surface, rgba(255, 255, 255, 0.04));
  color: var(--lw-text-main);
  font-size: 12px;
}

.lw-discord-card__session-editor-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}

.lw-discord-card__session-editor-button {
  padding: 8px 10px;
}

.lw-discord-card__session-editor-button.is-primary {
  background: color-mix(in srgb, var(--lw-primary) 18%, transparent);
  color: var(--lw-text-main);
}

.lw-discord-card__more {
  align-self: flex-start;
  padding: 8px 12px;
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
  background: var(--lw-character-card-bg, var(--lw-surface-container-lowest));
  border-color: var(--lw-character-card-border, var(--lw-border-strong));
}

.lw-discord-rail[data-skin-variant='discord'] .lw-discord-card__main:hover {
  background: color-mix(in srgb, var(--lw-primary) 6%, var(--lw-character-card-bg, var(--lw-surface-container-lowest)));
}

.lw-discord-rail[data-skin-variant='discord'] .lw-discord-card.is-active {
  background: color-mix(in srgb, var(--lw-primary) 9%, var(--lw-character-card-bg, var(--lw-surface-container-lowest)));
}

.lw-discord-rail[data-skin-variant='discord'] .lw-discord-card__session,
.lw-discord-rail[data-skin-variant='discord'] .lw-discord-card__session-menu-trigger,
.lw-discord-rail[data-skin-variant='discord'] .lw-discord-card__session-menu-item,
.lw-discord-rail[data-skin-variant='discord'] .lw-discord-card__session-editor-button,
.lw-discord-rail[data-skin-variant='discord'] .lw-discord-card__more {
  background: var(--lw-character-session-bg, var(--lw-surface-container-high));
}

.lw-discord-rail[data-skin-variant='discord'] .lw-discord-card__session:hover,
.lw-discord-rail[data-skin-variant='discord'] .lw-discord-card__session-menu-trigger:hover,
.lw-discord-rail[data-skin-variant='discord'] .lw-discord-card__session-menu-item:hover,
.lw-discord-rail[data-skin-variant='discord'] .lw-discord-card__session-editor-button:hover,
.lw-discord-rail[data-skin-variant='discord'] .lw-discord-card__more:hover {
  background: var(--lw-surface-container-highest);
}

.lw-discord-rail[data-skin-variant='discord'] .lw-discord-card__session-create,
.lw-discord-rail[data-skin-variant='discord'] .lw-discord-card__session-editor-button.is-primary {
  border-color: color-mix(in srgb, var(--lw-primary) 32%, var(--lw-border-strong));
  background: color-mix(in srgb, var(--lw-primary) 16%, var(--lw-character-session-bg, var(--lw-surface-container-high)));
}

.lw-discord-rail[data-skin-variant='discord'] .lw-discord-card__session-editor,
.lw-discord-rail[data-skin-variant='discord'] .lw-discord-card__session-delete-confirm {
  background: var(--lw-surface-container-low);
  border-color: var(--lw-border-strong);
}

.lw-discord-rail[data-skin-variant='discord'] .lw-discord-card__session-input {
  background: var(--lw-surface-container);
  border-color: var(--lw-border-strong);
}

.lw-discord-rail.is-mobile {
  width: 100%;
  min-width: 0;
  max-width: none;
  max-height: min(72vh, 680px);
  padding: 14px 12px 18px;
  border-right: none;
  border-top-left-radius: 26px;
  border-top-right-radius: 26px;
  box-shadow: 0 -22px 40px rgba(0, 0, 0, 0.28);
}

.lw-discord-rail.is-mobile .lw-discord-rail__header {
  padding: 8px 10px 6px;
}

.lw-discord-rail.is-mobile .lw-discord-rail__list {
  padding-right: 0;
  padding-bottom: 4px;
}

.lw-discord-rail.is-mobile .lw-discord-card__sessions {
  padding: 0 10px 10px 62px;
}

.lw-discord-rail.is-mobile.mobile-top {
  border-top-left-radius: 0;
  border-top-right-radius: 0;
  border-bottom-left-radius: 26px;
  border-bottom-right-radius: 26px;
}

.lw-discord-rail.is-mobile.mobile-left,
.lw-discord-rail.is-mobile.mobile-right {
  width: min(360px, 100%);
  height: 100%;
  max-height: none;
  padding: 16px 12px 18px;
  box-shadow: 0 0 0 rgba(0, 0, 0, 0);
}

.lw-discord-rail.is-mobile.mobile-left {
  border-top-left-radius: 0;
  border-bottom-left-radius: 0;
}

.lw-discord-rail.is-mobile.mobile-right {
  border-top-right-radius: 0;
  border-bottom-right-radius: 0;
}
</style>
