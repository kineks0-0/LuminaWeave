<template>
  <div class="chat-root-container">
    <ChatStream :messages="messages" />
  </div>
</template>

<script setup lang="ts">
import { storeToRefs } from 'pinia';
import ChatStream from './ChatStream.vue';
import { useChatStore } from '../../stores/useChatStore';

const chatStore = useChatStore();
const { messages } = storeToRefs(chatStore);
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
