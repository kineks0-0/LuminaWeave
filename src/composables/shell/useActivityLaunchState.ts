import { computed, ref, type CSSProperties } from 'vue';
import type {
  ActivityLaunchResolution,
  ActivityPanelPayload,
  ActivityStatusBarDescriptor
} from '../../platform/activity/types.js';

export const useActivityLaunchState = () => {
  const launchActivityStatusBar = ref<ActivityStatusBarDescriptor | null>(null);
  const activityStatusBarOverride = ref<ActivityStatusBarDescriptor | null>(null);
  const activeRightPanelActivity = ref<ActivityPanelPayload | null>(null);
  const activeActivityStatusBar = computed(() => activityStatusBarOverride.value || launchActivityStatusBar.value);

  const activityStatusBarStyle = computed<CSSProperties>(() => ({
    ...(activeActivityStatusBar.value?.background
      ? { '--lw-activity-statusbar-bg': activeActivityStatusBar.value.background }
      : {}),
    ...(activeActivityStatusBar.value?.iconColor
      ? { '--lw-activity-statusbar-icon-color': activeActivityStatusBar.value.iconColor }
      : {})
  }));

  const applyLaunchResolution = (resolved: ActivityLaunchResolution) => {
    launchActivityStatusBar.value = resolved.activity.statusBar || null;
    activityStatusBarOverride.value = null;
    activeRightPanelActivity.value = resolved.placement === 'right-panel'
      ? resolved.panel || null
      : null;
  };

  const setActivityStatusBarOverride = (statusBar: ActivityStatusBarDescriptor | null) => {
    activityStatusBarOverride.value = statusBar;
  };

  const clearTransientActivityMetadata = () => {
    launchActivityStatusBar.value = null;
    activityStatusBarOverride.value = null;
    activeRightPanelActivity.value = null;
  };

  const clearRightPanelActivity = () => {
    activeRightPanelActivity.value = null;
  };

  return {
    activeActivityStatusBar,
    activeRightPanelActivity,
    activityStatusBarStyle,
    applyLaunchResolution,
    setActivityStatusBarOverride,
    clearTransientActivityMetadata,
    clearRightPanelActivity
  };
};
