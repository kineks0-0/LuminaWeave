<template>
  <div class="chat-preview-container" :class="{ collapsed: isCollapsed }" :style="previewStyle">
    <!-- 头部控制栏 -->
    <div class="preview-header">
      <div class="header-left">
        <svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" stroke-width="2" fill="none">
          <path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7" />
        </svg>
        <span>实时效果预览</span>
      </div>
      <div class="header-actions">
        <button class="collapse-btn" @click="isCollapsed = !isCollapsed">
          {{ isCollapsed ? '展开预览' : '收起' }}
          <svg :class="{ rotate: isCollapsed }" viewBox="0 0 24 24" width="12" height="12" stroke="currentColor" stroke-width="2" fill="none">
            <polyline points="18 15 12 9 6 15"></polyline>
          </svg>
        </button>
      </div>
    </div>

    <template v-if="!isCollapsed">
      <div class="preview-tabs">
        <button :class="{ active: activeTab === 'typography' }" @click="activeTab = 'typography'">排版预览</button>
        <button :class="{ active: activeTab === 'streaming' }" @click="activeTab = 'streaming'">流式实验室</button>
      </div>

      <div ref="viewportRef" class="preview-viewport" :class="[activeSettings['lumina-chat.theme'], { 'doc-mode': activeSettings['lumina-chat.viewMode'] === 'document' }]">
        <!-- 场景1: 排版预览 -->
        <div v-if="activeTab === 'typography'" class="scene-typography">
          <div class="preview-bubble ai">
            <div class="bubble-content">
              <p>这是一个<strong>排版预览</strong>示例。你可以观察到<u>字体</u>、<u>字号</u>、<u>行高</u>以及<u>字间距</u>的变化。</p>
              <p>明月出天山，苍茫云海间。长风几万里，吹度玉门关。</p>
            </div>
          </div>
          <div class="preview-bubble user">
            <div class="bubble-content">
              <p>用户消息的显示效果也会同步更新。</p>
            </div>
          </div>
        </div>

        <!-- 场景2: 流式模拟 -->
        <div v-if="activeTab === 'streaming'" class="scene-streaming">
          <!-- 实验性参数控制 -->
          <div class="sim-dashboard">
            <div class="sim-param">
              <label>原始流速 (字/块)</label>
              <input type="range" min="1" max="20" step="1" v-model.number="simConfig.chunkSize" />
              <span>{{ simConfig.chunkSize }}</span>
            </div>
            <div class="sim-param">
              <label>卡顿概率 (%)</label>
              <input type="range" min="0" max="90" step="5" v-model.number="simConfig.stutterChance" />
              <span>{{ simConfig.stutterChance }}%</span>
            </div>
            <div class="sim-param flex-row">
              <label class="toggle-label">
                <input type="checkbox" v-model="simConfig.autoLoop" /> 自动循环
              </label>
              <button @click="toggleSimulation" class="sim-main-btn" :class="{ running: isSimulating }">
                {{ isSimulating ? '停止模拟' : '开始模拟' }}
              </button>
            </div>
          </div>

          <div class="preview-bubble ai streaming" :class="{ 'is-simulating': isSimulating }">
            <div class="bubble-content">
              <p v-if="simulationText" v-html="renderText(simulationText)"></p>
              <div v-else class="placeholder-text">配置上方参数并启动模拟...</div>
              <!-- 模拟光标 -->
              <span v-if="isSimulating" class="sim-cursor"></span>
            </div>
          </div>
          
          <div class="sim-live-stats" v-if="isSimulating">
             <span>队列积压: {{ queue.length }}</span>
             <span>当前帧步长: {{ currentStep }}</span>
          </div>
        </div>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onUnmounted, reactive, watch, nextTick } from 'vue';
import { activeSettings } from '../settings/useSettings';

const isCollapsed = ref(false);
const activeTab = ref<'typography' | 'streaming'>('typography');
const isSimulating = ref(false);
const simulationText = ref('');

const viewportRef = ref<HTMLElement | null>(null);

// 自动滚动到底部
watch(simulationText, async () => {
  if (viewportRef.value && activeTab.value === 'streaming') {
    await nextTick();
    viewportRef.value.scrollTop = viewportRef.value.scrollHeight;
  }
});
const fullText = "这就是 LuminaWeave 的流式模拟实验室。在这里，你可以模拟各种极端网络环境下的生成效果。比如，当你调高“卡顿概率”后，你会发现文字包的到达变得极不规则，此时你可以观察下方的“流式输出平滑”设置能否有效地过滤掉这种抖动，维持一个优雅的出字节奏。如果是长文本瞬间爆发，我们的“最高限速”逻辑则会确保文字不会瞬间刷屏，维持阅读的连贯性。";

