<template>
  <ForgeMessageSubmitBlock
    v-if="autoSubmitTarget"
    :form-id="autoSubmitTarget.kind === 'form' ? autoSubmitTarget.id : undefined"
    :message-id="autoSubmitTarget.kind === 'message' ? autoSubmitTarget.id : undefined"
    :label="autoSubmitLabel"
    auto-generated
  />
</template>

<script setup lang="ts">
import { computed, watchEffect } from 'vue';
import type { MessageSegment } from '../../../api/core/xml-view/LVParser.js';
import { resolveForgeAutoSubmitTarget } from '../../../api/core/forge/forms/ForgeAutoSubmitTarget.js';
import { useCardMakerStore } from '../CardMakerStore.js';
import ForgeMessageSubmitBlock from './ForgeMessageSubmitBlock.vue';

const props = defineProps<{
  messageId: string;
  segments: MessageSegment[];
}>();

const forgeStore = useCardMakerStore();

const explicitSubmitLabel = computed<string | null>(() => {
  for (const segment of props.segments) {
    if (segment.type !== 'view' || !segment.components?.length) {
      continue;
    }

    const submitComponent = segment.components.find((component) => component.component === 'ForgeMessageSubmit');
    if (submitComponent) {
      return String(submitComponent.props.label || '').trim() || null;
    }
  }

  return null;
});

watchEffect(() => {
  if (!explicitSubmitLabel.value) {
    return;
  }

  forgeStore.rememberSubmitConfig(props.messageId, explicitSubmitLabel.value);
});

const autoSubmitTarget = computed(() => resolveForgeAutoSubmitTarget(
  props.segments,
  props.messageId,
  {
    hasStructuredFieldBinding: (formId, fieldKey) => forgeStore.hasStructuredFieldBinding(formId, fieldKey)
  }
));

const autoSubmitLabel = computed(() => {
  if (!autoSubmitTarget.value) {
    return '提交并继续';
  }

  return forgeStore.resolveSubmitLabel(
    autoSubmitTarget.value.id,
    explicitSubmitLabel.value || '提交并继续'
  );
});
</script>
