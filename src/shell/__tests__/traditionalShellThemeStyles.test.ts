import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const readTraditionalShellSource = (): string =>
  readFileSync(new URL('../traditional/TraditionalShell.vue', import.meta.url), 'utf-8');

const readWidgetPanelHostSource = (): string =>
  readFileSync(new URL('../traditional/WidgetPanelHost.vue', import.meta.url), 'utf-8');

const extractStyleBlock = (source: string): string => {
  const match = source.match(/<style>([\s\S]*?)<\/style>/);
  if (!match?.[1]) {
    throw new Error('TraditionalShell.vue style block not found');
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

describe('TraditionalShell theme styles', () => {
  it('keeps the main wrapper background tied to theme surfaces instead of white', () => {
    const style = extractStyleBlock(readTraditionalShellSource());
    const wrapperRule = extractRule(style, /\.lw-main-wrapper\s*\{([\s\S]*?)\n\}/, '.lw-main-wrapper');

    expect(wrapperRule).not.toContain('white');
    expect(wrapperRule).not.toContain('rgba(255, 255, 255');
  });

  it('keeps the widget container background tied to theme surfaces instead of white', () => {
    const style = extractStyleBlock(readWidgetPanelHostSource());
    const widgetRule = extractRule(style, /\.lw-widget-container\s*\{([\s\S]*?)\n\}/, '.lw-widget-container');

    expect(widgetRule).not.toContain('rgba(255, 255, 255');
    expect(widgetRule).not.toMatch(/(^|[^-\w])white(?![-\w])/);
  });
});
