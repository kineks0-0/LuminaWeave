import { describe, expect, it } from 'vitest';
import { resolveRootSafeAreaStyle } from '../rootSafeArea.js';

describe('resolveRootSafeAreaStyle', () => {
  it('applies native safe insets to the root frame only for Android generic Tauri window layout', () => {
    expect(resolveRootSafeAreaStyle({
      isAndroidGenericTauri: true,
      layoutSource: 'window',
      safeInsets: {
        top: 24,
        right: 2,
        bottom: 18,
        left: 4
      }
    })).toEqual({
      '--lw-root-safe-top': '24px',
      '--lw-root-safe-right': '2px',
      '--lw-root-safe-bottom': '18px',
      '--lw-root-safe-left': '4px'
    });
  });

  it('does not root-shift TauriTavern layout-kit snapshots', () => {
    expect(resolveRootSafeAreaStyle({
      isAndroidGenericTauri: true,
      layoutSource: 'tauri-layout',
      safeInsets: {
        top: 24,
        right: 2,
        bottom: 18,
        left: 4
      }
    })).toEqual({
      '--lw-root-safe-top': '0px',
      '--lw-root-safe-right': '0px',
      '--lw-root-safe-bottom': '0px',
      '--lw-root-safe-left': '0px'
    });
  });
});
