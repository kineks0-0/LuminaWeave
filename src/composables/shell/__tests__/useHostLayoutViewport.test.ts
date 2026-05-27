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
});
