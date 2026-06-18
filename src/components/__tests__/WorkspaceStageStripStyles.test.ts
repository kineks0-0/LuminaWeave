import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const readWorkspaceStageStripSource = (): string =>
  readFileSync(new URL('../WorkspaceStageStrip.vue', import.meta.url), 'utf-8');

const extractScopedStyle = (source: string): string => {
  const match = source.match(/<style scoped>([\s\S]*?)<\/style>/);
  if (!match?.[1]) {
    throw new Error('WorkspaceStageStrip.vue scoped style block not found');
  }
  return match[1];
};

describe('WorkspaceStageStrip theme styles', () => {
  it('keeps active and hover stage backgrounds tied to theme surfaces instead of white', () => {
    const style = extractScopedStyle(readWorkspaceStageStripSource());

    expect(style).not.toContain('color-mix(in srgb, var(--lw-primary) 8%, white)');
    expect(style).not.toContain('color-mix(in srgb, var(--lw-primary) 10%, white)');
  });
});
