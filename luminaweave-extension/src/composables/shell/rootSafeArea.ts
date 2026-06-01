import type { CSSProperties } from 'vue';
import type { ActivityStatusBarSafeAreaMode } from '../../platform/activity/types.js';

export type HostLayoutSource = 'tauri-layout' | 'window';

export type SafeInsets = {
  top: number;
  right: number;
  bottom: number;
  left: number;
};

export const zeroRootSafeAreaStyle = {
  '--lw-root-safe-top': '0px',
  '--lw-root-safe-right': '0px',
  '--lw-root-safe-bottom': '0px',
  '--lw-root-safe-left': '0px'
} satisfies CSSProperties;

const toSafePixel = (value: number): string => `${Math.max(0, Math.round(value))}px`;
const isConsumed = (value: unknown): boolean => value !== '0px' && value !== 0 && value !== undefined;

export const resolveRootSafeAreaStyle = ({
  isAndroidGenericTauri,
  layoutSource,
  statusBarSafeArea = 'shell',
  safeInsets
}: {
  isAndroidGenericTauri: boolean;
  layoutSource: HostLayoutSource;
  statusBarSafeArea?: ActivityStatusBarSafeAreaMode;
  safeInsets: SafeInsets;
}): CSSProperties => {
  if (!isAndroidGenericTauri || layoutSource !== 'window') {
    return zeroRootSafeAreaStyle;
  }

  return {
    '--lw-root-safe-top': toSafePixel(statusBarSafeArea === 'manual' ? 0 : safeInsets.top),
    '--lw-root-safe-right': toSafePixel(safeInsets.right),
    '--lw-root-safe-bottom': toSafePixel(safeInsets.bottom),
    '--lw-root-safe-left': toSafePixel(safeInsets.left)
  };
};

export const rootSafeAreaStyleConsumesInsets = (style: CSSProperties): boolean =>
  isConsumed(style['--lw-root-safe-top']) ||
  isConsumed(style['--lw-root-safe-right']) ||
  isConsumed(style['--lw-root-safe-bottom']) ||
  isConsumed(style['--lw-root-safe-left']);

export const resolveRootSafeAreaResidualStyle = (style: CSSProperties): CSSProperties => {
  const residualStyle: CSSProperties = {};
  if (isConsumed(style['--lw-root-safe-top'])) {
    residualStyle['--lw-content-safe-top'] = '0px';
  }
  if (isConsumed(style['--lw-root-safe-right'])) {
    residualStyle['--lw-content-safe-right'] = '0px';
  }
  if (isConsumed(style['--lw-root-safe-bottom'])) {
    residualStyle['--lw-content-safe-bottom'] = '0px';
  }
  if (isConsumed(style['--lw-root-safe-left'])) {
    residualStyle['--lw-content-safe-left'] = '0px';
  }
  return residualStyle;
};
