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

    <!-- 手机端：点头像展开为通栏封面（原版资料页的封面形态），再点收起 -->
    <button
      v-if="isCoverExpanded"
      type="button"
      class="lw-telegram-profile__cover"
      aria-label="收起头像"
      @click="isCoverExpanded = false"
    >
      <img :src="profile.avatarUrl" :alt="profile.name" @error="isCoverExpanded = false">
      <span class="lw-telegram-profile__cover-copy">
        <strong>{{ profile.name }}</strong>
        <small>{{ statusText }}</small>
      </span>
    </button>
    <section v-else class="lw-telegram-profile__hero">
      <component
        :is="canExpandCover ? 'button' : 'div'"
        :type="canExpandCover ? 'button' : undefined"
        class="lw-telegram-profile__avatar"
        :class="{ 'is-expandable': canExpandCover, 'is-placeholder': !hasProfile }"
        :style="hasProfile ? getTelegramAvatarStyle(profile.name) : undefined"
        :aria-label="canExpandCover ? '展开头像' : undefined"
        @click="canExpandCover && (isCoverExpanded = true)"
      >
        <img v-if="profile.avatarUrl" :src="profile.avatarUrl" :alt="profile.name" @error="hideBrokenTelegramAvatar">
        <LuminaAvatarPlaceholder v-else-if="!hasProfile" class="lw-telegram-profile__avatar-placeholder" />
        <span v-else>{{ getTelegramInitial(profile.name) }}</span>
      </component>
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

    <p v-if="!activeGroup" class="lw-telegram-profile__hint">从左侧选择一个聊天，这里会显示对应角色的资料与会话。</p>

    <section v-if="activeGroup" class="lw-telegram-profile__card">
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

    <h3 v-if="activeGroup" class="lw-telegram-profile__section-title">会话 · {{ allSessions.length }}</h3>
    <section v-if="activeGroup" class="lw-telegram-profile__card is-list" aria-label="会话">
      <div v-for="session in allSessions" :key="session.id" class="lw-telegram-profile__session-row">
        <form
          v-if="renamingSessionId === session.id"
          class="lw-telegram-profile__rename"
          @submit.prevent="saveRename(session.id)"
        >
          <input
            ref="renameInput"
            v-model="renameTitle"
            :aria-label="`重命名 ${session.title}`"
            @keydown.esc="cancelRename"
          >
          <button type="submit" class="lw-telegram-profile__icon" title="保存名称" aria-label="保存名称">
            <Check :size="20" />
          </button>
          <button type="button" class="lw-telegram-profile__icon" title="取消重命名" aria-label="取消重命名" @click="cancelRename">
            <X :size="20" />
          </button>
        </form>
        <template v-else>
          <button
            type="button"
            class="lw-telegram-profile__session"
            :class="{ 'is-current': session.id === currentSession?.id }"
            @click="handleSessionClick(session.id)"
            @contextmenu.prevent="openSessionMenu(session.id, $event)"
            @pointerdown="onSessionPointerdown(session.id, $event)"
            @pointermove="longPress.handlePointermove"
            @pointerup="longPress.handlePointerup"
            @pointercancel="longPress.handlePointercancel"
          >
            <span class="lw-telegram-profile__session-copy">
              <strong>{{ session.title }}</strong>
              <small>{{ session.recentHistoryPreview || session.previewMessage || session.summary || '暂无消息' }}</small>
            </span>
            <time>{{ formatSessionTime(session.updatedAt) }}</time>
          </button>
          <button
            type="button"
            class="lw-telegram-profile__session-more"
            :title="`管理 ${session.title}`"
            :aria-label="`管理 ${session.title}`"
            @click.stop="openSessionMenu(session.id, $event)"
          >
            <MoreHorizontal :size="18" aria-hidden="true" />
          </button>
          <ChatPopoverMenu
            v-if="menuSessionId === session.id"
            :items="sessionMenu"
            label="会话操作"
            :placement="menuPlacement"
            align="end"
            @select="handleSessionMenu(session, $event)"
            @close="menuSessionId = null"
          />
        </template>
      </div>
      <button type="button" class="lw-telegram-profile__session is-new" @click="createSession">
        <MessageCirclePlus :size="20" :stroke-width="2.2" aria-hidden="true" />
        <strong>新建会话</strong>
      </button>
    </section>
  </aside>
</template>