const simConfig = reactive({
  chunkSize: 5,
  stutterChance: 10,
  autoLoop: false
});

const currentStep = ref(0);
let simTimer: any = null;
let chunkTimer: any = null;
let buffer = '';
let queue: string[] = [];
let charIndex = 0;

const previewStyle = computed(() => {
  return {
    '--lw-preview-font': activeSettings['lumina-chat.fontFamily'] || 'sans-serif',
    '--lw-preview-size': (activeSettings['lumina-chat.fontSize'] || 16) + 'px',
    '--lw-preview-lh': activeSettings['lumina-chat.lineHeight'] || 1.6,
    '--lw-preview-ps': (activeSettings['lumina-chat.paragraphSpacing'] || 16) + 'px',
    '--lw-preview-ls': (activeSettings['lumina-chat.letterSpacing'] || 0) + 'px',
    '--lw-preview-weight': activeSettings['lumina-chat.fontWeight'] || 400,
  };
});

const renderText = (text: string) => {
  return text.split('\n').map(p => `<p>${p}</p>`).join('');
};

const toggleSimulation = () => {
  if (isSimulating.value) {
    stopSimulation();
  } else {
    startSimulation();
  }
};

const startSimulation = () => {
  stopSimulation(); // 先清理
  isSimulating.value = true;
  simulationText.value = '';
  buffer = '';
  queue = [];
  charIndex = 0;
  
  const isSmooth = activeSettings['lumina-chat.streamingSmoothness'];
  const smoothness = activeSettings['lumina-chat.streamingSmoothnessFactor'] || 2;

  // 模拟 Chunk 到达逻辑 (受 chunkSize 和 stutterChance 影响)
  chunkTimer = setInterval(() => {
    if (charIndex >= fullText.length) {
      clearInterval(chunkTimer);
      return;
    }

    // 模拟由于网络阻塞产生的随机卡顿
    if (Math.random() * 100 < simConfig.stutterChance) {
        return; // 本次跳过，模拟卡顿
    }

    const len = simConfig.chunkSize;
    const chunk = fullText.substring(charIndex, charIndex + len);
    charIndex += len;
    
    buffer += chunk;
    if (isSmooth) {
      for (const char of chunk) {
        queue.push(char);
      }
    } else {
      simulationText.value = buffer;
    }
  }, 100);

  // 模拟平滑渲染 (50fps)
  simTimer = setInterval(() => {
    if (isSmooth && queue.length > 0) {
        let step = Math.ceil(queue.length / (8 - smoothness));
        if (queue.length > 50) step = Math.max(step, 2);
        const maxSpeed = activeSettings['lumina-chat.streamingMaxSpeed'] || 20;
        step = Math.min(step, maxSpeed); // 限速保护
        currentStep.value = step;
        
        const batch = queue.splice(0, step).join('');
        simulationText.value += batch;
    } else if (!isSmooth) {
        // 非平滑模式下，直接检查是否结束且循环
    }

    // 检测是否完成并处理循环
    if (charIndex >= fullText.length && (isSmooth ? queue.length === 0 : true)) {
        if (simConfig.autoLoop) {
            setTimeout(startSimulation, 1000); // 1秒后自动重起
            clearInterval(simTimer);
            clearInterval(chunkTimer);
        } else {
            stopSimulation();
        }
    }
  }, 20);
};

const stopSimulation = () => {
  isSimulating.value = false;
  clearInterval(simTimer);
  clearInterval(chunkTimer);
};

onUnmounted(stopSimulation);

</script>

<style scoped>
.chat-preview-container {
  border-radius: 12px;
  overflow: hidden;
  margin-bottom: 4px;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  background: var(--lw-bg-surface);
  border: 1px solid var(--lw-border-base);
  box-shadow: var(--lw-shadow);
}

.chat-preview-container.collapsed {
  margin-bottom: 12px;
}

.preview-header {
  padding: 10px 16px;
  background: #f8fafc;
  display: flex;
  justify-content: space-between;
  align-items: center;
  border-bottom: 1px solid #e2e8f0;
}

.header-left {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  font-weight: 600;
  color: #475569;
}

.collapse-btn {
  background: #f1f5f9;
  border: 1px solid #e2e8f0;
  padding: 4px 10px;
  border-radius: 6px;
  font-size: 11px;
  color: #64748b;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 6px;
  transition: 0.2s;
}

