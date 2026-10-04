<template>
  <SettingsSectionPanel
    class="regex-block"
    :class="{ 'is-expanded': expanded && !props.embedded }"
    :core="!props.embedded"
    :plain="props.embedded"
  >
    <div ref="rootRef" class="regex-manager" :class="{ 'is-embedded': props.embedded }">
      <SettingsBlockHeader :title="props.embedded ? '' : '消息净化'">
        <template v-if="!props.embedded" #icon>
          <Regex :size="18" :stroke-width="2" aria-hidden="true" />
        </template>
        <template #actions>
          <span v-if="saveState === 'saved'" class="save-state">已保存</span>
          <span v-else-if="saveState === 'saving'" class="save-state">保存中…</span>
          <LuminaIconButton ariaLabel="新建脚本" title="新建脚本" size="sm" @click="addScript">
            <Plus :size="14" :stroke-width="2" aria-hidden="true" />
          </LuminaIconButton>
          <LuminaIconButton ariaLabel="导入脚本" title="导入 ST 正则 JSON" size="sm" @click="openImport">
            <Upload :size="14" :stroke-width="2" aria-hidden="true" />
          </LuminaIconButton>
          <LuminaIconButton ariaLabel="导出脚本" title="导出" size="sm" :disabled="scripts.length === 0" @click="exportScripts">
            <Download :size="14" :stroke-width="2" aria-hidden="true" />
          </LuminaIconButton>
          <LuminaIconButton
            v-if="!props.embedded"
            :ariaLabel="expanded ? '退出展开' : '展开编辑'"
            :title="expanded ? '退出展开' : '展开编辑'"
            size="sm"
            @click="expanded = !expanded"
          >
            <Minimize2 v-if="expanded" :size="14" :stroke-width="2" aria-hidden="true" />
            <Maximize2 v-else :size="14" :stroke-width="2" aria-hidden="true" />
          </LuminaIconButton>
        </template>
      </SettingsBlockHeader>

      <input ref="fileInput" class="tw:hidden" type="file" accept=".json,application/json" @change="handleImportFile" />

      <section class="builtin-panel">
        <div class="section-label">
          <span>内置处理</span>
          <span class="section-hint">XML 标签过滤由内置拦截器按标签注册表执行，此处只读展示</span>
        </div>
        <ul class="builtin-tag-list">
          <li v-for="rule in builtinTagRules" :key="rule.tag" class="builtin-tag">
            <code class="builtin-tag-name">&lt;{{ rule.tag }}&gt;</code>
            <span class="builtin-tag-badge" :data-disposition="rule.disposition">{{ rule.dispositionLabel }}</span>
            <span v-if="rule.description" class="builtin-tag-desc">{{ rule.description }}</span>
          </li>
        </ul>
        <div class="builtin-filter">
          <div class="builtin-filter-head">
            <span class="builtin-filter-title">回复过滤</span>
            <span class="builtin-filter-state" :data-on="replyFilterState.enabled">
              {{ replyFilterState.enabled ? '已启用' : '已关闭' }}
            </span>
          </div>
          <ul class="builtin-filter-options">
            <li>
              <span>保留不在标签内的正文</span>
              <b class="builtin-option-state" :data-on="replyFilterState.allowTopLevel">
                {{ replyFilterState.allowTopLevel ? '开' : '关' }}
              </b>
            </li>
            <li>
              <span>开头的无标签文本视为思考</span>
              <b class="builtin-option-state" :data-on="replyFilterState.implicitThinking">
                {{ replyFilterState.implicitThinking ? '开' : '关' }}
              </b>
            </li>
            <li>
              <span>隐藏到第一个 &lt;/thinking&gt; 为止</span>
              <b class="builtin-option-state" :data-on="replyFilterState.aggressiveThinking">
                {{ replyFilterState.aggressiveThinking ? '开' : '关' }}
              </b>
            </li>
          </ul>
          <p class="builtin-note">仅作用于模型回复的显示与写回；角色卡招呼（第一条消息）不处理，正则脚本不受影响。</p>
          <button type="button" class="builtin-link" @click="openReplyFilterSettings">
            前往「对话与流式 › 回复过滤」调整
          </button>
        </div>
      </section>

      <section v-if="boundRegexRules.length > 0" class="bound-panel">
        <div class="section-label">
          <span>绑定正则</span>
          <span class="section-hint">来自当前激活预设与角色卡；关闭仅在本机禁用，不改写资产，同 id 时优先于全局库</span>
        </div>
        <ul class="bound-list">
          <li
            v-for="rule in boundRegexRules"
            :key="`${rule.source}:${rule.id}`"
            class="bound-row"
            :class="{ 'is-disabled': !rule.effectiveEnabled }"
          >
            <span class="bound-name">{{ rule.name }}</span>
            <span class="bound-source" :data-source="rule.source">{{ rule.sourceLabel }}</span>
            <span class="bound-placements">
              <span v-for="placement in rule.placement" :key="placement" class="bound-tag">
                {{ placementLabel(placement) }}
              </span>
            </span>
            <LuminaToggle
              class="bound-toggle"
              :modelValue="rule.effectiveEnabled"
              :disabled="!rule.sourceEnabled"
              :title="rule.sourceEnabled
                ? (rule.effectiveEnabled ? '禁用（Lumina 覆盖，不改写资产）' : '重新启用')
                : '来源脚本已停用'"
              @update:modelValue="toggleBoundRegex(rule, $event)"
            />
          </li>
        </ul>
      </section>

      <div class="section-label">
        <span>正则脚本</span>
        <span class="section-hint">按顺序应用，支持导入导出与内联测试</span>
      </div>

      <LuminaEmptyState
        v-if="scripts.length === 0"
        title="还没有正则脚本"
        description="新建一条脚本，或导入 ST 导出的正则 JSON。"
      >
        <template #action>
          <div class="tw:flex tw:gap-2">
            <LuminaButton variant="soft" size="sm" @click="addScript">新建脚本</LuminaButton>
            <LuminaButton variant="soft" size="sm" @click="openImport">导入</LuminaButton>
          </div>
        </template>
      </LuminaEmptyState>

      <div v-else class="regex-body" :data-view="isWide ? 'split' : view">
        <aside class="regex-list">
          <button
            v-for="(script, index) in scripts"
            :key="script.id"
            type="button"
            class="regex-row"
            :class="{ 'is-selected': script.id === selectedId, 'is-disabled': !script.enabled }"
            @click="selectScript(script.id)"
          >
            <span class="regex-row-name">{{ script.scriptName || '未命名脚本' }}</span>
            <span class="regex-row-tags">
              <span v-for="placement in script.placement" :key="placement" class="tag">
                {{ placementLabel(placement) }}
              </span>
            </span>
            <span class="regex-row-actions" @click.stop>
              <LuminaToggle v-model="script.enabled" />
              <LuminaIconButton ariaLabel="上移" title="上移" size="sm" :disabled="index === 0" @click="moveScript(index, -1)">
                <ArrowUp :size="13" :stroke-width="2" aria-hidden="true" />
              </LuminaIconButton>
              <LuminaIconButton
                ariaLabel="下移"
                title="下移"
                size="sm"
                :disabled="index === scripts.length - 1"
                @click="moveScript(index, 1)"
              >
                <ArrowDown :size="13" :stroke-width="2" aria-hidden="true" />
              </LuminaIconButton>
              <LuminaIconButton ariaLabel="删除" title="删除" size="sm" tone="danger" @click="requestDelete(script)">
                <Trash2 :size="13" :stroke-width="2" aria-hidden="true" />
              </LuminaIconButton>
            </span>
          </button>
        </aside>

        <section v-if="draft" class="regex-detail">
          <header class="detail-head">
            <button v-if="!isWide" type="button" class="back-button" @click="view = 'list'">
              <ChevronLeft :size="16" :stroke-width="2" aria-hidden="true" />
              列表
            </button>
            <input v-model="draft.scriptName" class="detail-name" aria-label="脚本名称" />
          </header>

          <div class="regex-editor">
            <div class="editor-column">
              <label class="field">
                <span>匹配（支持 /pattern/flags）</span>
                <textarea v-model="draft.findRegex" class="mono-input" rows="2" spellcheck="false"></textarea>
              </label>
              <label class="field">
                <span>替换（支持 $1 等捕获组）</span>
                <textarea v-model="draft.replaceString" class="mono-input" rows="2" spellcheck="false"></textarea>
              </label>
              <label class="field">
                <span>裁剪字符串（每行一条）</span>
                <textarea
                  class="mono-input"
                  rows="2"
                  spellcheck="false"
                  :value="draft.trimStrings.join('\n')"
                  @input="updateTrimStrings($event)"
                ></textarea>
              </label>

              <div class="field">
                <span>作用位置</span>
                <div class="placement-grid">
                  <label v-for="option in placementOptions" :key="option.value" class="placement-option">
                    <LuminaCheckbox
                      :modelValue="draft.placement.includes(option.value)"
                      @update:modelValue="togglePlacement(option.value, $event)"
                    />
                    <span>{{ option.label }}</span>
                  </label>
                </div>
              </div>

              <div class="editor-grid">
                <label class="field">
                  <span>宏替换</span>
                  <select v-model.number="draft.substituteRegex">
                    <option :value="0">不替换</option>
                    <option :value="1">原始替换</option>
                    <option :value="2">替换并转义</option>
                  </select>
                </label>
                <label class="field">
                  <span>最小深度</span>
                  <input
                    type="number"
                    min="0"
                    :value="draft.minDepth ?? ''"
                    placeholder="不限"
                    @input="draft.minDepth = nullableNumber($event)"
                  />
                </label>
                <label class="field">
                  <span>最大深度</span>
                  <input
                    type="number"
                    min="0"
                    :value="draft.maxDepth ?? ''"
                    placeholder="不限"
                    @input="draft.maxDepth = nullableNumber($event)"
                  />
                </label>
              </div>

              <div class="toggle-row">
                <label class="field field-toggle">
                  <span>仅显示层</span>
                  <LuminaToggle v-model="draft.markdownOnly" />
                </label>
                <label class="field field-toggle">
                  <span>仅提示词</span>
                  <LuminaToggle v-model="draft.promptOnly" />
                </label>
                <label class="field field-toggle">
                  <span>编辑时运行</span>
                  <LuminaToggle v-model="draft.runOnEdit" />
                </label>
              </div>
            </div>

            <div class="test-column">
              <div class="test-head">
                <span class="test-title">测试</span>
                <select v-model.number="testSource" aria-label="测试作用位置">
                  <option v-for="option in placementOptions" :key="option.value" :value="option.value">
                    {{ option.label }}
                  </option>
                </select>
              </div>
              <textarea
                v-model="testInput"
                class="mono-input"
                rows="5"
                spellcheck="false"
                placeholder="输入示例文本，实时查看替换结果"
              ></textarea>
              <div class="test-result" aria-live="polite">
                <p class="test-result-label">匹配预览</p>
                <pre class="test-preview"><template v-for="(segment, index) in matchSegments" :key="index"><mark v-if="segment.match">{{ segment.text }}</mark><span v-else>{{ segment.text }}</span></template></pre>
                <p class="test-result-label">替换结果</p>
                <pre class="test-preview">{{ testResult.text || '（无输出）' }}</pre>
                <p v-if="testResult.warnings.length > 0" class="test-error">{{ testResult.warnings.join('；') }}</p>
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  </SettingsSectionPanel>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import {
  ArrowDown,
  ArrowUp,
  ChevronLeft,
  Download,
  Maximize2,
  Minimize2,
  Plus,
  Regex,
  Trash2,
  Upload
} from 'lucide-vue-next';
import { SettingsBlockHeader, SettingsSectionPanel } from '../components';
import { openSettingsCategory } from '../settingsViewState.js';
import {
  listBoundRegexRules,
  listBuiltinTagRules,
  resolveReplyFilterState,
  type BoundRegexRule,
  type BuiltinReplyFilterState,
  type BuiltinTagRule
} from './chatSanitizerBuiltins.js';
import {
  LuminaButton,
  LuminaCheckbox,
  LuminaEmptyState,
  LuminaIconButton,
  LuminaToggle
} from '../../../ui/primitives';
import { useModalStore } from '../../../stores/useModalStore.js';
import {
  regexScriptLibraryService
} from '../../../api/core/hal/prompt/chat/RegexScriptLibraryService.js';
import { chatPromptCompositionService } from '../../../api/core/hal/prompt/ChatPromptCompositionService.js';
import { setBoundRegexDisabled } from '../../../api/core/hal/regex/BoundRegexOverrideStore.js';
import { compileFindRegex } from '../../../api/core/hal/regex/RegexScriptEngine.js';
import { REGEX_PLACEMENTS, type RegexPlacement, type RegexScript } from '../../../types/RegexScriptTypes.js';

