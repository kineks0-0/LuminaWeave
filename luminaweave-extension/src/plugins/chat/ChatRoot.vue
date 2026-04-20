<template>
  <div class="chat-root-container">
    <ChatStream :messages="messages" :isMobile="isMobile" :workspaceCompact="workspaceCompact" />
  </div>
</template>

<script setup lang="ts">
import { storeToRefs } from 'pinia';
import ChatStream from './ChatStream.vue';
import { useConversationContextStore } from '../../stores/useConversationContextStore';

withDefaults(defineProps<{
  isMobile?: boolean;
  workspaceCompact?: boolean;
}>(), {
  isMobile: false,
  workspaceCompact: false
});

const contextStore = useConversationContextStore();
const { activeMessages: messages } = storeToRefs(contextStore);

import { watch } from 'vue';
watch(messages, (newList) => {
    console.log('[ChatRoot] messages 发生变化，新长度:', newList.length);
}, { immediate: true });
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
