<template>
  <div
    class="luminaweave-app-root"
    :data-theme="resolvedTheme"
    :data-desktop-mode="activeDesktopModeId"
    :data-motion="motionPerformanceSetting"
    :data-smooth-scroll="smoothScrollSetting ? 'true' : undefined"
    :data-layout-mode="layoutMode"
    :style="appRootStyle"
  >
    <transition name="fade">
      <MiniSidebar v-if="!isExpanded && showMiniSidebar" @expand="emit('expand')" />
    </transition>

    <transition name="panel-slide">
      <div
        v-if="isExpanded"
        class="lw-fullscreen-panel"
        :data-shell-variant="shellAppVariant || 'default'"
        :style="rootFrameStyle"
      >
        <slot />
      </div>
    </transition>

    <ToastNotification />
    <GlobalConfirmationModal />
  </div>
</template>

<script setup lang="ts">
import type { CSSProperties } from 'vue';
import '../styles/app-shell-base.css';
import MiniSidebar from '../components/MiniSidebar.vue';
import ToastNotification from '../components/ToastNotification.vue';
import GlobalConfirmationModal from '../components/common/GlobalConfirmationModal.vue';

defineProps<{
  isExpanded: boolean;
  resolvedTheme: string;
  activeDesktopModeId: string;
  motionPerformanceSetting: string;
  smoothScrollSetting: boolean;
  layoutMode: 'traditional' | 'freeform';
  appRootStyle: CSSProperties;
  rootFrameStyle: CSSProperties;
  shellAppVariant: string;
  showMiniSidebar?: boolean;
}>();

const emit = defineEmits<{
  expand: [];
}>();
</script>
