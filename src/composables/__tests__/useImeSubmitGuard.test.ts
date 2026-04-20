import { describe, expect, it } from 'vitest';
import { isImeComposing, useImeSubmitGuard } from '../useImeSubmitGuard.js';

describe('useImeSubmitGuard', () => {
  it('treats explicit isComposing as active composition', () => {
    expect(isImeComposing({ isComposing: true })).toBe(true);
  });

  it('treats keyCode 229 as active composition', () => {
    expect(isImeComposing({ keyCode: 229 })).toBe(true);
  });

  it('tracks compositionstart and compositionend through local state', () => {
    const guard = useImeSubmitGuard();

    guard.handleCompositionStart();
    expect(guard.shouldIgnoreSubmit()).toBe(true);

    guard.handleCompositionEnd();
    expect(guard.shouldIgnoreSubmit()).toBe(false);
  });
});

