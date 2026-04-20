<template>
  <LorebookWorkspace
    :mode="props.mode"
    :is-mobile="props.isMobile"
    :skin-variant="workspaceVariant || 'default'"
    :skin-style="workspaceSkinStyle"
  />
</template>

<script setup lang="ts">
import { computed } from 'vue';
import LorebookWorkspace from './components/LorebookWorkspace.vue';
import { useComponentSkin } from '../../theme/useComponentSkin';

const props = defineProps<{
  mode?: 'large' | 'small',
  isMobile?: boolean
}>();

const { cssVars: workspaceSkinVars, variant: workspaceVariant } = useComponentSkin('lorebook.workspace');
const workspaceSkinStyle = computed(() => workspaceSkinVars.value);
</script>
