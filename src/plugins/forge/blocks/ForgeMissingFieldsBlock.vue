<template>
  <div class="forge-missing-card">
    <div class="forge-missing-title">{{ title }}</div>
    <div v-if="parsedFields.length > 0" class="forge-missing-list">
      <span v-for="field in parsedFields" :key="field" class="forge-missing-chip">{{ field }}</span>
    </div>
    <div v-else class="forge-missing-empty">当前层没有待补字段，后续也可以随时回来修改。</div>
    <button class="forge-submit-btn" @click="submitCurrentForm">保存当前层并继续</button>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { luminaWeaveApi } from '../../../api';

const props = defineProps<{
    formId: string;
    fields: string;
}>();

const parsedFields = computed(() => props.fields.split(',').map(item => item.trim()).filter(Boolean));
const title = computed(() => parsedFields.value.length > 0 ? '可继续补充这些字段' : '当前层可直接继续推进');
const submitCurrentForm = () => {
    luminaWeaveApi.forgeAgent.submitFormResult(props.formId, parsedFields.value.join('、'));
};
</script>

<style scoped>
.forge-missing-card {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 14px;
  border-radius: 18px;
  border: 1px dashed rgba(var(--lw-primary-rgb), 0.26);
  background: rgba(var(--lw-primary-rgb), 0.06);
}

.forge-missing-title {
  font-size: 12px;
  font-weight: 800;
  color: var(--lw-text-main);
}

.forge-missing-list {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.forge-missing-empty {
  font-size: 12px;
  line-height: 1.6;
  color: var(--lw-text-secondary);
}

.forge-missing-chip {
  padding: 6px 10px;
  border-radius: 999px;
  background: rgba(var(--lw-primary-rgb), 0.12);
  color: var(--lw-primary);
  font-size: 11px;
  font-weight: 700;
}

.forge-submit-btn {
  align-self: flex-start;
  border-radius: 12px;
  border: 1px solid #111111;
  background: #111111;
  color: var(--lw-text-inverse);
  padding: 9px 12px;
  font-size: 12px;
  font-weight: 700;
  cursor: pointer;
}
</style>