const props = withDefaults(defineProps<{
  /** 嵌入聊天底部抽屉时去掉卡片外壳与重复标题 */
  embedded?: boolean;
}>(), {
  embedded: false
});

type ToastKind = 'success' | 'warning' | 'error' | 'info';

interface LuminaToastHost {
  LuminaWeave?: {
    showToast?: (message: string, kind?: ToastKind) => void;
  };
}

interface MatchSegment {
  text: string;
  match: boolean;
}

const modal = useModalStore();
const rootRef = ref<HTMLElement | null>(null);
const fileInput = ref<HTMLInputElement | null>(null);
const scripts = ref<RegexScript[]>([]);
const builtinTagRules = ref<BuiltinTagRule[]>([]);
const boundRegexRules = ref<BoundRegexRule[]>([]);
const replyFilterState = ref<BuiltinReplyFilterState>(resolveReplyFilterState());
const selectedId = ref('');
const view = ref<'list' | 'detail'>('list');
const isWide = ref(false);
const expanded = ref(false);
const saveState = ref<'idle' | 'saving' | 'saved'>('idle');
const testSource = ref<RegexPlacement>(REGEX_PLACEMENTS.aiOutput);
const testInput = ref('');

let saveTimer: number | null = null;
let suppressSave = false;
let resizeObserver: ResizeObserver | null = null;

