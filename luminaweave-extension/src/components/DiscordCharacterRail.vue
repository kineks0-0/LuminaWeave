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
    <div v-if="isTelegramVariant" class="lw-telegram-rail__toolbar">
      <div class="lw-telegram-rail__brand">
        <strong>Telegram</strong>
      </div>
      <div class="lw-telegram-rail__create">
      <button
        type="button"
        title="新建或打开对话"
        :aria-expanded="isTelegramCreateMenuOpen"
        @click="toggleTelegramCreateMenu"
      >
        <component :is="getTelegramIconComponent('plus')" :size="22" :stroke-width="TELEGRAM_ICON_STROKE_WIDTH" aria-hidden="true" />
      </button>
        <div v-if="isTelegramCreateMenuOpen" class="lw-telegram-create-menu">
          <button
            type="button"
            :disabled="!activeOrFirstGroup || !onCreateSession"
            @click="createFromActiveGroup"
          >
            <strong>新建当前角色对话</strong>
            <span>{{ activeOrFirstGroup ? activeOrFirstGroup.characterName : '先选择一个角色' }}</span>
          </button>
          <button type="button" @click="selectRoleForCreate">
            <strong>选择角色新建</strong>
            <span>回到角色列表选择对象</span>
          </button>
          <button type="button" :disabled="!mostRecentSession" @click="openMostRecentSession">
            <strong>打开最近</strong>
            <span>{{ mostRecentSession ? mostRecentSession.title : '暂无最近会话' }}</span>
          </button>
          <button type="button" @click="showFavoritesFilter">
            <strong>管理收藏</strong>
            <span>查看已收藏的角色会话</span>
          </button>
        </div>
      </div>
    </div>

    <label v-if="isTelegramVariant" class="lw-telegram-search">
      <component :is="getTelegramIconComponent('search')" :size="23" :stroke-width="TELEGRAM_ICON_STROKE_WIDTH" aria-hidden="true" />
      <input v-model="telegramSearchQuery" type="search" placeholder="搜索聊天">
    </label>

    <div v-if="isTelegramVariant" class="lw-telegram-tabs" aria-label="Telegram chat filters">
      <div
        v-for="tab in telegramFilterTabs"
        :key="tab.id"
        class="lw-telegram-tab-wrap"
      >
        <button
          type="button"
          :class="{ active: telegramActiveFilter === tab.id }"
          :aria-expanded="tab.id === 'filter' ? isTelegramFilterMenuOpen : undefined"
          @click="handleTelegramFilterTabClick(tab.id)"
        >
          {{ tab.label }}
          <component
            v-if="tab.id === 'filter'"
            :is="getTelegramIconComponent('chevronDown')"
            :size="15"
            :stroke-width="TELEGRAM_ICON_STROKE_WIDTH"
            aria-hidden="true"
          />
        </button>

        <div v-if="tab.id === 'filter' && isTelegramFilterMenuOpen" class="lw-telegram-filter-menu">
          <button
            v-for="item in telegramSecondaryFilters"
            :key="item.id"
            type="button"
            :class="{ active: telegramSecondaryFilter === item.id }"
            @click="selectTelegramSecondaryFilter(item.id)"
          >
            {{ item.label }}
          </button>
        </div>
      </div>
    </div>

    <div v-if="isTelegramVariant" class="lw-telegram-list-mode" aria-label="Telegram conversation list mode">
      <button
        type="button"
        :class="{ active: telegramListMode === 'groupedByRole' }"
        @click="setTelegramListMode('groupedByRole')"
      >
        角色聚合
      </button>
      <button
        type="button"
        :class="{ active: telegramListMode === 'conversationFiles' }"
        @click="setTelegramListMode('conversationFiles')"
      >
        对话文件
      </button>
    </div>

    <button
      v-if="isTelegramVariant"
      class="lw-telegram-saved"
      type="button"
      :disabled="!mostRecentSession"
      @click="openMostRecentSession"
    >
      <span class="saved-icon">
        <component :is="getTelegramIconComponent('chat')" :size="22" :stroke-width="TELEGRAM_ICON_STROKE_WIDTH" aria-hidden="true" />
      </span>
      <span class="saved-copy">
        <strong>{{ mostRecentGroup ? mostRecentGroup.characterName : '还没有最近对话' }}</strong>
        <small>{{ mostRecentSession ? mostRecentSession.title : '选择角色开始第一段聊天' }}</small>
      </span>
      <span class="saved-meta">{{ mostRecentSession ? formatSessionTime(mostRecentSession.updatedAt) : '' }}</span>
    </button>

    <div v-else class="lw-discord-rail__header">
      <span class="lw-discord-rail__eyebrow">Direct Messages</span>
      <strong>角色频道</strong>
      <span>点击头像直达最近一次会话，点击卡片主体展开这个角色的历史分支。</span>
    </div>

    <div v-if="characterGroups.length === 0 && displayedTelegramTools.length === 0" class="lw-discord-rail__empty">
      <strong>暂无角色会话</strong>
      <span>开始一段聊天后，这里会聚合角色卡和最近对话。</span>
    </div>

    <div v-else-if="isTelegramVariant && displayedCharacterGroups.length === 0 && displayedConversationSessions.length === 0 && displayedTelegramTools.length === 0" class="lw-discord-rail__empty">
      <strong>无匹配聊天</strong>
      <span>换个关键词或切回全部，不会自动新建会话。</span>
    </div>

    <div v-else class="lw-discord-rail__list">
      <article
        v-for="tool in displayedTelegramTools"
        :key="tool.id"
        class="lw-discord-card lw-telegram-tool-card"
        :class="{
          'is-active': activeTelegramToolId === tool.id,
          'is-compact': cardDensity === 'compact'
        }"
        :style="cardStyle"
      >
        <button class="lw-discord-card__main" type="button" @click="openTelegramTool(tool.id)">
          <span
            class="lw-discord-card__avatar lw-telegram-tool-card__icon"
            aria-hidden="true"
          >
            <component :is="getTelegramIconComponent(getTelegramToolIconName(tool.id))" :size="24" :stroke-width="TELEGRAM_ICON_STROKE_WIDTH" />
          </span>

          <span class="lw-discord-card__body">
            <span class="lw-discord-card__title-row">
              <strong>{{ tool.label }}</strong>
              <span>工具</span>
            </span>
            <span
              class="lw-discord-card__preview"
              :style="{ WebkitLineClamp: String(previewLines) }"
            >
              {{ tool.description }}
            </span>
          </span>
        </button>
      </article>

      <article
        v-for="session in displayedConversationSessions"
        :key="session.id"
        class="lw-discord-card lw-telegram-session-file-card"
        :class="{
          'is-active': activeSessionId === session.id,
          'is-compact': cardDensity === 'compact'
        }"
        :style="cardStyle"
      >
        <button class="lw-discord-card__main" type="button" @click="onOpenSession?.(session.id)">
          <span class="lw-discord-card__avatar" :style="getTelegramAvatarStyle(session.characterName || session.title)">
            <img
              v-if="session.characterAvatarUrl"
              :src="session.characterAvatarUrl"
              :alt="session.characterName || session.title"
              @error="hideBrokenTelegramAvatar"
            >
            <span v-else>{{ getSessionInitial(session) }}</span>
          </span>

          <span class="lw-discord-card__body">
            <span class="lw-discord-card__title-row">
              <strong>{{ session.title }}</strong>
              <span>{{ formatSessionTime(session.updatedAt) }}</span>
            </span>
            <span
              class="lw-discord-card__preview"
              :style="{ WebkitLineClamp: String(previewLines) }"
            >
              {{ getSessionPreview(session) }}
            </span>
          </span>
        </button>
      </article>

      <article
        v-for="group in displayedCharacterGroups"
        :key="group.key"
        class="lw-discord-card"
        :class="{
          'is-active': isCharacterGroupActive(group),
          'is-expanded': expandedCharacterKey === group.key,
          'is-compact': cardDensity === 'compact'
        }"
        :style="cardStyle"
      >
        <div class="lw-discord-card__main" @click="handleCardMainClick(group)">
          <button
            class="lw-discord-card__avatar"
            :style="getTelegramAvatarStyle(group.characterName)"
            type="button"
            :title="isTelegramVariant ? `查看 ${group.characterName} 概览` : (group.recentSession ? `打开 ${group.characterName} 最近一次对话` : `${group.characterName} 暂无对话`)"
            :disabled="!isTelegramVariant && !group.recentSession"
            @click.stop="handleAvatarClick(group)"
          >
            <img
              v-if="group.characterAvatarUrl"
              :src="group.characterAvatarUrl"
              :alt="group.characterName"
              @error="hideBrokenTelegramAvatar"
            >
            <span v-else>{{ getTelegramInitial(group.characterName) }}</span>
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

          <button
            class="lw-discord-card__chevron"
            type="button"
            :disabled="isTelegramVariant && group.sessions.length === 0"
            :tabindex="isTelegramVariant ? 0 : -1"
            :aria-hidden="!isTelegramVariant"
            :title="`展开 ${group.characterName} 的历史会话`"
            @click.stop="toggleGroup(group.key)"
          >
            <component :is="getTelegramIconComponent('chevronRight')" :size="17" :stroke-width="TELEGRAM_ICON_STROKE_WIDTH" aria-hidden="true" />
          </button>
        </div>

        <div v-if="expandedCharacterKey === group.key && group.sessions.length > 0" class="lw-discord-card__sessions">
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
                  <component :is="getTelegramIconComponent('more')" :size="17" :stroke-width="TELEGRAM_ICON_STROKE_WIDTH" aria-hidden="true" />
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
import { activeSettings, useSettings } from '../plugins/settings/useSettings.js';
import { getDesktopModeSettingValue } from '../desktop-modes/core/registry.js';
import { useSurfaceSkin } from '../desktop-modes/core/useSurfaceSkin.js';
import {
  TELEGRAM_ICON_STROKE_WIDTH,
  getTelegramAvatarStyle,
  getTelegramIconComponent,
  getTelegramInitial,
  getTelegramToolIconName,
  hideBrokenTelegramAvatar
} from '../shell/traditional/telegramVisual.js';
import type {
  CharacterChannelGroup,
  CharacterChannelSessionItem,
  CharacterChannelState,
  CreateChatConversationInput,
  DeleteChatConversationInput,
  RenameChatConversationInput
} from '../types/ConversationContextTypes.js';

