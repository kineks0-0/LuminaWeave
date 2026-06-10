import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const pathFromShellTest = (path: string) => new URL(`../${path}`, import.meta.url);
const readTraditionalShellSource = () =>
  readFileSync(pathFromShellTest('traditional/TraditionalShell.vue'), 'utf-8');

describe('shell mode directory structure', () => {
  it('places mode-specific shell files under shell/modes', () => {
    [
      'modes/discord/DiscordMobileShell.vue',
      'modes/telegram/TelegramBottomNav.vue',
      'modes/telegram/TelegramCharacterOverview.vue',
      'modes/telegram/TelegramRoleListPage.vue',
      'modes/telegram/TelegramUserInfoPanel.vue',
      'modes/telegram/TelegramUserProfilePage.vue',
      'modes/telegram/telegramVisual.ts'
    ].forEach((path) => {
      expect(existsSync(pathFromShellTest(path)), path).toBe(true);
    });
  });

  it('keeps traditional shell root free of mode-specific component files', () => {
    [
      'traditional/DiscordMobileShell.vue',
      'traditional/TelegramBottomNav.vue',
      'traditional/TelegramCharacterOverview.vue',
      'traditional/TelegramRoleListPage.vue',
      'traditional/TelegramUserInfoPanel.vue',
      'traditional/TelegramUserProfilePage.vue',
      'traditional/telegramVisual.ts'
    ].forEach((path) => {
      expect(existsSync(pathFromShellTest(path)), path).toBe(false);
    });
  });

  it('imports mode-specific components through shell mode directories', () => {
    const source = readTraditionalShellSource();

    [
      "from '../modes/discord/DiscordMobileShell.vue';",
      "from '../modes/telegram/TelegramBottomNav.vue';",
      "from '../modes/telegram/TelegramCharacterOverview.vue';",
      "from '../modes/telegram/TelegramRoleListPage.vue';",
      "from '../modes/telegram/TelegramUserProfilePage.vue';"
    ].forEach((importPath) => {
      expect(source).toContain(importPath);
    });

    [
      "from './DiscordMobileShell.vue';",
      "from './TelegramBottomNav.vue';",
      "from './TelegramCharacterOverview.vue';",
      "from './TelegramRoleListPage.vue';",
      "from './TelegramUserProfilePage.vue';"
    ].forEach((importPath) => {
      expect(source).not.toContain(importPath);
    });
  });
});
