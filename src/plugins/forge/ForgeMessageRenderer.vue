<template>
  <MessageRenderer
    :mes="mes"
    :mes-raw="mesRaw"
    :plugin-raw="pluginRaw"
    :thinking-text="thinkingText"
    :render-markdown="renderMarkdown"
    :is-streaming="isStreaming"
    render-context="forge"
    thinking-variant="codex"
  />
</template>

<script setup lang="ts">
import MessageRenderer from '../chat/components/MessageRenderer.vue';

defineProps<{
    mes?: string;
    mesRaw: string;
    pluginRaw?: string | null;
    thinkingText?: string | null;
    renderMarkdown: (text: string) => string;
    isStreaming?: boolean;
}>();
</script>
