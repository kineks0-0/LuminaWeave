<template>
  <div class="forge-preset-summary">
    <div class="summary-header">
      <div>
        <div class="summary-title">Agent 预设绑定</div>
        <div class="summary-subtitle">Agent 预设绑定主模型与执行模型提示词；测试聊天保留独立预设。</div>
      </div>
      <button class="summary-open-btn" type="button" @click="openDetail">
        打开完整工作台
      </button>
    </div>

    <div class="summary-grid">
      <div v-for="row in rows" :key="row.profileId" class="summary-card">
        <div class="summary-card-head">
          <span class="summary-card-title">{{ row.label }}</span>
          <span class="summary-badge" :class="{ builtIn: row.preset?.builtIn }">
            {{ row.preset?.builtIn ? '内置' : '自定义' }}
          </span>
        </div>
        <div class="summary-card-name">{{ row.preset?.name || '未绑定' }}</div>
        <div class="summary-card-meta">
          <span>{{ row.summary.primary }}</span>
          <span v-for="detail in row.summary.details" :key="detail">{{ detail }}</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue';
import { promptPresetRegistry } from '../../api/core/hal/prompt/PromptPresetRegistry.js';
import { lwStorage } from '../../api/storage.js';
import { currentDetailedView } from '../settings/useSettings.js';
import { summarizeForgePromptPreset } from './store/forgePromptPresetPresentation.js';
import type { PromptPresetDefinition, PromptPresetProfileId } from '../../types/PromptPresetTypes.js';

const version = ref(0);
const STORAGE_KEY_BUILTIN_OVERRIDES = 'lumina-prompt-presets.builtin-overrides';

const refresh = () => {
    promptPresetRegistry.reload();
    version.value += 1;
};

const handleStorageChange = (data: { key?: string } | null) => {
    const key = data?.key;
    if (!key || key === 'lumina-prompt-presets.registry' || key === 'lumina-prompt-presets.bindings' || key === STORAGE_KEY_BUILTIN_OVERRIDES) {
        refresh();
    }
};

const rows = computed(() => {
    version.value;
    return ([
        ['forge-agent', 'Agent'],
        ['forge-test-chat', '测试聊天']
    ] as Array<[PromptPresetProfileId, string]>).map(([profileId, label]) => ({
        profileId,
        label,
        preset: promptPresetRegistry.getActivePreset(profileId) as PromptPresetDefinition | null
    })).map(row => ({
        ...row,
        summary: summarizeForgePromptPreset(row.preset)
    }));
});

const openDetail = () => {
    currentDetailedView.value = 'lumina-forge';
};

onMounted(() => {
    refresh();
    lwStorage.on('*', handleStorageChange);
});

onUnmounted(() => {
    lwStorage.off('*', handleStorageChange);
});
</script>

<style scoped>
.forge-preset-summary {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.summary-header {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  align-items: flex-start;
}

.summary-title {
  font-size: var(--lw-type-title-small-size);
  font-weight: var(--lw-type-title-small-weight);
  color: var(--lw-text-main);
}

.summary-subtitle {
  margin-top: 4px;
  font-size: var(--lw-type-body-small-size);
  line-height: 1.55;
  color: var(--lw-text-muted);
}

.summary-open-btn {
  border: 1px solid var(--lw-border-base);
  background: var(--lw-bg-elevated);
  color: var(--lw-text-main);
  border-radius: 999px;
  padding: 8px 12px;
  font-size: var(--lw-type-body-small-size);
  font-weight: var(--lw-type-title-small-weight);
  cursor: pointer;
  white-space: nowrap;
}

.summary-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
}

.summary-card {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 14px;
  border-radius: 16px;
  border: 1px solid var(--lw-border-base);
  background: color-mix(in srgb, var(--lw-bg-elevated) 84%, transparent);
}

.summary-card-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.summary-card-title {
  font-size: var(--lw-type-body-small-size);
  font-weight: var(--lw-type-title-small-weight);
  color: var(--lw-text-secondary);
}

.summary-badge {
  border-radius: 999px;
  padding: 3px 8px;
  font-size: var(--lw-type-label-small-size);
  font-weight: var(--lw-type-title-small-weight);
  color: var(--lw-primary);
  background: rgba(var(--lw-primary-rgb), 0.1);
}

.summary-badge.builtIn {
  color: var(--lw-text-muted);
  background: color-mix(in srgb, var(--lw-bg-subtle) 88%, transparent);
}

.summary-card-name {
  font-size: var(--lw-type-title-small-size);
  font-weight: var(--lw-type-title-small-weight);
  color: var(--lw-text-main);
}

.summary-card-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  font-size: var(--lw-type-label-small-size);
  color: var(--lw-text-muted);
}

@media (max-width: 900px) {
  .summary-grid {
    grid-template-columns: 1fr;
  }

  .summary-header {
    flex-direction: column;
  }
}
</style>
