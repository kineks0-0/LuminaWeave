<template>
  <div class="lw-splash-page">
    <div class="splash-background">
      <div class="glow glow-1"></div>
      <div class="glow glow-2"></div>
      <div class="glow glow-3"></div>
    </div>

    <div class="splash-content">
      <div class="logo-area">
        <div class="logo-inner">
          <div class="logo-orb"></div>
          <div class="logo-ring"></div>
        </div>
        <h1 class="splash-title">LuminaWeave</h1>
      </div>

      <div class="status-area">
        <div class="progress-bar-wrap">
          <div class="progress-bar-fill" :style="{ width: progress + '%' }"></div>
        </div>
        <div class="status-text-wrap">
          <transition name="status-fade" mode="out-in">
            <span :key="statusText" class="status-text">{{ statusText }}</span>
          </transition>
        </div>
      </div>

      <div class="footer-hint">
        <div class="spinner-small"></div>
        <span>正在构建同步链路...</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch } from 'vue';

const props = defineProps<{
  statusText: string;
  isReady: boolean;
}>();

const emit = defineEmits<{
  (e: 'finished'): void
}>();

const progress = ref(0);

// 模拟进度条，直到真的 Ready
let progressTimer: any = null;
let finishTimer: any = null;

const finishSplash = () => {
  if (progressTimer) {
    clearInterval(progressTimer);
    progressTimer = null;
  }
  progress.value = 100;
  if (finishTimer) {
    clearTimeout(finishTimer);
  }
  finishTimer = setTimeout(() => {
    emit('finished');
    finishTimer = null;
  }, 400); // 给一点时间让进度条跑到 100%
};

onMounted(() => {
  progressTimer = setInterval(() => {
    if (progress.value < 90) {
      progress.value += Math.random() * 5;
    }
  }, 500);
});

watch(() => props.isReady, (ready) => {
  if (ready) {
    finishSplash();
  }
}, { immediate: true });

onUnmounted(() => {
  if (progressTimer) {
    clearInterval(progressTimer);
    progressTimer = null;
  }
  if (finishTimer) {
    clearTimeout(finishTimer);
    finishTimer = null;
  }
});
</script>

<style scoped>
.lw-splash-page {
  position: fixed;
  inset: 0;
  z-index: 100000;
  background: #0f172a;
  color: #f8fafc;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  font-family: var(--lw-font-display, 'Inter', system-ui, sans-serif);
  pointer-events: auto;
}

.lw-splash-page.is-closing {
  opacity: 0;
  pointer-events: none;
  transition: opacity 0.8s cubic-bezier(0.16, 1, 0.3, 1);
}

.splash-background {
  position: absolute;
  inset: 0;
  overflow: hidden;
  z-index: 0;
}

.glow {
  position: absolute;
  border-radius: 50%;
  filter: blur(80px);
  opacity: 0.15;
  animation: pulse 8s infinite ease-in-out;
}

.glow-1 {
  width: 500px;
  height: 500px;
  background: #6366f1;
  top: -100px;
  left: -100px;
}

.glow-2 {
  width: 400px;
  height: 400px;
  background: #a855f7;
  bottom: -50px;
  right: -50px;
  animation-delay: -2s;
}

.glow-3 {
  width: 300px;
  height: 300px;
  background: #2dd4bf;
  top: 40%;
  right: 20%;
  animation-delay: -4s;
}

.splash-content {
  position: relative;
  z-index: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  width: 100%;
  max-width: 400px;
  padding: 40px;
}

.logo-area {
  display: flex;
  flex-direction: column;
  align-items: center;
  margin-bottom: 60px;
}

.logo-inner {
  position: relative;
  width: 80px;
  height: 80px;
  margin-bottom: 24px;
}

.logo-orb {
  position: absolute;
  inset: 20px;
  background: #f8fafc;
  border-radius: 50%;
  box-shadow: 0 0 20px rgba(248, 250, 252, 0.4);
}

.logo-ring {
  position: absolute;
  inset: 0;
  border: 2px solid rgba(248, 250, 252, 0.2);
  border-radius: 50%;
  animation: rotate 4s linear infinite;
}

.logo-ring::after {
  content: '';
  position: absolute;
  top: -4px;
  left: 50%;
  width: 8px;
  height: 8px;
  background: #6366f1;
  border-radius: 50%;
  box-shadow: 0 0 10px #6366f1;
}

.splash-title {
  font-size: 32px;
  font-weight: 700;
  letter-spacing: 2px;
  margin: 0;
  background: linear-gradient(135deg, #f8fafc 0%, #94a3b8 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
}

.status-area {
  width: 100%;
}

.progress-bar-wrap {
  width: 100%;
  height: 4px;
  background: rgba(248, 250, 252, 0.1);
  border-radius: 2px;
  margin-bottom: 16px;
  overflow: hidden;
}

.progress-bar-fill {
  height: 100%;
  background: linear-gradient(90deg, #6366f1, #a855f7);
  transition: width 0.3s ease-out;
  box-shadow: 0 0 10px rgba(99, 102, 241, 0.5);
}

.status-text-wrap {
  height: 20px;
  display: flex;
  justify-content: center;
}

.status-text {
  font-size: 14px;
  color: #94a3b8;
  letter-spacing: 1px;
}

.footer-hint {
  position: absolute;
  bottom: -100px;
  display: flex;
  align-items: center;
  gap: 8px;
  color: #475569;
  font-size: 12px;
}

.spinner-small {
  width: 12px;
  height: 12px;
  border: 1.5px solid rgba(71, 85, 105, 0.2);
  border-top-color: #475569;
  border-radius: 50%;
  animation: rotate 1s linear infinite;
}

@keyframes pulse {
  0%, 100% { transform: scale(1); opacity: 0.1; }
  50% { transform: scale(1.2); opacity: 0.2; }
}

@keyframes rotate {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

.status-fade-enter-active,
.status-fade-leave-active {
  transition: all 0.3s ease;
}

.status-fade-enter-from {
  opacity: 0;
  transform: translateY(4px);
}

.status-fade-leave-to {
  opacity: 0;
  transform: translateY(-4px);
}
</style>
