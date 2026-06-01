import { describe, expect, it } from 'vitest';
import {
  createActivityStatusBarStyle,
  resolveActivityStatusBarAppearance
} from '../statusBarAppearance.js';

describe('status bar appearance resolver', () => {
  it('uses white status bar icons for dark appearance by default', () => {
    expect(resolveActivityStatusBarAppearance({
      statusBar: null,
      resolvedAppearance: 'dark'
    })).toEqual({
      background: null,
      iconColor: 'light',
      safeArea: 'shell'
    });
  });

  it('uses black status bar icons for light appearance by default', () => {
    expect(resolveActivityStatusBarAppearance({
      statusBar: null,
      resolvedAppearance: 'light'
    })).toEqual({
      background: null,
      iconColor: 'dark',
      safeArea: 'shell'
    });
  });

  it('lets Activity metadata override automatic icon color and safe-area ownership', () => {
    expect(resolveActivityStatusBarAppearance({
      statusBar: {
        background: 'var(--lw-bg-surface)',
        iconColor: 'light',
        safeArea: 'manual'
      },
      resolvedAppearance: 'light'
    })).toEqual({
      background: 'var(--lw-bg-surface)',
      iconColor: 'light',
      safeArea: 'manual'
    });
  });

  it('resolves explicit auto icon color through the current appearance', () => {
    expect(resolveActivityStatusBarAppearance({
      statusBar: { iconColor: 'auto' },
      resolvedAppearance: 'dark'
    }).iconColor).toBe('light');
  });

  it('exposes resolved status bar values as root CSS variables', () => {
    expect(createActivityStatusBarStyle({
      background: '#101820',
      iconColor: 'light',
      safeArea: 'shell'
    })).toEqual({
      '--lw-activity-statusbar-bg': '#101820',
      '--lw-activity-statusbar-icon-color': 'light',
      '--lw-activity-statusbar-safe-area': 'shell'
    });
  });
});
