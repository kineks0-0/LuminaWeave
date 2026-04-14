<template>
  <div class="forge-form-card">
    <div class="forge-form-meta">
      <span class="forge-form-layer">{{ layer || 'forge' }}</span>
      <span class="forge-form-id">{{ formId }}</span>
    </div>
    <div class="forge-form-title">{{ title }}</div>
    <div v-if="description" class="forge-form-description">{{ description }}</div>
    <div class="forge-form-actions">
      <div class="forge-form-hint">
        <template v-if="isSubmitted">这部分内容已提交给 Forge。</template>
        <template v-else>填写完成后，点击继续把当前表单结果提交给 Forge。</template>
      </div>
      <button class="forge-form-submit" :disabled="isProcessing || isSubmitted" @click="submitForm">
        <template v-if="isSubmitted">已提交</template>
        <template v-else>保存当前层并继续</template>
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useCardMakerStore } from '../CardMakerStore';
import { useForgeStore } from '../../../stores/useForgeStore';

const props = defineProps<{
    formId: string;
    title: string;
    description?: string;
    layer?: string;
}>();

const store = useCardMakerStore();
const forgeStore = useForgeStore();

const isSubmitted = computed(() => {
    return Boolean(store.structuredState.forms[props.formId]?.lastSubmittedAt);
});

const isProcessing = computed(() => store.isBusy);

const submitForm = () => {
    if (isSubmitted.value || isProcessing.value) return;
    void store.submitStructuredForm(props.formId);
};
</script>

<style scoped>
.forge-form-card {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 14px;
  border-radius: 18px;
  border: 1px solid rgba(var(--lw-primary-rgb), 0.16);
  background: linear-gradient(180deg, rgba(var(--lw-primary-rgb), 0.08), rgba(var(--lw-primary-rgb), 0.03));
}

.forge-form-meta {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  font-size: 10px;
  text-transform: uppercase;
  letter-spacing: 0.08em;
}

.forge-form-layer,
.forge-form-id {
  padding: 4px 8px;
  border-radius: 999px;
  background: rgba(var(--lw-primary-rgb), 0.1);
  color: var(--lw-primary);
}

.forge-form-title {
  font-size: 14px;
  font-weight: 800;
  color: var(--lw-text-main);
}

.forge-form-description {
  font-size: 12px;
  line-height: 1.6;
  color: var(--lw-text-secondary);
}

.forge-form-actions {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  flex-wrap: wrap;
  padding-top: 4px;
}

.forge-form-hint {
  font-size: 11px;
  line-height: 1.6;
  color: var(--lw-text-muted);
}

.forge-form-submit {
  border-radius: 12px;
  border: 1px solid #111111;
  background: #111111;
  color: var(--lw-text-inverse);
  padding: 9px 12px;
  font-size: 12px;
  font-weight: 700;
  cursor: pointer;
}

.forge-form-submit:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}
</style>
