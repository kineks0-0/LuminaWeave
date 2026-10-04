<template>
  <TimelineLargeCanvas v-if="isLargeCanvas" :mode="resolvedMode" :is-mobile="isMobile" />
  <TimelineSmallList v-else :mode="resolvedMode" />
</template>

<script setup lang="ts">
import { computed, defineAsyncComponent } from 'vue';
import { activityFromLegacyMode, normalizeActivityDescriptor } from '../../platform/activity/activityLaunchResolver.js';
import { useSurfaceSkin } from '../../desktop-modes/core/useSurfaceSkin.js';
import { useSurfaceInput } from '../../platform/surface/useSurfaceRuntimeContext.js';
import TimelineSmallList from './TimelineSmallList.vue';

const TimelineLargeCanvas = defineAsyncComponent(() => import('./TimelineLargeCanvas.vue'));

type TimelineMode = 'small' | 'large';

const props = useSurfaceInput('timeline.navigator');

const { variant: timelineVariant } = useSurfaceSkin('timeline.root');
const normalizedActivity = computed(() => normalizeActivityDescriptor(props.activity, activityFromLegacyMode(props.mode)));
const resolvedMode = computed<TimelineMode>(() => normalizedActivity.value.size === 'default' ? 'large' : 'small');
const isMobileDevice = computed(() => {
  return props.isMobile || (typeof window !== 'undefined' && ('ontouchstart' in window || navigator.maxTouchPoints > 0));
});
const isTelegramSingleColumnTimeline = computed(() => timelineVariant.value === 'telegram' && isMobileDevice.value);
const isLargeCanvas = computed(() => resolvedMode.value === 'large' && !isTelegramSingleColumnTimeline.value);
const isMobile = computed(() => props.isMobile);
</script>
<style>
/* 样式保持不变 */
.lw-timeline-container {
  display: flex;
  flex-direction: column;
  height: 100%;
  background:
    linear-gradient(180deg, rgba(var(--lw-bg-elevated-rgb), 0.42), rgba(var(--lw-bg-elevated-rgb), 0));
  position: relative;
  font-family: inherit;
  overflow: hidden;
}

.lw-timeline-container.large {
  background: var(--lw-timeline-canvas-bg, var(--lw-bg-app));
}

/* 页眉工具栏 - 极简 Modern Geek */
.large-header {
  padding: 12px 24px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  background: var(--lw-timeline-header-bg, color-mix(in srgb, var(--lw-bg-elevated) 88%, transparent));
  backdrop-filter: var(--lw-glass-blur);
  border-bottom: 1px solid var(--lw-border-base);
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  z-index: 100;
}

.header-left {
  display: flex;
  align-items: center;
  gap: 20px;
}

.header-title {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: var(--lw-type-title-small-size);
  font-weight: var(--lw-type-title-small-weight);
  color: var(--lw-text-main);
  letter-spacing: 0;
}

.header-source-pill {
  font-size: var(--lw-type-label-small-size);
  font-weight: var(--lw-type-title-small-weight);
  color: var(--lw-timeline-chip-color, var(--lw-text-secondary));
  background: var(--lw-timeline-chip-bg, var(--lw-bg-subtle));
  border: 1px solid var(--lw-timeline-chip-border, var(--lw-border-base));
  padding: 4px 8px;
  border-radius: 999px;
}

.timeline-context-pill {
  display: inline-flex;
  align-items: center;
  align-self: flex-start;
  padding: 7px 10px;
  border-radius: 999px;
  background: var(--lw-timeline-chip-bg, var(--lw-bg-subtle));
  color: var(--lw-timeline-chip-color, var(--lw-text-secondary));
  border: 1px solid var(--lw-timeline-chip-border, var(--lw-border-base));
  font-size: var(--lw-type-label-small-size);
  font-weight: var(--lw-type-title-small-weight);
  letter-spacing: 0.02em;
}

.timeline-context-pill.compact {
  margin-bottom: 16px;
}

.timeline-source-switcher {
  display: flex;
  align-items: center;
  gap: 8px;
}

.timeline-source-switcher.compact {
  padding: 0 0 16px;
  overflow-x: auto;
}

.source-chip {
  border: 1px solid var(--lw-border-base);
  background: var(--lw-timeline-chip-bg, var(--lw-surface-container-lowest));
  color: var(--lw-timeline-chip-color, var(--lw-text-dim));
  border-color: var(--lw-timeline-chip-border, var(--lw-border-base));
  border-radius: 999px;
  padding: 7px 12px;
  display: inline-flex;
  align-items: center;
  gap: 8px;
  font-size: var(--lw-type-body-small-size);
  font-weight: var(--lw-type-title-small-weight);
  cursor: pointer;
  transition: var(--lw-transition);
  white-space: nowrap;
}

