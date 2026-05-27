import { afterEach, describe, expect, it } from 'vitest';
import { ref } from 'vue';
import { useHostLayoutViewport } from '../useHostLayoutViewport.js';

const originalWindowDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'window');
const originalDocumentDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'document');

const restoreGlobal = (name: 'window' | 'document', descriptor: PropertyDescriptor | undefined) => {
  if (descriptor) {
    Object.defineProperty(globalThis, name, descriptor);
    return;
  }
  Reflect.deleteProperty(globalThis, name);
};

const installViewportGlobals = (cssValues: Record<string, string>) => {
  Object.defineProperty(globalThis, 'document', {
    configurable: true,
    value: {
      documentElement: {}
    } as Document
  });

  Object.defineProperty(globalThis, 'window', {
    configurable: true,
    value: {
      innerHeight: 800,
      innerWidth: 400,
      requestAnimationFrame: (callback: FrameRequestCallback) => {
        callback(0);
        return 0;
      },
      getComputedStyle: () => ({
        getPropertyValue: (propertyName: string) => cssValues[propertyName] ?? ''
      } as CSSStyleDeclaration)
    } as unknown as Window & typeof globalThis
  });
};

describe('useHostLayoutViewport', () => {
  afterEach(() => {
    restoreGlobal('window', originalWindowDescriptor);
    restoreGlobal('document', originalDocumentDescriptor);
  });

  it('uses native safe-area CSS variables when layout-kit.js is unavailable', () => {
    installViewportGlobals({
      '--tt-inset-top': '0px',
      '--tt-inset-right': '0px',
      '--tt-inset-bottom': '0px',
      '--tt-inset-left': '0px',
      '--lw-native-safe-top': '24px',
      '--lw-native-safe-right': '3px',
      '--lw-native-safe-bottom': '18px',
      '--lw-native-safe-left': '5px'
    });

    const viewport = useHostLayoutViewport({
      hostContainer: null,
      isExpanded: ref(true),
      layoutMode: ref('traditional'),
      reflowWorkspaceWindows: () => undefined
    });

    viewport.syncViewportMetricsFromWindow();

    expect(viewport.safeInsetTopPx.value).toBe(24);
    expect(viewport.safeInsetRightPx.value).toBe(3);
    expect(viewport.safeInsetBottomPx.value).toBe(18);
    expect(viewport.safeInsetLeftPx.value).toBe(5);
  });

  it('uses the Lumina native safe-area source without mixing TauriTavern variables', () => {
    installViewportGlobals({
      '--tt-inset-top': '134px',
      '--tt-inset-right': '10px',
      '--tt-inset-bottom': '24px',
      '--tt-inset-left': '10px',
      '--lw-native-safe-top': '44.67px',
      '--lw-native-safe-right': '0px',
      '--lw-native-safe-bottom': '12.33px',
      '--lw-native-safe-left': '0px'
    });

    const viewport = useHostLayoutViewport({
      hostContainer: null,
      isExpanded: ref(true),
      layoutMode: ref('traditional'),
      reflowWorkspaceWindows: () => undefined,
      safeAreaCssSource: 'lumina-native'
    });

    viewport.syncViewportMetricsFromWindow();

    expect(viewport.safeInsetTopPx.value).toBe(45);
    expect(viewport.safeInsetRightPx.value).toBe(0);
    expect(viewport.safeInsetBottomPx.value).toBe(12);
    expect(viewport.safeInsetLeftPx.value).toBe(0);
  });

  it('falls back to web safe-area CSS variables when host layout sources are unavailable', () => {
    installViewportGlobals({
      '--tt-inset-top': '0px',
      '--tt-inset-right': '0px',
      '--tt-inset-bottom': '0px',
      '--tt-inset-left': '0px',
      '--lw-native-safe-top': '0px',
      '--lw-native-safe-right': '0px',
      '--lw-native-safe-bottom': '0px',
      '--lw-native-safe-left': '0px',
      '--lw-web-safe-top': '33.25px',
      '--lw-web-safe-right': '2px',
      '--lw-web-safe-bottom': '21.75px',
      '--lw-web-safe-left': '4px'
    });

    const viewport = useHostLayoutViewport({
      hostContainer: null,
      isExpanded: ref(true),
      layoutMode: ref('traditional'),
      reflowWorkspaceWindows: () => undefined
    });

    viewport.syncViewportMetricsFromWindow();

    expect(viewport.safeInsetTopPx.value).toBe(33);
    expect(viewport.safeInsetRightPx.value).toBe(2);
    expect(viewport.safeInsetBottomPx.value).toBe(22);
    expect(viewport.safeInsetLeftPx.value).toBe(4);
  });
});
