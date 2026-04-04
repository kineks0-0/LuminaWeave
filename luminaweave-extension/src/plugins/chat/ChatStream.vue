<template>
  <div class="lw-chat-stream" :class="{ 'doc-mode': activeSettings['lumina-chat.viewMode'] === 'document' }"
    :style="streamStyle">
    <div class="chat-scroll-area" ref="chatScrollArea" @wheel.stop @scroll="handleScroll">
      <div class="chat-content-wrapper" :style="msgMaxWidthStyle">
        <!-- 临时插标物：章节线 -->
        <div class="chat-chapter-divider" v-if="messages.length > 0">
          <div class="chip">
            <svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" stroke-width="2" fill="none">
              <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path>
              <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"></path>
            </svg>
            第一章：最初的相遇
          </div>
        </div>

        <div v-for="(msg, index) in messages" :key="index" class="chat-msg" :class="{ 'user': msg.is_user }">
          <div class="msg-avatar">
            <img :src="msg.avatarUrl" class="avatar-img" :alt="msg.name"
              @error="(e) => (e.target as any).src = lwApi?.DEFAULT_AVATAR">
          </div>
          <div class="msg-content">
            <div class="msg-meta">
              <span class="msg-name">{{ msg.name }}</span>
              <span class="msg-info" v-if="!msg.is_user">分支 A-1</span>
            </div>
            <!-- 内联编辑模式 -->
            <template v-if="editingIndex === index">
              <div class="msg-edit-wrap">
                <textarea class="msg-edit-textarea" v-model="editingText" rows="4" autofocus
                  @keydown.ctrl.enter="confirmEdit" @keydown.esc="editingIndex = -1"></textarea>
                <div class="msg-edit-actions-row">
                  <div class="edit-tip">Ctrl + Enter 确认，Esc 取消</div>
                  <div class="edit-btns">
                    <button class="edit-cancel-btn" @click="editingIndex = -1">取消</button>
                    <button class="edit-confirm-btn" @click="confirmEdit">保存修改</button>
                  </div>
                </div>
              </div>
            </template>
            <!-- 正常显示模式 -->
            <template v-else>
              <div class="msg-bubble">
                  <!-- AI 消息使用 MessageRenderer 支持 <V> 块组件渲染 -->
                  <MessageRenderer v-if="!msg.is_user" 
                    :mes="msg.mes" 
                    :mesRaw="msg.mesRaw" 
                    :pluginRaw="msg.pluginRaw" 
                    :renderMarkdown="renderMarkdown" />
                  <div v-else v-html="renderMarkdown(msg.mes)"></div>
                <!-- 动作栏内置于消息框底部常驻 -->
                <div class="msg-actions" v-if="!msg.is_user">
                  <button title="编辑 (Edit)" @click="handleEdit(index, msg)">
                    <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="2" fill="none">
                      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                    </svg>
                  </button>
                  <button title="重新生成 (Regenerate)" @click="handleRegen()">
                    <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="2" fill="none">
                      <polyline points="23 4 23 10 17 10"></polyline>
                      <polyline points="1 20 1 14 7 14"></polyline>
                      <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path>
                    </svg>
                  </button>
                  <button title="从此分支世界线" @click="handleBranch(index, msg)">
                    <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="2" fill="none">
                      <line x1="12" y1="19" x2="12" y2="12"></line>
                      <line x1="12" y1="12" x2="19" y2="5"></line>
                      <line x1="12" y1="12" x2="5" y2="5"></line>
                      <polyline points="15 5 19 5 19 9"></polyline>
                      <polyline points="9 5 5 5 5 9"></polyline>
                    </svg>
                  </button>
                  <button title="删除 (Delete)" @click="handleDelete(index, msg)" class="delete-btn">
                    <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="2" fill="none">
                      <polyline points="3 6 5 6 21 6"></polyline>
                      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                    </svg>
                  </button>
                </div>
                <!-- 用户自己消息的动作栏 -->
                <div class="msg-actions" v-else>
                  <button title="编辑 (Edit)" @click="handleEdit(index, msg)">
                    <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="2" fill="none">
                      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                    </svg>
                  </button>
                  <button title="删除 (Delete)" @click="handleDelete(index, msg)" class="delete-btn">
                    <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="2" fill="none">
                      <polyline points="3 6 5 6 21 6"></polyline>
                      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                    </svg>
                  </button>
                </div>
              </div>
            </template>
          </div>
        </div>
        <!-- 流式 buffer 气泡：在生成过程中显示当前返回的实时文本 -->
        <div class="chat-msg streaming-msg" v-if="isGenerating || streamingBuffer || generationError">
          <div class="msg-avatar">
            <div class="streaming-avatar">
              <svg viewBox="0 0 24 24" width="18" height="18" stroke="currentColor" stroke-width="2" fill="none">
                <circle cx="12" cy="12" r="10"></circle>
                <path d="M8 12h.01"></path>
                <path d="M12 12h.01"></path>
                <path d="M16 12h.01"></path>
              </svg>
            </div>
          </div>
          <div class="msg-content">
            <div class="msg-bubble streaming-bubble">
              <!-- 核心变更：流式显示提纯后的内容 (streamingBuffer) 而非原始流 (streamingRaw) -->
              <div class="msg-text" v-if="streamingBuffer" :class="effectClass">
                <MessageRenderer :mesRaw="streamingBuffer" :renderMarkdown="renderMarkdown" :isStreaming="true" />
                <span class="typing-cursor">|</span>
              </div>

              <!-- 当正文为空但有状态或已过滤内容时，展示显著的状态占位符 -->
              <div class="streaming-status-placeholder" v-if="!streamingBuffer && (streamingStatusText || streamingFilteredLength > 0) && !generationError">
                <div class="status-pulse"></div>
                <span class="status-label">{{ streamingStatusText || '正在处理内容...' }}</span>
                <span class="status-count" v-if="streamingFilteredLength > 0">(已过滤 {{ streamingFilteredLength }} 字)</span>
              </div>

              <div class="typing-indicator" v-else-if="!streamingBuffer && !generationError && !streamingStatusText">
                <span></span><span></span><span></span>
              </div>

              <div class="stream-error" v-if="generationError">{{ generationError }}</div>
              
              <!-- 辅助信息行（仅在有正文时作为底部栏显示） -->
              <div class="streaming-meta-info" v-if="(streamingFilteredLength > 0 || streamingStatusText) && streamingBuffer">
                <span class="meta-item status" v-if="streamingStatusText">{{ streamingStatusText }}</span>
                <span class="meta-item filtered" v-if="streamingFilteredLength > 0">已过滤 {{ streamingFilteredLength }} 字</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 提示词查看器展开区域 -->
    <transition name="inspector-slide">
      <div class="prompt-inspector-wrap" v-if="showInspector" :class="{ 'inspector-expanded': inspectorExpanded }">
        <PromptInspector />
      </div>
    </transition>

    <!-- 输入区 -->
    <div class="chat-input-area">
      <div class="input-wrapper">
        <!-- 工具栏行 -->
        <div class="input-toolbar">
          <!-- 展开/收起输入框 -->
          <button class="lw-btn lw-btn-ghost collapse-input-btn" style="padding: 4px; min-width: 28px; height: 28px;"
            @click="inputCollapsed = !inputCollapsed" :title="inputCollapsed ? '展开输入框' : '收起输入框'">
            <svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" stroke-width="2.5" fill="none">
              <polyline :points="inputCollapsed ? '18 9 12 15 6 9' : '18 15 12 9 6 15'"></polyline>
            </svg>
          </button>

          <button v-if="showInspector" class="lw-btn collapse-input-btn"
            :class="inspectorExpanded ? 'lw-btn-primary' : 'lw-btn-ghost'"
            style="padding: 4px; min-width: 28px; height: 28px;" @click="inspectorExpanded = !inspectorExpanded"
            :title="inspectorExpanded ? '收起查看器' : '展开查看器至全屏'">
            <svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" stroke-width="2.5" fill="none">
              <polyline :points="inspectorExpanded ? '18 15 12 9 6 15' : '18 9 12 15 6 9'"></polyline>
            </svg>
          </button>

          <button class="lw-btn" :class="showInspector ? 'lw-btn-primary' : 'lw-btn-secondary'"
            style="font-size: 11px; padding: 4px 10px;" @click="showInspector = !showInspector"
            :title="showInspector ? '隐藏提示词查看器' : '查看/编辑提示词'">
            <svg viewBox="0 0 24 24" width="13" height="13" stroke="currentColor" stroke-width="2" fill="none">
              <circle cx="11" cy="11" r="8"></circle>
              <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
            </svg>
            Prompt 预览
          </button>
        </div>

        <!-- 输入块（可折叠）-->
        <div class="input-container" v-show="!inputCollapsed">
          <textarea v-model="quickInput" id="lw-main-input" @keydown.enter.exact.prevent="handleSend"
            :disabled="isGenerating" placeholder="请输入您的回复或指令... (Enter 发送，Shift+Enter 换行)"></textarea>
          <div class="input-actions">
            <!-- 生成中：显示停止按钮 -->
            <button v-if="isGenerating" class="lw-btn stop-btn"
              style="background: #ef4444; color: white; width: 38px; height: 38px; padding: 0;" @click="handleStop"
              title="停止生成">
              <svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" stroke-width="2.5"
                fill="currentColor">
                <rect x="4" y="4" width="16" height="16" rx="2"></rect>
              </svg>
            </button>
            <!-- 默认：发送按钮 -->
            <button v-else class="lw-btn lw-btn-primary send-btn" style="width: 38px; height: 38px; padding: 0;"
              @click="handleSend" :disabled="!quickInput.trim()" title="发送 (Enter)">
              <svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" stroke-width="2" fill="none">
                <line x1="22" y1="2" x2="11" y2="13"></line>
                <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
              </svg>
            </button>
          </div>
        </div>

      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, inject, nextTick, computed, onMounted, onUnmounted } from 'vue';
