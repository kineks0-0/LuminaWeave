<template>
  <LuminaPanel v-if="!plain" as="section" variant="elevated" padding="md" :class="panelClass">
    <slot />
  </LuminaPanel>
  <div v-else :class="panelClass">
    <slot />
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { cn } from '../../../ui/cn.js';
import { LuminaPanel } from '../../../ui/primitives';

const props = withDefaults(defineProps<{
  core?: boolean;
  /** 嵌入抽屉等容器时去掉卡片外壳，只保留内容排布 */
  plain?: boolean;
}>(), {
  core: false,
  plain: false
});

const panelClass = computed(() => props.plain
  ? 'tw:flex tw:min-w-0 tw:flex-col'
  : cn(
    'plugin-settings-block lw-card tw:flex tw:min-w-0 tw:flex-col tw:hover:border-lw-border tw:hover:shadow-none',
    props.core && 'core-block tw:col-span-full'
  ));
</script>
