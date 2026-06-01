import { describe, expect, it } from 'vitest';
import { useActivityLaunchState } from '../useActivityLaunchState.js';
import type { ActivityLaunchResolution } from '../../../platform/activity/types.js';

describe('useActivityLaunchState', () => {
  it('stores right panel Activity payload and clears transient Activity metadata on shell navigation', () => {
    const state = useActivityLaunchState();
    const resolution: ActivityLaunchResolution = {
      placement: 'right-panel',
      intent: {
        id: 'stats.panel',
        title: 'Stats',
        icon: 'bar',
        role: 'support',
        target: {
          kind: 'surface',
          contractId: 'stats.panel'
        }
      },
      activity: {
        size: 'small',
        pageType: 'nested',
        statusBar: { iconColor: 'dark' }
      },
      panelId: 'stats.panel',
      panel: {
        panelId: 'stats.panel',
        title: 'Stats',
        icon: 'bar',
        contractId: 'stats.panel',
        activity: {
          size: 'small',
          pageType: 'nested',
          statusBar: { iconColor: 'dark' }
        },
        props: { source: 'test' }
      }
    };

    state.applyLaunchResolution(resolution);

    expect(state.activeActivityStatusBar.value).toEqual({ iconColor: 'dark' });
    expect(state.activeRightPanelActivity.value?.props).toEqual({ source: 'test' });

    state.clearTransientActivityMetadata();

    expect(state.activeActivityStatusBar.value).toBeNull();
    expect(state.activeRightPanelActivity.value).toBeNull();
  });

  it('lets components temporarily override Activity status bar metadata', () => {
    const state = useActivityLaunchState();

    state.setActivityStatusBarOverride({
      background: 'var(--lw-bg-app)',
      iconColor: 'light',
      safeArea: 'manual'
    });

    expect(state.activeActivityStatusBar.value).toEqual({
      background: 'var(--lw-bg-app)',
      iconColor: 'light',
      safeArea: 'manual'
    });

    state.setActivityStatusBarOverride(null);

    expect(state.activeActivityStatusBar.value).toBeNull();
  });

  it('restores launch status bar metadata after a component override is cleared', () => {
    const state = useActivityLaunchState();
    const resolution: ActivityLaunchResolution = {
      placement: 'main',
      intent: {
        id: 'card_maker',
        title: 'Card Maker',
        icon: 'cards',
        target: {
          kind: 'registered-panel',
          panelId: 'card_maker'
        }
      },
      activity: {
        size: 'default',
        pageType: 'standalone',
        statusBar: {
          background: 'var(--lw-card-maker-bg)',
          iconColor: 'auto',
          safeArea: 'manual'
        }
      },
      panelId: 'card_maker'
    };

    state.applyLaunchResolution(resolution);
    state.setActivityStatusBarOverride({
      background: 'var(--lw-bg-app)',
      iconColor: 'light',
      safeArea: 'shell'
    });

    expect(state.activeActivityStatusBar.value).toEqual({
      background: 'var(--lw-bg-app)',
      iconColor: 'light',
      safeArea: 'shell'
    });

    state.setActivityStatusBarOverride(null);

    expect(state.activeActivityStatusBar.value).toEqual({
      background: 'var(--lw-card-maker-bg)',
      iconColor: 'auto',
      safeArea: 'manual'
    });
  });
});