import { useSettings } from '../settings/useSettings';
import PromptInspector from './PromptInspector.vue';
import MessageRenderer from './components/MessageRenderer.vue';
import { LuminaWeaveAPI, LuminaChatMessage } from '../../api/index';

interface Props {
  messages: LuminaChatMessage[];
}

const props = withDefaults(defineProps<Props>(), {
  messages: () => []
});

const lwApi = inject<LuminaWeaveAPI>('lwApi');
const { activeSettings } = useSettings();

// === 状态 ===
const quickInput = ref('');
const chatScrollArea = ref<HTMLElement | null>(null);
const showInspector = ref(false);     // 提示词查看器开关
const inspectorExpanded = ref(false); // 展开到全屏模式
const inputCollapsed = ref(false);    // 输入框折叠状态
const isGenerating = ref(lwApi?.isGenerating || false);
const streamingBuffer = ref('');      // 实时流式文本缓冲 (正则处理后)
const streamingRaw = ref('');         // 实时流式文本 (处理前)
const streamingConfirmed = ref('');   // 已确认显示的文本（无动画）
const streamingPending = ref('');     // 本帧新增文本（需要动画）
const streamingFilteredLength = ref(0); // 核心修复：后端计算的过滤字数总额
const streamingStatusText = ref('');  // 当前生成的 XML 标签状态
const generationError = ref('');
const editingIndex = ref(-1);         // 当前内联编辑的消息索引，-1 表示未编辑
const editingText = ref('');          // 内联编辑中的文本
const editingTargetId = ref<string | null>(null);
const lastStreamingHeight = ref(0);   // 上一次流式气泡的测量高度
const isAtBottom = ref(true);         // 响应式追踪是否处于底部