.source-chip strong {
  font-size: var(--lw-type-label-small-size);
  color: inherit;
  opacity: 0.78;
}

.source-chip.active {
  background: color-mix(in srgb, var(--lw-primary) 16%, var(--lw-timeline-chip-bg, var(--lw-surface-container-lowest)));
  border-color: var(--lw-border-active);
  color: var(--lw-text-main);
  box-shadow: var(--lw-shadow);
}

.source-chip:hover {
  transform: translateY(-1px);
  border-color: var(--lw-border-hover);
  color: var(--lw-text-main);
}

.source-chip.active:hover {
  color: #fff;
}

.header-tools {
  display: flex;
  gap: 6px;
  padding-left: 20px;
  border-left: 1px solid var(--lw-border-base);
}

.tool-btn {
  padding: 6px;
  min-width: 32px;
  height: 32px;
}

.active-pulse {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: var(--lw-type-label-small-size);
  font-weight: var(--lw-type-title-small-weight);
  color: var(--lw-success);
  background: color-mix(in srgb, var(--lw-success) 12%, white);
  padding: 4px 10px;
  border-radius: 20px;
}

.pulse-dot {
  width: 6px;
  height: 6px;
  background: var(--lw-success);
  border-radius: 50%;
  box-shadow: 0 0 0 6px rgba(19, 137, 92, 0.08);
  /* animation: pulse-ring 2s infinite; */
}

@keyframes pulse-ring {
  0% {
    transform: scale(1);
    opacity: 1;
  }

  100% {
    transform: scale(2.5);
    opacity: 0;
  }
}

.canvas-controls {
  position: absolute;
  bottom: 24px;
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  gap: 12px;
  padding: 8px;
  background: color-mix(in srgb, var(--lw-bg-elevated) 90%, transparent);
  backdrop-filter: var(--lw-glass-blur);
  border: 1px solid var(--lw-border-base);
  border-radius: 20px;
  box-shadow: var(--lw-shadow-hover);
  z-index: 100;
}

.control-group {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 0 4px;
}

.control-group:not(:last-child) {
  border-right: 1px solid var(--lw-border-base);
  padding-right: 10px;
}

.run-btn {
  background: var(--lw-primary);
  color: var(--lw-text-inverse);
  border: none;
  padding: 8px 16px;
  border-radius: 6px;
  font-weight: var(--lw-type-label-medium-weight);
  font-size: var(--lw-type-body-medium-size);
  cursor: pointer;
  box-shadow: 0 2px 8px rgba(99, 102, 241, 0.3);
  transition: 0.2s;
}

.run-btn:hover {
  background: #4f46e5;
  transform: translateY(-1px);
}

.lw-timeline-container.small {
  background: transparent;
}

.small-timeline-wrapper {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  padding: 24px;
  padding-bottom: 0;
}

/* Small Mode Styles */
.timeline-tree {
  position: relative;
  display: flex;
  flex-direction: column;
  gap: 0;
  flex: 1;
  overflow-y: auto;
  overflow-x: auto;
  scrollbar-width: thin;
}

.s-node {
  display: flex;
  position: relative;
  /* margin-bottom: 12px; */
}

.s-graph-track {
  position: relative;
  flex-shrink: 0;
}

.track-svg {
  position: absolute;
  top: 0;
  left: 0;
  z-index: 1;
}

.glow-dot {
  filter: drop-shadow(0 0 1px currentColor);
  stroke: #fff;
  stroke-width: 2px;
}

.s-card-wrapper {
  flex: 1;
  padding-left: 12px;
  padding-bottom: 18px;
  /* 减小底部填充，因为现在主要靠 s-node 的 margin-bottom 控制间距 */
  position: relative;
}

.s-card {
  background: var(--lw-timeline-card-bg, var(--lw-bg-surface));
  border: 1px solid var(--lw-border-base);
  border-radius: var(--lw-radius);
  padding: 12px 16px;
  cursor: pointer;
  transition: var(--lw-transition);
  position: relative;
  overflow: hidden;
}

.s-card.active {
  border-color: var(--lw-border-active);
  box-shadow: var(--lw-shadow-hover);
}

.s-card.inactive {
  opacity: 0.6;
  filter: grayscale(0.5);
}

.s-card:hover {
  transform: translateY(-2px);
  border-color: var(--lw-border-hover);
}

.s-card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
}

.s-title {
  font-size: var(--lw-type-label-small-size);
  font-weight: var(--lw-type-title-small-weight);
  color: var(--lw-text-dim);
  font-family: var(--lw-font-mono, monospace);
}

