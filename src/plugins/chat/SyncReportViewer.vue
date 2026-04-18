<template>
  <transition name="fade-scale">
    <div v-if="(isOpen || !!isTabMode) && report" class="report-overlay" :class="{ 'is-tab': !!isTabMode }"
      @click.self="!isTabMode && close()">
      <div class="report-window" :class="{ 'full-mode': !!isTabMode }">
        <div class="report-header">
          <div class="title-area">
            <div class="brand-badge">Lumina Sync</div>
            <h2>同步对比报告</h2>
            <p>用于定位“插件影子图谱 vs ST 线性列表”的对齐断点、内容口径与元数据差异。</p>
          </div>
          <div class="header-actions">
            <button class="lw-external-btn" v-if="!isTabMode" @click="externalize" title="外放至大窗口">
              <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="2" fill="none">
                <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path>
                <polyline points="15 3 21 3 21 9"></polyline>
                <line x1="10" y1="14" x2="21" y2="3"></line>
              </svg>
            </button>
            <button class="close-btn" v-if="!isTabMode" @click="close">
              <svg viewBox="0 0 24 24" width="20" height="20" stroke="currentColor" stroke-width="2" fill="none">
                <line x1="18" y1="6" x2="6" y2="18"></line>
                <line x1="6" y1="6" x2="18" y2="18"></line>
              </svg>
            </button>
          </div>
        </div>

        <div class="lw-body">
          <div class="lw-section-title">总览</div>

          <div class="summary-grid">
            <div class="sum-item">
              <div class="sum-label">Lumina 条数</div>
              <div class="sum-val">{{ report.summary.luminaCount }}</div>
            </div>
            <div class="sum-item">
              <div class="sum-label">ST 条数</div>
              <div class="sum-val">{{ report.summary.stCount }}</div>
            </div>
            <div class="sum-item">
              <div class="sum-label">分歧点</div>
              <div class="sum-val">{{ formatIndex(report.divergenceIndex) }}</div>
            </div>
            <div class="sum-item">
              <div class="sum-label">首个不一致</div>
              <div class="sum-val">{{ formatIndex(report.firstMismatchIndex) }}</div>
            </div>
            <div class="sum-item">
              <div class="sum-label">内容不一致</div>
              <div class="sum-val">{{ report.summary.contentMismatchCount }}</div>
            </div>
            <div class="sum-item">
              <div class="sum-label">元数据不一致</div>
              <div class="sum-val">{{ report.summary.metadataMismatchCount }}</div>
            </div>
            <div class="sum-item">
              <div class="sum-label">写回口径不一致</div>
              <div class="sum-val">{{ report.summary.writeTextMismatchCount }}</div>
            </div>
            <div class="sum-item">
              <div class="sum-label">低置信匹配</div>
              <div class="sum-val">{{ report.summary.lowConfidenceMatchCount }}</div>
            </div>
          </div>

          <div class="lw-section-title">明细</div>
          <div class="report-controls">
            <label><input type="radio" value="diff" v-model="viewMode"> 仅差异</label>
            <label><input type="radio" value="all" v-model="viewMode"> 全部</label>
          </div>

          <div class="report-scroll scrollbar-thin">
            <div v-for="item in visibleItems" :key="itemKey(item)" class="report-row" :class="{ active: activeKey === itemKey(item) }"
              @click="toggleActive(item)">
              <div class="row-left">
                <div class="row-title">
                  <span class="idx">#{{ item.indexHint }}</span>
                  <span class="pill">{{ item.matchReason }}/{{ item.confidence }}</span>
                </div>
                <div class="row-sub">
                  <span v-for="t in item.diffTypes" :key="t" class="tag" :class="`t-${t}`">{{ t }}</span>
                  <span v-if="item.diffTypes.length === 0" class="tag t-same">same</span>
                </div>
              </div>
              <div class="row-right">
                <div class="mini">
                  <span class="mini-label">L</span>
                  <span class="mini-text">{{ miniText(item.lumina?.canonicalText) }}</span>
                </div>
                <div class="mini">
                  <span class="mini-label">S</span>
                  <span class="mini-text">{{ miniText(item.st?.canonicalText) }}</span>
                </div>
              </div>
            </div>

            <div v-if="visibleItems.length === 0" class="empty">无可展示条目</div>
          </div>

          <div v-if="activeItem" class="detail">
            <div class="lw-section-title">对照</div>
            <div class="detail-grid">
              <div class="detail-col">
                <div class="detail-head">
                  <div class="dot lumina"></div>
                  <div class="head-text">Lumina</div>
                </div>
                <div class="kv">
                  <div class="k">id</div><div class="v">{{ activeItem.lumina?.id }}</div>
                  <div class="k">fp</div><div class="v">{{ activeItem.lumina?.fingerprint }}</div>
                  <div class="k">stfp</div><div class="v">{{ activeItem.lumina?.stFingerprint }}</div>
                  <div class="k">name</div><div class="v">{{ activeItem.lumina?.name }}</div>
                  <div class="k">role</div><div class="v">{{ activeItem.lumina?.role }}</div>
                  <div class="k">hidden</div><div class="v">{{ activeItem.lumina?.is_hidden ? '1' : '0' }}</div>
                </div>
                <div class="text-block">
                  <div class="text-title">Canonical</div>
                  <pre class="pre">{{ activeItem.lumina?.canonicalText }}</pre>
                </div>
                <div class="text-block">
                  <div class="text-title">ST Write</div>
                  <pre class="pre">{{ activeItem.lumina?.stWriteText }}</pre>
                </div>
              </div>

              <div class="detail-col">
                <div class="detail-head">
                  <div class="dot st"></div>
                  <div class="head-text">SillyTavern</div>
                </div>
                <div class="kv">
                  <div class="k">id</div><div class="v">{{ activeItem.st?.id }}</div>
                  <div class="k">fp</div><div class="v">{{ activeItem.st?.fingerprint }}</div>
                  <div class="k">stfp</div><div class="v">{{ activeItem.st?.stFingerprint }}</div>
                  <div class="k">name</div><div class="v">{{ activeItem.st?.name }}</div>
                  <div class="k">role</div><div class="v">{{ activeItem.st?.role }}</div>
                  <div class="k">hidden</div><div class="v">{{ activeItem.st?.is_hidden ? '1' : '0' }}</div>
                </div>
                <div class="text-block">
                  <div class="text-title">Canonical</div>
                  <pre class="pre">{{ activeItem.st?.canonicalText }}</pre>
                </div>
                <div class="text-block">
                  <div class="text-title">ST Write</div>
                  <pre class="pre">{{ activeItem.st?.stWriteText }}</pre>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div class="lw-footer">
          <div class="lw-stats">
            条目: {{ report.items.length }}，匹配: {{ report.summary.matchedCount }}
          </div>
        </div>
      </div>
    </div>
  </transition>
