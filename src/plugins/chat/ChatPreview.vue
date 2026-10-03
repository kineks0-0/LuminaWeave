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

      <div
        ref="viewportRef"
        class="preview-viewport"
        :data-skin-variant="chatVariant || 'default'"
      >
        <div v-if="showPreviewTopbar" class="preview-topbar">
          <div class="preview-topbar-peer">
            <div v-if="assistantAvatarPlacement === 'topbar'" class="preview-topbar-avatar">A</div>
            <div v-if="userAvatarPlacement === 'topbar'" class="preview-topbar-avatar preview-topbar-avatar--user">U</div>
            <div class="preview-topbar-copy">
              <strong>当前会话</strong>
              <small>{{ assistantShapeLabel }} / {{ userShapeLabel }}</small>
            </div>
          </div>
        </div>
        <!-- 场景1: 排版预览 -->
        <div v-if="activeTab === 'typography'" class="scene-typography">
          <div class="preview-message ai" :data-message-shape="assistantShape" :data-avatar-placement="assistantAvatarPlacement">
            <div v-if="showPreviewAvatar('assistant')" class="preview-avatar" aria-hidden="true">A</div>
            <div class="preview-bubble ai">
              <div class="bubble-content">
                <div v-if="showPreviewMeta('assistant')" class="preview-meta">Assistant</div>
                <p>这是一个<strong>排版预览</strong>示例。你可以观察到<u>字体</u>、<u>字号</u>、<u>行高</u>以及<u>字间距</u>的变化。</p>
                <p>明月出天山，苍茫云海间。长风几万里，吹度玉门关。</p>
              </div>
            </div>
          </div>
          <div class="preview-message user" :data-message-shape="userShape" :data-avatar-placement="userAvatarPlacement">
            <div v-if="showPreviewAvatar('user')" class="preview-avatar preview-avatar--user" aria-hidden="true">U</div>
            <div class="preview-bubble user">
              <div class="bubble-content">
                <div v-if="showPreviewMeta('user')" class="preview-meta">You</div>
                <p>这是一个<strong>排版预览</strong>示例。你可以观察到<u>字体</u>、<u>字号</u>、<u>行高</u>以及<u>字间距</u>的变化。</p>
                <p>用户消息的显示效果也会同步更新。</p>
              </div>
            </div>
          </div>
        </div>

        <!-- 场景2: 流式模拟：与真实聊天共用节奏器（StreamPacer）与渲染管线（TextBlock） -->
        <div v-if="activeTab === 'streaming'" ref="streamingContentRef" class="scene-streaming">
          <div class="sim-dashboard">
            <div class="sim-effects" role="radiogroup" aria-label="流式文本显示效果">
              <button
                v-for="option in effectOptions"
                :key="option.value"
                type="button"
                role="radio"
                :aria-checked="simConfig.effect === option.value"
                :class="{ active: simConfig.effect === option.value }"
                @click="simConfig.effect = option.value"
              >
                {{ option.label }}
              </button>
            </div>
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
                <input type="checkbox" v-model="simConfig.smooth" /> 平滑输出
              </label>
              <label class="toggle-label">
                <input type="checkbox" v-model="simConfig.autoLoop" /> 自动循环
              </label>
              <button @click="toggleSimulation" class="sim-main-btn" :class="{ running: isSimulating }">
                {{ isSimulating ? '停止模拟' : '开始模拟' }}
              </button>
            </div>
          </div>

          <div class="preview-message ai" :data-message-shape="assistantShape" :data-avatar-placement="assistantAvatarPlacement">
            <div v-if="showPreviewAvatar('assistant')" class="preview-avatar" aria-hidden="true">A</div>
            <div class="preview-bubble ai streaming" :class="{ 'is-simulating': isSimulating }">
              <div class="bubble-content">
                <div v-if="showPreviewMeta('assistant')" class="preview-meta">Assistant</div>
                <TextBlock
                  v-if="simulationText"
                  :text="simulationText"
                  :render-fn="renderChatMarkdown"
                  :streaming="isSimulating"
                  :presentation="streamPresentation"
                />
                <div v-else class="placeholder-text">选择效果并启动模拟...</div>
              </div>
            </div>
          </div>

          <div class="sim-live-stats" v-if="isSimulating">
            <span>队列积压: {{ backlogSize }}</span>
            <span>当前帧步长: {{ currentStep }}</span>
          </div>
        </div>
        <LuminaJumpToLatest v-if="activeTab === 'streaming'" :visible="showJumpToLatest" @jump="jumpToLatest" />
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onUnmounted, reactive } from 'vue';
import { useSurfaceRuntimeContext } from '../../platform/surface/useSurfaceRuntimeContext.js';
import { settingsDomainService } from '../../api/services/SettingsDomainService.js';
import { createDefaultFrameScheduler, StreamPacer } from '../../api/core/generation/StreamPacer.js';
import { useMotionPreference } from '../../composables/useMotionPreference.js';
import { useStickToBottom } from '../../composables/useStickToBottom.js';
import LuminaJumpToLatest from '../../ui/primitives/LuminaJumpToLatest.vue';
import TextBlock from './components/blocks/TextBlock.vue';
import { renderChatMarkdown } from './components/chatMarkdown.js';
import { resolveChatStreamingEffect, type ChatStreamingEffect } from './presentation/ChatMessageRenderPreferences.js';
import { resolveChatStreamingPresentation } from './presentation/ChatStreamingPresentation.js';