// 流式效果模式
const effectMode = computed(() => {
  return (activeSettings['lumina-chat.streamingEffect'] as string) || 'instant';
});
const effectClass = computed(() => {
  const mode = effectMode.value;
  if (mode === 'fade-in') return 'lw-effect-fade-in';
  if (mode === 'gpt-style') return 'lw-effect-gpt-reveal';
  // typewriter 模式下文本本身不需要额外 class，光标在模板中单独渲染
  return '';
});

// 订阅流式事件
const onGenerationStarted = () => {
  isGenerating.value = true;
  streamingBuffer.value = '';
  streamingRaw.value = '';
  streamingFilteredLength.value = 0; // 重置过滤计数器
  streamingStatusText.value = '';
  generationError.value = '';
  scrollToBottom(true); // 强制触底以适应新出现的消息气泡
};
const onBufferUpdated = (text: string, rawText?: string, filteredCount?: number, statusText?: string, pendingText?: string) => {
  const area = chatScrollArea.value;
  
  if (area && lwApi?.measureService) {
    const fontSize = parseFloat(String(streamStyle.value['--lw-size'])) || 16;
    const lineHeight = (parseFloat(String(streamStyle.value['--lw-line-height'])) || 1.6) * fontSize;
    
    const measureOptions = {
      width: area.clientWidth - 80, 
      lineHeight,
      fontSize,
      fontFamily: String(streamStyle.value['--lw-font']),
      fontWeight: streamStyle.value['--lw-font-weight'],
    };
    
    const result = lwApi.measureService.measure(text, measureOptions);
    lastStreamingHeight.value = result.height;
  }

  streamingBuffer.value = text;
  generationError.value = '';

  // 双层输出拆分：confirmed = 全文减去 pending
  if (pendingText && effectMode.value !== 'instant') {
    streamingConfirmed.value = text.slice(0, text.length - pendingText.length);
    streamingPending.value = pendingText;
  } else {
    // instant 模式或无 pending：全部作为 confirmed
    streamingConfirmed.value = text;
    streamingPending.value = '';
  }

  if (rawText !== undefined) {
    streamingRaw.value = rawText;
  }
  if (filteredCount !== undefined) {
    streamingFilteredLength.value = filteredCount;
  }
  if (statusText !== undefined) {
    streamingStatusText.value = statusText;
  }
  
  // 仅在之前就贴底的情况下跟随滚动
  if (isAtBottom.value) {
    scrollToBottom();
  }
};
const onGenerationEnded = () => {
  console.log('[ChatStream] Generation ended signal received.');
  isGenerating.value = false;
  streamingBuffer.value = ''; // 清除流式气泡，正式消息已由 crud 写入
  streamingRaw.value = '';
  streamingConfirmed.value = '';
  streamingPending.value = '';
  streamingFilteredLength.value = 0;
  streamingStatusText.value = '';
  generationError.value = '';
  // 核心优化：传输完成后不再强制触底，保持用户当前的滚动位置
  // 这样用户在生成过程中向上翻阅时，不会在结束那一瞬间被强制拉回底部
};
const onGenerationFailed = (message?: string) => {
  isGenerating.value = false;
  generationError.value = message || '生成失败，请检查后端节点配置或网络状态。';
  streamingStatusText.value = '';
  if (!streamingBuffer.value) {
    streamingRaw.value = '';
    streamingFilteredLength.value = 0;
  }
};

const onWorldlineChanged = () => {
  console.log('[ChatStream] Worldline changed, resetting generation state.');
  isGenerating.value = false;
  streamingBuffer.value = '';
  streamingRaw.value = '';
  streamingFilteredLength.value = 0;
  streamingStatusText.value = '';
  generationError.value = '';
  scrollToBottom(true);
};

