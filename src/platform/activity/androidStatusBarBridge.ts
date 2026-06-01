import type { ResolvedActivityStatusBarAppearance } from './types.js';

export interface LuminaAndroidStatusBarNativeBridge {
  setAppearance: (payload: string) => void;
}

export interface LuminaAndroidStatusBarWindow {
  LuminaAndroidStatusBar?: LuminaAndroidStatusBarNativeBridge;
}

export interface ApplyAndroidStatusBarAppearanceOptions {
  appearance: ResolvedActivityStatusBarAppearance;
  isAndroidGenericTauri: boolean;
  windowRef?: LuminaAndroidStatusBarWindow;
  logger?: Pick<Console, 'warn'>;
}

export const serializeAndroidStatusBarAppearance = (
  appearance: ResolvedActivityStatusBarAppearance
): string => JSON.stringify({
  iconColor: appearance.iconColor,
  safeArea: appearance.safeArea
});

export const applyAndroidStatusBarAppearance = ({
  appearance,
  isAndroidGenericTauri,
  windowRef,
  logger = console
}: ApplyAndroidStatusBarAppearanceOptions): boolean => {
  if (!isAndroidGenericTauri) {
    return false;
  }

  const targetWindow = windowRef || (
    typeof window !== 'undefined'
      ? window as Window & LuminaAndroidStatusBarWindow
      : undefined
  );
  const bridge = targetWindow?.LuminaAndroidStatusBar;
  if (!bridge || typeof bridge.setAppearance !== 'function') {
    return false;
  }

  try {
    bridge.setAppearance(serializeAndroidStatusBarAppearance(appearance));
    return true;
  } catch (error) {
    logger.warn('[LuminaWeave][StatusBar] Failed to apply Android status bar appearance', error);
    return false;
  }
};
