<template>
  <!-- 渲染一行轻量提示，让操作留痕 -->
  <div v-if="injectedCount > 0" class="forge-assist-notice">
    <span class="forge-assist-icon">✨</span>
    <span class="forge-assist-text">助理已为 {{ injectedCount }} 个字段提供{{ modeLabel }}辅助</span>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted } from 'vue';
import { useCardMakerStore } from '../CardMakerStore';
import { parseFormAssistVararg, type FormAssistField, parseCompositePath } from '../../../api/core/utils/forgeDslUtils';

const props = defineProps<{
    /** 对应的消息 ID（临时表单必需，用于隔离选值） */
    messageId?: string;
    /** varargs 收集后的字段字符串列表。格式为 "路径/键|值1::说明1|值2" */
    fields: string | string[];
}>();

const store = useCardMakerStore();

/** 将 props.fields 规范化为字符串数组（兼容单值与 varargs 数组） */
const rawFieldArgs = computed<string[]>(() => {
    if (Array.isArray(props.fields)) {
        return props.fields.map(s => String(s).trim()).filter(Boolean);
    }
    const s = String(props.fields || '').trim();
    return s ? [s] : [];
});

/** 解析所有 vararg 字符串为 FormAssistField 列表 */
const parsedFields = computed<FormAssistField[]>(() =>
    rawFieldArgs.value
        .map(raw => parseFormAssistVararg(raw))
        .filter((f): f is FormAssistField => f !== null)
);

/** 实际注入的字段数量（用于提示文字） */
const injectedCount = computed(() => parsedFields.value.length);

/** 当前辅助模式的可读说明 */
const modeLabel = computed(() => {
    const mode = store.formAssistanceMode;
    if (mode === 'prefill') return '预填';
    if (mode === 'suggestion') return '建议';
    return '';
});

onMounted(() => {
    const mode = store.formAssistanceMode;
    // off 模式：完全忽略
    if (mode === 'off' || injectedCount.value === 0) return;

    const fields = parsedFields.value;

    // 1. 向 assistPool 注入候选值
    // 由于全量路径化，f.fieldKey 已经包含了可能的 formId 前缀
    const injectionData = fields.map(f => ({ 
        fieldKey: f.fieldKey, 
        candidates: f.candidates 
    }));
    store.injectAssistCandidates(injectionData, null);

    // 2. prefill 模式：执行具体的预填操作（分流：结构化 vs 瞬态）
    if (mode === 'prefill') {
        for (const f of fields) {
            // 解析真实的表单 ID 和字段键
            // 模式 A: "form/key" -> formId="form", fieldKey="key"
            // 模式 B: "key" -> formId=null, fieldKey="key"
            const [targetFormId, targetFieldKey] = parseCompositePath(f.fieldKey);

            const firstValue = f.candidates[0]?.value;
            if (!firstValue) continue;

            const isBoundField = targetFormId && store.hasStructuredFieldBinding(targetFormId, targetFieldKey);

            if (isBoundField) {
                // 蓝图绑定字段 → 结构化预填
                (store as any).prefillStructuredForm({
                    formId: targetFormId,
                    fields: [{ fieldKey: targetFieldKey, value: firstValue }],
                    overwrite: false,
                    source: 'system'
                });
            } else {
                // 未绑定字段或临时字段 → 瞬态存储
                store.upsertTransientSelection(f.fieldKey, firstValue, props.messageId);
            }
        }
    }
});
</script>

<style scoped>
.forge-assist-notice {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 12px;
  border-radius: 10px;
  background: rgba(var(--lw-primary-rgb), 0.06);
  border: 1px solid rgba(var(--lw-primary-rgb), 0.10);
  margin: 4px 0;
}

.forge-assist-icon {
  font-size: 12px;
  flex-shrink: 0;
}

.forge-assist-text {
  font-size: 11px;
  color: var(--lw-text-secondary);
  line-height: 1.4;
}
</style>
