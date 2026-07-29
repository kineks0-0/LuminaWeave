<template>
  <div class="chat-root-container">
    <ChatStream
      :messages="messages"
      :context="snapshot.context"
      :generation="snapshot.generation"
      :promptInspectorVisible="snapshot.promptInspectorVisible"
      :sessionSwitchState="sessionSwitchState"
      :chatSessions="chatSessions"
      :intents="controller.intents"
      :onSelectViewSession="contextStore.selectViewSession"
      :isMobile="props.isMobile"
      :workspaceCompact="props.workspaceCompact"
      :onTelegramBack="props.onTelegramBack"
      :onTelegramOpenRoleProfile="props.onTelegramOpenRoleProfile"
    />
  </div>
</template>

<script setup lang="ts">
import { storeToRefs } from 'pinia';
import { computed, onScopeDispose, shallowRef } from 'vue';
import ChatStream from './ChatStream.vue';
import { luminaWeaveApi } from '../../api/index.js';
import { useConversationContextStore } from '../../stores/useConversationContextStore.js';
import {
  useSurfaceInput,
  useSurfaceRuntimeContext
} from '../../platform/surface/useSurfaceRuntimeContext.js';
import {
  ChatApplicationController,
  type ChatApplicationSnapshot
} from './application/ChatApplicationController.js';

const props = useSurfaceInput('chat.main');
const surfaceContext = useSurfaceRuntimeContext('chat.main');

const contextStore = useConversationContextStore();
const { chatSessions, sessionSwitchState } = storeToRefs(contextStore);
const runtime = surfaceContext.value.runtime;
const controller = new ChatApplicationController({
  conversation: runtime.conversation,
  generation: runtime.generation,
  feedback: luminaWeaveApi.services.host
});
const snapshot = shallowRef<ChatApplicationSnapshot>(controller.getSnapshot());
const messages = computed(() => snapshot.value.messages);
const unsubscribe = controller.subscribe((nextSnapshot) => {
  snapshot.value = nextSnapshot;
});

void controller.start().catch((error: unknown) => {
  console.error('[ChatApplicationController] Start failed', { error });
});

onScopeDispose(() => {
  unsubscribe();
  controller.dispose();
});
</script>

<style scoped>
.chat-root-container {
  position: relative;
  width: 100%;
  height: 100%;
  min-height: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}
</style>
