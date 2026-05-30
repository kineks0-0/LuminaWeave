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
});