const placementOptions = [
  { value: REGEX_PLACEMENTS.userInput, label: '用户输入' },
  { value: REGEX_PLACEMENTS.aiOutput, label: 'AI 输出' },
  { value: REGEX_PLACEMENTS.slashCommand, label: '斜杠命令' },
  { value: REGEX_PLACEMENTS.worldInfo, label: '世界书' },
  { value: REGEX_PLACEMENTS.reasoning, label: '推理' }
];

const draft = computed<RegexScript | null>(() => scripts.value.find(script => script.id === selectedId.value) ?? null);

const placementLabel = (placement: RegexPlacement): string =>
  placementOptions.find(option => option.value === placement)?.label ?? String(placement);

const testResult = computed(() => {
  const script = draft.value;
  if (!script || !testInput.value) {
    return { text: '', applied: [] as string[], warnings: [] as string[] };
  }
  return regexScriptLibraryService.test(script, testInput.value, testSource.value);
});

const matchSegments = computed<MatchSegment[]>(() => {
  const script = draft.value;
  const text = testInput.value;
  if (!script || !text) return [{ text, match: false }];
  const compiled = compileFindRegex(script.findRegex);
  if (!compiled) return [{ text, match: false }];
  const global = new RegExp(compiled.source, compiled.flags.includes('g') ? compiled.flags : `${compiled.flags}g`);
  const segments: MatchSegment[] = [];
  let lastIndex = 0;
  let guard = 0;
  let match: RegExpExecArray | null;
  while ((match = global.exec(text)) !== null && guard < 5000) {
    guard += 1;
    if (match[0].length === 0) {
      global.lastIndex += 1;
      continue;
    }
    if (match.index > lastIndex) segments.push({ text: text.slice(lastIndex, match.index), match: false });
    segments.push({ text: match[0], match: true });
    lastIndex = match.index + match[0].length;
  }
  if (lastIndex < text.length) segments.push({ text: text.slice(lastIndex), match: false });
  return segments;
});

