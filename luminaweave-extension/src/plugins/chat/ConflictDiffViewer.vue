<template>
  <transition name="fade-scale">
    <div v-if="(isOpen || !!isTabMode) && diffData" class="conflict-overlay" :class="{ 'is-tab': !!isTabMode }"
      @click.self="!isTabMode && close()">
      <div class="conflict-window" :class="{ 'full-mode': !!isTabMode }">
        <!-- ... (header) ... -->
        <div class="conflict-header">
          <div class="title-area">
            <div class="brand-badge">Lumina Sync</div>
            <h2>检测到数据版本冲突</h2>
            <p>检测到 ST 内存与独立存储库的消息分歧，请选择您希望保留的“世界线”版本。</p>
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
          <div class="lw-section-title">对话数据分歧比对 (Diff)</div>

          <div class="lw-diff-container">
            <div class="lw-diff-head">
              <div class="lw-diff-side">
                <div class="lw-side-header">
                  <div class="lw-node-dot active"></div>
                  <div class="lw-side-info">
                    <div class="lw-side-label">Lumina 独立存储 (影子数据库)</div>
                    <div class="lw-side-status">当前影子副本</div>
                  </div>
                  <button class="lw-apply-btn" @click="resolve('lumina')">保留此版本</button>
                </div>
              </div>

              <div class="lw-diff-vs">VS</div>

              <div class="lw-diff-side">
                <div class="lw-side-header">
                  <div class="lw-node-dot st-dot"></div>
                  <div class="lw-side-info">
                    <div class="lw-side-label">SillyTavern 运行时状态</div>
                    <div class="lw-side-status">内存即时数据</div>
                  </div>
                  <button class="lw-apply-btn secondary" @click="resolve('st')">拉取此版本</button>
                </div>
              </div>
            </div>

            <div class="lw-diff-scroll scrollbar-thin">
              <div v-for="row in diffRows" :key="row.index" class="lw-diff-pair">
                <div class="lw-diff-cell" :class="row.leftClass">
                  <div class="lw-mobile-tag lumina">LUMINA / 独立存储</div>
                  <div class="lw-code-row">
                    <span class="lw-code-no">{{ row.leftLine }}</span>
                    <span class="lw-code-sign">{{ row.leftSign }}</span>
                    <span class="lw-code-text">{{ row.leftText }}</span>
                  </div>
                </div>

                <div class="lw-diff-vs row">VS</div>

                <div class="lw-diff-cell" :class="row.rightClass">
                  <div class="lw-mobile-tag st">ST / 内存即时数据</div>
                  <div class="lw-code-row">
                    <span class="lw-code-no">{{ row.rightLine }}</span>
                    <span class="lw-code-sign">{{ row.rightSign }}</span>
                    <span class="lw-code-text">{{ row.rightText }}</span>
                  </div>
                </div>
              </div>
              <div v-if="diffRows.length === 0" class="lw-empty-node">无可展示差异</div>
            </div>
          </div>
        </div>

        <div class="lw-footer">
          <div class="lw-stats">
            差异项: {{ diffData.diffCount || (diffData.onlyInIndependent.length + diffData.onlyInST.length) }}
          </div>
        </div>
      </div>
    </div>
  </transition>
</template>

<script setup lang="ts">
import { computed, ref, onMounted, onUnmounted } from 'vue';

const lwApi = (window as any).LuminaWeave;
const props = defineProps<{
  isTabMode?: boolean | string
}>();

const emit = defineEmits(['close']);
const isOpen = ref(false);
const diffData = ref<any>(null);

const diffRows = computed(() => Array.isArray(diffData.value?.rows) ? diffData.value.rows : []);

const handleConflict = (data: any) => {
  if (!data?.hasDivergence || !data?.diffCount) {
    diffData.value = null;
    isOpen.value = false;
    return;
  }
  diffData.value = data;
  isOpen.value = true;
};

// 外部调用打开弹窗
const open = () => {
  if (props.isTabMode) return;
  const currentState = lwApi?.getConflictState?.();
  if (currentState?.hasDivergence && currentState?.diffCount) {
    handleConflict(currentState);
  } else {
    const latestDiff = lwApi?.getSyncDiff?.();
    if (latestDiff?.hasDivergence && latestDiff?.diffCount) {
      handleConflict(latestDiff);
    }
  }
};

