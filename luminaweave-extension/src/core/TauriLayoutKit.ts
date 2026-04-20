export type LayoutKitSurfaceMap = {
  Backdrop: 'backdrop';
  FullscreenWindow: 'fullscreen-window';
  FreeWindow: 'free-window';
  ViewportHost: 'viewport-host';
  EdgeWindow: 'edge-window';
  None: 'none';
};

export type TauriLayoutKitModule = {
  SURFACE: LayoutKitSurfaceMap;
  waitForHostReady: () => Promise<void>;
  subscribeLayout: (handler: (snapshot: unknown) => void) => Promise<(() => Promise<void> | void) | void>;
  applySurface: (element: Element, surface: string) => void;
  getHostWindow?: () => Window | null;
  getLayoutApi?: () => {
    snapshot: () => unknown;
    subscribe: (handler: (snapshot: unknown) => void) => Promise<(() => Promise<void> | void) | void>;
  } | null;
};

const LAYOUT_KIT_PATH = '/scripts/tauritavern/layout-kit.js';

let layoutKitPromise: Promise<TauriLayoutKitModule | null> | null = null;

export const loadTauriLayoutKit = async (): Promise<TauriLayoutKitModule | null> => {
  if (typeof window === 'undefined') {
    return null;
  }

  if (!layoutKitPromise) {
    layoutKitPromise = import(/* @vite-ignore */ LAYOUT_KIT_PATH)
      .then((module) => module as TauriLayoutKitModule)
      .catch((error) => {
        console.debug('[LuminaWeave][HostLayout] Failed to load layout-kit.js.', error);
        return null;
      });
  }

  return layoutKitPromise;
};
