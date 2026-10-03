<template>
  <span class="telegram-avatar" :style="sizeStyle">
    <img v-if="src && !broken" :src="src" :alt="name" @error="broken = true">
    <span v-else class="telegram-avatar__initial" :style="initialStyle" aria-hidden="true">{{ initial }}</span>
  </span>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { resolveAvatarHue } from '../../presentation/telegramChatList.js';

const props = withDefaults(defineProps<{
  src: string | null;
  name: string;
  initial?: string;
  size?: number;
}>(), {
  initial: '',
  size: 54
});

const broken = ref(false);
watch(() => props.src, () => { broken.value = false; });

const sizeStyle = computed(() => ({ '--telegram-avatar-size': `${props.size}px` }));
const initialStyle = computed(() => {
  const hue = resolveAvatarHue(props.name);
  return { background: `linear-gradient(180deg, oklch(0.74 0.13 ${hue}), oklch(0.62 0.14 ${hue}))` };
});
const initial = computed(() => (props.initial || props.name.trim().slice(0, 1) || '?').toUpperCase());
</script>

<style scoped>
.telegram-avatar {
  display: inline-grid;
  width: var(--telegram-avatar-size);
  height: var(--telegram-avatar-size);
  flex: 0 0 auto;
  overflow: hidden;
  border-radius: 999px;
}

.telegram-avatar img,
.telegram-avatar__initial {
  width: 100%;
  height: 100%;
}

.telegram-avatar img {
  object-fit: cover;
}

.telegram-avatar__initial {
  display: grid;
  place-items: center;
  color: var(--lw-text-inverse);
  font-size: calc(var(--telegram-avatar-size) * 0.4);
  font-weight: 600;
}
</style>
