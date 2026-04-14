<template>
  <div class="lorebook-preview" :class="{ 'is-minimal': minimal }">
    <header class="preview-header">
      <div class="header-main">
        <span class="type-kicker">{{ entry.uid ? '条目预览' : '新建预览' }}</span>
        <h3 class="title">{{ entry.comment || '未命名条目' }}</h3>
      </div>
      <div v-if="entry.uid" class="uid-tag">{{ entry.uid }}</div>
    </header>

    <div v-if="hasKeywords" class="tags-section">
      <div class="tag-group">
        <span v-for="key in entry.key" :key="`main-${key}`" class="tag-chip primary">{{ key }}</span>
        <span v-for="key in entry.keysecondary" :key="`sec-${key}`" class="tag-chip secondary">{{ key }}</span>
      </div>
    </div>

    <div class="specs-grid">
      <div class="spec-item">
        <span class="label">插入位置</span>
        <span class="value">{{ positionLabel }}</span>
      </div>
      <div class="spec-item">
        <span class="label">深度</span>
        <span class="value">{{ entry.depth }}</span>
      </div>
      <div class="spec-item">
        <span class="label">概率</span>
        <span class="value">{{ entry.probability }}%</span>
      </div>
      <div class="spec-item">
        <span class="label">状态</span>
        <span class="value" :class="{ 'is-active': !entry.disable }">{{ entry.disable ? '禁用' : '激活' }}</span>
      </div>
    </div>

    <div class="content-section">
      <div class="content-header">
        <span>条目内容</span>
      </div>
      <pre class="content-body">{{ entry.content || '（空）' }}</pre>
    </div>

    <div v-if="!minimal" class="extra-specs">
      <span v-if="entry.constant" class="extra-chip">常驻</span>
      <span v-if="entry.selective" class="extra-chip">选择性激活</span>
      <span class="extra-chip">阶序: {{ entry.order }}</span>
      <span class="extra-chip">扫描深度: {{ entry.scan_depth }}</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';

const props = defineProps<{
  entry: LuminaLorebookEntry;
  minimal?: boolean;
}>();

const hasKeywords = computed(() => (props.entry.key?.length || 0) + (props.entry.keysecondary?.length || 0) > 0);

const positionLabel = computed(() => {
  const p = props.entry.position;
  if (p === 0 || p === '0') return '角色前';
  if (p === 1 || p === '1') return '角色后';
  if (p === 2 || p === '2') return '深度前';
  if (p === 3 || p === '3') return '深度后';
  if (p === 4 || p === '4') return '内容前';
  return p;
});
</script>

<style scoped>
.lorebook-preview {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 16px;
  border-radius: 20px;
  background: var(--lw-bg-elevated);
  border: 1px solid var(--lw-border-subtle);
  color: var(--lw-text-main);
  box-shadow: 0 8px 30px rgba(0, 0, 0, 0.08);
  font-family: inherit;
  transition: all 0.2s ease;
}

.lorebook-preview.is-minimal {
  padding: 12px;
  gap: 8px;
  box-shadow: none;
  background: transparent;
  border-color: color-mix(in srgb, var(--lw-border-base) 60%, transparent);
}

.preview-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 12px;
}

.type-kicker {
  font-size: 10px;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  color: var(--lw-primary);
  display: block;
  margin-bottom: 2px;
}

.title {
  margin: 0;
  font-size: 17px;
  font-weight: 700;
  line-height: 1.2;
}

.is-minimal .title {
  font-size: 15px;
}

.uid-tag {
  font-size: 10px;
  font-family: var(--lw-font-mono), ui-monospace, monospace;
  padding: 2px 6px;
  background: var(--lw-bg-subtle);
  border-radius: 6px;
  color: var(--lw-text-muted);
}

.tags-section {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.tag-group {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.tag-chip {
  font-size: 11px;
  padding: 3px 8px;
  border-radius: 999px;
  border: 1px solid transparent;
}

.tag-chip.primary {
  background: rgba(var(--lw-primary-rgb), 0.12);
  color: var(--lw-primary);
  border-color: rgba(var(--lw-primary-rgb), 0.1);
}

.tag-chip.secondary {
  background: var(--lw-bg-subtle);
  color: var(--lw-text-secondary);
  border-color: var(--lw-border-base);
}

.specs-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 8px;
  padding: 10px;
  background: color-mix(in srgb, var(--lw-bg-subtle) 40%, transparent);
  border-radius: 12px;
}

.is-minimal .specs-grid {
  grid-template-columns: repeat(4, 1fr);
  padding: 6px 8px;
  gap: 4px;
}

.spec-item {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.is-minimal .spec-item {
  align-items: center;
}

.spec-item .label {
  font-size: 10px;
  font-weight: 700;
  color: var(--lw-text-muted);
  text-transform: uppercase;
}

.spec-item .value {
  font-size: 12px;
  font-weight: 600;
}

.spec-item .value.is-active {
  color: #8adead;
}

.content-section {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.content-header {
  font-size: 11px;
  font-weight: 700;
  color: var(--lw-text-muted);
  text-transform: uppercase;
}

.content-body {
  margin: 0;
  font-size: 13px;
  line-height: 1.6;
  white-space: pre-wrap;
  word-break: break-word;
  max-height: 180px;
  overflow-y: auto;
  color: var(--lw-text-secondary);
  font-family: inherit;
  padding: 10px;
  background: color-mix(in srgb, var(--lw-bg-subtle) 20%, transparent);
  border-radius: 10px;
  border-left: 3px solid var(--lw-border-strong);
}

.is-minimal .content-body {
  max-height: 100px;
  font-size: 12px;
}

.extra-specs {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.extra-chip {
  font-size: 10px;
  padding: 2px 7px;
  background: var(--lw-bg-subtle);
  border: 1px solid var(--lw-border-base);
  border-radius: 6px;
  color: var(--lw-text-muted);
}
</style>
