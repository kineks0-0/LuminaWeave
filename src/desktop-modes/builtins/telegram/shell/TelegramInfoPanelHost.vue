<template>
  <div
    class="lw-widget-container lw-telegram-info-host"
    :data-surface-variant="surfaceVariant"
    :style="{ ...widgetStyle, width: `${widgetWidth}px`, minWidth: `${widgetWidth}px` }"
  >
    <div
      class="lw-widget-resizer"
      :class="{ 'is-resizing': isResizing }"
      @mousedown.stop.prevent="onResizeStart($event)"
    ></div>
    <SurfaceOutlet
      contract-id="telegram.infoPanel"
      :input="panelInput"
      :desktop-mode-id="desktopModeId"
    />
  </div>
</template>

<script setup lang="ts">
import { computed, type CSSProperties } from 'vue';
import SurfaceOutlet from '../../../../platform/surface/SurfaceOutlet.vue';
import type { CharacterChannelState, CreateChatConversationInput } from '../../../../types/ConversationContextTypes.js';

const props = defineProps<{
  desktopModeId: string;
  isMobile: boolean;
  surfaceVariant: string;
  widgetStyle: CSSProperties;
  widgetWidth: number;
  isResizing: boolean;
  state: CharacterChannelState;
  onResizeStart: (event?: MouseEvent) => void;
  onOpenTool: (panelId: string) => void;
  onCreateSession: (payload: CreateChatConversationInput) => void;
  onOpenSession: (sessionId: string) => void;
  onRenameSession: (sessionId: string, nextTitle: string) => void;
  onDuplicateSession: (sessionId: string, title?: string) => void;
  onDeleteSession: (sessionId: string) => void;
}>();

const panelInput = computed(() => ({
  state: props.state,
  isMobile: props.isMobile,
  onOpenTool: props.onOpenTool,
  onCreateSession: props.onCreateSession,
  onOpenSession: props.onOpenSession,
  onRenameSession: props.onRenameSession,
  onDuplicateSession: props.onDuplicateSession,
  onDeleteSession: props.onDeleteSession
}));
</script>
