import { onMounted, onUnmounted, ref, watch, type Ref } from 'vue';
import { loadTauriLayoutKit, type TauriLayoutKitModule } from '../../core/TauriLayoutKit.js';

type LayoutSnapshotLike = {
  viewport?: Partial<{
    left: number;
    top: number;
    width: number;
    height: number;
  }>;
  safeInsets?: Partial<{
    top: number;
    right: number;
    bottom: number;
    left: number;
  }>;
  ime?: {
    keyboardOffset?: number;
  };
};

const NATIVE_INSETS_CHANGE_EVENT = 'lw:native-insets-change';
type SafeAreaCssSource = 'auto' | 'tauritavern' | 'lumina-native';

const readRootCssPixel = (propertyName: string): number => {
  const parsed = Number.parseFloat(window.getComputedStyle(document.documentElement).getPropertyValue(propertyName));
  return Number.isFinite(parsed) ? parsed : 0;
};

const readLargestRootCssPixel = (...propertyNames: string[]): number =>
  Math.max(0, ...propertyNames.map((propertyName) => readRootCssPixel(propertyName)));

const hasLuminaNativeSafeInsets = (): boolean =>
  readLargestRootCssPixel(
    '--lw-native-safe-top',
    '--lw-native-safe-right',
    '--lw-native-safe-bottom',
    '--lw-native-safe-left'
  ) > 0;

const resolveSafeAreaCssSource = (source: SafeAreaCssSource): Exclude<SafeAreaCssSource, 'auto'> => {
  if (source !== 'auto') {
    return source;
  }

  return hasLuminaNativeSafeInsets() ? 'lumina-native' : 'tauritavern';
};

const readRootSafeInsets = (source: SafeAreaCssSource) => {
  const resolvedSource = resolveSafeAreaCssSource(source);
  const prefix = resolvedSource === 'lumina-native' ? '--lw-native-safe' : '--tt-inset';

  return {
    top: readLargestRootCssPixel(`${prefix}-top`),
    right: readLargestRootCssPixel(`${prefix}-right`),
    bottom: readLargestRootCssPixel(`${prefix}-bottom`),
    left: readLargestRootCssPixel(`${prefix}-left`)
  };
};

