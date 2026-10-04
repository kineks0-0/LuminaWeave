import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const fromSrc = (path: string) => new URL(`../../${path}`, import.meta.url);
const readSrc = (path: string) => readFileSync(fromSrc(path), 'utf-8');

const MODE_ID_LITERAL_PATTERN = /['"](classic|stage|discord|telegram)['"]/;

describe('desktop mode package boundaries', () => {
  it('keeps mode-specific shell UI out of the generic shell directory', () => {
    expect(existsSync(fromSrc('shell/modes'))).toBe(false);

    [
      'desktop-modes/builtins/discord/shell/DiscordShell.vue',
      'desktop-modes/builtins/discord/shell/DiscordMobileShell.vue',
      'desktop-modes/builtins/discord/shell/DiscordGuildRail.vue',
      'desktop-modes/builtins/telegram/shell/TelegramShell.vue',
      'desktop-modes/builtins/telegram/shell/TelegramBottomNav.vue',
      'desktop-modes/builtins/telegram/shell/TelegramUserInfoPanel.vue',
      'desktop-modes/builtins/telegram/shell/TelegramUserProfilePage.vue',
      'desktop-modes/builtins/telegram/shell/telegramVisual.ts'
    ].forEach((path) => {
      expect(existsSync(fromSrc(path)), path).toBe(true);
    });
  });

  it('keeps the generic shell and App free of mode id literals', () => {
    [
      'App.vue',
      'shell/LuminaShellRoot.vue',
      'shell/traditional/TraditionalShell.vue',
      'shell/freeform/FreeformShell.vue',
      'shell/types.ts',
      'composables/shell/useWidgetPanels.ts',
      'composables/shell/useShellRuntimePayload.ts'
    ].forEach((path) => {
      expect(readSrc(path), path).not.toMatch(MODE_ID_LITERAL_PATTERN);
    });
  });

  it('keeps generic shell sources from importing mode packages', () => {
    [
      'shell/LuminaShellRoot.vue',
      'shell/traditional/TraditionalShell.vue',
      'shell/freeform/FreeformShell.vue',
      'composables/shell/useWidgetPanels.ts',
      'composables/shell/useShellRuntimePayload.ts'
    ].forEach((path) => {
      expect(readSrc(path), path).not.toContain('desktop-modes/builtins');
    });
  });

  it('binds mode renderers only in the builtin bindings table', () => {
    const bindings = readSrc('desktop-modes/builtins/bindings.ts');

    expect(bindings).toContain("['telegram'");
    expect(bindings).toContain("['discord'");
    expect(bindings).toContain('shellRenderer');
    expect(bindings).toContain('shellChrome');
  });

  it('keeps Forge presentation components inside the Forge plugin boundary', () => {
    expect(existsSync(fromSrc('plugins/forge/app/ForgeSidebar.vue'))).toBe(true);
    expect(existsSync(fromSrc('components/ForgeSidebar.vue'))).toBe(false);
  });
});
