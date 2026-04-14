<template>
  <div class="lw-widgets-pane">
    <div class="widget-content">
      <div class="stats-shell">
        <div class="stats-head">
          <div>
            <span class="stats-kicker">Live Readout</span>
            <h3>状态轨</h3>
          </div>
          <span class="stats-badge">Synced</span>
        </div>

        <div class="stats-grid">
          <div class="stat-card">
            <div class="metric-label">Integrity / HP</div>
            <div class="metric-value">{{ getStatValue('hp', 100) }}%</div>
            <div class="metric-rail">
              <span class="metric-fill" :style="{ width: getStatValue('hp', 100) + '%' }"></span>
            </div>
          </div>

          <div class="stat-card">
            <div class="metric-label">Affinity / Level</div>
            <div class="metric-value">Lvl {{ Math.max(1, Math.floor(getStatValue('affection', 10) / 10)) }}</div>
            <div class="metric-rail">
              <span class="metric-fill is-soft" :style="{ width: getStatValue('affection', 0) + '%' }"></span>
            </div>
          </div>
        </div>

        <div class="tag-row">
          <span class="tag-pill">Tavern</span>
          <span class="tag-pill">Night</span>
          <span class="tag-pill">Decision Point</span>
        </div>

        <div class="helper-info">
          数据总线已连接，状态随世界线切换同步刷新。
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { inject } from 'vue';
import { LuminaWeaveAPI } from '../../api/index';

const lwApi = inject<LuminaWeaveAPI>('lwApi');

const getStatValue = (key: string, fallback: number): number => {
  // 暂时保留 fallback 以防核心状态机未就绪
  if (!lwApi) return fallback;
  const val = lwApi.getState(key);
  return val !== undefined ? val : fallback;
};

// 后续可通过监听状态机更新数值，暂由 Vue 的 reactivity 驱动（如果 getState 是响应式的）
</script>

<style scoped>
.lw-widgets-pane {
  flex: 1;
  background: transparent;
  display: flex;
  flex-direction: column;
  height: 100%;
}

.widget-content {
  flex: 1;
  overflow-y: auto;
  padding: 18px;
}

.stats-shell {
  display: flex;
  flex-direction: column;
  gap: 16px;
  background: color-mix(in srgb, var(--lw-bg-elevated) 94%, transparent);
  border: 1px solid var(--lw-border-base);
  border-radius: 20px;
  padding: 16px;
  box-shadow: var(--lw-shadow);
}

.stats-head {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 12px;
}

.stats-kicker {
  display: inline-block;
  margin-bottom: 4px;
  font-size: 10px;
  font-weight: 800;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: var(--lw-text-muted);
}

.stats-head h3 {
  font-family: var(--lw-font-display);
  font-size: 18px;
  font-weight: 700;
  color: var(--lw-text-main);
  letter-spacing: -0.02em;
}

.stats-badge {
  display: inline-flex;
  align-items: center;
  min-height: 26px;
  padding: 0 10px;
  border-radius: 999px;
  background: var(--lw-bg-subtle);
  border: 1px solid var(--lw-border-subtle);
  color: var(--lw-text-secondary);
  font-size: 10px;
  font-weight: 800;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
}

.stat-card {
  background: var(--lw-bg-surface);
  border: 1px solid var(--lw-border-subtle);
  border-radius: 16px;
  padding: 14px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.metric-label {
  font-size: 10px;
  font-weight: 800;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: var(--lw-text-muted);
}

.metric-value {
  font-family: var(--lw-font-display);
  font-size: 24px;
  font-weight: 700;
  color: var(--lw-text-main);
  letter-spacing: -0.04em;
}

.metric-rail {
  width: 100%;
  height: 8px;
  background: var(--lw-bg-active);
  border-radius: 999px;
  overflow: hidden;
}

.metric-fill {
  display: block;
  height: 100%;
  border-radius: inherit;
  background: var(--lw-black);
  transition: width 0.24s ease;
}

.metric-fill.is-soft {
  background: var(--lw-primary);
}

.tag-row {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.tag-pill {
  display: inline-flex;
  align-items: center;
  min-height: 28px;
  padding: 0 10px;
  background: var(--lw-bg-subtle);
  border: 1px solid var(--lw-border-subtle);
  border-radius: 999px;
  font-size: 11px;
  font-weight: 700;
  color: var(--lw-text-secondary);
}

.helper-info {
  padding-top: 8px;
  border-top: 1px solid var(--lw-border-subtle);
  font-size: 11px;
  color: var(--lw-text-muted);
  line-height: 1.6;
}

@media (max-width: 480px) {
  .stats-grid {
    grid-template-columns: 1fr;
  }
}
</style>