const isCollapsed = ref(false);
const activeTab = ref<'typography' | 'streaming'>('typography');
const isSimulating = ref(false);
const simulationText = ref('');

const viewportRef = ref<HTMLElement | null>(null);
const streamingContentRef = ref<HTMLElement | null>(null);
const { showJumpToLatest, jumpToLatest } = useStickToBottom(viewportRef, streamingContentRef);
const motionPreference = useMotionPreference(viewportRef);

const fullText = [
  '这就是 LuminaWeave 的**流式模拟实验室**。在这里，你可以模拟各种极端网络环境下的生成效果。',
  '',
  '调高“卡顿概率”后，文字包的到达会变得极不规则，此时可以观察“平滑输出”能否过滤掉这种抖动，维持稳定的出字节奏。',
  '',
  '- 淡入：新到的文字短暂淡入',
  '- GPT 风格：最新的文字带一段柔和的渐显拖尾',
  '- 打字机：匀速出字，光标跟在文末'
].join('\n');

const effectOptions: ReadonlyArray<{ value: ChatStreamingEffect; label: string }> = [
  { value: 'instant', label: '即时' },
  { value: 'fade-in', label: '淡入' },
  { value: 'gpt-style', label: 'GPT 风格' },
  { value: 'typewriter', label: '打字机' }
];

const readNumberSetting = (key: string, fallback: number): number => {
  const value = Number(settingsDomainService.getEffectiveValue(key));
  return Number.isFinite(value) && value > 0 ? value : fallback;
};

const simConfig = reactive({
  effect: resolveChatStreamingEffect(settingsDomainService.getEffectiveValue('lumina-chat.streamingEffect')),
  chunkSize: 5,
  stutterChance: 10,
  smooth: true,
  smoothnessFactor: readNumberSetting('lumina-chat.streamingSmoothnessFactor', 2),
  maxSpeed: readNumberSetting('lumina-chat.streamingMaxSpeed', 20),
  autoLoop: false
});

const streamPresentation = computed(() => resolveChatStreamingPresentation(simConfig.effect, motionPreference.value));

const frameScheduler = createDefaultFrameScheduler();
const pacer = new StreamPacer({ speedFactor: 2, maxCharsPerFrame: 20 });
const currentStep = ref(0);
const backlogSize = ref(0);
let cancelFrame: (() => void) | null = null;
let chunkTimer: ReturnType<typeof setInterval> | null = null;
let loopTimer: ReturnType<typeof setTimeout> | null = null;
let backlog = '';
let charIndex = 0;
const surfaceContext = useSurfaceRuntimeContext('chat.preview');
const chatVariant = computed(() => surfaceContext.value.theme.variant || 'default');

const previewStyle = computed<Record<string, string | number>>(() => {
  return {
    ...(surfaceContext.value.theme.tokens || {}),
    ...(surfaceContext.value.theme.cssVars || {})
  };
});

const assistantShape = computed(() => String(previewStyle.value['--lw-chat-preview-assistant-shape'] || 'bubble'));
const userShape = computed(() => String(previewStyle.value['--lw-chat-preview-user-shape'] || 'bubble'));
const assistantAvatarPlacement = computed(() => String(previewStyle.value['--lw-chat-preview-assistant-avatar-placement'] || 'inline'));
const userAvatarPlacement = computed(() => String(previewStyle.value['--lw-chat-preview-user-avatar-placement'] || 'inline'));
const showPreviewTopbar = computed(() => assistantAvatarPlacement.value === 'topbar' || userAvatarPlacement.value === 'topbar');
const assistantShapeLabel = computed(() => assistantShape.value === 'document' ? 'AI 文档' : 'AI 气泡');
const userShapeLabel = computed(() => userShape.value === 'document' ? '用户文档' : '用户气泡');

