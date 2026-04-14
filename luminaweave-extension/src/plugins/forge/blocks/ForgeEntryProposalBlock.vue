<template>
  <div class="entry-proposal" :class="[processedState, category]">
    <!-- Header -->
    <div class="proposal-header">
      <div class="header-left">
        <span class="kicker-dot"></span>
        <span class="kicker-label">{{ categoryLabel }}</span>
      </div>
      <!-- View toggle -->
      <div class="view-toggle">
        <button
          class="toggle-btn"
          :class="{ active: viewMode === 'raw' }"
          @click="viewMode = 'raw'"
        >原文</button>
        <button
          class="toggle-btn"
          :class="{ active: viewMode === 'preview' }"
          @click="viewMode = 'preview'"
        >预览</button>
      </div>
    </div>

    <!-- Title row -->
    <div class="proposal-title">
      {{ displayTitle }}
      <span v-if="isIdTitle" class="title-hint">（标题未提供）</span>
    </div>

    <!-- Raw view -->
    <div v-if="viewMode === 'raw'" class="proposal-body">
      <template v-if="isJson && displayFields">
        <div v-for="(value, key) in displayFields" :key="key" class="field-row">
          <span class="field-key">{{ key }}</span>
          <span class="field-val">{{ value }}</span>
        </div>
      </template>
      <span v-else class="text-preview">{{ previewText }}</span>
    </div>

    <!-- Preview view -->
    <div v-else class="proposal-preview">
      <ForgeLorebookPreview :entry="previewEntry" :minimal="true" />
    </div>

    <!-- Footer: pending -->
    <div v-if="processedState === 'pending'" class="proposal-footer pending">
      <button class="btn btn-approve" @click="handleApprove">加入工作区</button>
      <button class="btn btn-reject" @click="handleReject">舍弃</button>
    </div>

    <!-- Footer: processed -->
    <div v-else class="proposal-footer processed">
      <span class="state-badge" :class="processedState">
        {{ processedState === 'approved' ? '已加入工作区' : '已舍弃' }}
      </span>
      <button v-if="processedState === 'approved'" class="btn-text" @click="handleUndo">撤回</button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import { useCardMakerStore } from '../CardMakerStore';
import ForgeLorebookPreview from '../ForgeLorebookPreview.vue';

const props = defineProps<{
    id: string;
    title: string;
    content: string;
    category?: string;
    indent?: number;
}>();

const cardMakerStore = useCardMakerStore();
const internalState = ref<'pending' | 'approved' | 'rejected'>('pending');
const viewMode = ref<'raw' | 'preview'>('raw');

const processedState = computed(() => {
    const isCommitted = cardMakerStore.commitReadyEntries.some(
        (e: any) => e.targetEntryId === props.id && e.proposedContent === contentStr.value
    );
    if (isCommitted) return 'approved';
    return internalState.value;
});

const categoryMap: Record<string, string> = {
    interaction_paradigm: '交互范式',
    aesthetic_program: '美学纲领',
    creation_blueprint: '创作蓝图',
    power_system: '力量与超凡',
    factions: '势力与组织',
    economy: '经济与资源',
    philosophy: '信仰与哲学',
    culture: '文化与习俗',
    characters: '角色设定',
    plot: '剧情元数据',
};

const categoryLabel = computed(() =>
    (props.category && categoryMap[props.category]) || '条目建议'
);

/** 将 content 规范化为字符串（模型有时直接传入对象） */
const contentStr = computed(() =>
    typeof props.content === 'string' ? props.content : JSON.stringify(props.content)
);

