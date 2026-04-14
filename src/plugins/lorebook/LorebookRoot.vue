<template>
  <LorebookWorkspace :mode="props.mode" :is-mobile="props.isMobile" />
</template>

<script setup lang="ts">
import LorebookWorkspace from './components/LorebookWorkspace.vue';

const props = defineProps<{
  mode?: 'large' | 'small',
  isMobile?: boolean
}>();
</script>