export const useHostLayoutViewport = ({
  hostContainer,
  isExpanded,
  layoutMode,
  reflowWorkspaceWindows,
  safeAreaCssSource = 'auto'
}: {
  hostContainer: HTMLElement | null;
  isExpanded: Ref<boolean>;
  layoutMode: Ref<'traditional' | 'freeform'>;
  reflowWorkspaceWindows: () => void;
  safeAreaCssSource?: SafeAreaCssSource;
}) => {
  const viewportHeightPx = ref(window.innerHeight);
  const viewportWidthPx = ref(window.innerWidth);
  const viewportOffsetTopPx = ref(0);
  const viewportOffsetLeftPx = ref(0);
  const safeInsetTopPx = ref(0);
  const safeInsetRightPx = ref(0);
  const safeInsetBottomPx = ref(0);
  const safeInsetLeftPx = ref(0);
  const layoutSource = ref<'tauri-layout' | 'window'>('window');
  const keyboardOffsetPx = ref(0);
  const rootPanelShiftPx = ref(0);

  let resizeThrottleTimer: ReturnType<typeof setTimeout> | null = null;
  let layoutKitModule: TauriLayoutKitModule | null = null;
  let layoutUnsubscribe: (() => Promise<void> | void) | null = null;

  const syncViewportMetricsFromSnapshot = (
    snapshot: LayoutSnapshotLike,
    source: 'tauri-layout' | 'window'
  ) => {
    viewportHeightPx.value = Math.max(0, Math.round(snapshot.viewport?.height ?? window.innerHeight));
    viewportWidthPx.value = Math.max(0, Math.round(snapshot.viewport?.width ?? window.innerWidth));
    viewportOffsetTopPx.value = Math.max(0, Math.round(snapshot.viewport?.top ?? 0));
    viewportOffsetLeftPx.value = Math.max(0, Math.round(snapshot.viewport?.left ?? 0));
    const fallbackSafeInsets = readRootSafeInsets(safeAreaCssSource);
    safeInsetTopPx.value = Math.max(0, Math.round(snapshot.safeInsets?.top ?? fallbackSafeInsets.top));
    safeInsetRightPx.value = Math.max(0, Math.round(snapshot.safeInsets?.right ?? fallbackSafeInsets.right));
    safeInsetBottomPx.value = Math.max(0, Math.round(snapshot.safeInsets?.bottom ?? fallbackSafeInsets.bottom));
    safeInsetLeftPx.value = Math.max(0, Math.round(snapshot.safeInsets?.left ?? fallbackSafeInsets.left));
    keyboardOffsetPx.value = Math.max(0, Math.round(snapshot.ime?.keyboardOffset ?? readRootCssPixel('--lw-native-ime-bottom')));
    layoutSource.value = source;
    rootPanelShiftPx.value = isExpanded.value && source === 'tauri-layout' ? Math.max(0, keyboardOffsetPx.value) : 0;
  };

  const syncViewportMetricsFromWindow = () => {
    syncViewportMetricsFromSnapshot({
      viewport: {
        left: 0,
        top: 0,
        width: window.innerWidth,
        height: window.innerHeight
      },
      safeInsets: readRootSafeInsets(safeAreaCssSource),
      ime: {
        keyboardOffset: readRootCssPixel('--lw-native-ime-bottom')
      }
    }, 'window');
  };

  const applyHostSurface = async (expanded: boolean) => {
    if (!hostContainer) {
      return;
    }

    layoutKitModule = layoutKitModule ?? await loadTauriLayoutKit();
    if (!layoutKitModule) {
      return;
    }

    try {
      layoutKitModule.applySurface(
        hostContainer,
        expanded ? layoutKitModule.SURFACE.FullscreenWindow : layoutKitModule.SURFACE.FreeWindow
      );
    } catch (error) {
      console.debug('[LuminaWeave][HostLayout] Failed to apply host surface via layout-kit.js.', error);
    }
  };

  const handleResizeWindow = () => {
    if (layoutSource.value !== 'tauri-layout') {
      syncViewportMetricsFromWindow();
    }
    if (resizeThrottleTimer) return;

    resizeThrottleTimer = setTimeout(() => {
      if (layoutMode.value === 'freeform') {
        requestAnimationFrame(reflowWorkspaceWindows);
      }
      resizeThrottleTimer = null;
    }, 60);
  };

  const handleNativeInsetsChange = () => {
    if (layoutSource.value !== 'tauri-layout') {
      syncViewportMetricsFromWindow();
    }
  };

  watch(isExpanded, (expanded) => {
    rootPanelShiftPx.value = expanded && layoutSource.value === 'tauri-layout' ? Math.max(0, keyboardOffsetPx.value) : 0;
    void applyHostSurface(expanded);
  }, { immediate: true });

  onMounted(async () => {
    layoutKitModule = await loadTauriLayoutKit();
    syncViewportMetricsFromWindow();

    if (layoutKitModule) {
      try {
        await layoutKitModule.waitForHostReady();
        const layoutApi = layoutKitModule.getLayoutApi?.();

        if (layoutApi && typeof layoutApi.snapshot === 'function') {
          syncViewportMetricsFromSnapshot(layoutApi.snapshot() as LayoutSnapshotLike, 'tauri-layout');
        }

        const unsubscribe = await layoutKitModule.subscribeLayout((snapshot) => {
          syncViewportMetricsFromSnapshot(snapshot as LayoutSnapshotLike, 'tauri-layout');
        });

        layoutUnsubscribe = typeof unsubscribe === 'function' ? unsubscribe : null;
      } catch (error) {
        console.debug('[LuminaWeave][HostLayout] Failed to subscribe layout-kit.js layout stream.', error);
        syncViewportMetricsFromWindow();
      }
    }

    window.addEventListener('resize', handleResizeWindow);
    window.addEventListener(NATIVE_INSETS_CHANGE_EVENT, handleNativeInsetsChange);
  });

  onUnmounted(() => {
    window.removeEventListener('resize', handleResizeWindow);
    window.removeEventListener(NATIVE_INSETS_CHANGE_EVENT, handleNativeInsetsChange);
    if (resizeThrottleTimer) {
      clearTimeout(resizeThrottleTimer);
      resizeThrottleTimer = null;
    }
    const unsubscribe = layoutUnsubscribe;
    layoutUnsubscribe = null;
    if (unsubscribe) {
      void Promise.resolve(unsubscribe()).catch((error) => {
        console.debug('[LuminaWeave][HostLayout] Failed to unsubscribe layout-kit.js layout stream.', error);
      });
    }
  });

  return {
    viewportHeightPx,
    viewportWidthPx,
    viewportOffsetTopPx,
    viewportOffsetLeftPx,
    safeInsetTopPx,
    safeInsetRightPx,
    safeInsetBottomPx,
    safeInsetLeftPx,
    layoutSource,
    keyboardOffsetPx,
    rootPanelShiftPx,
    syncViewportMetricsFromWindow,
    applyHostSurface
  };
};
