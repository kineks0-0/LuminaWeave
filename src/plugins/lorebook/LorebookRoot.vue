<template>
  <LorebookWorkspace
    :mode="props.mode"
    :activity="props.activity"
    :is-mobile="props.isMobile"
    :skin-variant="workspaceVariant || 'default'"
    :skin-style="workspaceSkinStyle"
  />
</template>

<script setup lang="ts">
import { computed } from 'vue';
import LorebookWorkspace from './components/LorebookWorkspace.vue';
import type { ActivityDescriptor } from '../../platform/activity/types.js';
import { useSurfaceSkin } from '../../desktop-modes/core/useSurfaceSkin.js';

const props = defineProps<{
  mode?: 'large' | 'small',
  activity?: ActivityDescriptor,
  isMobile?: boolean
}>();

const { cssVars: workspaceSkinVars, variant: workspaceVariant } = useSurfaceSkin('lorebook.workspace');
const workspaceSkinStyle = computed(() => workspaceSkinVars.value);
</script>