const DEFAULT_VISIBLE_SESSION_COUNT = 5;
type TelegramRailToolEntry = {
  id: 'lumina-launcher' | 'lumina-forge';
  label: string;
  description: string;
  icon: string;
};
type TelegramConversationListMode = 'groupedByRole' | 'conversationFiles';

const props = withDefaults(defineProps<{
  state: CharacterChannelState;
  isMobile?: boolean;
  mobilePlacement?: 'top' | 'bottom' | 'left' | 'right';
  onOpenSession?: (sessionId: string) => void;
  onCreateSession?: (payload: CreateChatConversationInput) => void;
  selectedCharacterKey?: string | null;
  onSelectCharacterOverview?: (groupKey: string | null) => void;
  onRenameSession?: (payload: RenameChatConversationInput) => Promise<void> | void;
  onDeleteSession?: (payload: DeleteChatConversationInput) => Promise<void> | void;
  onToggleGroup?: (groupKey: string) => void;
  onToggleSessionExpansion?: (groupKey: string) => void;
  telegramToolEntries?: TelegramRailToolEntry[];
  activeTelegramToolId?: string | null;
  onOpenTelegramToolEntry?: (toolId: TelegramRailToolEntry['id']) => void;
  telegramListMode?: TelegramConversationListMode;
  onTelegramListModeChange?: (mode: TelegramConversationListMode) => void;
}>(), {
  isMobile: false,
  mobilePlacement: 'bottom',
  onOpenSession: undefined,
  onCreateSession: undefined,
  selectedCharacterKey: null,
  onSelectCharacterOverview: undefined,
  onRenameSession: undefined,
  onDeleteSession: undefined,
  onToggleGroup: undefined,
  onToggleSessionExpansion: undefined,
  telegramToolEntries: () => [],
  activeTelegramToolId: null,
  onOpenTelegramToolEntry: undefined,
  telegramListMode: 'groupedByRole',
  onTelegramListModeChange: undefined
});