// 外放至大窗口（标签页）
const externalize = () => {
  if (!lwApi) return;
  lwApi.openPanel('conflict', {}, { mode: 'tab' });
  isOpen.value = false;
};

onMounted(() => {
  if (lwApi) {
    lwApi.on('CHAT_CONFLICT', handleConflict);
    const state = lwApi.getConflictState?.();
    if (state?.hasDivergence && state?.diffCount) {
      handleConflict(state);
    }
  }
});

onUnmounted(() => {
  if (lwApi) {
    lwApi.off('CHAT_CONFLICT', handleConflict);
  }
});

const close = () => {
  isOpen.value = false;
  emit('close');
};

const resolve = async (winner: 'st' | 'lumina') => {
  if (!lwApi) return;
  try {
    console.log(`[ConflictViewer] 用户选择解决版本: ${winner}`);

    // UI 层不再直接调用底层的 commitToST 或决定 forceOverwrite
    // 而是通过触发带意图的 sync 请求，由服务层统一决议
    await lwApi.syncFromST({ resolveIntent: winner });

    // 刷新差异数据，确认是否已解决
    const newState = lwApi.getSyncDiff?.();
    if (newState?.hasDivergence && newState?.diffCount) {
      diffData.value = newState;
    } else {
      diffData.value = null;
    }

    lwApi.showToast(winner === 'lumina' ? '已成功应用本地版本至全局' : '已成功同步 ST 版本', 'success');

    if (!props.isTabMode && isOpen.value) {
      isOpen.value = false;
    }
    emit('close');
  } catch (err: any) {
    console.error('[ConflictViewer] 解决冲突失败:', err);
    lwApi.showToast(`解决失败: ${err.message || '未知错误'}`, 'error');
  }
};

defineExpose({ open });
</script>