onMounted(() => {
  lwApi?.on('GENERATION_STARTED', onGenerationStarted);
  lwApi?.on('BUFFER_UPDATED', onBufferUpdated);
  lwApi?.on('GENERATION_ENDED', onGenerationEnded);
  lwApi?.on('GENERATION_FAILED', onGenerationFailed);
  lwApi?.on('SCROLL_TO_BOTTOM', (opts: { force?: boolean } = {}) => {
    scrollToBottom(opts.force);
  });
  lwApi?.on('FOCUS_MAIN_INPUT', (data: { text?: string }) => {
    if (data && data.text !== undefined) {
      quickInput.value = data.text;
    }
    inputCollapsed.value = false;
    nextTick(() => {
      const el = document.getElementById('lw-main-input') as HTMLTextAreaElement | null;
      if (el) {
        el.focus();
        // 如果有文本，将光标移至末尾
        if (quickInput.value) {
          el.setSelectionRange(quickInput.value.length, quickInput.value.length);
        }
      }
    });
  });

  // 核心增强：专项响应世界线支路变换
  lwApi?.on('WORLDLINE_SWITCHED', onWorldlineChanged);
  lwApi?.on('WORLDLINE_ROLLED_BACK', onWorldlineChanged);

  // 核心修复：如果正在生成中重新挂载，立即恢复流式状态
  if (lwApi?.isGenerating && lwApi.lastStreamState) {
    isGenerating.value = true;
    const { processed, text, filteredCount, statusText } = lwApi.lastStreamState;
    onBufferUpdated(processed, text, filteredCount, statusText);
  }
});

onUnmounted(() => {
  lwApi?.off('GENERATION_STARTED', onGenerationStarted);
  lwApi?.off('BUFFER_UPDATED', onBufferUpdated);
  lwApi?.off('GENERATION_ENDED', onGenerationEnded);
  lwApi?.off('GENERATION_FAILED', onGenerationFailed);
  lwApi?.off('WORLDLINE_SWITCHED', onWorldlineChanged);
  lwApi?.off('WORLDLINE_ROLLED_BACK', onWorldlineChanged);
});

// 阅读主题变动计算器
const streamStyle = computed(() => {
  const themes: Record<string, any> = {
    gray: { bg: '#f8fafc', color: '#1e293b', bubbleBg: '#ffffff', userBg: '#f8fafc', border: '#f1f5f9', inputBg: '#ffffff' },
    warm: { bg: '#fffbf0', color: '#433422', bubbleBg: '#ffffff', userBg: '#fef3c7', border: '#fde68a', inputBg: '#ffffff' },
    green: { bg: '#f0fdf4', color: '#14532d', bubbleBg: '#ffffff', userBg: '#dcfce7', border: '#bbf7d0', inputBg: '#ffffff' },
    blue: { bg: '#f0f9ff', color: '#0c4a6e', bubbleBg: '#ffffff', userBg: '#e0f2fe', border: '#bae6fd', inputBg: '#ffffff' },
    dark: { bg: '#0f172a', color: '#f8fafc', bubbleBg: '#1e293b', userBg: '#334155', border: '#334155', inputBg: '#1e293b' }
  };
  const curTheme = themes[activeSettings['lumina-chat.theme'] || 'gray'] || themes.gray;
  const fonts: Record<string, string> = {
    'sans-serif': 'Inter, sans-serif',
    'serif': '"Noto Serif CJK SC", "Songti SC", serif',
    'kaiti': '"Kaiti SC", "STKaiti", serif'
  };

  return {
    '--lw-bg': curTheme.bg,
    '--lw-color': curTheme.color,
    '--lw-bubble': curTheme.bubbleBg,
    '--lw-user-bubble': curTheme.userBg,
    '--lw-border': curTheme.border,
    '--lw-input-bg': curTheme.inputBg,
    '--lw-font': (function () {
      const rawFamily = activeSettings['lumina-chat.fontFamily'] || 'sans-serif';
      const family = rawFamily.replace(/['"]/g, '').trim();
      const fonts: Record<string, string> = {
        'sans-serif': 'Inter, sans-serif',
        'serif': '"Noto Serif CJK SC", "Songti SC", serif',
        'kaiti': '"Kaiti SC", "STKaiti", serif'
      };
      return fonts[family] || `"${family}", sans-serif`;
    })(),
    '--lw-font-weight': activeSettings['lumina-chat.fontWeight'] || 400,
    '--lw-size': (activeSettings['lumina-chat.fontSize'] || 16) + 'px',
    '--lw-line-height': activeSettings['lumina-chat.lineHeight'] || 1.6,
    '--lw-p-spacing': (activeSettings['lumina-chat.paragraphSpacing'] ?? 16) + 'px',
    '--lw-letter-spacing': (activeSettings['lumina-chat.letterSpacing'] ?? 0) + 'px'
  };
});

const msgMaxWidthStyle = computed(() => {
  const w = activeSettings['lumina-chat.pageWidth'];
  if (!w || w === 'auto') return { maxWidth: '100%' };
  return { maxWidth: w + 'px', margin: '0 auto' };
});

// 简易 Markdown 渲染 (支持基于段落间距要求的 <p> 排版)
const renderMarkdown = (text: string) => {
  if (!text) return '';
  const lines = text.split('\n');
  const htmlLines = lines.map(line => {
    if (!line.trim()) return '<div class="empty-line"></div>';
    let parsed = line
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*([^\*]+)\*/g, '<em style="color:var(--lw-primary);">$1</em>')
      .replace(/"([^"]+)"/g, '<span style="color: var(--lw-blue-deep);">"$1"</span>')
      .replace(/“([^“]+)”/g, '<span style="color: var(--lw-blue-deep);">"$1"</span>');
    return `<p>${parsed}</p>`;
  });
  return htmlLines.join('');
};