useSettings();

const { cssVars: railSkinVars, variant: railVariant, desktopModeId } = useSurfaceSkin('shell.characterRail');
const { cssVars: cardSkinVars } = useSurfaceSkin('shell.characterCard');
const { cssVars: telegramChatListVars } = useSurfaceSkin('telegram.chatList');

const railStyle = computed<CSSProperties>(() => ({
  ...(railSkinVars.value as CSSProperties),
  ...(railVariant.value === 'telegram' ? (telegramChatListVars.value as CSSProperties) : {})
}));
const cardStyle = computed<CSSProperties>(() => cardSkinVars.value as CSSProperties);
const isTelegramVariant = computed(() => railVariant.value === 'telegram');
const previewLines = computed(() => {
  const value = Number(getDesktopModeSettingValue(activeSettings, desktopModeId.value, 'sidebarPreviewLines', 2));
  return Number.isFinite(value) && value > 0 ? value : 2;
});
const cardDensity = computed(() => String(
  getDesktopModeSettingValue(activeSettings, desktopModeId.value, 'sidebarCardDensity', 'cozy')
));
const visibleSessionCount = computed(() => {
  const value = Number(getDesktopModeSettingValue(activeSettings, desktopModeId.value, 'discordCharacterRailVisibleSessions', DEFAULT_VISIBLE_SESSION_COUNT));
  return Number.isFinite(value) && value > 0 ? Math.floor(value) : DEFAULT_VISIBLE_SESSION_COUNT;
});

const sessionMenuId = ref<string | null>(null);
const renameDraftSessionId = ref<string | null>(null);
const renameDraftTitle = ref('');
const deleteConfirmSessionId = ref<string | null>(null);
const pendingRenameSessionId = ref<string | null>(null);
const pendingDeleteSessionId = ref<string | null>(null);
type TelegramFilterTabId = 'all' | 'characters' | 'tools' | 'filter';
type TelegramSecondaryFilterId = 'all' | 'unread' | 'favorites' | 'recent';

const telegramSearchQuery = ref('');
const telegramActiveFilter = ref<TelegramFilterTabId>('all');
const telegramSecondaryFilter = ref<TelegramSecondaryFilterId>('all');
const isTelegramCreateMenuOpen = ref(false);
const isTelegramFilterMenuOpen = ref(false);

const characterGroups = computed<CharacterChannelGroup[]>(() => props.state.characterGroups);
const activeSessionId = computed(() => props.state.activeSessionId);
const expandedCharacterKey = computed(() => props.state.expandedCharacterKey);
const activeCharacterKey = computed(() => {
  const sessionId = activeSessionId.value;
  if (!sessionId) return null;
  return characterGroups.value.find((group) => group.sessions.some((session) => session.id === sessionId))?.key || null;
});
const activeOrFirstGroup = computed<CharacterChannelGroup | null>(() => {
  return characterGroups.value.find((group) => group.key === activeCharacterKey.value)
    || characterGroups.value.find((group) => group.key === props.selectedCharacterKey)
    || characterGroups.value.find((group) => group.key === expandedCharacterKey.value)
    || characterGroups.value[0]
    || null;
});
const mostRecentGroup = computed<CharacterChannelGroup | null>(() => {
  return [...characterGroups.value]
    .filter((group) => Boolean(group.recentSession))
    .sort((left, right) => (right.recentSession?.updatedAt || 0) - (left.recentSession?.updatedAt || 0))[0] || null;
});
const mostRecentSession = computed<CharacterChannelSessionItem | null>(() => mostRecentGroup.value?.recentSession || null);
const recentGroups = computed<CharacterChannelGroup[]>(() => (
  [...characterGroups.value]
    .filter((group) => Boolean(group.recentSession))
    .sort((left, right) => (right.recentSession?.updatedAt || 0) - (left.recentSession?.updatedAt || 0))
));
const telegramFilterTabs = computed<Array<{ id: TelegramFilterTabId; label: string; count: number | null }>>(() => [
  { id: 'all', label: '所有', count: characterGroups.value.length },
  { id: 'characters', label: '联系人', count: characterGroups.value.length },
  { id: 'tools', label: '工具', count: null },
  { id: 'filter', label: '筛选', count: recentGroups.value.length }
]);
const telegramSecondaryFilters: Array<{ id: TelegramSecondaryFilterId; label: string }> = [
  { id: 'all', label: '全部会话' },
  { id: 'unread', label: '未读优先' },
  { id: 'favorites', label: '收藏角色' },
  { id: 'recent', label: '最近更新' }
];
const filteredCharacterGroups = computed<CharacterChannelGroup[]>(() => {
  const baseGroups = telegramActiveFilter.value === 'tools'
    ? []
    : characterGroups.value;
  const secondaryGroups = applyTelegramSecondaryFilter(baseGroups);
  const query = telegramSearchQuery.value.trim().toLowerCase();
  if (!query) {
    return secondaryGroups;
  }

  return secondaryGroups.filter((group) => {
    const searchable = [
      group.characterName,
      group.recentPreview,
      group.recentSession?.title || '',
      ...group.sessions.flatMap((session) => [
        session.title,
        session.summary,
        session.previewMessage,
        session.recentHistoryPreview
      ])
    ].join('\n').toLowerCase();
    return searchable.includes(query);
  });
});
const displayedCharacterGroups = computed<CharacterChannelGroup[]>(() => (
  isTelegramVariant.value && props.telegramListMode === 'conversationFiles'
    ? []
    : (isTelegramVariant.value ? filteredCharacterGroups.value : characterGroups.value)
));
const flattenedConversationSessions = computed<CharacterChannelSessionItem[]>(() => (
  filteredCharacterGroups.value
    .flatMap((group) => group.sessions)
    .sort((left, right) => right.updatedAt - left.updatedAt)
));
const displayedConversationSessions = computed<CharacterChannelSessionItem[]>(() => (
  isTelegramVariant.value && props.telegramListMode === 'conversationFiles'
    ? flattenedConversationSessions.value
    : []
));
const displayedTelegramTools = computed<TelegramRailToolEntry[]>(() => {
  if (!isTelegramVariant.value || telegramActiveFilter.value !== 'tools') {
    return [];
  }

  const query = telegramSearchQuery.value.trim().toLowerCase();
  if (!query) {
    return props.telegramToolEntries;
  }

  return props.telegramToolEntries.filter((tool) => (
    `${tool.label}\n${tool.description}`.toLowerCase().includes(query)
  ));
});

