<template>
  <div class="forge-message-submit" :class="{ 'is-submitted': isSubmitted }">
    <div class="forge-message-submit-hint">
        <template v-if="isSubmitted">这部分内容已提交给 Forge 分析。如需修改请发新消息补充。</template>
        <template v-else>这条消息里的待填内容会一起提交给 Forge。</template>
    </div>
    <button class="forge-message-submit-btn" :disabled="isProcessing || isSubmitted" @click="submitForm">
      <template v-if="isSubmitted">已提交</template>
      <template v-else>{{ buttonLabel }}</template>
    </button>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useCardMakerStore } from '../CardMakerStore';
import { useForgeStore } from '../../../stores/useForgeStore';

const props = defineProps<{
    formId: string;
    label?: string;
}>();

const store = useCardMakerStore();
const forgeStore = useForgeStore();
const buttonLabel = computed(() => props.label || '提交并继续');

const isSubmitted = computed(() => {
    return Boolean(store.structuredState.forms[props.formId]?.lastSubmittedAt);
});

const isProcessing = computed(() => store.isGenerating || forgeStore.isProcessing);

const submitForm = () => {
    console.log(`[Forge-Submit] 触发消息提交按钮点击 (formId: "${props.formId}")。`, {
        isSubmitted: isSubmitted.value,
        isProcessing: isProcessing.value
    });
    if (isSubmitted.value || isProcessing.value) {
        console.warn('[Forge-Submit] 点击被拦截：已提交或正在处理中。');
        return;
    }
    void store.submitStructuredForm(props.formId);
};
</script>

<style scoped>
.forge-message-submit {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  flex-wrap: wrap;
  padding: 12px 14px;
  border-radius: 16px;
  border: 1px dashed rgba(var(--lw-primary-rgb), 0.2);
  background: rgba(var(--lw-primary-rgb), 0.04);
}

.forge-message-submit-hint {
  font-size: 11px;
  line-height: 1.6;
  color: var(--lw-text-muted);
}

.forge-message-submit-btn {
  border-radius: 12px;
  border: 1px solid #111111;
  background: #111111;
  color: var(--lw-text-inverse);
  padding: 9px 12px;
  font-size: 12px;
  font-weight: 700;
  cursor: pointer;
}

.forge-message-submit-btn:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}
</style>