<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue';
import { padNumber as pad } from '../../../../api/utils/dateFormat.js';
import type { Component, CSSProperties } from 'vue';
import {
  Activity,
  ArrowLeft,
  BookOpen,
  Check,
  ChevronRight,
  Clapperboard,
  MessageCircle,
  MessageCirclePlus,
  MoreHorizontal,
  Waypoints,
  X
} from 'lucide-vue-next';
import { useSurfaceSkin } from '../../../core/useSurfaceSkin.js';
import LuminaAvatarPlaceholder from '../../../../ui/primitives/LuminaAvatarPlaceholder.vue';
import { luminaWeaveApi } from '@/api';
import { isPlaceholderTelegramAvatar } from '../../../../plugins/chat/presentation/telegramChatList.js';
import { buildConversationSessionMenu, resolveSessionMenuPlacement, type ChatMenuPlacement } from '../../../../plugins/chat/presentation/chatMenus.js';
import ChatPopoverMenu from '../../../../plugins/chat/components/ChatPopoverMenu.vue';
import { useLongPressMenu } from '../../../../composables/useLongPressMenu.js';
import type {
  CharacterChannelGroup,
  CharacterChannelSessionItem
} from '../../../../types/ConversationContextTypes.js';
import { useSurfaceInput } from '../../../../platform/surface/useSurfaceRuntimeContext.js';
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

const menuSessionId = ref<string | null>(null);
const menuPlacement = ref<ChatMenuPlacement>('below');
const renamingSessionId = ref<string | null>(null);
const renameTitle = ref('');
const renameInput = ref<HTMLInputElement[] | null>(null);
const sessionMenu = buildConversationSessionMenu();
const longPress = useLongPressMenu<string>({
  onTrigger: (sessionId) => openSessionMenu(sessionId)
});
let menuSourceElement: HTMLElement | null = null;

const openSessionMenu = (sessionId: string, event?: Event): void => {
  if (event?.currentTarget instanceof HTMLElement) {
    menuSourceElement = event.currentTarget;
  }
  const rowRect = menuSourceElement?.getBoundingClientRect();
  const panelRect = menuSourceElement?.closest('.lw-telegram-profile')?.getBoundingClientRect();
  if (rowRect && panelRect) {
    menuPlacement.value = resolveSessionMenuPlacement(rowRect, panelRect);
  }
  menuSessionId.value = sessionId;
};

const onSessionPointerdown = (sessionId: string, event: PointerEvent): void => {
  menuSourceElement = event.currentTarget instanceof HTMLElement ? event.currentTarget : null;
  longPress.handlePointerdown(sessionId, event);
};

const handleSessionClick = (sessionId: string): void => {
  if (longPress.consumeClick()) return;
  props.onOpenSession(sessionId);
};

const handleSessionMenu = (session: CharacterChannelSessionItem, action: string): void => {
  menuSessionId.value = null;
  if (action === 'rename') {
    renamingSessionId.value = session.id;
    renameTitle.value = session.title;
    void nextTick(() => renameInput.value?.[0]?.select());
    return;
  }
  if (action === 'duplicate') {
    props.onDuplicateSession(session.id, session.title);
    return;
  }
  if (action === 'delete') {
    props.onDeleteSession(session.id);
  }
};

const saveRename = (sessionId: string): void => {
  const nextTitle = renameTitle.value.trim();
  if (!nextTitle) return;
  props.onRenameSession(sessionId, nextTitle);
  cancelRename();
};

const cancelRename = (): void => {
  renamingSessionId.value = null;
  renameTitle.value = '';
};

// 切换角色后清掉上一角色的菜单 / 重命名状态
watch(() => activeGroup.value?.key, () => {
  menuSessionId.value = null;
  cancelRename();
});

const hasProfile = computed(() => Boolean(activeGroup.value));

const profile = computed(() => {
  const group = activeGroup.value;
  const avatarUrl = group?.characterAvatarUrl || '';
  return {
    name: group?.characterName?.trim() || '未选择角色',
    avatarUrl: isPlaceholderTelegramAvatar(avatarUrl, luminaWeaveApi.DEFAULT_AVATAR) ? '' : avatarUrl
  };
});

