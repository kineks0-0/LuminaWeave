import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
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

  it('keeps the fullscreen panel full-bleed and consumes root safe area as padding', () => {
    const cssPath = resolve(
      dirname(fileURLToPath(import.meta.url)),
      '../../../styles/app-shell-base.css'
    );
    const css = readFileSync(cssPath, 'utf8');

    expect(css).toContain('top: var(--lw-viewport-offset-top, 0px);');
    expect(css).toContain('left: var(--lw-viewport-offset-left, 0px);');
    expect(css).toContain('width: var(--lw-app-width, 100vw);');
    expect(css).toContain('height: var(--lw-app-height, 100vh);');
    expect(css).toContain(
      'padding: var(--lw-root-safe-top, 0px) var(--lw-root-safe-right, 0px) var(--lw-root-safe-bottom, 0px) var(--lw-root-safe-left, 0px);'
    );
    expect(css).toContain('.lw-root-safe-area-backdrop');
    expect(css).not.toContain('top: calc(var(--lw-viewport-offset-top, 0px) + var(--lw-root-safe-top, 0px));');
    expect(css).not.toContain('height: calc(var(--lw-app-height, 100vh) - var(--lw-root-safe-top, 0px)');
  });
});
