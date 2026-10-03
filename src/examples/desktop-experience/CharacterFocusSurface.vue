<template>
  <section class="character-focus" :aria-label="context.input.title">
    <header class="character-focus__header">
      <div>
        <p class="character-focus__title">{{ context.input.title }}</p>
        <h2>{{ snapshot.characterName || context.input.title }}</h2>
      </div>
      <button
        class="character-focus__icon-button"
        type="button"
        :aria-label="copy.refresh"
        :title="copy.refresh"
        @click="context.intents.refresh"
      >
        <RefreshCw :size="16" aria-hidden="true" />
      </button>
    </header>

    <p v-if="snapshot.sessionId" class="character-focus__session">
      {{ copy.session }}: {{ snapshot.sessionId }}
    </p>

    <nav v-if="snapshot.availableSessions.length" class="character-focus__sessions">
      <button
        v-for="session in snapshot.availableSessions"
        :key="session.id"
        type="button"
        :aria-current="session.id === snapshot.sessionId ? 'page' : undefined"
        @click="context.intents.openSession(session.id)"
      >
        <MessageSquareText :size="15" aria-hidden="true" />
        <span>{{ session.title }}</span>
      </button>
    </nav>

    <div class="character-focus__messages" aria-live="polite">
      <p v-if="snapshot.loading" class="character-focus__muted">{{ copy.loading }}</p>
      <p v-else-if="snapshot.error" role="alert">{{ snapshot.error }}</p>
      <p v-else-if="!snapshot.messages.length" class="character-focus__muted">
        {{ copy.emptyMessages }}
      </p>
      <ol v-else>
        <li v-for="message in snapshot.messages" :key="message.id">
          <strong>{{ message.name }}</strong>
          <span>{{ message.mes }}</span>
        </li>
      </ol>
    </div>

    <p v-if="context.input.showTimeline" class="character-focus__timeline">
      {{ copy.timeline }}: {{ Object.keys(snapshot.timeline).length }}
    </p>

    <form class="character-focus__composer" @submit.prevent="sendDraft">
      <input v-model="draft" :aria-label="copy.send" />
      <button
        class="character-focus__icon-button"
        type="submit"
        :aria-label="copy.send"
        :title="copy.send"
      >
        <Send :size="16" aria-hidden="true" />
      </button>
      <button
        class="character-focus__icon-button"
        type="button"
        :aria-label="copy.stop"
        :title="copy.stop"
        @click="context.intents.stopGeneration"
      >
        <Square :size="15" aria-hidden="true" />
      </button>
    </form>
  </section>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import { MessageSquareText, RefreshCw, Send, Square } from 'lucide-vue-next';
import { useSurfaceRuntimeContext } from '../../sdk/index.js';
import {
  CHARACTER_FOCUS_CONTRACT_ID,
  CHARACTER_FOCUS_EXAMPLE_COPY
} from './characterFocusContract.js';

const contextRef = useSurfaceRuntimeContext(CHARACTER_FOCUS_CONTRACT_ID);
const context = computed(() => contextRef.value);
const snapshot = computed(() => context.value.state.snapshot.value);
const copy = CHARACTER_FOCUS_EXAMPLE_COPY;
const draft = ref('');

const sendDraft = async (): Promise<void> => {
  const text = draft.value.trim();
  if (!text) return;
  const sent = await context.value.intents.sendMessage(text);
  if (sent) draft.value = '';
};
</script>

<style scoped>
.character-focus {
  display: grid;
  grid-template-rows: auto auto auto minmax(8rem, 1fr) auto auto;
  gap: 0.75rem;
  min-width: min(20rem, 100%);
  height: 100%;
  padding: 1rem;
  color: var(--lw-text-primary, #1f2933);
  background: var(--lw-surface-primary, #f8fafc);
  border-inline-end: 1px solid var(--lw-border-subtle, #d7dde5);
}

.character-focus__header,
.character-focus__composer {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.character-focus__header {
  justify-content: space-between;
}

.character-focus__header h2,
.character-focus__title,
.character-focus__session,
.character-focus__timeline,
.character-focus__messages p {
  margin: 0;
}

.character-focus__header h2 {
  font-size: 1rem;
  line-height: 1.35;
}

.character-focus__title,
.character-focus__session,
.character-focus__timeline,
.character-focus__muted {
  color: var(--lw-text-secondary, #5b6470);
  font-size: 0.75rem;
}

.character-focus__sessions {
  display: grid;
  gap: 0.25rem;
}

.character-focus__sessions button {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  min-width: 0;
  padding: 0.5rem;
  color: inherit;
  background: transparent;
  border: 0;
  border-radius: 0.25rem;
  text-align: start;
}

.character-focus__sessions button[aria-current='page'] {
  color: var(--lw-accent-strong, #0f766e);
  background: var(--lw-surface-selected, #e6fffb);
}

.character-focus__sessions span {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.character-focus__messages {
  min-height: 0;
  overflow: auto;
}

.character-focus__messages ol {
  display: grid;
  gap: 0.75rem;
  margin: 0;
  padding: 0;
  list-style: none;
}

.character-focus__messages li {
  display: grid;
  gap: 0.2rem;
  padding-block-end: 0.75rem;
  border-block-end: 1px solid var(--lw-border-subtle, #d7dde5);
}

.character-focus__messages strong {
  font-size: 0.75rem;
}

.character-focus__messages span {
  overflow-wrap: anywhere;
  font-size: 0.875rem;
  line-height: 1.5;
}

.character-focus__composer input {
  min-width: 0;
  flex: 1;
  height: 2.25rem;
  padding: 0 0.625rem;
  color: inherit;
  background: var(--lw-surface-elevated, #ffffff);
  border: 1px solid var(--lw-border-strong, #aeb7c2);
  border-radius: 0.25rem;
}

.character-focus__icon-button {
  display: inline-grid;
  flex: 0 0 2.25rem;
  width: 2.25rem;
  height: 2.25rem;
  place-items: center;
  color: inherit;
  background: var(--lw-surface-elevated, #ffffff);
  border: 1px solid var(--lw-border-strong, #aeb7c2);
  border-radius: 0.25rem;
}

.character-focus button:focus-visible,
.character-focus input:focus-visible {
  outline: 2px solid var(--lw-focus-ring, #0f766e);
  outline-offset: 2px;
}
</style>