const scrollToBottom = async (force = false) => {
  await nextTick();
  if (chatScrollArea.value) {
    const area = chatScrollArea.value;
    const threshold = 120; // 稍大的阈值，适应不同分辨率和滚动速度
    const currentIsAtBottom = area.scrollHeight - area.scrollTop - area.clientHeight <= threshold;

    if (force || currentIsAtBottom) {
      // 使用 requestAnimationFrame 确保在浏览器重绘前计算出最新的 scrollHeight
      requestAnimationFrame(() => {
        area.scrollTo({
          top: area.scrollHeight,
          behavior: force ? 'auto' : 'smooth' // 强制触发时（如刚开始生成）使用 auto，过程中使用 smooth 对冲抖动
        });
        isAtBottom.value = true;
      });
    }
  }
};

const handleScroll = (e: Event) => {
  const area = e.target as HTMLElement;
  const threshold = 100;
  const atBottom = area.scrollHeight - area.scrollTop - area.clientHeight <= threshold;
  
  // 仅当状态确实发生变化时才更新，减少 Vue 响应式开销
  if (isAtBottom.value !== atBottom) {
    isAtBottom.value = atBottom;
  }
};

watch(() => props.messages, (newVal, oldVal) => {
  // 如果是由于切换对话导致的（长度剧变或 ID 变更），强制滚动一次
  const isSwitch = !oldVal || Math.abs(newVal.length - (oldVal?.length || 0)) > 5;

  if (isSwitch) {
    scrollToBottom(true);
  } else if (isGenerating.value) {
    // 生成过程中新消息（如用户发送的）加入，尝试跟随
    scrollToBottom(false);
  } else {
    // 非生成期间（如编辑、删除、完成后的最后一次同步），仅在贴底时允许跟随
    scrollToBottom(false);
  }
}, { deep: true, immediate: true });

// -------- 交互动作对接 --------

/**
 * 发送消息
 * 注意: lwApi.sendMessage() 内部已经调用了 triggerGenerate()
 * 这里不需要再重复调用
 */
const handleSend = async () => {
  const text = quickInput.value.trim();
  if (!text || isGenerating.value || !lwApi) return;
  quickInput.value = '';
  await lwApi.sendMessage(text);
  // 发送后立即触底，确保用户内容可见并为随后的 AI 流式输出占位
  scrollToBottom(true);
};

/**
 * 停止当前生成
 */
const handleStop = () => {
  lwApi?.abortGenerate();
};

const handleEdit = (index: number, msg: LuminaChatMessage) => {
  // 内联编辑：使用 mesRaw（原始未经正则处理的文本），如果没有 mesRaw 则回退到 mes
  editingText.value = msg.mesRaw ?? msg.mes ?? '';
  editingIndex.value = index;
  editingTargetId.value = msg.id || null;
};

const confirmEdit = async () => {
  if (lwApi && editingText.value.trim() !== '') {
    const target = editingTargetId.value ?? editingIndex.value;
    await lwApi.crudChatRecord(target, 'edit', editingText.value);
  }
  editingIndex.value = -1;
  editingTargetId.value = null;
};

const handleRegen = async () => {
  if (lwApi) {
    await lwApi.regenerateLast();
  }
};

const handleBranch = async (index: number, msg: LuminaChatMessage) => {
  if (lwApi) {
    const nodeId = msg.id || (lwApi as any)._getMessageFingerprint(msg);
    if (nodeId) {
      await lwApi.branchFromNode(nodeId);
    } else {
      alert(`无法解析该节点的坐标信息。楼层：${index}`);
    }
  }
};

const handleDelete = async (index: number, msg: LuminaChatMessage) => {
  if (confirm(`确定要删除此条消息吗？\n删除后无法撤销 (楼层 ${index})`)) {
    if (lwApi) {
      await lwApi.crudChatRecord(msg.id || index, 'delete');
    }
  }
};

</script>

<style scoped>
/* --- 左侧聊天流 --- */
.lw-chat-stream {
  flex: 1;
  display: flex;
  flex-direction: column;
  background: var(--lw-bg);
  color: var(--lw-color);
  width: 100%;
  min-width: 600px;
  border-right: 1px solid #e2e8f0;
  overflow-x: hidden;
  transition: background 0.3s, color 0.3s;
}

.chat-scroll-area {
  flex: 1;
  overflow-y: auto;
  padding: 24px 40px;
  display: flex;
  flex-direction: column;
  align-items: center;
}

@media (max-width: 768px) {
  .lw-chat-stream {
    min-width: 0;
    border-right: none;
  }

  .chat-scroll-area {
    padding: 16px 12px;
    padding-left: 18.3px;
  }

  .chat-input-area {
    padding: 1px 18px 14px !important;
  }
}

.chat-content-wrapper {
  display: flex;
  flex-direction: column;
  gap: 24px;
  width: 100%;
  transition: max-width 0.3s;
}

/* 章节线设计 */
.chat-chapter-divider {
  text-align: center;
  margin: 16px 0;
  display: flex;
  justify-content: center;
}

.chat-chapter-divider .chip {
  background: var(--lw-bg);
  padding: 6px 16px;
  border-radius: 20px;
  font-size: 12px;
  color: #94a3b8;
  border: 1px solid var(--lw-border);
  display: flex;
  align-items: center;
  gap: 8px;
}

/* 聊天消息区域 */
.chat-msg {
  display: flex;
  gap: 16px;
  align-items: flex-start;
  max-width: 100%;
  width: 100%;
}

/* 用户消息头像居右 */
.chat-msg.user {
  align-self: flex-end;
  flex-direction: row-reverse;
}

