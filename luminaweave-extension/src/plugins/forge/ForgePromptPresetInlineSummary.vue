<template>
  <div class="forge-preset-summary">
    <div class="summary-header">
      <div>
        <div class="summary-title">预设提示词绑定</div>
        <div class="summary-subtitle">主模型、执行模型、测试聊天各自绑定独立预设，底层共用统一合成 API。</div>
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
          <span>{{ row.preset?.engine === 'st_preset' ? 'ST 预设直通' : '组合预设' }}</span>
          <span v-if="row.preset?.entries?.length">{{ row.preset.entries.filter(entry => entry.enabled).length }} 项</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue';
import { promptPresetRegistry } from '../../api/core/PromptPresetRegistry.js';
import { lwStorage } from '../../api/storage.js';
import { currentDetailedView } from '../settings/useSettings.js';
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
        ['forge-main', '主模型'],
        ['forge-executor', '执行模型'],
        ['forge-test-chat', '测试聊天']
    ] as Array<[PromptPresetProfileId, string]>).map(([profileId, label]) => ({
        profileId,
        label,
        preset: promptPresetRegistry.getActivePreset(profileId) as PromptPresetDefinition | null
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
  font-size: 14px;
  font-weight: 700;
  color: var(--lw-text-main);
}

.summary-subtitle {
  margin-top: 4px;
  font-size: 12px;
  line-height: 1.55;
  color: var(--lw-text-muted);
}

.summary-open-btn {
  border: 1px solid var(--lw-border-base);
  background: var(--lw-bg-elevated);
  color: var(--lw-text-main);
  border-radius: 999px;
  padding: 8px 12px;
  font-size: 12px;
  font-weight: 700;
  cursor: pointer;
  white-space: nowrap;
}

.summary-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
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
  font-size: 12px;
  font-weight: 700;
  color: var(--lw-text-secondary);
}

.summary-badge {
  border-radius: 999px;
  padding: 3px 8px;
  font-size: 10px;
  font-weight: 700;
  color: var(--lw-primary);
  background: rgba(var(--lw-primary-rgb), 0.1);
}

.summary-badge.builtIn {
  color: var(--lw-text-muted);
  background: color-mix(in srgb, var(--lw-bg-subtle) 88%, transparent);
}

.summary-card-name {
  font-size: 14px;
  font-weight: 700;
  color: var(--lw-text-main);
}

.summary-card-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  font-size: 11px;
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
