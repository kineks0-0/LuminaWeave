<template>
  <div class="lv-message-renderer">
    <template v-for="(segment, idx) in segments" :key="idx">
      <!-- 文本段：使用 TextBlock 渲染 Markdown -->
      <TextBlock v-if="segment.type === 'text'" :text="segment.raw" :renderFn="renderMarkdown" />

      <!-- 视图段：遍历组件列表并动态渲染 -->
      <div v-else-if="segment.type === 'view'" class="lv-view-segment">
        <template v-for="(comp, cIdx) in segment.components" :key="cIdx">
          <StatBlock v-if="comp.component === 'Stat'" v-bind="comp.props as any" />
          <ProgressBlock v-else-if="comp.component === 'Progress'" v-bind="comp.props as any" />
          <ChoiceBlock v-else-if="comp.component === 'Choices'" v-bind="comp.props as any" />
          <BadgeBlock v-else-if="comp.component === 'Badge'" v-bind="comp.props as any" />
          <AlertBlock v-else-if="comp.component === 'Alert'" v-bind="comp.props as any" />
          <QuoteBlock v-else-if="comp.component === 'Quote'" v-bind="comp.props as any" />
          <SepBlock v-else-if="comp.component === 'Sep'" />

          <!-- 降级：未识别的组件类型原样展示 -->
          <div v-else class="lv-unknown-block">
            <code>{{ comp.component }}({{ JSON.stringify(comp.props) }})</code>
          </div>
        </template>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { splitToSegments, type MessageSegment } from '../../../api/core/LVParser';
import TextBlock from './blocks/TextBlock.vue';
import StatBlock from './blocks/StatBlock.vue';
import ProgressBlock from './blocks/ProgressBlock.vue';
import ChoiceBlock from './blocks/ChoiceBlock.vue';
import BadgeBlock from './blocks/BadgeBlock.vue';
import AlertBlock from './blocks/AlertBlock.vue';
import QuoteBlock from './blocks/QuoteBlock.vue';
import SepBlock from './blocks/SepBlock.vue';
import { globalXMLInterceptor, XMLInterceptor } from '../../../api/core/XMLInterceptor';
import { lwStorage } from '../../../api/storage';

const props = defineProps<{
  /** 手动处理后的显示文本（ST 渲染主要来源） */
  mes?: string;
  /** 原始对话文本（ST 原始来源） */
  mesRaw: string;
  /** 最原始的 LLM 输出（Lumina 全量来源） */
  pluginRaw?: string | null;
  /** Markdown 渲染函数（由父组件传入） */
  renderMarkdown: (text: string) => string;
  /** 是否处于流式生成状态 */
  isStreaming?: boolean;
}>();

/** 将 mesRaw 分割为文本段和视图段 */
const segments = computed<MessageSegment[]>(() => {
  // 级联渲染源优先级：显式 mes > 原始 mesRaw > pluginRaw 提纯
  let targetText = props.mes || props.mesRaw;
  
  if (!targetText && props.pluginRaw) {
    // 降级：从 pluginRaw 提取包含展示标签的对话内容
    const chatReplyContent = XMLInterceptor.extractTagContent(props.pluginRaw, 'Chat_Reply').join('\n\n');
    targetText = chatReplyContent || globalXMLInterceptor.processAndCleanText(props.pluginRaw);
  }

  if (!targetText) return [];
  
  // 核心修复：同步流式过滤设置，且区分阶段应用猜测逻辑
  const filterChatReply = lwStorage.get('lumina-chat.filterChatReply', false, 'Global');
  
  if (filterChatReply && !props.isStreaming) {
    // 只有在从原始 pluginRaw 降级渲染时，才由设置开关决定猜测逻辑
    // 如果是 mes/mesRaw，我们明确认为其顶层即为回复主体
    const usePluginAsSource = !props.mes && !props.mesRaw && props.pluginRaw;
    
    // 场景感知：已整理的消息强制允许顶层展示且不识别隐式思考，仅对原始流应用用户配置
    const effectiveAllowTopLevel = usePluginAsSource ? lwStorage.get('lumina-chat.allowTopLevelInFilter', true, 'Global') : true;
    const effectiveImplicitThinking = usePluginAsSource ? lwStorage.get('lumina-chat.implicitThinkingInFilter', false, 'Global') : false;

    const state = globalXMLInterceptor.deriveStreamState(targetText, true, effectiveAllowTopLevel, effectiveImplicitThinking);
    targetText = state.displayText;
  }
  
  const result = splitToSegments(targetText);
  console.log(`[MessageRenderer] Calculated ${result.length} segments from text (filtered: ${filterChatReply}):`, result);
  return result;
});
</script>

<style scoped>
.lv-message-renderer {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.lv-view-segment {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin: 4px 0;
}

/* 未识别组件的降级展示 */
.lv-unknown-block {
  padding: 8px 12px;
  background: #fef3c7;
  border: 1px dashed #f59e0b;
  border-radius: 6px;
  font-size: 12px;
  color: #92400e;
}

.lv-unknown-block code {
  font-family: monospace;
  font-size: 11px;
}
</style>