.msg-avatar {
  display: flex !important;
  align-items: flex-start !important;
  flex-shrink: 0 !important;
  width: 40px !important;
  height: 40px !important;
}

@media (max-width: 768px) {
  .msg-avatar {
    width: 34px !important;
    height: 34px !important;
  }

  .msg-avatar .avatar-img {
    width: 34px !important;
    height: 34px !important;
  }
}

.msg-avatar .avatar-img {
  width: 40px !important;
  height: 40px !important;
  border-radius: 50% !important;
  object-fit: cover !important;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05) !important;
  display: block !important;
  visibility: visible !important;
  opacity: 1 !important;
  flex-shrink: 0 !important;
}

.msg-content {
  display: flex;
  flex-direction: column;
  gap: 6px;
  flex: 1;
  /* max-width: calc(100% - 56px); */
}

.chat-msg.user .msg-content {
  align-items: flex-end;
}

.msg-meta {
  display: flex;
  align-items: baseline;
  gap: 12px;
}

.status-label {
  font-weight: 500;
}

.status-count {
  opacity: 0.7;
  font-size: 0.85em;
  font-weight: normal;
}

.msg-name {
  font-weight: 600;
  font-size: 14px;
  color: var(--lw-color);
  opacity: 0.9;
}

.msg-info {
  font-size: 11px;
  color: #94a3b8;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.msg-bubble {
  background: var(--lw-bubble);
  padding: 16px;
  border-radius: 8px;
  border: 1px solid var(--lw-border);
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.02);
  font-size: var(--lw-size);
  font-family: var(--lw-font);
  font-weight: var(--lw-font-weight, 400);
  line-height: var(--lw-line-height);
  color: var(--lw-color);
  max-width: 100%;
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  transition: background 0.3s, color 0.3s, border-color 0.3s;
  overflow: hidden;
}

.streaming-bubble {
  border-color: var(--lw-primary);
  border-style: dashed;
  position: relative;
  min-height: 24px;
  /* 核心修复：增加平滑过渡，减缓布局跳动感 */
  transition: min-height 0.1s ease-out;
}

.msg-text {
  white-space: pre-wrap;
  word-wrap: break-word;
  overflow-wrap: break-word;
  letter-spacing: var(--lw-letter-spacing);
}

/* 编辑模式增强 */
.msg-edit-wrap {
  width: 100%;
  background: var(--lw-bg);
  border: 1px solid var(--lw-primary, var(--lw-primary));
  border-radius: 8px;
  padding: 12px;
  box-shadow: 0 4px 12px rgba(139, 92, 246, 0.1);
  margin-top: 4px;
  display: flex;
  flex-direction: column;
  gap: 12px;
  animation: edit-slide-in 0.2s ease-out;
}