<style scoped>
.fade-scale-enter-active,
.fade-scale-leave-active {
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

.fade-scale-enter-from,
.fade-scale-leave-to {
  opacity: 0;
  transform: scale(0.95);
}

.conflict-overlay {
  position: fixed;
  inset: 0;
  background: rgba(15, 23, 42, 0.4);
  backdrop-filter: blur(4px);
  z-index: 99999;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 40px;
}

@media (max-width: 768px) {
  .conflict-overlay {
    padding: 10px;
    height: 100vh;
  }
}

.conflict-overlay.is-tab {
  position: relative;
  width: 100%;
  height: 100%;
  background: transparent;
  backdrop-filter: none;
  padding: 0;
  z-index: 1;
}

.conflict-window {
  width: 1000px;
  max-width: 95vw;
  height: 80vh;
  background: #f8fafc;
  border-radius: 20px;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
  border: 1px solid rgba(255, 255, 255, 0.8);
  transition: all 0.3s;
}

@media (max-width: 768px) {
  .conflict-window {
    width: 100%;
    max-width: 100%;
    height: calc(100% - 20px);
    border-radius: 16px;
  }
}

.conflict-window.full-mode {
  width: 100%;
  max-width: 100%;
  height: 100%;
  border-radius: 0;
  box-shadow: none;
  border: none;
  background: transparent;
}

.conflict-window.full-mode .lw-body {
  background: transparent;
}

.conflict-window.full-mode .lw-diff-container {
  background: rgba(241, 245, 249, 0.4);
  border-color: #f1f5f9;
}

.conflict-window.full-mode .lw-diff-side {
  background: rgba(255, 255, 255, 0.6);
}

.conflict-window.full-mode .lw-diff-vs {
  background: transparent;
}

/* --- Header Section --- */
.conflict-header {
  padding: 32px 32px 24px;
  background: white;
  border-bottom: 1px solid #f1f5f9;
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
}

@media (max-width: 768px) {
  .conflict-header {
    padding: 20px 20px 16px;
  }
}

.title-area h2 {
  font-size: 20px;
  font-weight: 800;
  color: #0f172a;
  margin: 12px 0 6px;
  letter-spacing: -0.02em;
}

@media (max-width: 768px) {
  .title-area h2 {
    font-size: 17px;
    margin: 8px 0 4px;
  }

  .title-area p {
    font-size: 11px;
    line-height: 1.4;
  }
}

.title-area p {
  font-size: 13px;
  color: #64748b;
  max-width: 480px;
  line-height: 1.5;
}

.brand-badge {
  display: inline-block;
  padding: 4px 10px;
  background: rgba(15, 23, 42, 0.1);
  color: var(--lw-primary);
  border-radius: 8px;
  font-size: 11px;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.header-actions {
  display: flex;
  gap: 12px;
}

.lw-external-btn,
.close-btn {
  background: #f8fafc;
  border: 1px solid #f1f5f9;
  color: #94a3b8;
  cursor: pointer;
  padding: 10px;
  border-radius: 12px;
  transition: 0.2s;
  display: flex;
  align-items: center;
  justify-content: center;
}

.lw-external-btn:hover,
.close-btn:hover {
  background: #f1f5f9;
  color: #1e293b;
  border-color: #e2e8f0;
}

.close-btn:hover {
  background: #fee2e2;
  color: #ef4444;
  border-color: #fecaca;
}

.lw-body {
  flex: 1;
  overflow: hidden;
  padding: 24px;
  display: flex;
  flex-direction: column;
  gap: 20px;
}

@media (max-width: 768px) {
  .lw-body {
    padding: 12px;
    gap: 12px;
  }
}

.lw-section-title {
  font-size: 14px;
  font-weight: 600;
  color: #64748b;
  margin-left: 4px;
}

.lw-diff-container {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 2px;
  background: #f1f5f9;
  border-radius: 16px;
  padding: 2px;
  overflow: hidden;
  border: 1px solid #e2e8f0;
}

.lw-diff-head {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 40px minmax(0, 1fr);
  gap: 2px;
}

@media (max-width: 768px) {
  .lw-diff-head {
    display: flex;
    flex-direction: column;
    gap: 8px;
    padding: 4px;
    background: #f1f5f9;
    border-radius: 12px;
    border-bottom: none;
  }
}

.lw-diff-side {
  flex: 1;
  background: #f8fafc;
  display: flex;
  flex-direction: column;
  padding: 20px;
  position: relative;
}

@media (max-width: 768px) {
  .lw-diff-side {
    padding: 12px;
    border-radius: 10px;
    border: 1px solid #e2e8f0;
  }
}

.lw-side-header {
  display: flex;
  align-items: center;
  gap: 14px;
  margin-bottom: 16px;
}

@media (max-width: 768px) {
  .lw-side-header {
    flex-direction: column;
    align-items: flex-start;
    gap: 10px;
    margin-bottom: 12px;
  }
}

.lw-node-dot {
  width: 20px;
  height: 20px;
  border-radius: 50%;
  background: white;
  border: 4px solid #e2e8f0;
  flex-shrink: 0;
  box-sizing: border-box;
}

.lw-node-dot.active {
  background: var(--lw-primary);
  border-color: rgba(139, 92, 246, 0.2);
  box-shadow: 0 0 0 4px rgba(139, 92, 246, 0.1);
}

.lw-side-info {
  flex: 1;
}

.lw-side-label {
  font-size: 14px;
  font-weight: 700;
  color: #1e293b;
}

.lw-side-status {
  font-size: 12px;
  color: #94a3b8;
  margin-top: 2px;
}

.lw-apply-btn {
  padding: 8px 16px;
  border-radius: 12px;
  font-size: 12px;
  font-weight: 700;
  border: none;
  background: #111827;
  color: white;
  cursor: pointer;
  transition: 0.2s;
  box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
}

@media (max-width: 768px) {
  .lw-apply-btn {
    width: 100%;
    padding: 10px;
    font-size: 13px;
  }
}

.lw-apply-btn:hover {
  background: #000000;
  transform: translateY(-1px);
}

.lw-apply-btn.secondary {
  background: white;
  color: #64748b;
  border: 1px solid #e2e8f0;
  box-shadow: none;
}

.lw-apply-btn.secondary:hover {
  background: #f1f5f9;
  color: #1e293b;
}

.lw-diff-scroll {
  flex: 1;
  overflow-y: auto;
  background: #0b1220;
  border-radius: 12px;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
}

.lw-diff-pair {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 40px minmax(0, 1fr);
  gap: 2px;
  align-items: stretch;
}

@media (max-width: 768px) {
  .lw-diff-pair {
    display: flex;
    flex-direction: column;
    gap: 0;
    border-bottom: 4px solid #1e293b;
  }
}

.lw-mobile-tag {
  display: none;
}

@media (max-width: 768px) {
  .lw-mobile-tag {
    display: block;
    font-size: 9px;
    font-weight: 800;
    padding: 4px 10px;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    background: rgba(30, 41, 59, 0.8);
    color: #94a3b8;
    border-bottom: 1px solid rgba(255, 255, 255, 0.05);
  }

  .lw-mobile-tag.lumina {
    color: #a78bfa;
    border-left: 3px solid var(--lw-primary);
  }

  .lw-mobile-tag.st {
    color: #f87171;
    border-left: 3px solid #ef4444;
  }

  /* 当行内无实质差异且被收起时，为了节省空间，可以不重复显示这些标签 */
  .is-same .lw-mobile-tag {
    opacity: 0.5;
    font-weight: 500;
  }
}

.lw-diff-cell {
  min-width: 0;
  background: rgba(15, 23, 42, 0.96);
}

.lw-code-row {
  display: grid;
  grid-template-columns: 40px 22px 1fr;
  gap: 0;
  min-height: 32px;
  align-items: stretch;
  border-bottom: 1px solid rgba(148, 163, 184, 0.14);
}

@media (max-width: 768px) {
  .lw-code-row {
    grid-template-columns: 32px 20px 1fr;
    min-height: 28px;
  }
}

.lw-code-row:hover {
  background: rgba(255, 255, 255, 0.03);
}

.lw-code-no {
  color: #64748b;
  font-size: 11px;
  padding: 8px 8px;
  text-align: right;
  border-right: 1px solid rgba(148, 163, 184, 0.14);
  background: rgba(15, 23, 42, 0.3);
  user-select: none;
}

.lw-code-sign {
  color: #94a3b8;
  font-size: 11px;
  padding: 8px 6px;
  text-align: center;
  border-right: 1px solid rgba(148, 163, 184, 0.14);
  background: rgba(15, 23, 42, 0.15);
  user-select: none;
}

.lw-code-text {
  color: #e2e8f0;
  font-size: 12px;
  line-height: 1.6;
  padding: 8px 12px;
  white-space: pre-wrap;
  word-break: normal;
  overflow-wrap: anywhere;
  min-width: 0;
}

.lw-node-dot.st-dot {
  background: #ef4444;
  border-color: rgba(239, 68, 68, 0.2);
  box-shadow: 0 0 0 4px rgba(239, 68, 68, 0.1);
}

.lw-diff-cell.is-same .lw-code-text {
  color: #cbd5e1;
}

.lw-diff-cell.is-add {
  background: rgba(22, 163, 74, 0.18);
}

.lw-diff-cell.is-add .lw-code-sign,
.lw-diff-cell.is-add .lw-code-text {
  color: #86efac;
}

.lw-diff-cell.is-mod {
  background: rgba(245, 158, 11, 0.16);
}

.lw-diff-cell.is-mod .lw-code-sign,
.lw-diff-cell.is-mod .lw-code-text {
  color: #fcd34d;
}

.lw-diff-cell.is-empty {
  background: rgba(15, 23, 42, 0.52);
}

.lw-diff-vs {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  background: #f1f5f9;
  font-size: 10px;
  font-weight: 900;
  color: #cbd5e1;
  user-select: none;
}

@media (max-width: 768px) {
  .lw-diff-vs:not(.row) {
    display: none;
  }
}

.lw-diff-vs.row {
  min-height: 32px;
  background: #0b1220;
  border-bottom: 1px solid rgba(148, 163, 184, 0.14);
}

@media (max-width: 768px) {
  .lw-diff-vs.row {
    width: 100%;
    height: 24px;
    min-height: 24px;
    background: #1e293b;
    color: #64748b;
    font-size: 9px;
  }
}

.lw-empty-node {
  padding: 32px 0;
  text-align: center;
  font-size: 13px;
  color: #94a3b8;
  font-style: italic;
}

.lw-footer {
  padding: 16px 24px;
  background: white;
  border-top: 1px solid #eef2f6;
  display: flex;
  justify-content: flex-end;
  align-items: center;
}

@media (max-width: 768px) {
  .lw-footer {
    padding: 12px 16px;
  }
}

.lw-stats {
  font-size: 12px;
  color: #94a3b8;
  font-weight: 600;
}

.scrollbar-thin::-webkit-scrollbar {
  width: 4px;
}

.scrollbar-thin::-webkit-scrollbar-thumb {
  background: #e2e8f0;
  border-radius: 10px;
}
</style>
