import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const readFreeformShellSource = (): string =>
  readFileSync(new URL('../freeform/FreeformShell.vue', import.meta.url), 'utf-8');

const readWorkspaceMenuSource = (): string =>
  readFileSync(new URL('../freeform/WorkspaceMenu.vue', import.meta.url), 'utf-8');

const extractStyleBlock = (source: string): string => {
  const match = source.match(/<style>([\s\S]*?)<\/style>/);
  if (!match?.[1]) {
    throw new Error('style block not found');
  }
  return match[1];
};

const extractRule = (style: string, selectorPattern: RegExp, ruleName: string): string => {
  const match = style.match(selectorPattern);
  if (!match?.[1]) {
    throw new Error(`${ruleName} rule not found`);
  }
  return match[1];
};

const expectNoHardcodedLightSurface = (rule: string): void => {
  expect(rule).not.toContain('white');
  expect(rule).not.toContain('rgba(255, 255, 255');
  expect(rule).not.toContain('rgba(245, 249, 255');
};

describe('FreeformShell theme styles', () => {
  it('keeps freeform controls backgrounds tied to theme surfaces instead of white', () => {
    const style = extractStyleBlock(readFreeformShellSource());
    const controlsRule = extractRule(style, /\.lw-freeform-controls\s*\{([\s\S]*?)\n\}/, '.lw-freeform-controls');
    const controlActiveRule = extractRule(
      style,
      /\.lw-freeform-control:hover,\s*\.lw-freeform-control\.active\s*\{([\s\S]*?)\n\}/,
      '.lw-freeform-control:hover/.active'
    );

    expectNoHardcodedLightSurface(controlsRule);
    expectNoHardcodedLightSurface(controlActiveRule);
  });

  it('keeps freeform workspace menu backgrounds tied to theme surfaces instead of white', () => {
    const style = extractStyleBlock(readWorkspaceMenuSource());
    const menuRule = extractRule(style, /\.lw-workspace-menu\s*\{([\s\S]*?)\n\}/, '.lw-workspace-menu');
    const menuItemRule = extractRule(
      style,
      /\.lw-workspace-menu-item\s*\{([\s\S]*?)\n\}/,
      '.lw-workspace-menu-item'
    );
    const menuItemActiveRule = extractRule(
      style,
      /\.lw-workspace-menu-item:hover,\s*\.lw-workspace-menu-item\.active\s*\{([\s\S]*?)\n\}/,
      '.lw-workspace-menu-item:hover/.active'
    );

    expectNoHardcodedLightSurface(menuRule);
    expectNoHardcodedLightSurface(menuItemRule);
    expectNoHardcodedLightSurface(menuItemActiveRule);
  });
});