@keyframes edit-slide-in {
  from {
    opacity: 0;
    transform: translateY(-4px);
  }

  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.msg-edit-textarea {
  width: 100%;
  background: white;
  border: 1px solid #e2e8f0;
  border-radius: 6px;
  padding: 10px;
  font-family: var(--lw-font);
  font-size: var(--lw-size);
  line-height: var(--lw-line-height);
  color: #1e293b;
  resize: vertical;
  min-height: 100px;
  outline: none;
  transition: border-color 0.2s;
}

.msg-edit-textarea:focus {
  border-color: var(--lw-primary, var(--lw-primary));
}

.msg-edit-actions-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.edit-tip {
  font-size: 11px;
  color: #94a3b8;
}

.edit-btns {
  display: flex;
  gap: 8px;
}

.edit-confirm-btn {
  background: var(--lw-primary, var(--lw-primary));
  color: white;
  border: none;
  padding: 6px 14px;
  border-radius: 6px;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: 0.2s;
  box-shadow: 0 2px 4px rgba(139, 92, 246, 0.2);
}

.edit-confirm-btn:hover {
  background: var(--lw-primary-hover);
  transform: translateY(-1px);
}

.edit-cancel-btn {
  background: #f1f5f9;
  color: #64748b;
  border: none;
  padding: 6px 14px;
  border-radius: 6px;
  font-size: 13px;
  cursor: pointer;
  transition: 0.2s;
}

.edit-cancel-btn:hover {
  background: #e2e8f0;
  color: #1e293b;
}

/* 段落间距控制 */
.msg-text :deep(p) {
  margin: 0 0 var(--lw-p-spacing) 0;
}

.msg-text :deep(p:last-child) {
  margin-bottom: 0;
}

.msg-text :deep(.empty-line) {
  height: var(--lw-p-spacing);
}

/* 气泡平实卡片化 */
.chat-msg.user .msg-bubble {
  background: var(--lw-user-bubble);
  border: 1px solid var(--lw-border);
}

.filtered-text-info {
  margin-top: 8px;
  display: flex;
  justify-content: flex-start;
}

.stream-error {
  margin-top: 8px;
  font-size: 12px;
  color: #dc2626;
  background: #fee2e2;
  border: 1px solid #fecaca;
  border-radius: 6px;
  padding: 8px 10px;
}

.filtered-tag {
  font-size: 11px;
  color: #94a3b8;
  background: rgba(148, 163, 184, 0.1);
  padding: 2px 8px;
  border-radius: 4px;
  border: 1px dashed #cbd5e1;
}

.msg-actions .delete-btn:hover {
  background: #fee2e2;
  color: #ef4444;
}

/* --- 沉浸式文档模式 Document Mode --- */
.lw-chat-stream.doc-mode .msg-avatar {
  display: none !important;
}

.lw-chat-stream.doc-mode .msg-meta {
  display: none !important;
}

.lw-chat-stream.doc-mode .chat-msg {
  align-self: flex-start !important;
  flex-direction: row !important;
  margin-bottom: var(--lw-p-spacing);
}

.lw-chat-stream.doc-mode .msg-content {
  align-items: flex-start !important;
}

.lw-chat-stream.doc-mode .msg-bubble {
  background: transparent !important;
  border: none !important;
  box-shadow: none !important;
  padding: 0 !important;
}

/* 悬停出现动作栏：在气泡底部常驻 */
.msg-actions {
  display: flex;
  justify-content: flex-end;
  gap: 4px;
  margin-top: 12px;
  padding-top: 12px;
  border-top: 1px solid var(--lw-border);
}

.msg-actions button {
  background: none;
  border: none;
  font-size: 14px;
  cursor: pointer;
  color: #94a3b8;
  transition: 0.2s;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  border-radius: 4px;
}

.msg-actions button:hover {
  background: #f1f5f9;
  color: var(--lw-primary);
}

/* 状态反馈标签 */
.msg-status-tags {
  display: flex;
  gap: 8px;
  margin-top: 8px;
}

.status-tag {
  font-size: 11px;
  padding: 4px 8px;
  border-radius: 4px;
  font-weight: 600;
}

.status-tag.red {
  background: #ffe4e6;
  color: #e11d48;
}

.status-tag.yellow {
  background: #fef3c7;
  color: #d97706;
}

/* --- 底栏输入区 --- */
.chat-input-area {
  padding: 20px 24px 24px;
  background: var(--lw-bg-app);
  border-top: 1px solid var(--lw-border-base);
  transition: var(--lw-transition);
}

.input-container {
  background: var(--lw-bg-surface);
  border: 1px solid var(--lw-border-base);
  border-radius: var(--lw-radius);
  padding: 4px;
  display: flex;
  gap: 8px;
  align-items: center;
  transition: var(--lw-transition);
  box-shadow: var(--lw-shadow);
}

.input-container:focus-within {
  border-color: var(--lw-border-active);
  box-shadow: 0 0 0 2px rgba(0, 0, 0, 0.05);
}

.lw-chat-stream .input-container textarea {
  all: unset !important;
  display: block !important;
  flex: 1 !important;
  border: none !important;
  resize: none !important;
  min-height: 40px !important;
  max-height: 200px !important;
  font-family: inherit !important;
  font-size: 14px !important;
  outline: none !important;
  padding: 10px 12px !important;
  background-color: transparent !important;
  color: var(--lw-text-main) !important;
  box-sizing: border-box !important;
  line-height: 1.6 !important;
  box-shadow: none !important;
  margin: 0 !important;
  white-space: pre-wrap !important;
  -webkit-text-fill-color: var(--lw-text-main) !important;
}

.lw-chat-stream .input-container textarea::-webkit-scrollbar {
  display: none;
}

.lw-chat-stream .input-container textarea::placeholder {
  color: #94a3b8 !important;
  -webkit-text-fill-color: #94a3b8 !important;
}

.input-actions {
  display: flex;
  gap: 16px;
  align-items: center;
  padding-right: 10px;
}

.tool-btn {
  background: none;
  border: none;
  cursor: pointer;
  color: var(--lw-primary);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 4px;
}

.tool-btn:hover {
  opacity: 0.8;
}

.send-btn {
  margin-right: 4px;
}

/* === 停止按钮 === */
.stop-btn {
  background: #ef4444;
  color: white;
  border: none;
  width: 38px;
  height: 38px;
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: 0.2s;
  flex-shrink: 0;
  animation: pulse-red 1.5s ease-in-out infinite;
}

.stop-btn:hover {
  background: #dc2626;
  transform: scale(1.05);
}

@keyframes pulse-red {

  0%,
  100% {
    box-shadow: 0 0 0 0 rgba(239, 68, 68, 0);
  }

  50% {
    box-shadow: 0 0 0 4px rgba(239, 68, 68, 0.25);
  }
}

/* === 工具栏行 === */
.input-wrapper {
  display: flex;
  flex-direction: column;
}

.input-toolbar {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 8px 16px 8px;
}

/* === Prompt Inspector 面板 === */
.prompt-inspector-wrap {
  height: 260px;
  border-top: 1px solid var(--lw-border-base);
  overflow: hidden;
  transition: height 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

/* 展开到全屏模式：撑满整个聊天显示区域 */
.prompt-inspector-wrap.inspector-expanded {
  height: calc(100vh - 0px);
  max-height: 100%;
}

.inspector-slide-enter-active,
.inspector-slide-leave-active {
  transition: height 0.25s cubic-bezier(0.4, 0, 0.2, 1);
}

.inspector-slide-enter-from,
.inspector-slide-leave-to {
  height: 0;
}

/* === 流式输入气泡 === */
.streaming-msg .msg-bubble.streaming-bubble {
  background: var(--lw-bubble, #ffffff);
  border-left: 3px solid var(--lw-primary, var(--lw-primary));
  opacity: 0.95;
}

.streaming-avatar {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  background: linear-gradient(135deg, #ede9fe 0%, #ddd6fe 100%);
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--lw-primary, var(--lw-primary));
  animation: streaming-pulse 1.8s ease-in-out infinite;
}

@keyframes streaming-pulse {

  0%,
  100% {
    opacity: 1;
  }

  50% {
    opacity: 0.6;
  }
}

/* === 打字指示器 (三点) === */
.typing-indicator {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 8px 0;
}

.typing-indicator span {
  width: 7px;
  height: 7px;
  background: var(--lw-primary, var(--lw-primary));
  border-radius: 50%;
  opacity: 0.4;
  animation: typing-bounce 1.2s ease-in-out infinite;
}

.typing-indicator span:nth-child(2) {
  animation-delay: 0.2s;
}

.typing-indicator span:nth-child(3) {
  animation-delay: 0.4s;
}

@keyframes typing-bounce {

  0%,
  80%,
  100% {
    transform: translateY(0);
    opacity: 0.4;
  }

  40% {
    transform: translateY(-5px);
    opacity: 1;
  }
}

/* textarea 禁用态 */
.lw-chat-stream .input-container textarea:disabled {
  opacity: 0.6 !important;
  cursor: not-allowed !important;
}

/* === 内联编辑区域 === */
.msg-edit-wrap {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.msg-edit-textarea {
  width: 100%;
  box-sizing: border-box;
  border: 2px solid var(--lw-primary, var(--lw-primary));
  border-radius: 8px;
  padding: 10px 12px;
  font-size: var(--lw-size, 16px);
  font-family: var(--lw-font, sans-serif);
  line-height: var(--lw-line-height, 1.6);
  color: var(--lw-color, #1e293b);
  background: var(--lw-bubble, #ffffff);
  resize: vertical;
  outline: none;
  min-height: 80px;
  box-shadow: 0 0 0 3px rgba(139, 92, 246, 0.12);
  transition: border-color 0.15s;
}

.msg-edit-actions {
  display: flex;
  gap: 8px;
}

.edit-confirm-btn {
  padding: 5px 14px;
  border-radius: 6px;
  border: none;
  background: var(--lw-primary, var(--lw-primary));
  color: white;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.15s;
}

.edit-confirm-btn:hover {
  background: var(--lw-primary-hover);
}

.edit-cancel-btn {
  padding: 5px 14px;
  border-radius: 6px;
  border: 1px solid #e2e8f0;
  background: white;
  color: #64748b;
  font-size: 12px;
  cursor: pointer;
  transition: 0.15s;
}

.edit-cancel-btn:hover {
  background: #f8fafc;
  border-color: #cbd5e1;
}

/* === 收起状态下的输入区高度收缩 === */
.chat-input-area .input-container {
  overflow: hidden;
  transition: max-height 0.25s cubic-bezier(0.4, 0, 0.2, 1);
}

/* === 流式平滑显示效果 === */

/* 淡入效果 */
.lw-effect-fade-in {
  animation: lw-fade-in 0.3s ease-out forwards;
}
@keyframes lw-fade-in {
  from { opacity: 0; }
  to   { opacity: 1; }
}

/* GPT 风格：淡入 + 颜色从浅灰过渡到正文色 */
.lw-effect-gpt-reveal {
  animation: lw-gpt-reveal 0.6s ease-out forwards;
}
@keyframes lw-gpt-reveal {
  from {
    opacity: 0;
    color: var(--lw-text-light, #94a3b8);
  }
  to {
    opacity: 1;
    color: var(--lw-color, inherit);
  }
}

/* 打字机光标 */
.typing-cursor {
  display: inline;
  animation: lw-blink 0.8s step-end infinite;
  color: var(--lw-primary, #8b5cf6);
  font-weight: 300;
  user-select: none;
}
@keyframes lw-blink {
  50% { opacity: 0; }
}

.streaming-status-placeholder {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 4px 8px;
  background: var(--lw-bg);
  border-radius: 6px;
  color: var(--lw-text-light);
  font-size: 0.9em;
  font-style: italic;
  animation: status-fade-in 0.3s ease-out;
}

@keyframes status-fade-in {
  from { opacity: 0; transform: translateY(4px); }
  to { opacity: 1; transform: translateY(0); }
}

.status-pulse {
  width: 8px;
  height: 8px;
  background: var(--lw-primary);
  border-radius: 50%;
  animation: pulse-ring 1.5s infinite;
}

@keyframes pulse-ring {
  0% { transform: scale(0.8); opacity: 0.5; box-shadow: 0 0 0 0 rgba(var(--lw-primary-rgb), 0.4); }
  70% { transform: scale(1.1); opacity: 1; box-shadow: 0 0 0 6px rgba(var(--lw-primary-rgb), 0); }
  100% { transform: scale(0.8); opacity: 0.5; box-shadow: 0 0 0 0 rgba(var(--lw-primary-rgb), 0); }
}

.streaming-meta-info {
  display: flex;
  gap: 12px;
  margin-top: 10px;
  padding-top: 8px;
  border-top: 1px dashed var(--lw-border);
  font-size: 11px;
  color: #94a3b8;
}

.meta-item.status {
  color: var(--lw-primary);
  font-weight: 500;
  display: flex;
  align-items: center;
}

.meta-item.status::before {
  content: "";
  display: inline-block;
  width: 4px;
  height: 4px;
  border-radius: 50%;
  background: currentColor;
  margin-right: 6px;
}
</style>