/** 从条目内容中提取标题字段（支持 JSON / YAML / TOML） */
const titleFromContent = computed(() => {
    const raw = contentStr.value.trim();

    // 已经是对象（模型直接传入对象的情况）
    if (typeof props.content === 'object' && props.content !== null) {
        const obj = props.content as any;
        const t = obj.title || obj['标题'] || obj.name || obj.comment || obj.description;
        if (t && typeof t === 'string') return t.trim();
    }

    // JSON（含代码块）
    const jsonCandidate = raw.replace(/^```json\s*/i, '').replace(/\s*```$/, '').trim();
    if (jsonCandidate.startsWith('{') || jsonCandidate.startsWith('[')) {
        try {
            const obj = JSON.parse(jsonCandidate);
            const src = Array.isArray(obj) ? obj[0] : obj;
            const t = src?.title || src?.['标题'] || src?.name || src?.comment || src?.description;
            if (t && typeof t === 'string') return t.trim();
        } catch { /* ignore */ }
    }

    // YAML: `title: value`
    const yamlMatch = raw.match(/^title\s*:\s*["']?(.+?)["']?\s*$/im);
    if (yamlMatch) return yamlMatch[1].trim();

    // TOML: `title = "value"`
    const tomlMatch = raw.match(/^title\s*=\s*["'](.+?)["']\s*$/im);
    if (tomlMatch) return tomlMatch[1].trim();

    return '';
});

/**
 * 展示标题优先级：
 * 1. props.title（若不同于 id）
 * 2. JSON 内容中提取的标题
 * 3. props.title（即使和 id 相同，也展示）
 * 4. 截取 id 短名
 */
const displayTitle = computed(() => {
    if (props.title && props.title !== props.id) return props.title;
    if (titleFromContent.value) return titleFromContent.value;
    if (props.title) return props.title;
    return props.id ? props.id.slice(0, 24) : '未命名条目';
});

/** 当没有任何有效标题来源时才显示"标题未提供"提示 */
const isIdTitle = computed(() => !props.title && !titleFromContent.value);

const parsedContent = computed(() => {
    if (typeof props.content === 'object' && props.content !== null) return props.content;
    try { return JSON.parse(contentStr.value); } catch { return null; }
});

const isJson = computed(() =>
    parsedContent.value !== null && typeof parsedContent.value === 'object'
);

const displayFields = computed(() => {
    if (!isJson.value) return null;
    const data = parsedContent.value;
    const result: Record<string, string> = {};
    const keys = Object.keys(data).filter(k => typeof data[k] === 'string' || typeof data[k] === 'number');
    keys.slice(0, 4).forEach(k => {
        result[k] = String(data[k]).slice(0, 100) + (String(data[k]).length > 100 ? '…' : '');
    });
    return result;
});

const previewText = computed(() =>
    contentStr.value.slice(0, 200) + (contentStr.value.length > 200 ? '…' : '')
);

/** 构造 LuminaLorebookEntry 供预览组件使用 */
const previewEntry = computed((): LuminaLorebookEntry => ({
    uid: props.id,
    comment: displayTitle.value,
    content: contentStr.value,
    key: [],
    keysecondary: [],
    order: 100,
    disable: false,
    constant: false,
    selective: false,
    selectiveLogic: 0,
    position: 0,
    depth: 0,
    probability: 100,
    scan_depth: 0
}));

const handleApprove = () => {
    cardMakerStore.upsertStagingEntry({
        targetEntryId: props.id,
        proposedContent: contentStr.value,
        description: displayTitle.value,
        category: props.category,
        originalContent: '',
        sourceTag: 'entry_proposal_block',
        layer: null,
        sourceMessageId: null,
        sourceSessionId: null
    });
    const staging = cardMakerStore.stagingEntries.find((e: any) => e.targetEntryId === props.id);
    if (staging) cardMakerStore.moveStagingToCommitReady(staging.id);
    internalState.value = 'approved';
};

const handleReject = () => {
    const staging = cardMakerStore.stagingEntries.find(
        (e: any) => e.targetEntryId === props.id && e.proposedContent === contentStr.value
    );
    if (staging) cardMakerStore.removeStagingEntry(staging.id);
    internalState.value = 'rejected';
};

const handleUndo = () => {
    const committed = cardMakerStore.commitReadyEntries.find(
        (e: any) => e.targetEntryId === props.id && e.proposedContent === contentStr.value
    );
    if (committed) cardMakerStore.moveCommitReadyToStaging(committed.id);
    internalState.value = 'pending';
};
</script>

<style scoped>
.entry-proposal {
  --accent: var(--lw-primary);
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 14px 16px;
  border-radius: 14px;
  border: 1px solid var(--lw-border-base);
  background: var(--lw-bg-elevated);
  margin: 6px 0;
  max-width: 440px;
  transition: border-color 0.15s ease;
}

.entry-proposal:hover {
  border-color: color-mix(in srgb, var(--accent) 30%, var(--lw-border-base));
}

/* Category accent colors */
.interaction_paradigm { --accent: #f59e0b; }
.aesthetic_program    { --accent: #ec4899; }
.creation_blueprint   { --accent: #3b82f6; }
.factions             { --accent: #8b5cf6; }
.characters           { --accent: #10b981; }

/* Header row */
.proposal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.header-left {
  display: flex;
  align-items: center;
  gap: 6px;
}

.kicker-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--accent);
  flex-shrink: 0;
}

.kicker-label {
  font-size: 11px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--accent);
}

/* View toggle */
.view-toggle {
  display: flex;
  gap: 2px;
  background: var(--lw-bg-base);
  border: 1px solid var(--lw-border-base);
  border-radius: 8px;
  padding: 2px;
}

.toggle-btn {
  font-size: 11px;
  font-weight: 600;
  padding: 3px 10px;
  border-radius: 6px;
  border: none;
  background: transparent;
  color: var(--lw-text-tertiary);
  cursor: pointer;
  transition: background 0.12s ease, color 0.12s ease;
  line-height: 1;
}

.toggle-btn.active {
  background: var(--lw-bg-elevated);
  color: var(--lw-text-main);
  box-shadow: 0 1px 3px rgba(0,0,0,0.08);
}

.toggle-btn:not(.active):hover {
  color: var(--lw-text-secondary);
}

/* Title */
.proposal-title {
  font-size: 15px;
  font-weight: 700;
  color: var(--lw-text-main);
  line-height: 1.3;
  display: flex;
  align-items: baseline;
  gap: 6px;
  flex-wrap: wrap;
}

.title-hint {
  font-size: 11px;
  font-weight: 400;
  color: var(--lw-text-muted);
}

/* Raw body */
.proposal-body {
  font-size: 12px;
  line-height: 1.55;
  color: var(--lw-text-secondary);
  background: color-mix(in srgb, var(--lw-bg-base) 60%, transparent);
  border-radius: 8px;
  padding: 10px 12px;
  border: 1px solid color-mix(in srgb, var(--lw-border-base) 40%, transparent);
}

.field-row {
  display: grid;
  grid-template-columns: minmax(40px, auto) 1fr;
  gap: 8px;
  align-items: baseline;
  padding: 3px 0;
  border-bottom: 1px solid color-mix(in srgb, var(--lw-border-base) 20%, transparent);
}

.field-row:last-child {
  border-bottom: none;
  padding-bottom: 0;
}

.field-key {
  font-size: 10px;
  font-weight: 600;
  color: var(--lw-text-muted);
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.field-val {
  color: var(--lw-text-main);
  font-size: 12px;
  word-break: break-word;
}

.text-preview {
  white-space: pre-wrap;
  word-break: break-word;
}

/* Preview view */
.proposal-preview {
  border-radius: 10px;
  overflow: hidden;
}

/* Footer */
.proposal-footer {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 2px;
}

.proposal-footer.processed {
  padding-top: 0;
}

.btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 6px 14px;
  border-radius: 8px;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.15s ease, border-color 0.15s ease, color 0.15s ease;
  border: 1px solid var(--lw-border-base);
  background: var(--lw-bg-base);
  color: var(--lw-text-secondary);
  line-height: 1;
}

.btn-approve:hover {
  background: color-mix(in srgb, #10b981 12%, transparent);
  border-color: #10b981;
  color: #10b981;
}

.btn-reject:hover {
  background: color-mix(in srgb, var(--lw-text-muted) 10%, transparent);
  border-color: var(--lw-text-muted);
}

.state-badge {
  font-size: 11px;
  font-weight: 600;
  color: var(--lw-text-muted);
}

.state-badge.approved { color: #10b981; }
.state-badge.rejected { opacity: 0.5; }

.btn-text {
  background: none;
  border: none;
  font-size: 11px;
  font-weight: 600;
  color: var(--accent);
  cursor: pointer;
  padding: 2px 6px;
  border-radius: 4px;
  margin-left: auto;
  transition: background 0.15s ease;
}

.btn-text:hover {
  background: color-mix(in srgb, var(--accent) 10%, transparent);
}
</style>
