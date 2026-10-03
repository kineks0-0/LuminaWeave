<template>
  <TelegramContactList
    v-if="context.theme.variant === 'telegram'"
    :groups="channel.characterGroups"
    :page="Boolean(input.compact)"
    @open="openSession"
    @create="createFromGroup"
  />
  <section v-else class="character-roster-surface" :class="{ 'is-compact': input.compact }">
    <header>
      <strong>角色</strong>
      <button type="button" title="刷新角色" aria-label="刷新角色" @click="refresh">
        <RefreshCw :size="16" />
      </button>
    </header>

    <div class="character-roster-surface__list">
      <article v-for="group in channel.characterGroups" :key="group.key">
        <button type="button" class="character-roster-surface__character" @click="surface.intents.toggleGroup(group.key)">
          <img v-if="group.characterAvatarUrl" :src="group.characterAvatarUrl" :alt="group.characterName">
          <span v-else class="character-roster-surface__initial">{{ group.characterInitial }}</span>
          <span>
            <strong>{{ group.characterName }}</strong>
            <small>{{ group.recentPreview }}</small>
          </span>
          <ChevronDown v-if="channel.expandedCharacterKey === group.key" :size="16" />
          <ChevronRight v-else :size="16" />
        </button>

        <div v-if="channel.expandedCharacterKey === group.key" class="character-roster-surface__actions">
          <button
            type="button"
            title="新建会话"
            @click="createSession(group.characterId, group.characterName, group.characterAvatarUrl)"
          >
            <Plus :size="15" />
            <span>新建会话</span>
          </button>
          <button
            v-if="group.recentSession"
            type="button"
            title="打开最近会话"
            @click="openSession(group.recentSession.id)"
          >
            <MessageSquareText :size="15" />
            <span>最近会话</span>
          </button>
        </div>
      </article>

      <div v-if="channel.characterGroups.length === 0" class="character-roster-surface__empty">
        暂无角色
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import type { CharacterChannelGroup } from '../../../types/ConversationContextTypes.js';
import { ChevronDown, ChevronRight, MessageSquareText, Plus, RefreshCw } from 'lucide-vue-next';
import {
  useSurfaceInput,
  useSurfaceRuntimeContext
} from '../../../platform/surface/useSurfaceRuntimeContext.js';
import TelegramContactList from '../components/telegram/TelegramContactList.vue';

const input = useSurfaceInput('character.roster');
const context = useSurfaceRuntimeContext('character.roster');
const surface = computed(() => context.value);
const channel = computed(() => context.value.state.channel.value);

const refresh = (): void => {
  void context.value.intents.refresh();
};
const openSession = (sessionId: string): void => {
  if (input.onOpenSession) {
    input.onOpenSession(sessionId);
    return;
  }
  void context.value.intents.openSession(sessionId);
};
const createSession = (
  characterId: string | number | null,
  characterName: string,
  characterAvatarUrl: string | null
): void => {
  const target = { characterId, characterName, characterAvatarUrl };
  if (input.onCreateSession) {
    input.onCreateSession(target);
    return;
  }
  void context.value.intents.createSession(target);
};
const createFromGroup = (group: CharacterChannelGroup): void => {
  createSession(group.characterId, group.characterName, group.characterAvatarUrl);
};
</script>

<style scoped>
.character-roster-surface {
  display: flex;
  width: 100%;
  height: 100%;
  min-height: 0;
  flex-direction: column;
  background: var(--lw-bg-app);
}

.character-roster-surface.is-compact {
  width: var(--lw-character-rail-width, 292px);
  min-width: min(var(--lw-character-rail-width, 292px), 100%);
  max-width: min(var(--lw-character-rail-width, 292px), 100%);
  flex: 0 0 var(--lw-character-rail-width, 292px);
}

.character-roster-surface > header {
  display: flex;
  height: 42px;
  flex-shrink: 0;
  align-items: center;
  justify-content: space-between;
  border-bottom: 1px solid var(--lw-border-base);
  padding: 0 10px 0 12px;
}

.character-roster-surface button {
  color: inherit;
  font: inherit;
}

.character-roster-surface > header button {
  display: grid;
  width: 30px;
  height: 30px;
  place-items: center;
  border: 0;
  border-radius: 5px;
  background: transparent;
  color: var(--lw-text-muted);
  cursor: pointer;
}

.character-roster-surface__list {
  min-height: 0;
  overflow: auto;
  padding: 6px;
}

.character-roster-surface__character {
  display: grid;
  width: 100%;
  grid-template-columns: 36px minmax(0, 1fr) 18px;
  gap: 9px;
  align-items: center;
  border: 0;
  border-radius: 6px;
  background: transparent;
  padding: 8px;
  text-align: left;
  cursor: pointer;
}

.character-roster-surface__character:hover {
  background: var(--lw-bg-hover);
}

.character-roster-surface__character img,
.character-roster-surface__initial {
  display: grid;
  width: 36px;
  height: 36px;
  place-items: center;
  border-radius: 6px;
  object-fit: cover;
  background: var(--lw-bg-subtle);
}

.character-roster-surface__character > span:nth-child(2) {
  display: flex;
  min-width: 0;
  flex-direction: column;
}

.character-roster-surface__character small {
  overflow: hidden;
  color: var(--lw-text-muted);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.character-roster-surface__actions {
  display: flex;
  gap: 5px;
  padding: 0 8px 8px 53px;
}

.character-roster-surface__actions button {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  border: 1px solid var(--lw-border-base);
  border-radius: 5px;
  background: var(--lw-bg-surface);
  color: var(--lw-text-secondary);
  padding: 5px 7px;
  cursor: pointer;
  font-size: var(--lw-type-label-small-size);
}

.character-roster-surface__empty {
  display: grid;
  min-height: 120px;
  place-items: center;
  color: var(--lw-text-muted);
}
</style>