</template>

<script setup lang="ts">
import { computed, ref, onMounted } from 'vue';

const lwApi = (window as any).LuminaWeave_API;

const props = defineProps<{
  isTabMode?: boolean | string
}>();

const emit = defineEmits(['close']);

const isOpen = ref(false);
const report = ref<any>(null);
const viewMode = ref<'all' | 'diff'>('diff');
const activeKey = ref<string>('');

const open = () => {
  if (props.isTabMode) return;
  refresh();
  isOpen.value = true;
};

const refresh = () => {
  const res = lwApi?.analyzeChatDiffWithST?.();
  report.value = res?.report ?? null;
  if (!report.value) {
    isOpen.value = false;
  }
};

const close = () => {
  isOpen.value = false;
  emit('close');
};

const externalize = () => {
  if (!lwApi) return;
  lwApi.openPanel('sync_report', {}, { mode: 'tab' });
  isOpen.value = false;
};

const itemKey = (item: any): string => {
  const l = item?.lumina?.id ?? '';
  const s = item?.st?.id ?? '';
  return `${item?.indexHint ?? ''}|${l}|${s}`;
};

const isDiffItem = (item: any): boolean => {
  if (!item) return false;
  if (!Array.isArray(item.diffTypes)) return false;
  if (item.diffTypes.length === 0) return false;
  return !(item.diffTypes.length === 1 && item.diffTypes[0] === 'low_confidence_match');
};

const visibleItems = computed(() => {
  if (!report.value?.items) return [];
  if (viewMode.value === 'all') return report.value.items;
  return report.value.items.filter(isDiffItem);
});

