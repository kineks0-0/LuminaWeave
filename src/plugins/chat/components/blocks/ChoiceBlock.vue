<template>
  <div class="lv-choice-block">
    <div class="choice-header">
      <svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" stroke-width="2" fill="none">
        <polyline points="9 11 12 14 22 4"></polyline>
        <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"></path>
      </svg>
      <span>抉择与分支</span>
    </div>
    <div class="choice-list">
      <button 
        v-for="(opt, idx) in normalizedOptions" 
        :key="idx" 
        class="choice-item"
        @click="handleChoice(opt)"
      >
        <span class="choice-index">{{ idx + 1 }}</span>
        <span class="choice-label">{{ opt.label }}</span>
        <div class="choice-arrow">
          <svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" stroke-width="2.5" fill="none">
            <polyline points="9 18 15 12 9 6"></polyline>
          </svg>
        </div>
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, inject } from 'vue';
import { LuminaWeaveAPI } from '../../../../api/index';
import { useSettings } from '../../../settings/useSettings';

interface ChoiceOption {
  label: string;
  cmd?: string;
}

const props = defineProps<{
  options: (string | ChoiceOption)[];
}>();

const lwApi = inject<LuminaWeaveAPI>('lwApi');

const normalizedOptions = computed(() => {
  return props.options.map(opt => {
    if (typeof opt === 'string') {
      return { label: opt };
    }
    return opt;
  });
});

const { activeSettings } = useSettings();

const handleChoice = (opt: ChoiceOption) => {
  if (!lwApi) return;
  
  const interactionMode = activeSettings['lumina-chat.dialogueUIInteraction'] || 'generate';
  const text = opt.cmd || opt.label;

  if (interactionMode === 'fill') {
    // 填充模式：仅将内容填入输入框，不自动发送
    lwApi.emit('FOCUS_MAIN_INPUT', { text });
  } else {
    // 默认/生成模式：直接发送并触发生成
    lwApi.sendMessage(text);
  }
};
</script>

<style scoped>
.lv-choice-block {
  background: rgba(255, 255, 255, 0.7);
  backdrop-filter: blur(8px);
  border: 1px solid var(--lw-border);
  border-radius: 12px;
  overflow: hidden;
  margin: 10px 0;
  box-shadow: 0 4px 15px rgba(0, 0, 0, 0.04);
}

.choice-header {
  padding: 8px 14px;
  background: rgba(139, 92, 246, 0.05);
  border-bottom: 1px solid var(--lw-border);
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 11px;
  font-weight: 600;
  color: #8b5cf6;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.choice-list {
  display: flex;
  flex-direction: column;
}

.choice-item {
  width: 100%;
  padding: 12px 16px;
  display: flex;
  align-items: center;
  gap: 12px;
  background: transparent;
  border: none;
  border-bottom: 1px solid rgba(0, 0, 0, 0.03);
  text-align: left;
  cursor: pointer;
  transition: background 0.2s, transform 0.1s;
  color: var(--lw-color);
  font-family: inherit;
}

.choice-item:last-child {
  border-bottom: none;
}

.choice-item:hover {
  background: rgba(139, 92, 246, 0.03);
}

.choice-item:active {
  transform: scale(0.995);
  background: rgba(139, 92, 246, 0.06);
}

.choice-index {
  width: 22px;
  height: 22px;
  flex-shrink: 0;
  border-radius: 6px;
  background: #f1f5f9;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 11px;
  font-weight: 700;
  color: #64748b;
}

.choice-label {
  flex: 1;
  font-size: 14px;
  line-height: 1.5;
  font-weight: 500;
}

.choice-arrow {
  opacity: 0.3;
  transition: opacity 0.2s, transform 0.2s;
}

.choice-item:hover .choice-arrow {
  opacity: 1;
  transform: translateX(2px);
  color: #8b5cf6;
}
</style>