const telegramListMode = computed(() => props.telegramListMode);
const setTelegramListMode = (mode: TelegramConversationListMode) => {
  props.onTelegramListModeChange?.(mode);
};

watch(activeCharacterKey, (nextKey) => {
  if (isTelegramVariant.value) {
    return;
  }
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

const handleCardMainClick = (group: CharacterChannelGroup) => {
  if (isTelegramVariant.value) {
    props.onSelectCharacterOverview?.(group.key);
    return;
  }
  toggleGroup(group.key);
};

const handleAvatarClick = (group: CharacterChannelGroup) => {
  if (isTelegramVariant.value) {
    props.onSelectCharacterOverview?.(group.key);
    return;
  }
  openRecentSession(group);
};

const isCharacterGroupActive = (group: CharacterChannelGroup): boolean => (
  activeCharacterKey.value === group.key
  || (isTelegramVariant.value && !props.activeTelegramToolId && props.selectedCharacterKey === group.key)
);

const openTelegramTool = (toolId: TelegramRailToolEntry['id']) => {
  props.onOpenTelegramToolEntry?.(toolId);
  isTelegramCreateMenuOpen.value = false;
  isTelegramFilterMenuOpen.value = false;
};

const getSessionInitial = (session: CharacterChannelSessionItem) => (
  (session.characterName || session.title || '?').slice(0, 1).toUpperCase()
);

const getSessionPreview = (session: CharacterChannelSessionItem) => (
  session.previewMessage || session.summary || session.recentHistoryPreview || session.characterName || '暂无预览'
);

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

const createFirstSession = () => {
  const firstGroup = characterGroups.value[0];
  if (!firstGroup) return;
  createSession(firstGroup);
};

const toggleTelegramCreateMenu = () => {
  isTelegramCreateMenuOpen.value = !isTelegramCreateMenuOpen.value;
  if (isTelegramCreateMenuOpen.value) {
    isTelegramFilterMenuOpen.value = false;
  }
};

const createFromActiveGroup = () => {
  const group = activeOrFirstGroup.value;
  if (!group) return;
  createSession(group);
  isTelegramCreateMenuOpen.value = false;
};

const selectRoleForCreate = () => {
  telegramActiveFilter.value = 'characters';
  telegramSearchQuery.value = '';
  isTelegramCreateMenuOpen.value = false;
  const group = activeOrFirstGroup.value;
  if (group && props.state.expandedCharacterKey !== group.key) {
    props.onToggleGroup?.(group.key);
  }
};

const openMostRecentSession = () => {
  if (!mostRecentSession.value) return;
  props.onOpenSession?.(mostRecentSession.value.id);
  isTelegramCreateMenuOpen.value = false;
};

const showFavoritesFilter = () => {
  telegramActiveFilter.value = 'filter';
  telegramSecondaryFilter.value = 'favorites';
  isTelegramCreateMenuOpen.value = false;
  isTelegramFilterMenuOpen.value = false;
};

const handleTelegramFilterTabClick = (tabId: TelegramFilterTabId) => {
  if (tabId === 'filter') {
    telegramActiveFilter.value = 'filter';
    isTelegramFilterMenuOpen.value = !isTelegramFilterMenuOpen.value;
    isTelegramCreateMenuOpen.value = false;
    return;
  }
  telegramActiveFilter.value = tabId;
  isTelegramFilterMenuOpen.value = false;
};

const selectTelegramSecondaryFilter = (filterId: TelegramSecondaryFilterId) => {
  telegramSecondaryFilter.value = filterId;
  telegramActiveFilter.value = 'filter';
  isTelegramFilterMenuOpen.value = false;
};

const applyTelegramSecondaryFilter = (groups: CharacterChannelGroup[]): CharacterChannelGroup[] => {
  switch (telegramSecondaryFilter.value) {
    case 'unread':
      return [...groups].sort((left, right) => {
        const rightUnread = right.sessions.some((session) => session.id !== activeSessionId.value && session.messageCount > 0) ? 1 : 0;
        const leftUnread = left.sessions.some((session) => session.id !== activeSessionId.value && session.messageCount > 0) ? 1 : 0;
        return rightUnread - leftUnread || (right.recentSession?.updatedAt || 0) - (left.recentSession?.updatedAt || 0);
      });
    case 'favorites':
      return groups.filter((group) => (
        group.characterName.includes('★')
        || group.recentPreview.includes('★')
        || group.sessions.some((session) => session.title.includes('★') || session.summary.includes('★'))
      ));
    case 'recent':
      return [...groups].sort((left, right) => (right.recentSession?.updatedAt || 0) - (left.recentSession?.updatedAt || 0));
    case 'all':
    default:
      return groups;
  }
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
  font-size: var(--lw-type-body-small-size);
  line-height: var(--lw-type-body-small-line-height);
  font-weight: var(--lw-type-body-small-weight);
  letter-spacing: var(--lw-type-body-small-tracking);
  color: var(--lw-text-muted, rgba(255, 255, 255, 0.56));
}

.lw-discord-rail__eyebrow {
  font-size: var(--lw-type-label-small-size);
  line-height: var(--lw-type-label-small-line-height);
  font-weight: var(--lw-type-label-small-weight);
  letter-spacing: var(--lw-type-label-small-tracking);
  text-transform: uppercase;
  color: var(--lw-text-muted);
}

.lw-discord-rail__header strong {
  font-size: var(--lw-type-title-small-size);
  line-height: var(--lw-type-title-small-line-height);
  font-weight: var(--lw-type-title-small-weight);
  letter-spacing: var(--lw-type-title-small-tracking);
  color: var(--lw-text-main);
}

.lw-discord-rail__header span:last-child {
  font-size: var(--lw-type-body-small-size);
  line-height: var(--lw-type-body-small-line-height);
  font-weight: var(--lw-type-body-small-weight);
  letter-spacing: var(--lw-type-body-small-tracking);
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
  font-size: var(--lw-type-title-small-size);
  line-height: var(--lw-type-title-small-line-height);
  font-weight: var(--lw-type-title-small-weight);
  letter-spacing: var(--lw-type-title-small-tracking);
  color: var(--lw-text-main);
}

.lw-discord-rail__empty span {
  font-size: var(--lw-type-body-small-size);
  line-height: var(--lw-type-body-small-line-height);
  font-weight: var(--lw-type-body-small-weight);
  letter-spacing: var(--lw-type-body-small-tracking);
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
  font-size: var(--lw-type-title-medium-size);
  line-height: var(--lw-type-title-medium-line-height);
  font-weight: var(--lw-type-title-medium-weight);
  letter-spacing: var(--lw-type-title-medium-tracking);
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
  font-size: var(--lw-type-title-small-size);
  line-height: var(--lw-type-title-small-line-height);
  font-weight: var(--lw-type-title-small-weight);
  letter-spacing: var(--lw-type-title-small-tracking);
  color: var(--lw-text-main);
}

.lw-discord-card__title-row span {
  flex-shrink: 0;
  font-size: var(--lw-type-label-small-size);
  line-height: var(--lw-type-label-small-line-height);
  font-weight: var(--lw-type-label-small-weight);
  letter-spacing: var(--lw-type-label-small-tracking);
  color: var(--lw-text-muted);
}

.lw-discord-card__preview {
  margin: 0;
  font-size: var(--lw-type-body-small-size);
  line-height: var(--lw-type-body-small-line-height);
  font-weight: var(--lw-type-body-small-weight);
  letter-spacing: var(--lw-type-body-small-tracking);
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
  font-size: var(--lw-type-label-medium-size);
  line-height: var(--lw-type-label-medium-line-height);
  font-weight: var(--lw-type-label-medium-weight);
  letter-spacing: var(--lw-type-label-medium-tracking);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.lw-discord-card__session-meta {
  flex-shrink: 0;
  font-size: var(--lw-type-label-small-size);
  line-height: var(--lw-type-label-small-line-height);
  font-weight: var(--lw-type-label-small-weight);
  letter-spacing: var(--lw-type-label-small-tracking);
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
  font-size: var(--lw-type-label-small-size);
  line-height: var(--lw-type-label-small-line-height);
  font-weight: var(--lw-type-label-small-weight);
  letter-spacing: var(--lw-type-label-small-tracking);
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
  font-size: var(--lw-type-body-small-size);
  line-height: var(--lw-type-body-small-line-height);
  font-weight: var(--lw-type-body-small-weight);
  letter-spacing: var(--lw-type-body-small-tracking);
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
  font-size: var(--lw-type-body-small-size);
  line-height: var(--lw-type-body-small-line-height);
  font-weight: var(--lw-type-body-small-weight);
  letter-spacing: var(--lw-type-body-small-tracking);
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

.lw-discord-rail[data-skin-variant='telegram'] {
  gap: 12px;
  padding: 22px 14px 14px;
  border-right-color: var(--lw-character-rail-border, var(--lw-border-subtle));
  background: var(--lw-telegram-chat-list-bg, var(--lw-character-rail-bg));
  backdrop-filter: var(--lw-telegram-glass-blur, blur(20px));
  -webkit-backdrop-filter: var(--lw-telegram-glass-blur, blur(20px));
}

.lw-telegram-rail__toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  min-height: 52px;
  padding: 0 10px;
}

.lw-telegram-rail__create {
  position: relative;
  flex-shrink: 0;
}

.lw-telegram-rail__brand {
  min-width: 0;
  display: inline-flex;
  align-items: center;
  gap: 8px;
}

.lw-telegram-rail__brand strong {
  font-size: var(--lw-type-headline-small-size);
  line-height: var(--lw-type-headline-small-line-height);
  font-weight: 700;
  letter-spacing: var(--lw-type-headline-small-tracking);
  color: var(--lw-text-main);
}

.lw-telegram-rail__toolbar button {
  width: 44px;
  height: 44px;
  border: none;
  border-radius: 999px;
  background: var(--lw-telegram-glass-bg, color-mix(in srgb, var(--lw-surface-container-highest) 62%, transparent));
  color: var(--lw-text-secondary);
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

.lw-telegram-create-menu {
  position: absolute;
  top: calc(100% + 8px);
  right: 0;
  z-index: 12;
  width: 224px;
  padding: 6px;
  border: 0;
  border-radius: 22px;
  background: var(--lw-telegram-glass-bg-strong, color-mix(in srgb, var(--lw-surface-container-highest) 94%, transparent));
  box-shadow:
    var(--lw-character-card-menu-shadow, 0 18px 34px rgba(44, 92, 130, 0.16));
  backdrop-filter: var(--lw-telegram-glass-blur, blur(18px));
  -webkit-backdrop-filter: var(--lw-telegram-glass-blur, blur(18px));
}

.lw-telegram-create-menu button {
  width: 100%;
  height: auto;
  min-height: 44px;
  justify-content: flex-start;
  align-items: flex-start;
  flex-direction: column;
  gap: 2px;
  padding: 8px 10px;
  border-radius: 10px;
  text-align: left;
  background: transparent;
}

.lw-telegram-create-menu button:hover:not(:disabled) {
  background: color-mix(in srgb, var(--lw-primary) 10%, transparent);
}

.lw-telegram-create-menu button:disabled {
  opacity: 0.52;
  cursor: default;
}

.lw-telegram-create-menu strong {
  font-size: var(--lw-type-label-medium-size);
  line-height: var(--lw-type-label-medium-line-height);
  font-weight: var(--lw-type-label-medium-weight);
  letter-spacing: var(--lw-type-label-medium-tracking);
  color: var(--lw-text-main);
}

.lw-telegram-create-menu span {
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: var(--lw-type-body-small-size);
  line-height: var(--lw-type-body-small-line-height);
  font-weight: var(--lw-type-body-small-weight);
  letter-spacing: var(--lw-type-body-small-tracking);
  color: var(--lw-text-muted);
}

.lw-telegram-search {
  min-height: 54px;
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 0;
  padding: 0 20px;
  border-radius: 999px;
  background: var(--lw-telegram-glass-bg, color-mix(in srgb, var(--lw-surface-container-highest) 58%, transparent));
  border: 0;
  box-shadow: none;
  backdrop-filter: var(--lw-telegram-glass-blur, blur(18px));
  -webkit-backdrop-filter: var(--lw-telegram-glass-blur, blur(18px));
  color: var(--lw-text-muted);
  font-size: var(--lw-type-body-small-size);
  line-height: var(--lw-type-body-small-line-height);
  font-weight: var(--lw-type-body-small-weight);
  letter-spacing: var(--lw-type-body-small-tracking);
}

.lw-telegram-search input {
  min-width: 0;
  width: 100%;
  border: none;
  outline: none;
  background: transparent;
  color: var(--lw-text-main);
  font: inherit;
}

.lw-telegram-search input::placeholder {
  color: var(--lw-text-muted);
}

.lw-telegram-tabs {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 0;
  padding: 5px;
  border: 0.5px solid var(--lw-telegram-tab-rim, color-mix(in srgb, var(--lw-border-base) 42%, transparent));
  border-radius: 999px;
  background: var(--lw-telegram-tab-bg, color-mix(in srgb, var(--lw-surface-container-highest) 48%, transparent));
  box-shadow: none;
  overflow-x: auto;
  scrollbar-width: none;
}

.lw-telegram-tab-wrap {
  position: relative;
  min-width: max-content;
}

.lw-telegram-tabs button {
  width: 100%;
  height: 38px;
  min-width: 0;
  border: none;
  border-radius: 999px;
  background: transparent;
  color: var(--lw-text-secondary);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
  padding: 6px 14px;
  font-size: 14px;
  line-height: 19px;
  font-weight: 650;
  letter-spacing: 0;
  position: relative;
}

.lw-telegram-tab-wrap > button.active {
  color: var(--lw-primary);
  background: var(--lw-telegram-active-pill, color-mix(in srgb, var(--lw-primary) 16%, transparent));
  box-shadow: none;
}

.lw-telegram-tabs span {
  min-width: 15px;
  min-height: 15px;
  border-radius: 999px;
  background: color-mix(in srgb, var(--lw-primary) 18%, transparent);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: var(--lw-type-label-small-size);
  line-height: var(--lw-type-label-small-line-height);
  font-weight: var(--lw-type-label-small-weight);
  letter-spacing: var(--lw-type-label-small-tracking);
}

.lw-telegram-list-mode {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 6px;
  margin: 0;
  padding: 4px;
  border: 0.5px solid var(--lw-telegram-tab-rim, color-mix(in srgb, var(--lw-border-base) 42%, transparent));
  border-radius: 999px;
  background: var(--lw-telegram-tab-bg, color-mix(in srgb, var(--lw-surface-container-highest) 52%, transparent));
  box-shadow: none;
}

.lw-telegram-list-mode button {
  min-width: 0;
  min-height: 30px;
  border: none;
  border-radius: 999px;
  background: transparent;
  color: var(--lw-text-secondary);
  font-size: var(--lw-type-label-medium-size);
  line-height: var(--lw-type-label-medium-line-height);
  font-weight: var(--lw-type-label-medium-weight);
  letter-spacing: var(--lw-type-label-medium-tracking);
}

.lw-telegram-list-mode button.active,
.lw-telegram-list-mode button:hover {
  background: var(--lw-telegram-active-pill, color-mix(in srgb, var(--lw-primary) 14%, transparent));
  color: var(--lw-primary);
}

.lw-telegram-filter-menu {
  position: absolute;
  top: calc(100% + 8px);
  right: 0;
  z-index: 14;
  width: 160px;
  padding: 10px 0;
  border: 0;
  border-radius: 22px;
  background: var(--lw-telegram-glass-bg-strong, color-mix(in srgb, var(--lw-surface-container-highest) 96%, transparent));
  box-shadow:
    var(--lw-character-card-menu-shadow, 0 20px 42px rgba(44, 92, 130, 0.16));
  backdrop-filter: var(--lw-telegram-glass-blur, blur(18px));
  -webkit-backdrop-filter: var(--lw-telegram-glass-blur, blur(18px));
}

.lw-telegram-filter-menu button {
  height: 42px;
  justify-content: flex-start;
  padding: 0 18px;
  border-radius: 0;
  box-shadow: none;
  color: var(--lw-text-secondary);
  font-size: var(--lw-type-label-medium-size);
  line-height: var(--lw-type-label-medium-line-height);
  font-weight: var(--lw-type-label-medium-weight);
  letter-spacing: var(--lw-type-label-medium-tracking);
}

.lw-telegram-filter-menu button:hover,
.lw-telegram-filter-menu button.active {
  background: color-mix(in srgb, var(--lw-primary) 9%, transparent);
  color: var(--lw-text-main);
}

.lw-telegram-saved {
  width: 100%;
  min-height: 52px;
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  align-items: center;
  gap: 10px;
  padding: 6px 8px;
  border: none;
  border-radius: 14px;
  background: transparent;
  color: var(--lw-text-main);
  text-align: left;
  cursor: pointer;
}

.lw-telegram-saved:hover {
  background: color-mix(in srgb, var(--lw-primary) 8%, transparent);
}

.saved-icon {
  width: 38px;
  height: 38px;
  border-radius: 999px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  color: white;
  background: linear-gradient(135deg, #69c9ff, #2e9fe8);
}

.saved-copy {
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 3px;
}

.saved-copy strong {
  font-size: var(--lw-type-label-medium-size);
  line-height: var(--lw-type-label-medium-line-height);
  font-weight: var(--lw-type-label-medium-weight);
  letter-spacing: var(--lw-type-label-medium-tracking);
}

.saved-copy small,
.saved-meta {
  color: var(--lw-text-muted);
  font-size: var(--lw-type-body-small-size);
  line-height: var(--lw-type-body-small-line-height);
  font-weight: var(--lw-type-body-small-weight);
  letter-spacing: var(--lw-type-body-small-tracking);
}

.lw-discord-rail[data-skin-variant='telegram'] .lw-discord-card {
  border-radius: 18px;
  border-color: transparent;
  background: transparent;
  box-shadow: none;
}

.lw-discord-rail[data-skin-variant='telegram'] .lw-discord-card__main:hover,
.lw-discord-rail[data-skin-variant='telegram'] .lw-discord-card.is-active .lw-discord-card__main {
  background: color-mix(in srgb, var(--lw-primary) 13%, transparent);
}

.lw-discord-rail[data-skin-variant='telegram'] .lw-discord-card.is-active {
  border-color: color-mix(in srgb, var(--lw-primary) 20%, var(--lw-border-subtle));
}

.lw-discord-rail[data-skin-variant='telegram'] .lw-discord-card.is-active .lw-discord-card__main {
  border-radius: 18px;
}

.lw-discord-rail[data-skin-variant='telegram'] .lw-discord-card__main {
  min-height: 58px;
  padding: 8px 10px;
  border-radius: 18px;
}

.lw-discord-rail[data-skin-variant='telegram'] button.lw-discord-card__main {
  width: 100%;
  border: none;
  background: transparent;
  color: inherit;
  text-align: left;
  cursor: pointer;
}

.lw-discord-rail[data-skin-variant='telegram'] .lw-telegram-tool-card__icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  color: var(--lw-primary);
  font-size: var(--lw-type-title-medium-size);
  line-height: var(--lw-type-title-medium-line-height);
  font-weight: var(--lw-type-title-medium-weight);
  letter-spacing: var(--lw-type-title-medium-tracking);
  overflow: hidden;
}

.lw-discord-rail[data-skin-variant='telegram'] .lw-telegram-tool-card__icon :deep(svg) {
  width: 22px;
  height: 22px;
  display: block;
}

.lw-discord-rail[data-skin-variant='telegram'] .lw-telegram-tool-card .lw-discord-card__body,
.lw-discord-rail[data-skin-variant='telegram'] .lw-telegram-tool-card .lw-discord-card__title-row {
  display: flex;
}

.lw-discord-rail[data-skin-variant='telegram'] .lw-telegram-tool-card .lw-discord-card__body {
  flex-direction: column;
  min-width: 0;
  gap: 4px;
}

.lw-discord-rail[data-skin-variant='telegram'] .lw-telegram-tool-card .lw-discord-card__title-row {
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.lw-discord-rail[data-skin-variant='telegram'] .lw-telegram-tool-card .lw-discord-card__preview {
  display: -webkit-box;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.lw-discord-rail[data-skin-variant='telegram'] .lw-telegram-session-file-card .lw-discord-card__main {
  min-height: 64px;
}

.lw-discord-rail[data-skin-variant='telegram'] .lw-discord-card__avatar {
  width: 42px;
  height: 42px;
  border-radius: var(--lw-character-card-avatar-radius, 999px);
  background: var(--lw-telegram-avatar-bg, color-mix(in srgb, var(--lw-primary) 18%, var(--lw-surface-container-high)));
  border: 2px solid color-mix(in srgb, var(--lw-surface-container-highest) 92%, transparent);
  box-shadow: var(--lw-character-card-avatar-shadow, 0 8px 18px rgba(44, 92, 130, 0.10));
}

.lw-discord-rail[data-skin-variant='telegram'] .lw-discord-card__title-row strong {
  font-size: var(--lw-type-label-medium-size);
  line-height: var(--lw-type-label-medium-line-height);
}

.lw-discord-rail[data-skin-variant='telegram'] .lw-discord-card__title-row span {
  font-size: var(--lw-type-label-small-size);
  line-height: var(--lw-type-label-small-line-height);
}

.lw-discord-rail[data-skin-variant='telegram'] .lw-discord-card__preview {
  font-size: var(--lw-type-body-small-size);
  line-height: var(--lw-type-body-small-line-height);
}

.lw-discord-rail[data-skin-variant='telegram'] .lw-discord-card__chevron {
  pointer-events: auto;
  border-radius: 999px;
  cursor: pointer;
}

.lw-discord-rail[data-skin-variant='telegram'] .lw-discord-card__chevron:disabled {
  opacity: 0;
  pointer-events: none;
}

.lw-discord-rail[data-skin-variant='telegram'] .lw-discord-card__sessions {
  padding: 2px 8px 8px 60px;
  gap: 5px;
}

.lw-discord-rail[data-skin-variant='telegram'] .lw-discord-card__session,
.lw-discord-rail[data-skin-variant='telegram'] .lw-discord-card__session-menu-trigger,
.lw-discord-rail[data-skin-variant='telegram'] .lw-discord-card__session-menu-item,
.lw-discord-rail[data-skin-variant='telegram'] .lw-discord-card__session-editor-button,
.lw-discord-rail[data-skin-variant='telegram'] .lw-discord-card__more {
  background: color-mix(in srgb, var(--lw-character-session-bg, var(--lw-surface-container-high)) 78%, transparent);
}

.lw-discord-rail[data-skin-variant='telegram'] .lw-discord-card__session:hover,
.lw-discord-rail[data-skin-variant='telegram'] .lw-discord-card__session-main.is-active {
  background: color-mix(in srgb, var(--lw-primary) 12%, var(--lw-character-session-bg, var(--lw-surface-container-high)));
}

.lw-discord-rail[data-skin-variant='telegram'] .lw-discord-card__session-create {
  border-style: solid;
  border-color: color-mix(in srgb, var(--lw-primary) 24%, var(--lw-border-subtle));
  background: color-mix(in srgb, var(--lw-primary) 10%, transparent);
}

.lw-discord-rail[data-skin-variant='telegram'] .lw-discord-card__session-editor,
.lw-discord-rail[data-skin-variant='telegram'] .lw-discord-card__session-delete-confirm,
.lw-discord-rail[data-skin-variant='telegram'] .lw-discord-card__session-input {
  background: color-mix(in srgb, var(--lw-surface-container-high) 82%, transparent);
  border-color: var(--lw-border-subtle);
}

.lw-discord-rail.is-mobile[data-skin-variant='telegram'] {
  flex: 1 1 auto;
  height: 100%;
  max-height: none;
  padding: calc(14px + var(--lw-content-safe-top, var(--lw-safe-top, 0px))) 14px 18px;
  border-radius: 0;
  border-right: none;
  box-shadow: none;
}

.lw-discord-rail.is-mobile[data-skin-variant='telegram'] .lw-discord-rail__list {
  gap: 6px;
  padding-right: 0;
}

.lw-discord-rail.is-mobile[data-skin-variant='telegram'] .lw-discord-card {
  border-radius: 16px;
  overflow: visible;
}

.lw-discord-rail.is-mobile[data-skin-variant='telegram'] .lw-discord-card__main {
  min-height: 62px;
  padding: 8px 10px;
  grid-template-columns: 56px minmax(0, 1fr) 32px;
  gap: 10px;
}

.lw-discord-rail.is-mobile[data-skin-variant='telegram'] .lw-discord-card__avatar {
  width: 48px;
  height: 48px;
  justify-self: center;
}

.lw-discord-rail.is-mobile[data-skin-variant='telegram'] .lw-discord-card__title-row strong {
  font-size: var(--lw-type-title-small-size);
  line-height: var(--lw-type-title-small-line-height);
}

.lw-discord-rail.is-mobile[data-skin-variant='telegram'] .lw-discord-card__title-row span {
  font-size: var(--lw-type-body-small-size);
  line-height: var(--lw-type-body-small-line-height);
}

.lw-discord-rail.is-mobile[data-skin-variant='telegram'] .lw-discord-card__preview {
  font-size: var(--lw-type-body-medium-size);
  line-height: var(--lw-type-body-medium-line-height);
}

.lw-discord-rail.is-mobile[data-skin-variant='telegram'] .lw-discord-card__sessions {
  margin: 2px 8px 8px 74px;
  padding: 0;
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
  box-shadow: var(--lw-character-rail-mobile-shadow, 0 -22px 40px rgba(0, 0, 0, 0.28));
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