const showPreviewAvatar = (role: 'assistant' | 'user'): boolean => {
  const placement = role === 'assistant' ? assistantAvatarPlacement.value : userAvatarPlacement.value;
  return placement === 'inline';
};

const showPreviewMeta = (role: 'assistant' | 'user'): boolean => {
  const placement = role === 'assistant' ? assistantAvatarPlacement.value : userAvatarPlacement.value;
  const shape = role === 'assistant' ? assistantShape.value : userShape.value;
  return placement !== 'hidden' && placement !== 'topbar' && shape !== 'document';
};

const toggleSimulation = (): void => {
  if (isSimulating.value) {
    stopSimulation();
  } else {
    startSimulation();
  }
};

const finishOrLoop = (): void => {
  if (simConfig.autoLoop) {
    stopSimulation();
    loopTimer = setTimeout(startSimulation, 1000);
    return;
  }
  stopSimulation();
};

const runFrame = (): void => {
  cancelFrame = null;
  const arrivalsDone = charIndex >= fullText.length;
  if (backlog.length > 0) {
    const step = pacer.take(frameScheduler.now(), backlog.length, arrivalsDone);
    currentStep.value = step;
    simulationText.value += backlog.slice(0, step);
    backlog = backlog.slice(step);
    backlogSize.value = backlog.length;
  } else if (arrivalsDone) {
    finishOrLoop();
    return;
  }
  cancelFrame = frameScheduler.request(runFrame);
};

const startSimulation = (): void => {
  stopSimulation();
  isSimulating.value = true;
  simulationText.value = '';
  backlog = '';
  backlogSize.value = 0;
  charIndex = 0;

  // 打字机效果在真实聊天中会强制开启平滑节奏，这里保持一致
  const paced = simConfig.smooth || simConfig.effect === 'typewriter';
  pacer.setConfig({ speedFactor: simConfig.smoothnessFactor, maxCharsPerFrame: simConfig.maxSpeed });
  pacer.reset(frameScheduler.now());

  // 分块大小和卡顿概率作为网络到达节奏的输入
  chunkTimer = setInterval(() => {
    if (charIndex >= fullText.length) {
      if (chunkTimer !== null) {
        clearInterval(chunkTimer);
        chunkTimer = null;
      }
      if (!paced) finishOrLoop();
      return;
    }
    if (Math.random() * 100 < simConfig.stutterChance) return;

    const chunk = fullText.substring(charIndex, charIndex + simConfig.chunkSize);
    charIndex += simConfig.chunkSize;
    if (paced) {
      backlog += chunk;
      backlogSize.value = backlog.length;
    } else {
      simulationText.value += chunk;
    }
  }, 100);

  if (paced) cancelFrame = frameScheduler.request(runFrame);
};

const stopSimulation = (): void => {
  isSimulating.value = false;
  cancelFrame?.();
  cancelFrame = null;
  if (chunkTimer !== null) {
    clearInterval(chunkTimer);
    chunkTimer = null;
  }
  if (loopTimer !== null) {
    clearTimeout(loopTimer);
    loopTimer = null;
  }
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
  font-size: var(--lw-type-title-small-size);
  line-height: var(--lw-type-title-small-line-height);
  font-weight: var(--lw-type-title-small-weight);
  letter-spacing: var(--lw-type-title-small-tracking);
  color: #475569;
}

.collapse-btn {
  background: #f1f5f9;
  border: 1px solid #e2e8f0;
  padding: 4px 10px;
  border-radius: 6px;
  font-size: var(--lw-type-label-small-size);
  line-height: var(--lw-type-label-small-line-height);
  font-weight: var(--lw-type-label-small-weight);
  letter-spacing: var(--lw-type-label-small-tracking);
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
  font-size: var(--lw-type-label-medium-size);
  line-height: var(--lw-type-label-medium-line-height);
  font-weight: var(--lw-type-label-medium-weight);
  letter-spacing: var(--lw-type-label-medium-tracking);
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
  background: var(--lw-chat-preview-bg, var(--lw-bg-subtle));
  color: var(--lw-chat-preview-text-color, var(--lw-text-main));
}

