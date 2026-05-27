import type { CSSProperties } from 'vue';

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

export const resolveRootSafeAreaStyle = ({
  isAndroidGenericTauri,
  layoutSource,
  safeInsets
}: {
  isAndroidGenericTauri: boolean;
  layoutSource: HostLayoutSource;
  safeInsets: SafeInsets;
}): CSSProperties => {
  if (!isAndroidGenericTauri || layoutSource !== 'window') {
    return zeroRootSafeAreaStyle;
  }

  return {
    '--lw-root-safe-top': toSafePixel(safeInsets.top),
    '--lw-root-safe-right': toSafePixel(safeInsets.right),
    '--lw-root-safe-bottom': toSafePixel(safeInsets.bottom),
    '--lw-root-safe-left': toSafePixel(safeInsets.left)
  };
};

export const rootSafeAreaStyleConsumesInsets = (style: CSSProperties): boolean =>
  style['--lw-root-safe-top'] !== '0px' ||
  style['--lw-root-safe-right'] !== '0px' ||
  style['--lw-root-safe-bottom'] !== '0px' ||
  style['--lw-root-safe-left'] !== '0px';
