import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { effectScope, ref } from 'vue';
import { useWorkspaceNavigation } from '../shell/useWorkspaceNavigation';

describe('useWorkspaceNavigation', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
      callback(0);
      return 1;
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('should auto show navigation when there are no stage windows', () => {
    const scope = effectScope();
    const navigation = scope.run(() => useWorkspaceNavigation({
      isMobile: ref(false),
      layoutMode: ref<'traditional' | 'freeform'>('freeform'),
      activeStageWindowCount: ref(0),
      reflowWorkspaceWindows: vi.fn(),
      reconcileWorkspaceState: vi.fn(),
      workspaceShowStageStripSetting: ref(true),
      workspaceShowDockSetting: ref(true)
    }))!;

    expect(navigation.isWorkspaceNavigationVisible.value).toBe(true);
    scope.stop();
  });

  it('should hide navigation peek after the configured delay', () => {
    const scope = effectScope();
    const navigation = scope.run(() => useWorkspaceNavigation({
      isMobile: ref(false),
      layoutMode: ref<'traditional' | 'freeform'>('freeform'),
      activeStageWindowCount: ref(2),
      reflowWorkspaceWindows: vi.fn(),
      reconcileWorkspaceState: vi.fn(),
      workspaceShowStageStripSetting: ref(true),
      workspaceShowDockSetting: ref(true)
    }))!;

    navigation.revealWorkspaceNavigation(500);
    expect(navigation.workspaceNavigationPeek.value).toBe(true);

    vi.advanceTimersByTime(500);
    expect(navigation.workspaceNavigationPeek.value).toBe(false);
    scope.stop();
  });
});
