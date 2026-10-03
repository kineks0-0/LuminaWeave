import { describe, expect, it } from 'vitest';
import { shouldUpdateDesktopModeSetting } from '../desktopModeSelection.js';

describe('shouldUpdateDesktopModeSetting', () => {
  it('skips when the raw persisted id already equals the target', () => {
    expect(shouldUpdateDesktopModeSetting('stage', { 'lumina-settings.activeDesktopMode': 'stage' })).toBe(false);
  });

  it('updates when the persisted id points at an unregistered mode and the user picks classic', () => {
    expect(shouldUpdateDesktopModeSetting('classic', { 'lumina-settings.activeDesktopMode': 'not-registered-yet' })).toBe(true);
  });

  it('treats an empty persisted value as classic', () => {
    expect(shouldUpdateDesktopModeSetting('classic', {})).toBe(false);
  });
});