.preview-topbar {
  display: flex;
  justify-content: flex-start;
  margin-bottom: 16px;
}

.preview-topbar-peer {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  padding: 8px 12px;
  border-radius: 14px;
  background: color-mix(in srgb, var(--lw-chat-preview-bubble-bg, var(--lw-bg-surface)) 78%, transparent);
  border: 1px solid rgba(0, 0, 0, 0.06);
}

.preview-topbar-copy {
  display: flex;
  flex-direction: column;
  gap: 1px;
}

.preview-topbar-copy strong {
  font-size: var(--lw-type-title-small-size);
  line-height: var(--lw-type-title-small-line-height);
  font-weight: var(--lw-type-title-small-weight);
  letter-spacing: var(--lw-type-title-small-tracking);
}

.preview-topbar-copy small {
  font-size: var(--lw-type-body-small-size);
  line-height: var(--lw-type-body-small-line-height);
  font-weight: var(--lw-type-body-small-weight);
  letter-spacing: var(--lw-type-body-small-tracking);
  color: var(--lw-text-secondary);
}

.preview-topbar-avatar,
.preview-avatar {
  width: 28px;
  height: 28px;
  border-radius: var(--lw-chat-preview-avatar-radius, 999px);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: var(--lw-type-label-small-size);
  line-height: var(--lw-type-label-small-line-height);
  font-weight: var(--lw-type-title-small-weight);
  letter-spacing: var(--lw-type-label-small-tracking);
  color: var(--lw-primary);
  background: color-mix(in srgb, var(--lw-primary) 14%, var(--lw-chat-preview-bubble-bg, var(--lw-bg-surface)));
  flex-shrink: 0;
}

.preview-topbar-avatar--user,
.preview-avatar--user {
  color: var(--lw-text-secondary);
  background: color-mix(in srgb, var(--lw-text-muted) 18%, var(--lw-chat-preview-user-bubble-bg, var(--lw-bg-hover)));
}

.preview-message {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  max-width: 100%;
  margin-bottom: 12px;
}

.preview-message.user {
  justify-content: flex-end;
  flex-direction: row-reverse;
}

.preview-bubble {
  max-width: 85%;
  padding: var(--lw-chat-preview-padding, 12px 16px);
  border-radius: var(--lw-chat-preview-bubble-radius, 12px);
  font-family: var(--lw-chat-preview-font, var(--lw-font-main)), sans-serif;
  font-weight: var(--lw-chat-preview-font-weight, 400);
  font-size: var(--lw-current-preview-font-size, var(--lw-chat-preview-font-size, 16px));
  line-height: var(--lw-current-preview-line-height, var(--lw-chat-preview-line-height, 1.6));
  letter-spacing: var(--lw-current-preview-letter-spacing, var(--lw-chat-preview-letter-spacing, 0px));
  color: var(--lw-chat-preview-text-color, var(--lw-text-main));
  background: var(--lw-chat-preview-bubble-bg, var(--lw-bg-surface));
  border: 1px solid rgba(0,0,0,0.05);
  box-shadow: 0 2px 4px rgba(0,0,0,0.02);
}

.preview-bubble.ai {
  --lw-current-preview-font-size: var(--lw-chat-preview-assistant-font-size, var(--lw-chat-preview-font-size, 16px));
  --lw-current-preview-line-height: var(--lw-chat-preview-assistant-line-height, var(--lw-chat-preview-line-height, 1.6));
  --lw-current-preview-letter-spacing: var(--lw-chat-preview-assistant-letter-spacing, var(--lw-chat-preview-letter-spacing, 0px));
  align-self: flex-start;
}

