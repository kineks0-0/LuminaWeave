import { computed, ref, type CSSProperties } from 'vue';
import type {
  ActivityLaunchResolution,
  ActivityPanelPayload,
  ActivityStatusBarDescriptor
} from '../../platform/activity/types.js';

export const useActivityLaunchState = () => {
  const activeActivityStatusBar = ref<ActivityStatusBarDescriptor | null>(null);
  const activeRightPanelActivity = ref<ActivityPanelPayload | null>(null);

  const activityStatusBarStyle = computed<CSSProperties>(() => ({
    ...(activeActivityStatusBar.value?.background
      ? { '--lw-activity-statusbar-bg': activeActivityStatusBar.value.background }
      : {}),
    ...(activeActivityStatusBar.value?.iconColor
      ? { '--lw-activity-statusbar-icon-color': activeActivityStatusBar.value.iconColor }
      : {})
  }));

  const applyLaunchResolution = (resolved: ActivityLaunchResolution) => {
    activeActivityStatusBar.value = resolved.activity.statusBar || null;
    activeRightPanelActivity.value = resolved.placement === 'right-panel'
      ? resolved.panel || null
      : null;
  };

  const clearTransientActivityMetadata = () => {
    activeActivityStatusBar.value = null;
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
    clearTransientActivityMetadata,
    clearRightPanelActivity
  };
};
