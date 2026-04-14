<template>
  <div class="lw-stage-strip" :class="{ 'is-mobile': isMobile }">
    <button class="stage-create" type="button" aria-label="新建舞台" title="新建舞台" @click="$emit('create')">
      <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="2" fill="none" aria-hidden="true">
        <line x1="12" y1="5" x2="12" y2="19"></line>
        <line x1="5" y1="12" x2="19" y2="12"></line>
      </svg>
    </button>

    <button
      v-for="stage in stages"
      :key="stage.id"
      class="stage-card"
      :class="{ 'is-active': stage.isActive, 'is-empty': stage.isEmpty }"
      :aria-label="`切换到 ${stage.label}${stage.isEmpty ? '（空舞台）' : ''}`"
      :aria-current="stage.isActive ? 'true' : 'false'"
      @click="$emit('activate', stage.id)"
    >
      <div class="stage-preview">
        <div
          v-for="(icon, index) in stage.appIcons.slice(0, 3)"
          :key="`${stage.id}-${index}`"
          class="preview-window"
          :style="{
            transform: `translate(${index * 8}px, ${index * 6}px) scale(${1 - index * 0.06})`
          }"
        >
          <span v-if="icon" v-html="icon"></span>
          <span v-else>{{ stage.previewTitles[index]?.slice(0, 1) || '·' }}</span>
        </div>
        <div v-if="stage.isEmpty" class="preview-empty">空</div>
      </div>

      <div class="stage-copy">
        <span class="stage-label">{{ stage.label }}</span>
        <span class="stage-meta">{{ stage.isEmpty ? '空舞台' : `${stage.windowCount} 个窗口` }}</span>
      </div>
    </button>
  </div>
</template>

<script setup lang="ts">
defineProps<{
  isMobile?: boolean;
  stages: Array<{
    id: string;
    label: string;
    isActive: boolean;
    isEmpty: boolean;
    windowCount: number;
    appIcons: string[];
    previewTitles: string[];
  }>;
}>();

defineEmits<{
  (e: 'activate', id: string): void;
  (e: 'create'): void;
}>();
</script>

<style scoped>
.lw-stage-strip {
  position: absolute;
  top: 20px;
  left: 16px;
  bottom: 102px;
  z-index: 11;
  width: 116px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.stage-create,
.stage-card {
  border: 1px solid var(--lw-glass-border);
  background: var(--lw-glass-bg);
  color: var(--lw-text-main);
  backdrop-filter: blur(22px) saturate(130%);
}

.stage-create {
  width: 52px;
  height: 52px;
  border-radius: 18px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: var(--lw-transition);
}

.stage-create:hover {
  background: color-mix(in srgb, var(--lw-primary) 10%, white);
  border-color: var(--lw-border-active);
}

.stage-card {
  width: 100%;
  padding: 12px;
  border-radius: 24px;
  box-shadow: 0 16px 36px var(--lw-glass-shadow);
  display: flex;
  flex-direction: column;
  gap: 12px;
  text-align: left;
  cursor: pointer;
  transition:
    transform 180ms cubic-bezier(0.22, 1, 0.36, 1),
    border-color 180ms cubic-bezier(0.22, 1, 0.36, 1),
    box-shadow 180ms cubic-bezier(0.22, 1, 0.36, 1);
}

.stage-card:hover {
  transform: translateX(3px);
  border-color: var(--lw-border-active);
  box-shadow: var(--lw-shadow-hover);
}

.stage-card.is-active {
  background: color-mix(in srgb, var(--lw-primary) 8%, white);
  border-color: var(--lw-border-active);
  transform: translateX(4px);
  box-shadow: 0 20px 48px var(--lw-glass-shadow);
}

.stage-card.is-empty {
  min-height: 108px;
}

.stage-preview {
  position: relative;
  height: 74px;
  border-radius: 18px;
  background: rgba(255, 255, 255, 0.2);
  overflow: hidden;
}

.preview-window,
.preview-empty {
  position: absolute;
  left: 12px;
  top: 12px;
  width: 46px;
  height: 34px;
  border-radius: 12px;
  border: 1px solid var(--lw-glass-border);
  background: var(--lw-bg-surface);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 8px 16px rgba(15, 23, 42, 0.08);
}

.preview-empty {
  width: calc(100% - 24px);
  justify-content: flex-start;
  padding-left: 12px;
  color: var(--lw-text-muted);
  font-size: 12px;
  font-weight: 700;
}

.stage-copy {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.stage-label {
  font-size: 12px;
  font-weight: 800;
  color: var(--lw-text-main);
}

.stage-meta {
  font-size: 11px;
  color: var(--lw-text-secondary);
}

@media (max-width: 1024px) {
  .lw-stage-strip {
    width: 96px;
  }
}

@media (max-width: 768px) {
  .lw-stage-strip.is-mobile {
    top: 72px;
    left: 12px;
    right: 12px;
    bottom: auto;
    width: auto;
    flex-direction: row;
    align-items: stretch;
    overflow-x: auto;
    gap: 10px;
    padding-bottom: 2px;
  }

  .lw-stage-strip.is-mobile .stage-create {
    flex: 0 0 auto;
    width: 46px;
    height: 46px;
    border-radius: 16px;
  }

  .lw-stage-strip.is-mobile .stage-card {
    flex: 0 0 136px;
    padding: 10px;
    border-radius: 20px;
  }

  .lw-stage-strip.is-mobile .stage-preview {
    height: 60px;
  }
}
</style>