.collapse-btn:hover { background: #e2e8f0; color: #1e293b; }
.collapse-btn svg { transition: transform 0.3s; }
.collapse-btn svg.rotate { transform: rotate(180deg); }

.preview-tabs {
  display: flex;
  background: #f1f5f9;
  padding: 4px;
  gap: 4px;
  border-bottom: 1px solid #e2e8f0;
}

.preview-tabs button {
  flex: 1;
  border: none;
  background: transparent;
  padding: 6px;
  font-size: 12px;
  font-weight: 600;
  color: #64748b;
  cursor: pointer;
  border-radius: 6px;
  transition: 0.2s;
}

.preview-tabs button.active {
  background: #ffffff;
  color: var(--lw-primary, var(--lw-primary));
  box-shadow: 0 1px 2px rgba(0,0,0,0.05);
}

.preview-viewport {
  padding: 20px;
  min-height: 180px;
  max-height: 320px;
  overflow-y: auto;
}

.preview-viewport.gray { background: #f8fafc; --bubble-bg: #ffffff; --text-color: #1e293b; }
.preview-viewport.warm { background: #fffbf0; --bubble-bg: #ffffff; --text-color: #433422; --user-bg: #fef3c7; }
.preview-viewport.dark { background: #0f172a; --bubble-bg: #1e293b; --text-color: #f8fafc; --user-bg: #334155; }

.preview-bubble {
  max-width: 85%;
  padding: 12px 16px;
  border-radius: 12px;
  margin-bottom: 12px;
  font-family: var(--lw-preview-font), sans-serif;
  font-weight: var(--lw-preview-weight, 400);
  font-size: var(--lw-preview-size);
  line-height: var(--lw-preview-lh);
  letter-spacing: var(--lw-preview-ls);
  color: var(--text-color);
  background: var(--bubble-bg);
  border: 1px solid rgba(0,0,0,0.05);
  box-shadow: 0 2px 4px rgba(0,0,0,0.02);
}

.preview-bubble.ai { align-self: flex-start; }
.preview-bubble.user { align-self: flex-end; background: var(--user-bg, #f1f5f9); margin-left: auto; }

/* Document Mode overrides */
.preview-viewport.doc-mode {
  padding: 24px 40px;
}

.preview-viewport.doc-mode .scene-typography,
.preview-viewport.doc-mode .scene-streaming {
  display: flex;
  flex-direction: column;
}

.preview-viewport.doc-mode .preview-bubble {
  background: transparent !important;
  border: none !important;
  box-shadow: none !important;
  padding: 0 !important;
  max-width: 100% !important;
  margin-bottom: var(--lw-preview-ps) !important;
  border-radius: 0;
}

.preview-viewport.doc-mode .preview-bubble.user {
  margin-left: 0 !important;
  align-self: flex-start !important;
}

.bubble-content p { margin: 0 0 var(--lw-preview-ps) 0; }
.bubble-content p:last-child { margin-bottom: 0; }

/* Dashboard */
.sim-dashboard {
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  padding: 12px;
  margin-bottom: 16px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.sim-param {
  display: flex;
  align-items: center;
  gap: 12px;
  font-size: 11px;
  color: #64748b;
}

.sim-param label { width: 85px; font-weight: 600; }
.sim-param input[type="range"] { flex: 1; accent-color: var(--lw-primary); height: 4px; }
.sim-param span { min-width: 35px; text-align: right; font-family: monospace; }
.sim-param.flex-row { justify-content: space-between; margin-top: 4px; border-top: 1px dashed #e2e8f0; padding-top: 8px; }

.toggle-label { display: flex; align-items: center; gap: 6px; cursor: pointer; }

.sim-main-btn {
  background: var(--lw-primary);
  color: white;
  border: none;
  padding: 5px 14px;
  border-radius: 4px;
  font-size: 11px;
  font-weight: 600;
  cursor: pointer;
  transition: 0.2s;
}

.sim-main-btn.running { background: #ef4444; }

.sim-live-stats {
  margin-top: 8px;
  font-family: monospace;
  font-size: 10px;
  color: #94a3b8;
  display: flex;
  gap: 16px;
  justify-content: center;
}

.sim-cursor {
  display: inline-block;
  width: 2px;
  height: 1.2em;
  background: var(--lw-primary);
  vertical-align: middle;
  margin-left: 2px;
  animation: blink 0.8s infinite;
}

@keyframes blink { 0%, 100% { opacity: 1; } 50% { opacity: 0; } }

.placeholder-text {
  color: #cbd5e1;
  font-style: italic;
  font-size: 13px;
  text-align: center;
  padding: 20px 0;
}
</style>