.preview-bubble.user {
  --lw-current-preview-font-size: var(--lw-chat-preview-user-font-size, var(--lw-chat-preview-font-size, 16px));
  --lw-current-preview-line-height: var(--lw-chat-preview-user-line-height, var(--lw-chat-preview-line-height, 1.6));
  --lw-current-preview-letter-spacing: var(--lw-chat-preview-user-letter-spacing, var(--lw-chat-preview-letter-spacing, 0px));
  align-self: flex-end;
  background: var(--lw-chat-preview-user-bubble-bg, #f1f5f9);
}

.preview-meta {
  margin-bottom: 6px;
  font-size: var(--lw-type-label-small-size);
  line-height: var(--lw-type-label-small-line-height);
  font-weight: var(--lw-type-label-small-weight);
  letter-spacing: var(--lw-type-label-small-tracking);
  color: var(--lw-text-secondary);
}

.preview-message[data-message-shape='document'] .preview-bubble {
  background: transparent !important;
  border: none !important;
  box-shadow: none !important;
  padding: 0 !important;
  max-width: 100% !important;
  border-radius: 0;
}

.preview-message[data-message-shape='document'] {
  justify-content: flex-start;
  flex-direction: row;
}

.preview-message[data-message-shape='document'][data-avatar-placement='hidden'] .preview-avatar,
.preview-message[data-message-shape='document'][data-avatar-placement='topbar'] .preview-avatar,
.preview-message[data-message-shape='document'][data-avatar-placement='rail'] .preview-avatar {
  display: none;
}

.preview-message[data-avatar-placement='hidden'] .preview-avatar,
.preview-message[data-avatar-placement='topbar'] .preview-avatar,
.preview-message[data-avatar-placement='rail'] .preview-avatar {
  display: none;
}

.bubble-content p { margin: 0 0 var(--lw-chat-preview-paragraph-spacing, 16px) 0; }
.bubble-content p:last-child { margin-bottom: 0; }

/* 模拟控制面板 */
.sim-effects {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.sim-effects button {
  height: 28px;
  padding: 0 12px;
  border: 1px solid var(--lw-border-base);
  border-radius: 999px;
  background: transparent;
  color: var(--lw-text-secondary);
  font-family: var(--lw-font-main);
  font-size: var(--lw-type-label-medium-size);
  line-height: var(--lw-type-label-medium-line-height);
  font-weight: var(--lw-type-label-medium-weight);
  cursor: pointer;
  transition: background var(--lw-transition), color var(--lw-transition), border-color var(--lw-transition);
}

.sim-effects button.active {
  border-color: var(--lw-primary);
  background: color-mix(in srgb, var(--lw-primary) 10%, transparent);
  color: var(--lw-primary);
}

.sim-dashboard {
  background: var(--lw-bg-subtle);
  border: 1px solid var(--lw-border-base);
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
  font-size: var(--lw-type-body-small-size);
  line-height: var(--lw-type-body-small-line-height);
  font-weight: var(--lw-type-body-small-weight);
  letter-spacing: var(--lw-type-body-small-tracking);
  color: var(--lw-text-secondary);
}

.sim-param label { width: 85px; font-weight: var(--lw-type-label-medium-weight); }
.sim-param input[type="range"] { flex: 1; accent-color: var(--lw-primary); height: 4px; }
.sim-param span { min-width: 35px; text-align: right; font-family: var(--lw-font-mono); }
.sim-param.flex-row { justify-content: space-between; margin-top: 4px; border-top: 1px dashed var(--lw-border-base); padding-top: 8px; }

.toggle-label { display: flex; align-items: center; gap: 6px; cursor: pointer; }

.sim-main-btn {
  background: var(--lw-primary);
  color: white;
  border: none;
  padding: 5px 14px;
  border-radius: 4px;
  font-size: var(--lw-type-label-small-size);
  line-height: var(--lw-type-label-small-line-height);
  font-weight: var(--lw-type-label-small-weight);
  letter-spacing: var(--lw-type-label-small-tracking);
  cursor: pointer;
  transition: 0.2s;
}

.sim-main-btn.running { background: var(--lw-text-secondary); }

.sim-live-stats {
  margin-top: 8px;
  font-family: var(--lw-font-mono);
  font-size: var(--lw-type-label-small-size);
  line-height: var(--lw-type-label-small-line-height);
  font-weight: var(--lw-type-label-small-weight);
  letter-spacing: var(--lw-type-label-small-tracking);
  color: var(--lw-text-muted);
  display: flex;
  gap: 16px;
  justify-content: center;
}

.placeholder-text {
  color: var(--lw-text-muted);
  font-style: italic;
  font-size: var(--lw-type-body-medium-size);
  line-height: var(--lw-type-body-medium-line-height);
  font-weight: var(--lw-type-body-medium-weight);
  letter-spacing: var(--lw-type-body-medium-tracking);
  text-align: center;
  padding: 20px 0;
}

.preview-viewport[data-skin-variant='discord'] .preview-bubble {
  max-width: 100%;
  border-color: var(--lw-border-base);
  box-shadow: none;
}
</style>