const activeItem = computed(() => {
  if (!report.value?.items) return null;
  return report.value.items.find((it: any) => itemKey(it) === activeKey.value) ?? null;
});

const toggleActive = (item: any) => {
  const k = itemKey(item);
  activeKey.value = activeKey.value === k ? '' : k;
};

const miniText = (text?: string) => {
  const v = text ?? '';
  if (!v) return '空';
  return v.length > 60 ? v.slice(0, 60) + '…' : v;
};

const formatIndex = (value: number) => {
  return value >= 0 ? String(value) : '无';
};

onMounted(() => {
  if (props.isTabMode) {
    refresh();
  }
});

defineExpose({ open });
</script>

<style scoped>
.fade-scale-enter-active,
.fade-scale-leave-active {
  transition: all 0.22s cubic-bezier(0.16, 1, 0.3, 1);
}
.fade-scale-enter-from,
.fade-scale-leave-to {
  opacity: 0;
  transform: scale(0.98);
}

.report-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.45);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 99999;
}
.report-overlay.is-tab {
  position: relative;
  inset: auto;
  background: transparent;
  display: block;
}

.report-window {
  width: min(1080px, 92vw);
  max-height: 86vh;
  background: var(--lw-bg-surface, #fff);
  border: 1px solid var(--lw-border, #e2e8f0);
  border-radius: 14px;
  box-shadow: 0 24px 60px rgba(0, 0, 0, 0.22);
  overflow: hidden;
  display: flex;
  flex-direction: column;
}
.report-window.full-mode {
  width: 100%;
  max-height: none;
  height: calc(100vh - 20px);
  border-radius: 12px;
}

.report-header {
  padding: 18px 18px 14px;
  border-bottom: 1px solid var(--lw-border, #e2e8f0);
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 12px;
}
.brand-badge {
  display: inline-flex;
  font-weight: 700;
  font-size: 12px;
  padding: 2px 8px;
  border-radius: 999px;
  color: var(--lw-primary, #0061e0);
  background: rgba(var(--lw-primary-rgb, 0, 97, 224), 0.12);
  width: fit-content;
}
.title-area h2 {
  margin: 8px 0 4px;
  font-size: 18px;
}
.title-area p {
  margin: 0;
  font-size: 12px;
  color: var(--lw-text-dim, #6b7280);
}
.header-actions {
  display: flex;
  gap: 8px;
}
.lw-external-btn,
.close-btn {
  border: 1px solid var(--lw-border, #e2e8f0);
  background: rgba(255, 255, 255, 0.7);
  color: var(--lw-text-main, #111827);
  border-radius: 10px;
  width: 38px;
  height: 38px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
}

.lw-body {
  padding: 16px 18px;
  overflow: auto;
  flex: 1;
}
.lw-section-title {
  font-size: 11px;
  font-weight: 700;
  color: var(--lw-text-dim, #6b7280);
  text-transform: uppercase;
  letter-spacing: 0.08em;
  margin: 10px 0 10px;
}
.summary-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 10px;
}
.sum-item {
  border: 1px solid var(--lw-border, #e2e8f0);
  border-radius: 12px;
  padding: 10px 12px;
  background: rgba(var(--lw-surface-rgb, 255, 255, 255), 0.7);
  backdrop-filter: blur(10px) saturate(180%);
}
.sum-label {
  font-size: 11px;
  color: var(--lw-text-dim, #6b7280);
}
.sum-val {
  font-size: 18px;
  font-weight: 800;
  color: var(--lw-text-main, #111827);
  margin-top: 4px;
}

.report-controls {
  display: flex;
  gap: 14px;
  font-size: 12px;
  color: var(--lw-text-main, #111827);
  margin-bottom: 10px;
}
.report-scroll {
  border: 1px solid var(--lw-border, #e2e8f0);
  border-radius: 12px;
  overflow: hidden;
}
.report-row {
  display: grid;
  grid-template-columns: 230px 1fr;
  gap: 12px;
  padding: 12px;
  border-bottom: 1px solid var(--lw-border-subtle, rgba(0, 0, 0, 0.04));
  cursor: pointer;
}
.report-row:last-child {
  border-bottom: none;
}
.report-row.active {
  background: rgba(var(--lw-primary-rgb, 0, 97, 224), 0.06);
}
.row-title {
  display: flex;
  align-items: center;
  gap: 8px;
}
.idx {
  font-weight: 800;
  color: var(--lw-text-main, #111827);
}
.pill {
  font-size: 11px;
  padding: 2px 8px;
  border: 1px solid var(--lw-border, #e2e8f0);
  border-radius: 999px;
  color: var(--lw-text-dim, #6b7280);
  background: rgba(255, 255, 255, 0.6);
}
.row-sub {
  margin-top: 6px;
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}
.tag {
  font-size: 11px;
  padding: 2px 6px;
  border-radius: 8px;
  border: 1px solid var(--lw-border, #e2e8f0);
  color: var(--lw-text-main, #111827);
  background: rgba(255, 255, 255, 0.65);
}
.t-same {
  color: var(--lw-text-dim, #6b7280);
}
.t-content_mismatch {
  border-color: rgba(239, 68, 68, 0.45);
  background: rgba(239, 68, 68, 0.08);
}
.t-metadata_mismatch {
  border-color: rgba(245, 158, 11, 0.5);
  background: rgba(245, 158, 11, 0.12);
}
.t-write_text_mismatch {
  border-color: rgba(59, 130, 246, 0.5);
  background: rgba(59, 130, 246, 0.12);
}
.t-low_confidence_match {
  border-color: rgba(107, 114, 128, 0.5);
  background: rgba(107, 114, 128, 0.08);
  color: var(--lw-text-dim, #6b7280);
}
.t-local_only,
.t-st_only {
  border-color: rgba(168, 85, 247, 0.45);
  background: rgba(168, 85, 247, 0.1);
}

.row-right {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
}
.mini {
  border: 1px dashed var(--lw-border, #e2e8f0);
  border-radius: 10px;
  padding: 8px 10px;
}
.mini-label {
  font-weight: 800;
  font-size: 12px;
  color: var(--lw-text-dim, #6b7280);
  margin-right: 6px;
}
.mini-text {
  font-size: 12px;
  color: var(--lw-text-main, #111827);
}
.empty {
  padding: 14px;
  text-align: center;
  color: var(--lw-text-dim, #6b7280);
}

.detail {
  margin-top: 14px;
}
.detail-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
}
.detail-col {
  border: 1px solid var(--lw-border, #e2e8f0);
  border-radius: 12px;
  padding: 12px;
  background: rgba(var(--lw-surface-rgb, 255, 255, 255), 0.7);
  backdrop-filter: blur(10px) saturate(180%);
}
.detail-head {
  display: flex;
  align-items: center;
  gap: 8px;
  font-weight: 800;
  margin-bottom: 10px;
}
.dot {
  width: 10px;
  height: 10px;
  border-radius: 999px;
}
.dot.lumina {
  background: var(--lw-primary, #0061e0);
}
.dot.st {
  background: #22c55e;
}
.kv {
  display: grid;
  grid-template-columns: 70px 1fr;
  gap: 6px 10px;
  font-size: 12px;
  margin-bottom: 10px;
}
.k {
  color: var(--lw-text-dim, #6b7280);
  font-weight: 700;
}
.v {
  color: var(--lw-text-main, #111827);
  word-break: break-all;
}
.text-block {
  margin-top: 10px;
}
.text-title {
  font-size: 11px;
  font-weight: 800;
  color: var(--lw-text-dim, #6b7280);
  margin-bottom: 6px;
}
.pre {
  margin: 0;
  padding: 10px;
  border-radius: 10px;
  border: 1px solid var(--lw-border, #e2e8f0);
  background: rgba(255, 255, 255, 0.7);
  max-height: 240px;
  overflow: auto;
  white-space: pre-wrap;
  word-break: break-word;
  font-size: 12px;
  line-height: 1.5;
}

.lw-footer {
  padding: 12px 18px;
  border-top: 1px solid var(--lw-border, #e2e8f0);
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.lw-stats {
  color: var(--lw-text-dim, #6b7280);
  font-size: 12px;
}

@media (max-width: 960px) {
  .summary-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
  .report-row {
    grid-template-columns: 1fr;
  }
  .row-right {
    grid-template-columns: 1fr;
  }
  .detail-grid {
    grid-template-columns: 1fr;
  }
}
</style>
