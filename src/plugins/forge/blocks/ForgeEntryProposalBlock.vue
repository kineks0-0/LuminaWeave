<template>
  <LuminaPanel variant="elevated" padding="sm" :class="proposalClass">
    <!-- Header -->
    <div class="tw:flex tw:items-center tw:justify-between tw:gap-2">
      <div class="tw:flex tw:items-center tw:gap-1.5">
        <span class="tw:size-1.5 tw:shrink-0 tw:rounded-lw-pill tw:bg-lw-primary"></span>
        <span class="tw:text-xs tw:font-bold tw:uppercase tw:text-lw-primary">{{ categoryLabel }}</span>
      </div>
      <!-- View toggle -->
      <LuminaSegmentedControl :modelValue="viewMode" :options="viewOptions" @update:modelValue="setViewMode" />
    </div>

    <!-- Title row -->
    <div class="tw:flex tw:flex-wrap tw:items-baseline tw:gap-1.5 tw:text-[length:var(--lw-type-title-small-size)] tw:font-bold tw:leading-snug tw:text-lw-text tw:text-balance">
      {{ displayTitle }}
      <span v-if="isIdTitle" class="tw:text-xs tw:font-normal tw:text-lw-text-muted">（标题未提供）</span>
    </div>

    <!-- Raw view -->
    <div v-if="viewMode === 'raw'" class="tw:rounded-lw-sm tw:border tw:border-lw-border-subtle tw:bg-lw-subtle tw:px-3 tw:py-2.5 tw:text-xs tw:leading-5 tw:text-lw-text-secondary tw:text-pretty">
      <template v-if="isJson && displayFields">
        <div v-for="(value, key) in displayFields" :key="key" class="tw:grid tw:grid-cols-[minmax(40px,auto)_1fr] tw:items-baseline tw:gap-2 tw:border-b tw:border-lw-border-subtle tw:py-1 tw:last:border-b-0 tw:last:pb-0">
          <span class="tw:text-xs tw:font-bold tw:uppercase tw:text-lw-text-muted">{{ key }}</span>
          <span class="tw:break-words tw:text-xs tw:text-lw-text">{{ value }}</span>
        </div>
      </template>
      <span v-else class="tw:whitespace-pre-wrap tw:break-words">{{ previewText }}</span>
    </div>

    <!-- Preview view -->
    <div v-else class="tw:overflow-hidden tw:rounded-lw-sm">
      <ForgeLorebookPreview :entry="previewEntry" :minimal="true" />
    </div>

    <!-- Footer: pending -->
    <div v-if="processedState === 'pending'" class="tw:mt-0.5 tw:flex tw:items-center tw:gap-2">
      <LuminaButton variant="soft" tone="primary" size="sm" @click="handleApprove">加入工作区</LuminaButton>
      <LuminaButton variant="ghost" size="sm" @click="handleReject">舍弃</LuminaButton>
    </div>

    <!-- Footer: processed -->
    <div v-else class="tw:flex tw:items-center tw:gap-2">
      <span :class="stateBadgeClass">
        {{ processedState === 'approved' ? '已加入工作区' : '已舍弃' }}
      </span>
      <LuminaButton v-if="processedState === 'approved'" class="tw:ml-auto" variant="ghost" size="sm" @click="handleUndo">撤回</LuminaButton>
    </div>
  </LuminaPanel>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import { useCardMakerStore } from '../CardMakerStore.js';
import ForgeLorebookPreview from '../project/ForgeLorebookPreview.vue';
import { cn } from '../../../ui/cn.js';
import { LuminaButton, LuminaPanel, LuminaSegmentedControl } from '../../../ui/primitives';

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
const viewOptions = [
    { label: '原文', value: 'raw' },
    { label: '预览', value: 'preview' }
];

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

const proposalClass = computed(() => cn(
    'tw:my-1.5 tw:flex tw:max-w-[440px] tw:flex-col tw:gap-2.5 tw:transition-[border-color,opacity] tw:duration-150 tw:ease-out tw:hover:border-lw-primary',
    processedState.value === 'approved' && 'tw:border-lw-primary',
    processedState.value === 'rejected' && 'tw:opacity-60'
));

const stateBadgeClass = computed(() => cn(
    'tw:text-xs tw:font-bold tw:text-lw-text-muted',
    processedState.value === 'approved' && 'tw:text-emerald-600',
    processedState.value === 'rejected' && 'tw:opacity-60'
));

const setViewMode = (nextValue: string) => {
    if (nextValue === 'raw' || nextValue === 'preview') {
        viewMode.value = nextValue;
    }
};

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
