import { describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { applyAndroidStatusBarAppearance } from '../androidStatusBarBridge.js';

const currentDir = dirname(fileURLToPath(import.meta.url));
const extensionRoot = resolve(currentDir, '../../../..');
const mainActivityPath = resolve(
  extensionRoot,
  'src-tauri/gen/android/app/src/main/java/io/luminaweave/client/MainActivity.kt'
);
const statusBarBridgePath = resolve(
  extensionRoot,
  'src-tauri/gen/android/app/src/main/java/io/luminaweave/client/LuminaAndroidStatusBarBridge.kt'
);

describe('android status bar bridge', () => {
  it('does not call native bridge outside generic Tauri Android', () => {
    const setAppearance = vi.fn();

    const applied = applyAndroidStatusBarAppearance({
      appearance: {
        background: null,
        iconColor: 'dark',
        safeArea: 'shell'
      },
      isAndroidGenericTauri: false,
      windowRef: {
        LuminaAndroidStatusBar: { setAppearance }
      }
    });

    expect(applied).toBe(false);
    expect(setAppearance).not.toHaveBeenCalled();
  });

  it('serializes only native-owned status bar fields for the Android bridge', () => {
    const setAppearance = vi.fn();

    const applied = applyAndroidStatusBarAppearance({
      appearance: {
        background: 'var(--lw-bg-app)',
        iconColor: 'light',
        safeArea: 'manual'
      },
      isAndroidGenericTauri: true,
      windowRef: {
        LuminaAndroidStatusBar: { setAppearance }
      }
    });

    expect(applied).toBe(true);
    expect(setAppearance).toHaveBeenCalledWith(JSON.stringify({
      iconColor: 'light',
      safeArea: 'manual'
    }));
  });

  it('keeps status bar background ownership in the web shell instead of native Android', () => {
    const source = readFileSync(statusBarBridgePath, 'utf8');

    expect(source).not.toContain('background=');
    expect(source).not.toContain('optString("background")');
  });

  it('replays native insets and status bar appearance when MainActivity restarts', () => {
    const source = readFileSync(mainActivityPath, 'utf8');

    expect(source).toMatch(
      /override fun onRestart\(\) \{\s*super\.onRestart\(\)\s*insetsBridge\.onResume\(\)\s*statusBarBridge\.reapplyLastAppearance\(\)\s*\}/
    );
  });
});