const isCoverExpanded = ref(false);
const canExpandCover = computed(() => props.isMobile && Boolean(profile.value.avatarUrl));
// 切换角色后回到默认的圆形头像，避免封面停留在上一个角色
watch(() => profile.value.avatarUrl, () => { isCoverExpanded.value = false; });

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
  /* 面板底由外层通透玻璃提供（桌面右栏容器 / 移动端 stack），卡片略透出背景 */
  --lw-telegram-profile-card-bg: color-mix(in srgb, var(--lw-telegram-info-card-bg, var(--lw-bg-surface)) 74%, transparent);
  /* 桌面右栏较窄，整体排版比手机整页收一档；.is-mobile 恢复为大号 */
  --lw-telegram-profile-avatar-size: 84px;
  --lw-telegram-profile-name-size: var(--lw-type-title-medium-size);
  --lw-telegram-profile-name-line-height: var(--lw-type-title-medium-line-height);
  --lw-telegram-profile-body-size: var(--lw-type-body-medium-size);
  --lw-telegram-profile-secondary-size: var(--lw-type-body-small-size);
  --lw-telegram-profile-secondary-line-height: var(--lw-type-body-small-line-height);
  background: transparent;
  color: var(--lw-text-main);
  overflow: auto;
}

.lw-telegram-profile.is-mobile {
  --lw-telegram-profile-avatar-size: 108px;
  --lw-telegram-profile-name-size: var(--lw-type-headline-small-size);
  --lw-telegram-profile-name-line-height: var(--lw-type-headline-small-line-height);
  --lw-telegram-profile-body-size: var(--lw-type-body-large-size);
  --lw-telegram-profile-secondary-size: var(--lw-type-body-medium-size);
  --lw-telegram-profile-secondary-line-height: var(--lw-type-body-medium-line-height);
  /* 移动端一级页是纯色底：资料页自铺 layer-base，卡片实底，避免白卡白底丢失层级 */
  --lw-telegram-profile-card-bg: var(--lw-telegram-info-card-bg, var(--lw-bg-surface));
  background: var(--lw-telegram-info-panel-bg, var(--lw-telegram-layer-base));
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
  background: color-mix(in srgb, var(--lw-telegram-info-card-bg, var(--lw-bg-surface)) 46%, transparent);
  backdrop-filter: blur(14px);
  -webkit-backdrop-filter: blur(14px);
}

.lw-telegram-profile__topbar strong {
  padding-left: 10px;
  font-size: var(--lw-type-title-medium-size);
  line-height: var(--lw-type-title-medium-line-height);
  font-weight: var(--lw-type-title-medium-weight);
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
  width: var(--lw-telegram-profile-avatar-size);
  height: var(--lw-telegram-profile-avatar-size);
  margin-bottom: 12px;
  place-items: center;
  overflow: hidden;
  border-radius: 999px;
  background: var(--lw-telegram-avatar-bg);
  color: var(--lw-text-inverse);
  font-size: calc(var(--lw-telegram-profile-avatar-size) * 0.4);
  font-weight: 600;
}

.lw-telegram-profile__avatar.is-placeholder {
  background: color-mix(in srgb, var(--lw-text-muted) 18%, transparent);
  color: var(--lw-text-muted);
}

.lw-telegram-profile__avatar-placeholder {
  width: 56%;
  height: 56%;
}

.lw-telegram-profile__avatar.is-expandable {
  padding: 0;
  border: 0;
  cursor: pointer;
}

/* 通栏封面：抵消面板左右 12px 内边距，名称与状态压在底部渐隐遮罩上 */
.lw-telegram-profile__cover {
  position: relative;
  display: block;
  width: calc(100% + 24px);
  margin: 0 -12px;
  padding: 0;
  overflow: hidden;
  border: 0;
  aspect-ratio: 1;
  background: var(--lw-telegram-avatar-bg);
  color: var(--lw-telegram-cover-text, var(--lw-text-inverse));
  text-align: left;
  cursor: pointer;
}

.lw-telegram-profile__cover img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.lw-telegram-profile__cover-copy {
  position: absolute;
  right: 0;
  bottom: 0;
  left: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: 48px 16px 14px;
  background: linear-gradient(180deg, transparent, var(--lw-telegram-cover-scrim));
}

.lw-telegram-profile__cover-copy strong {
  font-size: var(--lw-type-headline-small-size);
  line-height: var(--lw-type-headline-small-line-height);
  font-weight: 650;
}

