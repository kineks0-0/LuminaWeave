<template>
  <div class="chat-root-container">
    <ChatStream :messages="messages" :isMobile="isMobile" :workspaceCompact="workspaceCompact" />
  </div>
</template>

<script setup lang="ts">
import { storeToRefs } from 'pinia';
import ChatStream from './ChatStream.vue';
import { useChatStore } from '../../stores/useChatStore';

withDefaults(defineProps<{
  isMobile?: boolean;
  workspaceCompact?: boolean;
}>(), {
  isMobile: false,
  workspaceCompact: false
});

const chatStore = useChatStore();
const { messages } = storeToRefs(chatStore);

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
  display: flex;
  flex-direction: column;
  overflow: hidden;
}
</style>
