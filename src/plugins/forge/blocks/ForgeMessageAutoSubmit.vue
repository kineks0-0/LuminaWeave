<template>
  <ForgeMessageSubmitBlock
    v-if="autoSubmitScopeId"
    :message-id="autoSubmitScopeId"
    :label="autoSubmitLabel"
    auto-generated
  />
</template>

<script setup lang="ts">
import { computed, watchEffect } from 'vue';
import type { MessageSegment } from '../../../api/core/LVParser';
import { useCardMakerStore } from '../CardMakerStore';
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

const hasPersistentForgeForm = computed(() => props.segments.some((segment) => (
  segment.type === 'view' && Boolean(segment.components?.some((component) => component.component === 'ForgeForm'))
)));

const hasTemporaryForgeCollection = computed(() => {
  const interactiveComponents = new Set([
    'ForgeInput',
    'ForgeTextarea',
    'ForgeSelect',
    'ForgeChecklist',
    'ForgeChoiceGroup',
    'ForgeFacetChecklist'
  ]);

  return props.segments.some((segment) => {
    if (segment.type !== 'view' || !segment.components?.length) {
      return false;
    }

    return segment.components.some((component) => {
      if (!interactiveComponents.has(component.component)) {
        return false;
      }

      const formId = String(component.props.formId || '').trim();
      const fieldKey = String(component.props.fieldKey || '').trim();
      if (!formId) {
        return true;
      }

      return !fieldKey || !forgeStore.hasStructuredFieldBinding(formId, fieldKey);
    });
  });
});

const autoSubmitScopeId = computed<string | null>(() => {
  if (hasPersistentForgeForm.value || !hasTemporaryForgeCollection.value) {
    return null;
  }

  return props.messageId;
});

const autoSubmitLabel = computed(() => {
  if (!autoSubmitScopeId.value) {
    return '提交并继续';
  }

  return forgeStore.resolveSubmitLabel(
    autoSubmitScopeId.value,
    explicitSubmitLabel.value || '提交并继续'
  );
});
</script>