.lw-telegram-profile__cover-copy small {
  font-size: var(--lw-type-body-medium-size);
  opacity: 0.85;
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
  font-size: var(--lw-telegram-profile-name-size);
  font-weight: 650;
  line-height: var(--lw-telegram-profile-name-line-height);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.lw-telegram-profile__hero p {
  margin: 0;
  color: var(--lw-text-muted);
  font-size: var(--lw-telegram-profile-secondary-size);
  line-height: var(--lw-telegram-profile-secondary-line-height);
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
  background: var(--lw-telegram-profile-card-bg);
  color: var(--lw-text-main);
  font: inherit;
  font-size: var(--lw-type-label-medium-size);
  line-height: var(--lw-type-label-medium-line-height);
  font-weight: 600;
  cursor: pointer;
  transition: background-color var(--lw-transition);
}

.lw-telegram-profile__actions button:hover:not(:disabled) {
  background: color-mix(in srgb, var(--lw-text-main) 6%, var(--lw-telegram-profile-card-bg));
}

.lw-telegram-profile__hint {
  margin: 0;
  padding: 4px 20px 8px;
  color: var(--lw-text-muted);
  font-size: var(--lw-type-body-small-size);
  line-height: 1.5;
  text-align: center;
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
  background: var(--lw-telegram-profile-card-bg);
}

.lw-telegram-profile__field {
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: 12px 18px;
}

.lw-telegram-profile__field p {
  margin: 0;
  font-size: var(--lw-telegram-profile-body-size);
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
  font-size: var(--lw-telegram-profile-secondary-size);
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
  font-size: var(--lw-telegram-profile-body-size);
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
  font-size: var(--lw-type-label-large-size);
  line-height: var(--lw-type-label-large-line-height);
  font-weight: var(--lw-type-label-large-weight);
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
  font-size: var(--lw-telegram-profile-secondary-size);
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

/* 列表卡不裁剪：会话管理菜单需要弹出卡片；首末行自行圆角避免悬停底色出框 */
.lw-telegram-profile__card.is-list {
  overflow: visible;
}

.lw-telegram-profile__card.is-list > :first-child {
  border-top-left-radius: 16px;
  border-top-right-radius: 16px;
}

.lw-telegram-profile__card.is-list > :last-child {
  border-bottom-left-radius: 16px;
  border-bottom-right-radius: 16px;
}

.lw-telegram-profile__session-row:first-child .lw-telegram-profile__session {
  border-top-left-radius: 16px;
  border-top-right-radius: 16px;
}

.lw-telegram-profile__session-row {
  position: relative;
}

.lw-telegram-profile__session-row .lw-telegram-profile__session {
  width: 100%;
}

/* 会话管理：「…」悬停出现（触屏走长按，鼠标走右键） */
.lw-telegram-profile__session-more {
  position: absolute;
  top: 50%;
  right: 8px;
  display: grid;
  width: 36px;
  height: 36px;
  place-items: center;
  border: 0;
  border-radius: 999px;
  background: transparent;
  color: var(--lw-text-muted);
  transform: translateY(-50%);
  opacity: 0;
  pointer-events: none;
  cursor: pointer;
  transition: opacity var(--lw-transition), background-color var(--lw-transition), color var(--lw-transition);
}

@media (hover: hover) {
  .lw-telegram-profile__session-row:hover .lw-telegram-profile__session-more,
  .lw-telegram-profile__session-more:focus-visible {
    opacity: 1;
    pointer-events: auto;
  }

  .lw-telegram-profile__session-row:hover .lw-telegram-profile__session time {
    visibility: hidden;
  }
}

.lw-telegram-profile__session-more:hover {
  background: var(--lw-bg-hover);
  color: var(--lw-text-main);
}

.lw-telegram-profile__rename {
  display: flex;
  min-height: 56px;
  align-items: center;
  gap: 6px;
  padding: 8px 10px 8px 16px;
}

.lw-telegram-profile__rename input {
  min-width: 0;
  flex: 1;
  height: 40px;
  border: 1px solid var(--lw-border-active, var(--lw-primary));
  border-radius: 10px;
  outline: 0;
  background: var(--lw-bg-subtle);
  color: var(--lw-text-main);
  padding: 0 12px;
  font: inherit;
}

.lw-telegram-profile__icon {
  display: grid;
  width: 40px;
  height: 40px;
  flex: 0 0 auto;
  place-items: center;
  border: 0;
  border-radius: 999px;
  background: transparent;
  color: var(--lw-text-main);
  cursor: pointer;
}

.lw-telegram-profile__icon:hover {
  background: var(--lw-bg-hover);
}
</style>
