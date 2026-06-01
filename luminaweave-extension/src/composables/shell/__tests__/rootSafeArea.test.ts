import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { readdirSync, statSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  resolveRootSafeAreaStyle,
  resolveRootSafeAreaResidualStyle
} from '../rootSafeArea.js';

const currentDir = dirname(fileURLToPath(import.meta.url));
const sourceRoot = resolve(currentDir, '../../..');

const readSourceFiles = (dir: string, extensions: string[]): string[] => {
  const entries = readdirSync(dir);
  const files: string[] = [];

  for (const entry of entries) {
    const path = resolve(dir, entry);
    const stat = statSync(path);
    if (stat.isDirectory()) {
      files.push(...readSourceFiles(path, extensions));
      continue;
    }
    if (extensions.some((extension) => path.endsWith(extension))) {
      files.push(path);
    }
  }

  return files;
};

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

  it('keeps injected safe-area variables immutable when root consumes insets', () => {
    expect(resolveRootSafeAreaResidualStyle({
      '--lw-root-safe-top': '24px',
      '--lw-root-safe-right': '2px',
      '--lw-root-safe-bottom': '18px',
      '--lw-root-safe-left': '4px'
    })).toEqual({
      '--lw-content-safe-top': '0px',
      '--lw-content-safe-right': '0px',
      '--lw-content-safe-bottom': '0px',
      '--lw-content-safe-left': '0px'
    });
  });

  it('lets standalone activities own the top status-bar safe area while root keeps other insets', () => {
    const rootStyle = resolveRootSafeAreaStyle({
      isAndroidGenericTauri: true,
      layoutSource: 'window',
      statusBarSafeArea: 'manual',
      safeInsets: {
        top: 24,
        right: 2,
        bottom: 18,
        left: 4
      }
    });

    expect(rootStyle).toEqual({
      '--lw-root-safe-top': '0px',
      '--lw-root-safe-right': '2px',
      '--lw-root-safe-bottom': '18px',
      '--lw-root-safe-left': '4px'
    });
    expect(resolveRootSafeAreaResidualStyle(rootStyle)).toEqual({
      '--lw-content-safe-right': '0px',
      '--lw-content-safe-bottom': '0px',
      '--lw-content-safe-left': '0px'
    });
  });

  it('keeps the fullscreen panel full-bleed and consumes root safe area as padding without a backdrop layer', () => {
    const cssPath = resolve(sourceRoot, 'styles/app-shell-base.css');
    const css = readFileSync(cssPath, 'utf8');

    expect(css).toContain('top: var(--lw-viewport-offset-top, 0px);');
    expect(css).toContain('left: var(--lw-viewport-offset-left, 0px);');
    expect(css).toContain('width: var(--lw-app-width, 100vw);');
    expect(css).toContain('height: var(--lw-app-height, 100vh);');
    expect(css).toContain(
      'padding: var(--lw-root-safe-top, 0px) var(--lw-root-safe-right, 0px) var(--lw-root-safe-bottom, 0px) var(--lw-root-safe-left, 0px);'
    );
    expect(css).not.toContain('.lw-root-safe-area-backdrop');
    expect(css).toContain('var(--lw-content-safe-bottom, var(--lw-safe-bottom, 0px))');
    expect(css).not.toContain('top: calc(var(--lw-viewport-offset-top, 0px) + var(--lw-root-safe-top, 0px));');
    expect(css).not.toContain('height: calc(var(--lw-app-height, 100vh) - var(--lw-root-safe-top, 0px)');
  });

  it('paints Activity status bar background through the web shell layer', () => {
    const cssPath = resolve(sourceRoot, 'styles/app-shell-base.css');
    const css = readFileSync(cssPath, 'utf8');

    expect(css).toContain('.lw-fullscreen-panel::after');
    expect(css).toContain('height: var(--lw-safe-top, 0px);');
    expect(css).toContain('background: var(--lw-activity-statusbar-bg, transparent);');
  });

  it('defines web safe-area fallback variables from CSS environment insets', () => {
    const cssPath = resolve(sourceRoot, 'style.css');
    const css = readFileSync(cssPath, 'utf8');

    expect(css).toContain('--lw-web-safe-top: env(safe-area-inset-top, 0px);');
    expect(css).toContain('--lw-web-safe-right: env(safe-area-inset-right, 0px);');
    expect(css).toContain('--lw-web-safe-bottom: env(safe-area-inset-bottom, 0px);');
    expect(css).toContain('--lw-web-safe-left: env(safe-area-inset-left, 0px);');
  });

  it('keeps plugin safe-area consumption behind Lumina residual variables', () => {
    const pluginRoot = resolve(sourceRoot, 'plugins');
    const offenders = readSourceFiles(pluginRoot, ['.vue', '.css', '.scss'])
      .filter((path) => readFileSync(path, 'utf8').includes('env(safe-area-inset'))
      .map((path) => path.slice(sourceRoot.length + 1).replace(/\\/g, '/'));

    expect(offenders).toEqual([]);
  });
});