.s-role-tag {
  font-size: var(--lw-type-label-small-size);
  padding: 1px 6px;
  border-radius: 4px;
  font-weight: var(--lw-type-title-small-weight);
  letter-spacing: 0.5px;
}

.s-role-tag.user {
  background: color-mix(in srgb, var(--lw-success) 12%, white);
  color: var(--lw-success);
}

.s-role-tag.char {
  background: var(--lw-bg-subtle);
  color: var(--lw-text-secondary);
}

.s-card-content {
  display: flex;
  gap: 8px;
  align-items: flex-start;
}

.s-avatar-mini {
  width: 20px;
  height: 20px;
  border-radius: var(--lw-timeline-mini-avatar-radius, 50%);
  background: var(--lw-bg-app);
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--lw-text-dim);
  flex-shrink: 0;
  margin-top: 2px;
}

.s-text {
  font-size: var(--lw-type-body-medium-size);
  color: var(--lw-timeline-muted-text, var(--lw-text-secondary));
  line-height: 1.6;
  /* 增加行高 */
  margin: 0;
  display: -webkit-box;
  -webkit-line-clamp: 5;
  line-clamp: 5;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.s-variant-info {
  margin-top: 8px;
  padding-top: 8px;
  border-top: 1px dashed var(--lw-timeline-line-color, var(--lw-border-base));
}

.s-variant-text {
  font-size: var(--lw-type-label-small-size);
  color: var(--lw-timeline-subtle-text, var(--lw-text-muted));
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.s-switch-btn {
  color: var(--lw-primary);
  font-weight: var(--lw-type-title-small-weight);
  cursor: pointer;
}

.s-switch-btn:hover {
  text-decoration: underline;
}

.s-actions-group {
  position: relative;
  background: var(--lw-bg-surface);
  border: 1px solid var(--lw-primary);
  border-top: none;
  border-radius: 0 0 var(--lw-radius) var(--lw-radius);
  display: flex;
  padding: 8px;
  gap: 8px;
  z-index: 10;
  box-shadow: var(--lw-shadow-hover);
  margin-top: -12px;
  padding-top: 18px;
  width: auto;
}

.s-action-btn {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  font-size: var(--lw-type-label-small-size);
  font-weight: var(--lw-type-title-small-weight);
  padding: 6px;
  border-radius: 6px;
  cursor: pointer;
  transition: 0.2s;
}

.s-action-btn.branch {
  background: var(--lw-bg-subtle);
  color: var(--lw-text-main);
}

.s-action-btn.rollback {
  background: color-mix(in srgb, var(--lw-danger) 10%, var(--lw-surface-container-lowest));
  color: var(--lw-danger);
}

.s-action-btn.grey {
  background: var(--lw-bg-subtle);
  color: var(--lw-text-secondary);
}

.s-action-btn:hover {
  filter: brightness(0.95);
}

.s-action-card {
  border: 2px dashed var(--lw-border-base);
  border-radius: var(--lw-radius);
  padding: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  color: var(--lw-text-dim);
  font-size: var(--lw-type-body-medium-size);
  font-weight: var(--lw-type-label-medium-weight);
}

/* Animations */
.slide-down-enter-active,
.slide-down-leave-active {
  transition: all 0.3s ease;
}

.slide-down-enter-from,
.slide-down-leave-to {
  transform: translateY(-10px);
  opacity: 0;
}

/* --- Global Loading Overlay --- */
.global-loading-overlay {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: var(--lw-timeline-loading-overlay-bg, rgba(255, 255, 255, 0.72));
  backdrop-filter: blur(8px) saturate(180%);
  z-index: 2000;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-direction: column;
}

.loading-content {
  display: flex;
  flex-direction: column;
  align-items: center;
  animation: float 3s ease-in-out infinite;
}

.spinner-container {
  position: relative;
  width: 60px;
  height: 60px;
  margin-bottom: 24px;
}

.spinner {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  border: 4px solid var(--lw-timeline-loading-spinner-track, var(--lw-surface-container-high));
  border-top-color: var(--lw-timeline-line-active, var(--lw-primary));
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

.spinner-ring {
  position: absolute;
  top: -8px;
  left: -8px;
  right: -8px;
  bottom: -8px;
  border: 2px solid color-mix(in srgb, var(--lw-timeline-line-active, var(--lw-primary)) 18%, transparent);
  border-radius: 50%;
  animation: pulse 2s ease-in-out infinite;
}

.loading-title {
  font-size: var(--lw-type-title-large-size);
  font-weight: var(--lw-type-title-small-weight);
  color: var(--lw-text-main);
  margin: 0 0 8px 0;
  letter-spacing: 0.5px;
}

.loading-desc {
  font-size: var(--lw-type-body-medium-size);
  color: var(--lw-text-secondary);
  margin: 0;
  font-weight: var(--lw-type-label-medium-weight);
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

@keyframes pulse {

  0%,
  100% {
    transform: scale(1);
    opacity: 0.5;
  }

  50% {
    transform: scale(1.1);
    opacity: 1;
  }
}

@keyframes float {

  0%,
  100% {
    transform: translateY(0);
  }

  50% {
    transform: translateY(-10px);
  }
}

/* --- Message Detail Modal --- */
.l-modal-overlay {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: var(--lw-timeline-modal-overlay-bg, rgba(15, 23, 42, 0.3));
  backdrop-filter: blur(4px);
  z-index: 1500;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 40px;
}

.l-modal-container {
  width: 100%;
  max-width: 800px;
  max-height: 80vh;
  background: var(--lw-timeline-modal-bg, var(--lw-bg-elevated));
  border-radius: 20px;
  box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
  display: flex;
  flex-direction: column;
  overflow: hidden;
  border: 1px solid var(--lw-border-strong);
}

.l-modal-header {
  padding: 20px 28px;
  border-bottom: 1px solid var(--lw-timeline-line-color, var(--lw-border-base));
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.l-modal-title {
  display: flex;
  align-items: center;
  gap: 12px;
}

.l-modal-badge {
  background: var(--lw-timeline-chip-bg, var(--lw-surface-container-high));
  color: var(--lw-timeline-muted-text, var(--lw-text-secondary));
  font-size: var(--lw-type-label-small-size);
  font-weight: var(--lw-type-title-small-weight);
  padding: 4px 10px;
  border-radius: 6px;
  letter-spacing: 0.5px;
}

.l-modal-id {
  font-family: monospace;
  font-size: var(--lw-type-body-small-size);
  color: var(--lw-timeline-subtle-text, var(--lw-text-muted));
}

.l-modal-close {
  background: transparent;
  border: none;
  color: var(--lw-timeline-subtle-text, var(--lw-text-muted));
  cursor: pointer;
  padding: 6px;
  border-radius: 50%;
  transition: 0.2s;
}

.l-modal-close:hover {
  background: var(--lw-timeline-chip-bg, var(--lw-surface-container-high));
  color: var(--lw-text-main);
}

.l-modal-body {
  flex: 1;
  overflow-y: auto;
  padding: 32px 40px;
  background: var(--lw-timeline-modal-body-bg, var(--lw-surface-container-low));
}

.l-modal-content-wrapper {
  max-width: 680px;
  margin: 0 auto;
  font-size: var(--lw-type-title-medium-size);
  line-height: 1.8;
  color: var(--lw-timeline-muted-text, var(--lw-text-secondary));
}

.l-modal-footer {
  padding: 20px 40px;
  border-top: 1px solid var(--lw-timeline-line-color, var(--lw-border-base));
  display: flex;
  justify-content: space-between;
  align-items: center;
  background: var(--lw-timeline-modal-footer-bg, var(--lw-surface-container-lowest));
}

.l-footer-meta {
  display: flex;
  align-items: center;
  gap: 12px;
  font-size: var(--lw-type-body-small-size);
  color: var(--lw-timeline-subtle-text, var(--lw-text-muted));
  font-weight: var(--lw-type-label-medium-weight);
}

.l-footer-meta .divider {
  opacity: 0.3;
}

.l-modal-action-btn {
  background: var(--lw-timeline-line-active, var(--lw-primary));
  color: var(--lw-text-inverse);
  border: none;
  padding: 10px 24px;
  border-radius: 10px;
  font-weight: var(--lw-type-title-small-weight);
  font-size: var(--lw-type-body-medium-size);
  cursor: pointer;
  transition: 0.2s;
  box-shadow: 0 4px 12px color-mix(in srgb, var(--lw-timeline-line-active, var(--lw-primary)) 26%, transparent);
}

.l-modal-action-btn:hover {
  background: color-mix(in srgb, var(--lw-timeline-line-active, var(--lw-primary)) 88%, black);
  transform: translateY(-1px);
}

/* Transitions */
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.3s;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

.modal-scale-enter-active,
.modal-scale-leave-active {
  transition: all 0.4s cubic-bezier(0.34, 1.56, 0.64, 1);
}

.modal-scale-enter-from,
.modal-scale-leave-to {
  opacity: 0;
  transform: scale(0.9) translateY(20px);
}










































</style>
