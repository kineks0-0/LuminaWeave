import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const readPanelHeaderSource = (): string =>
  readFileSync(new URL('../PanelHeader.vue', import.meta.url), 'utf-8');

const extractStyleBlock = (source: string): string => {
  const match = source.match(/<style(?: scoped)?>([\s\S]*?)<\/style>/);
  if (!match?.[1]) {
    throw new Error('PanelHeader.vue style block not found');
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
  expect(rule).not.toContain('#ffffff');
  expect(rule).not.toContain('#f8fafc');
  expect(rule).not.toContain('#f1f5f9');
  expect(rule).not.toContain('#e2e8f0');
  expect(rule).not.toContain('#64748b');
  expect(rule).not.toContain('rgba(255, 255, 255');
  expect(rule).not.toContain('rgba(248, 250, 254');
  expect(rule).not.toContain('rgba(244, 248, 254');
  expect(rule).not.toMatch(/(^|[^-\w])white(?![-\w])/);
};

describe('PanelHeader theme styles', () => {
  it('keeps launcher and tab backgrounds tied to theme tokens', () => {
    const style = extractStyleBlock(readPanelHeaderSource());
    const selectors: Array<[RegExp, string]> = [
      [/\.launcher-btn\s*\{([\s\S]*?)\n\}/, '.launcher-btn'],
      [/\.launcher-btn:hover\s*\{([\s\S]*?)\n\}/, '.launcher-btn:hover'],
      [/\.lw-tabs\s*\{([\s\S]*?)\n\}/, '.lw-tabs'],
      [/\.lw-tab\s*\{([\s\S]*?)\n\}/, '.lw-tab'],
      [/\.lw-tab:hover\s*\{([\s\S]*?)\n\}/, '.lw-tab:hover'],
      [/\.lw-tab\.active\s*\{([\s\S]*?)\n\}/, '.lw-tab.active'],
      [/\.lw-tab-dropdown\s*\{([\s\S]*?)\n\}/, '.lw-tab-dropdown'],
      [/\.lw-tab-dropdown-item\s*\{([\s\S]*?)\n\}/, '.lw-tab-dropdown-item'],
      [/\.lw-tab-dropdown-item:hover\s*\{([\s\S]*?)\n\}/, '.lw-tab-dropdown-item:hover'],
      [/\.lw-tab-dropdown-item\.active\s*\{([\s\S]*?)\n\}/, '.lw-tab-dropdown-item.active']
    ];

    for (const [selectorPattern, ruleName] of selectors) {
      expectNoHardcodedLightSurface(extractRule(style, selectorPattern, ruleName));
    }
  });

  it('keeps profile menu backgrounds tied to theme tokens', () => {
    const style = extractStyleBlock(readPanelHeaderSource());
    const selectors: Array<[RegExp, string]> = [
      [/\.profile-trigger\s*\{([\s\S]*?)\n\}/, '.profile-trigger'],
      [/\.profile-menu\s*\{([\s\S]*?)\n\}/, '.profile-menu'],
      [/\.profile-menu-item\s*\{([\s\S]*?)\n\}/, '.profile-menu-item'],
      [/\.profile-menu-item:hover\s*\{([\s\S]*?)\n\}/, '.profile-menu-item:hover'],
      [/\.profile-menu-icon\s*\{([\s\S]*?)\n\}/, '.profile-menu-icon'],
      [/\.profile-menu-choice\s*\{([\s\S]*?)\n\}/, '.profile-menu-choice'],
      [
        /\.profile-menu-choice:hover,\s*\.profile-menu-choice\.active\s*\{([\s\S]*?)\n\}/,
        '.profile-menu-choice:hover/.active'
      ]
    ];

    for (const [selectorPattern, ruleName] of selectors) {
      expectNoHardcodedLightSurface(extractRule(style, selectorPattern, ruleName));
    }
  });
});
