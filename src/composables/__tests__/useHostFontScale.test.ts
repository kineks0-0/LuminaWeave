import { describe, expect, it } from 'vitest';
import { parseHostFontScale } from '../shell/useHostFontScale.js';

describe('parseHostFontScale', () => {
  it('falls back to 1 when the host value is missing or invalid', () => {
    expect(parseHostFontScale(undefined)).toBe(1);
    expect(parseHostFontScale(null)).toBe(1);
    expect(parseHostFontScale('')).toBe(1);
    expect(parseHostFontScale('abc')).toBe(1);
    expect(parseHostFontScale('-1')).toBe(1);
  });

  it('reads the host font scale', () => {
    expect(parseHostFontScale('1')).toBe(1);
    expect(parseHostFontScale('1.25')).toBe(1.25);
    expect(parseHostFontScale('0.5')).toBe(0.5);
  });

  it('clamps to the SillyTavern slider range', () => {
    expect(parseHostFontScale('0.1')).toBe(0.5);
    expect(parseHostFontScale('3')).toBe(1.5);
  });
});
