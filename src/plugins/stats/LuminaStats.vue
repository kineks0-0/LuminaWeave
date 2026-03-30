<template>
  <div class="lw-widgets-pane">
    <div class="widget-content">
      <div class="stats-container">
        <!-- Top Cards Row -->
        <div class="stats-grid">
          <!-- Health Card -->
          <div class="stat-card pink-card">
            <div class="card-top">
              <span class="icon-circle red-icon">
                <svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" stroke-width="2"
                  fill="currentColor">
                  <path
                    d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z">
                  </path>
                </svg>
              </span>
              <span class="card-val red-text">{{ getStatValue('hp', 100) }}%</span>
            </div>
            <div class="card-bottom">
              <div class="stat-name red-text">生命值</div>
              <div class="stat-bar-bg">
                <div class="stat-bar-fill val-red" :style="{ width: getStatValue('hp', 100) + '%' }"></div>
              </div>
            </div>
          </div>

          <!-- Affinity Card -->
          <div class="stat-card pink-card">
            <div class="card-top">
              <span class="icon-circle pink-icon">
                <svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" stroke-width="2"
                  fill="currentColor">
                  <path
                    d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z">
                  </path>
                </svg>
              </span>
              <span class="card-val pink-text">Lvl {{ Math.max(1, Math.floor(getStatValue('affection', 10) / 10))
              }}</span>
            </div>
            <div class="card-bottom">
              <div class="stat-name pink-text">亲密度</div>
              <div class="stat-bar-bg">
                <div class="stat-bar-fill val-pink" :style="{ width: getStatValue('affection', 0) + '%' }"></div>
              </div>
            </div>
          </div>
        </div>

        <!-- Tags Row -->
        <div class="tags-row">
          <div class="tag-pill"><span class="dot blue"></span>酒馆</div>
          <div class="tag-pill"><span class="dot purple"></span>夜晚</div>
          <div class="tag-pill"><span class="dot orange"></span>剧情判定点</div>
        </div>

        <div class="helper-info">
          <span>✔️ 已连通 LuminaWeave 数据流</span>
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
  padding: 24px;
}



.stats-container {
  display: flex;
  flex-direction: column;
  gap: 24px;
  margin-top: 8px;
}

/* Grid for the two square cards */
.stats-grid {
  display: flex;
  gap: 16px;
}

.stat-card.pink-card {
  flex: 1;
  background: #fff4f5;
  /* Very light pink background */
  border-radius: 12px;
  padding: 16px;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  min-height: 110px;
}

.card-top {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
}

.icon-circle {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #fff;
}

.red-icon {
  color: #f43f5e;
  box-shadow: 0 2px 4px rgba(244, 63, 94, 0.1);
}

.pink-icon {
  color: #ec4899;
  box-shadow: 0 2px 4px rgba(236, 72, 153, 0.1);
}

.card-val {
  font-size: 14px;
  font-weight: 700;
}

.red-text {
  color: #e11d48;
}

.pink-text {
  color: #be185d;
}

.card-bottom {
  margin-top: auto;
}

.stat-name {
  font-size: 10px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  margin-bottom: 8px;
}

.stat-bar-bg {
  width: 100%;
  height: 6px;
  background: rgba(255, 255, 255, 0.6);
  border-radius: 3px;
  overflow: hidden;
}

.stat-bar-fill {
  height: 100%;
  border-radius: 3px;
  transition: width 0.3s ease;
}

.val-red {
  background: #f43f5e;
}

.val-pink {
  background: #ec4899;
}

/* Tags row */
.tags-row {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.tag-pill {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 4px 12px;
  background: #ffffff;
  border: 1px solid #e2e8f0;
  border-radius: 16px;
  font-size: 12px;
  font-weight: 500;
  color: #475569;
}

.tag-pill .dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
}

.dot.blue {
  background: var(--lw-primary);
}

.dot.purple {
  background: var(--lw-primary);
}

.dot.orange {
  background: #f59e0b;
}

.helper-info {
  margin-top: 12px;
  text-align: center;
  font-size: 11px;
  color: #10b981;
  font-weight: 600;
}
</style>
