<template>
  <span class="telegram-avatar" :class="{ 'is-placeholder': usePlaceholder }" :style="sizeStyle">
    <img v-if="hasImage" :src="src || ''" :alt="name" @error="broken = true">
    <LuminaAvatarPlaceholder v-else-if="usePlaceholder" class="telegram-avatar__placeholder" />
    <span v-else class="telegram-avatar__initial" :style="initialStyle" aria-hidden="true">{{ initial }}</span>
  </span>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import LuminaAvatarPlaceholder from '../../../../ui/primitives/LuminaAvatarPlaceholder.vue';
import { isPlaceholderTelegramAvatar, resolveAvatarHue } from '../../presentation/telegramChatList.js';

const props = withDefaults(defineProps<{
  src: string | null;
  name: string;
  initial?: string;
  size?: number;
  defaultAvatar?: string;
}>(), {
  initial: '',
  size: 54,
  defaultAvatar: ''
});

const broken = ref(false);
watch(() => props.src, () => { broken.value = false; });

const sizeStyle = computed(() => ({ '--telegram-avatar-size': `${props.size}px` }));
const hasImage = computed(() => Boolean(props.src) && !broken.value && !isPlaceholderTelegramAvatar(props.src, props.defaultAvatar));
const hasInitial = computed(() => Boolean((props.initial || props.name).trim()));
const usePlaceholder = computed(() => !hasImage.value && !hasInitial.value);
const initialStyle = computed(() => {
  const hue = resolveAvatarHue(props.name);
  return { background: `linear-gradient(180deg, oklch(0.74 0.13 ${hue}), oklch(0.62 0.14 ${hue}))` };
});
const initial = computed(() => (props.initial || props.name.trim().slice(0, 1)).toUpperCase());
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

.telegram-avatar.is-placeholder {
  background: color-mix(in srgb, var(--lw-text-muted) 18%, transparent);
  color: var(--lw-text-muted);
}

.telegram-avatar__placeholder {
  width: 56%;
  height: 56%;
  place-self: center;
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