const showToast = (message: string, kind: ToastKind = 'info'): void => {
  (window as LuminaToastHost).LuminaWeave?.showToast?.(message, kind);
};

const nullableNumber = (event: Event): number | null => {
  const value = (event.target as HTMLInputElement).value;
  if (value === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const refreshBuiltinState = (): void => {
  builtinTagRules.value = listBuiltinTagRules();
  boundRegexRules.value = listBoundRegexRules();
  replyFilterState.value = resolveReplyFilterState();
};

const toggleBoundRegex = (rule: BoundRegexRule, enabled: boolean): void => {
  if (!rule.sourceEnabled) return;
  setBoundRegexDisabled(rule.id, !enabled);
  boundRegexRules.value = listBoundRegexRules();
};

const openReplyFilterSettings = (): void => {
  openSettingsCategory('conversation');
};

const refresh = (): void => {
  suppressSave = true;
  refreshBuiltinState();
  scripts.value = regexScriptLibraryService.list();
  if (!scripts.value.some(script => script.id === selectedId.value)) {
    selectedId.value = scripts.value[0]?.id ?? '';
  }
  // deep watcher 是异步的，必须等它跑完再解除抑制，否则加载/刷新会被当成一次编辑并立即保存。
  void nextTick(() => {
    suppressSave = false;
  });
};

const selectScript = (id: string): void => {
  selectedId.value = id;
  view.value = 'detail';
};

const addScript = (): void => {
  const script = regexScriptLibraryService.add();
  refresh();
  selectScript(script.id);
};

const moveScript = (index: number, delta: number): void => {
  const target = index + delta;
  if (target < 0 || target >= scripts.value.length) return;
  const [item] = scripts.value.splice(index, 1);
  scripts.value.splice(target, 0, item);
  scheduleSave();
};

const togglePlacement = (placement: RegexPlacement, enabled: boolean): void => {
  const script = draft.value;
  if (!script) return;
  if (enabled) {
    if (!script.placement.includes(placement)) script.placement.push(placement);
  } else {
    script.placement = script.placement.filter(item => item !== placement);
  }
  scheduleSave();
};

const updateTrimStrings = (event: Event): void => {
  const script = draft.value;
  if (!script) return;
  script.trimStrings = (event.target as HTMLTextAreaElement).value
    .split('\n')
    .map(item => item.trim())
    .filter(Boolean);
  scheduleSave();
};

const requestDelete = async (script: RegexScript): Promise<void> => {
  const confirmed = await modal.confirm({
    title: '删除正则脚本',
    message: `删除「${script.scriptName || '未命名脚本'}」？此操作不可撤销。`,
    confirmText: '删除',
    danger: true
  });
  if (!confirmed) return;
  if (selectedId.value === script.id) selectedId.value = '';
  scripts.value = scripts.value.filter(item => item.id !== script.id);
  scheduleSave();
};

const openImport = (): void => fileInput.value?.click();

const handleImportFile = async (event: Event): Promise<void> => {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  input.value = '';
  if (!file) return;
  try {
    const raw: unknown = JSON.parse(await file.text());
    const result = regexScriptLibraryService.importFromRaw(raw);
    if (result.added === 0) {
      showToast(result.diagnostics[0]?.message ?? '导入失败', 'error');
      return;
    }
    refresh();
    showToast(`已导入 ${result.added} 条脚本`, 'success');
  } catch (error) {
    console.warn('[ChatRegexScriptManagerPanel] 导入失败', error);
    showToast('JSON 解析失败，请检查文件格式。', 'error');
  }
};

const exportScripts = (): void => {
  const data = JSON.stringify(regexScriptLibraryService.exportRaw(), null, 4);
  const blob = new Blob([data], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = 'lumina-regex-scripts.json';
  anchor.click();
  URL.revokeObjectURL(url);
};

const scheduleSave = (): void => {
  if (suppressSave) return;
  saveState.value = 'saving';
  if (saveTimer !== null) window.clearTimeout(saveTimer);
  saveTimer = window.setTimeout(() => {
    saveTimer = null;
    regexScriptLibraryService.replaceAll(scripts.value);
    saveState.value = 'saved';
  }, 400);
};

watch(scripts, () => {
  scheduleSave();
}, { deep: true });

onMounted(() => {
  refresh();
  // 绑定正则缓存可能停留在上一次合成；打开面板时按当前预设/角色补热一次。
  void chatPromptCompositionService.warmBoundRegex().then(() => {
    boundRegexRules.value = listBoundRegexRules();
  });
  if (rootRef.value && typeof ResizeObserver !== 'undefined') {
    resizeObserver = new ResizeObserver((entries) => {
      isWide.value = (entries[0]?.contentRect.width ?? 0) >= 840;
    });
    resizeObserver.observe(rootRef.value);
  }
});

onBeforeUnmount(() => {
  if (saveTimer !== null) window.clearTimeout(saveTimer);
  resizeObserver?.disconnect();
});
</script>

<style scoped>
.regex-block.is-expanded {
  position: fixed;
  inset: 12px;
  z-index: 400;
  overflow: auto;
  border-radius: var(--lw-radius-md, 14px);
  background: var(--lw-bg-surface);
  border: 1px solid var(--lw-border-base);
  box-shadow: 0 24px 60px rgba(15, 23, 42, 0.18);
}

.save-state {
  font-size: var(--lw-type-label-small-size, 11px);
  color: var(--lw-text-muted);
}

.builtin-panel {
  margin-top: 12px;
  border-radius: var(--lw-radius-md, 14px);
  background: var(--lw-bg-subtle);
  padding: 10px 12px 12px;
}

.regex-manager.is-embedded .builtin-panel {
  background: var(--lw-bg-surface);
}

.regex-manager.is-embedded .regex-list {
  background: var(--lw-bg-surface);
}

.builtin-tag-list {
  display: flex;
  flex-direction: column;
  margin: 6px 0 0;
  padding: 0;
  list-style: none;
}

.builtin-tag {
  display: flex;
  min-width: 0;
  flex-wrap: wrap;
  align-items: center;
  gap: 4px 8px;
  padding: 6px 0;
  border-bottom: 1px solid var(--lw-border-subtle);
}

.builtin-tag:last-child {
  border-bottom: 0;
  padding-bottom: 2px;
}

.builtin-tag-name {
  color: var(--lw-text-main);
  font-family: var(--lw-font-mono);
  font-size: 11px;
}

.builtin-tag-badge {
  border-radius: 999px;
  background: var(--lw-bg-surface);
  color: var(--lw-text-secondary);
  padding: 1px 8px;
  font-size: 10px;
}

.builtin-tag-badge[data-disposition='hide-content'],
.builtin-tag-badge[data-disposition='hidden-from-ui'] {
  background: color-mix(in srgb, var(--lw-text-main) 8%, transparent);
  color: var(--lw-text-muted);
}

.builtin-tag-badge[data-disposition='body'],
.builtin-tag-badge[data-disposition='preserve'] {
  background: color-mix(in srgb, var(--lw-primary) 12%, transparent);
  color: var(--lw-primary);
}

.builtin-tag-desc {
  min-width: 0;
  flex: 1 1 160px;
  color: var(--lw-text-muted);
  font-size: 11px;
}

.builtin-filter {
  margin-top: 10px;
  border-top: 1px solid var(--lw-border-subtle);
  padding-top: 10px;
}

.builtin-filter-head {
  display: flex;
  align-items: center;
  gap: 8px;
}

.builtin-filter-title {
  color: var(--lw-text-main);
  font-size: var(--lw-type-label-small-size, 12px);
  font-weight: 600;
}

.builtin-filter-state {
  border-radius: 999px;
  background: color-mix(in srgb, var(--lw-text-main) 8%, transparent);
  color: var(--lw-text-muted);
  padding: 1px 8px;
  font-size: 10px;
}

.builtin-filter-state[data-on='true'] {
  background: color-mix(in srgb, var(--lw-primary) 14%, transparent);
  color: var(--lw-primary);
}

.builtin-filter-options {
  display: flex;
  flex-direction: column;
  gap: 4px;
  margin: 8px 0 0;
  padding: 0;
  list-style: none;
}

.builtin-filter-options li {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  color: var(--lw-text-secondary);
  font-size: 11px;
}

.builtin-filter-options li > span {
  min-width: 0;
}

.builtin-option-state {
  flex-shrink: 0;
  min-width: 26px;
  border-radius: 6px;
  background: color-mix(in srgb, var(--lw-text-main) 8%, transparent);
  color: var(--lw-text-muted);
  font-size: 10px;
  font-weight: 600;
  padding: 1px 6px;
  text-align: center;
}

.builtin-option-state[data-on='true'] {
  background: color-mix(in srgb, var(--lw-primary) 14%, transparent);
  color: var(--lw-primary);
}

.builtin-note {
  margin: 8px 0 0;
  color: var(--lw-text-muted);
  font-size: 11px;
  line-height: 1.6;
}

.builtin-link {
  margin-top: 6px;
  border: 0;
  background: transparent;
  color: var(--lw-primary);
  cursor: pointer;
  font: inherit;
  font-size: 11px;
  padding: 0;
}

.builtin-link:hover {
  text-decoration: underline;
}

.bound-panel {
  margin-top: 12px;
  border-radius: var(--lw-radius-md, 14px);
  background: var(--lw-bg-subtle);
  padding: 10px 12px 12px;
}

.regex-manager.is-embedded .bound-panel {
  background: var(--lw-bg-surface);
}

.bound-panel .section-label {
  margin-top: 0;
}

.bound-list {
  display: flex;
  flex-direction: column;
  margin: 0;
  padding: 0;
  list-style: none;
}

.bound-row {
  display: flex;
  min-width: 0;
  flex-wrap: wrap;
  align-items: center;
  gap: 4px 8px;
  padding: 6px 0;
  border-bottom: 1px solid var(--lw-border-subtle);
}

.bound-row:last-child {
  border-bottom: 0;
  padding-bottom: 2px;
}

.bound-row.is-disabled .bound-name,
.bound-row.is-disabled .bound-source,
.bound-row.is-disabled .bound-tag {
  opacity: 0.55;
}

.bound-toggle {
  flex-shrink: 0;
}

.bound-name {
  min-width: 0;
  color: var(--lw-text-main);
  font-size: 11px;
}

.bound-source {
  flex-shrink: 0;
  border-radius: 6px;
  background: color-mix(in srgb, var(--lw-text-main) 8%, transparent);
  color: var(--lw-text-muted);
  padding: 1px 7px;
  font-size: 10px;
}

.bound-source[data-source='preset'] {
  background: color-mix(in srgb, var(--lw-primary) 12%, transparent);
  color: var(--lw-primary);
}

.bound-placements {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  margin-left: auto;
}

.bound-tag {
  border-radius: 999px;
  background: color-mix(in srgb, var(--lw-text-main) 7%, transparent);
  color: var(--lw-text-muted);
  padding: 1px 7px;
  font-size: 10px;
}

.section-label {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 2px 8px;
  margin-top: 12px;
}

.builtin-panel .section-label {
  margin-top: 0;
}

.section-label > span:first-child {
  color: var(--lw-text-main);
  font-size: var(--lw-type-label-size, 13px);
  font-weight: 600;
}

.section-hint {
  min-width: 0;
  flex: 1 1 220px;
  color: var(--lw-text-muted);
  font-size: 11px;
  line-height: 1.5;
}

.regex-body {
  display: grid;
  gap: 12px;
  padding-top: 12px;
}

.regex-body[data-view='split'] {
  grid-template-columns: minmax(180px, 260px) minmax(0, 1fr);
}

.regex-body[data-view='detail'] .regex-list {
  display: none;
}

.regex-body[data-view='list'] .regex-detail {
  display: none;
}

.regex-list {
  display: flex;
  max-height: 520px;
  min-width: 0;
  flex-direction: column;
  gap: 4px;
  overflow: auto;
  border-radius: var(--lw-radius-sm);
  background: var(--lw-bg-subtle);
  padding: 8px;
}

.regex-row {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: 3px;
  border: 1px solid transparent;
  border-radius: var(--lw-radius-xs, 8px);
  background: transparent;
  padding: 7px 9px;
  text-align: left;
  cursor: pointer;
}

.regex-row:hover {
  background: var(--lw-bg-hover, var(--lw-bg-elevated));
}

.regex-row.is-selected {
  border-color: var(--lw-primary);
  background: var(--lw-bg-elevated);
}

.regex-row.is-disabled .regex-row-name {
  opacity: 0.55;
}

.regex-row-name {
  overflow: hidden;
  color: var(--lw-text-main);
  font-size: var(--lw-type-label-size, 13px);
  font-weight: 600;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.regex-row-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}

.tag {
  border-radius: 999px;
  background: var(--lw-bg-subtle);
  color: var(--lw-text-muted);
  padding: 1px 6px;
  font-size: 10px;
}

.regex-row-actions {
  display: flex;
  align-items: center;
  gap: 2px;
  margin-top: 2px;
}

.regex-detail {
  display: flex;
  min-width: 0;
  flex-direction: column;
  gap: 10px;
}

.detail-head {
  display: flex;
  align-items: center;
  gap: 8px;
}

.back-button {
  display: inline-flex;
  align-items: center;
  gap: 2px;
  border: 0;
  background: transparent;
  color: var(--lw-text-secondary);
  font: inherit;
  font-size: var(--lw-type-label-small-size, 12px);
  cursor: pointer;
}

.detail-name {
  min-width: 0;
  flex: 1;
  border: 1px solid transparent;
  border-radius: var(--lw-radius-sm);
  background: transparent;
  color: var(--lw-text-main);
  font: inherit;
  font-size: var(--lw-type-title-small-size, 15px);
  font-weight: 650;
  padding: 5px 8px;
  outline: none;
}

.detail-name:hover,
.detail-name:focus {
  border-color: var(--lw-border-base);
  background: var(--lw-bg-elevated);
}

.regex-editor {
  display: grid;
  gap: 12px;
}

.regex-body[data-view='split'] .regex-editor {
  grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
}

.editor-column,
.test-column {
  display: flex;
  min-width: 0;
  flex-direction: column;
  gap: 8px;
}

.field {
  display: flex;
  min-width: 0;
  flex-direction: column;
  gap: 3px;
}

.field > span {
  color: var(--lw-text-muted);
  font-size: var(--lw-type-label-small-size, 11px);
}

.field input,
.field select,
.mono-input {
  width: 100%;
  border: 1px solid var(--lw-border-base);
  border-radius: var(--lw-radius-sm);
  background: var(--lw-bg-elevated);
  color: var(--lw-text-main);
  font: inherit;
  font-size: var(--lw-type-body-small-size, 12px);
  padding: 6px 8px;
  outline: none;
}

.mono-input {
  font-family: var(--lw-font-mono);
  line-height: 1.5;
  resize: vertical;
}

.field input:focus,
.field select:focus,
.mono-input:focus {
  border-color: var(--lw-primary);
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--lw-primary) 12%, transparent);
}

.editor-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(min(100%, 130px), 1fr));
  gap: 8px;
}

