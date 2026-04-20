import { ref } from 'vue';

type KeyboardLikeEvent = {
  isComposing?: boolean;
  keyCode?: number;
  nativeEvent?: {
    isComposing?: boolean;
    keyCode?: number;
  };
};

type ImeSubmitGuardOptions = {
  debugLabel?: string;
};

const IME_DEBUG_PREFIX = '[LuminaWeave][IME]';

const buildImeDebugPayload = (
  event?: KeyboardLikeEvent | null,
  localCompositionState = false
): Record<string, boolean | number> => ({
  localCompositionState,
  isComposing: event?.isComposing === true,
  nativeIsComposing: event?.nativeEvent?.isComposing === true,
  keyCode229: event?.keyCode === 229,
  nativeKeyCode229: event?.nativeEvent?.keyCode === 229
});

export const isImeComposing = (
  event?: KeyboardLikeEvent | null,
  localCompositionState = false
): boolean => {
  if (localCompositionState) {
    return true;
  }

  if (!event) {
    return false;
  }

  if (event.isComposing === true || event.nativeEvent?.isComposing === true) {
    return true;
  }

  return event.keyCode === 229 || event.nativeEvent?.keyCode === 229;
};

export function useImeSubmitGuard(options: ImeSubmitGuardOptions = {}) {
  const isComposingLocally = ref(false);
  const debugPrefix = options.debugLabel ? `${IME_DEBUG_PREFIX}[${options.debugLabel}]` : IME_DEBUG_PREFIX;

  const logDebug = (message: string, payload?: Record<string, boolean | number>) => {
    console.debug(`${debugPrefix} ${message}`, payload);
  };

  const handleCompositionStart = () => {
    if (!isComposingLocally.value) {
      logDebug('compositionstart', buildImeDebugPayload(undefined, true));
    }
    isComposingLocally.value = true;
  };

  const handleCompositionEnd = () => {
    if (isComposingLocally.value) {
      logDebug('compositionend', buildImeDebugPayload(undefined, false));
    }
    isComposingLocally.value = false;
  };

  const shouldIgnoreSubmit = (event?: KeyboardLikeEvent | null): boolean => {
    const ignored = isImeComposing(event, isComposingLocally.value);

    if (ignored) {
      logDebug('Ignored submit while IME composition is active.', buildImeDebugPayload(event, isComposingLocally.value));
    }

    return ignored;
  };

  return {
    isComposingLocally,
    handleCompositionStart,
    handleCompositionEnd,
    shouldIgnoreSubmit
  };
}
