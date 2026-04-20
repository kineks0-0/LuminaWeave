import { computed, onUnmounted, ref, watch, type Ref } from 'vue';

export const useWorkspaceNavigation = ({
  isMobile,
  layoutMode,
  activeStageWindowCount,
  reflowWorkspaceWindows,
  reconcileWorkspaceState,
  workspaceShowStageStripSetting,
  workspaceShowDockSetting
}: {
  isMobile: Ref<boolean>;
  layoutMode: Ref<'traditional' | 'freeform'> | ReturnType<typeof computed<'traditional' | 'freeform'>>;
  activeStageWindowCount: Ref<number> | ReturnType<typeof computed<number>>;
  reflowWorkspaceWindows: () => void;
  reconcileWorkspaceState: (force?: boolean) => void;
  workspaceShowStageStripSetting: Ref<boolean> | ReturnType<typeof computed<boolean>>;
  workspaceShowDockSetting: Ref<boolean> | ReturnType<typeof computed<boolean>>;
}) => {
  const showWorkspaceNavigation = ref(false);
  const workspaceNavigationPeek = ref(false);
  const workspaceNavigationVisibleRef = ref(false);
  const showWorkspaceLaunchpad = ref(false);
  let workspaceNavigationHideTimer: ReturnType<typeof setTimeout> | null = null;

  const isWorkspaceNavigationVisible = computed(() =>
    showWorkspaceNavigation.value || workspaceNavigationPeek.value || activeStageWindowCount.value === 0
  );
  const isWorkspaceStageStripVisible = computed(() =>
    isWorkspaceNavigationVisible.value && workspaceShowStageStripSetting.value
  );
  const isWorkspaceDockVisible = computed(() =>
    isWorkspaceNavigationVisible.value && workspaceShowDockSetting.value
  );
  const shouldShowWorkspaceNavigationOnEntry = () =>
    workspaceShowStageStripSetting.value || workspaceShowDockSetting.value;

  const clearWorkspaceNavigationHideTimer = () => {
    if (workspaceNavigationHideTimer) {
      clearTimeout(workspaceNavigationHideTimer);
      workspaceNavigationHideTimer = null;
    }
  };

  const scheduleWorkspaceNavigationHide = (delay = isMobile.value ? 1400 : 720) => {
    clearWorkspaceNavigationHideTimer();
    if (showWorkspaceNavigation.value || activeStageWindowCount.value === 0) {
      return;
    }
    workspaceNavigationHideTimer = setTimeout(() => {
      workspaceNavigationPeek.value = false;
      workspaceNavigationHideTimer = null;
    }, delay);
  };

  const holdWorkspaceNavigation = () => {
    clearWorkspaceNavigationHideTimer();
    if (!showWorkspaceNavigation.value) {
      workspaceNavigationPeek.value = true;
    }
  };

  const revealWorkspaceNavigation = (delay = isMobile.value ? 1800 : 900) => {
    if (showWorkspaceNavigation.value) {
      clearWorkspaceNavigationHideTimer();
      return;
    }
    workspaceNavigationPeek.value = true;
    if (activeStageWindowCount.value > 0) {
      scheduleWorkspaceNavigationHide(delay);
    }
  };

  const closeWorkspaceLaunchpad = () => {
    if (!showWorkspaceLaunchpad.value) return;
    showWorkspaceLaunchpad.value = false;
    if (!showWorkspaceNavigation.value && activeStageWindowCount.value > 0) {
      scheduleWorkspaceNavigationHide(isMobile.value ? 1200 : 480);
    }
  };

  const openWorkspaceLaunchpad = () => {
    showWorkspaceLaunchpad.value = true;
    clearWorkspaceNavigationHideTimer();
    workspaceNavigationPeek.value = false;
  };

  const toggleWorkspaceLaunchpad = () => {
    if (showWorkspaceLaunchpad.value) {
      closeWorkspaceLaunchpad();
      return;
    }
    openWorkspaceLaunchpad();
  };

  const toggleWorkspaceNavigation = () => {
    showWorkspaceNavigation.value = !showWorkspaceNavigation.value;
    if (showWorkspaceNavigation.value) {
      clearWorkspaceNavigationHideTimer();
      workspaceNavigationPeek.value = false;
      return;
    }
    scheduleWorkspaceNavigationHide(0);
  };

  const handleFreeformScenePointerDown = (event: PointerEvent) => {
    if (!isMobile.value || event.pointerType === 'mouse') return;
    revealWorkspaceNavigation();
  };

  watch(
    isWorkspaceNavigationVisible,
    (value) => {
      workspaceNavigationVisibleRef.value = value;
    },
    { immediate: true }
  );

  watch(isWorkspaceNavigationVisible, () => {
    if (layoutMode.value === 'freeform') {
      requestAnimationFrame(reflowWorkspaceWindows);
    }
  });

  watch(() => activeStageWindowCount.value, (count) => {
    if (count === 0) {
      clearWorkspaceNavigationHideTimer();
      workspaceNavigationPeek.value = false;
      return;
    }
    if (!showWorkspaceNavigation.value && workspaceNavigationPeek.value) {
      scheduleWorkspaceNavigationHide(isMobile.value ? 1600 : 760);
    }
  });

  watch(layoutMode, (value) => {
    if (value === 'freeform') {
      showWorkspaceNavigation.value = shouldShowWorkspaceNavigationOnEntry();
      workspaceNavigationPeek.value = false;
      clearWorkspaceNavigationHideTimer();
      requestAnimationFrame(() => reconcileWorkspaceState(true));
      return;
    }

    closeWorkspaceLaunchpad();
    showWorkspaceNavigation.value = false;
    workspaceNavigationPeek.value = false;
    clearWorkspaceNavigationHideTimer();
  });

  onUnmounted(() => {
    clearWorkspaceNavigationHideTimer();
  });

  return {
    showWorkspaceNavigation,
    workspaceNavigationPeek,
    workspaceNavigationVisibleRef,
    showWorkspaceLaunchpad,
    isWorkspaceNavigationVisible,
    isWorkspaceStageStripVisible,
    isWorkspaceDockVisible,
    shouldShowWorkspaceNavigationOnEntry,
    clearWorkspaceNavigationHideTimer,
    scheduleWorkspaceNavigationHide,
    holdWorkspaceNavigation,
    revealWorkspaceNavigation,
    closeWorkspaceLaunchpad,
    openWorkspaceLaunchpad,
    toggleWorkspaceLaunchpad,
    toggleWorkspaceNavigation,
    handleFreeformScenePointerDown
  };
};