.placement-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 4px 12px;
}

.placement-option {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  color: var(--lw-text-secondary);
  font-size: var(--lw-type-label-small-size, 12px);
}

.toggle-row {
  display: flex;
  flex-wrap: wrap;
  gap: 8px 16px;
}

.field-toggle {
  flex-direction: row;
  align-items: center;
  gap: 6px;
}

.test-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.test-title {
  color: var(--lw-text-main);
  font-size: var(--lw-type-label-size, 13px);
  font-weight: 600;
}

.test-head select {
  border: 1px solid var(--lw-border-base);
  border-radius: var(--lw-radius-sm);
  background: var(--lw-bg-elevated);
  color: var(--lw-text-main);
  font: inherit;
  font-size: var(--lw-type-label-small-size, 12px);
  padding: 4px 8px;
}

.test-result {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.test-result-label {
  margin: 0;
  color: var(--lw-text-muted);
  font-size: var(--lw-type-label-small-size, 11px);
}

.test-preview {
  margin: 0;
  min-height: 44px;
  max-height: 160px;
  overflow: auto;
  border: 1px solid var(--lw-border-base);
  border-radius: var(--lw-radius-sm);
  background: var(--lw-bg-subtle);
  color: var(--lw-text-main);
  font-family: var(--lw-font-mono);
  font-size: 12px;
  line-height: 1.6;
  padding: 8px;
  white-space: pre-wrap;
  word-break: break-word;
}

.test-preview mark {
  border-radius: 3px;
  background: color-mix(in srgb, var(--lw-primary) 22%, transparent);
  color: inherit;
  padding: 0 1px;
}

.test-error {
  margin: 0;
  color: var(--lw-danger, #b91c1c);
  font-size: var(--lw-type-label-small-size, 12px);
}
</style>
