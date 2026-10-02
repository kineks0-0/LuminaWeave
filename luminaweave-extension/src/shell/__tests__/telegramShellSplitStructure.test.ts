import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const pathFromShellTest = (path: string) => new URL(`../${path}`, import.meta.url);
const readShellSource = (path: string) => readFileSync(pathFromShellTest(path), 'utf-8');

describe('Telegram shell split structure', () => {
  it('keeps Telegram desktop and mobile shell branches in dedicated files', () => {
    [
      'modes/telegram/TelegramDesktopPane.vue',
      'modes/telegram/TelegramMobileStack.vue',
      'modes/telegram/telegramRouteViewModel.ts'
    ].forEach((path) => {
      expect(existsSync(pathFromShellTest(path)), path).toBe(true);
    });
  });

  it('keeps TraditionalShell focused on shell composition instead of Telegram route details', () => {
    const source = readShellSource('traditional/TraditionalShell.vue');

    expect(source).toContain("import TelegramDesktopPane from '../modes/telegram/TelegramDesktopPane.vue';");
    expect(source).toContain("import TelegramMobileStack from '../modes/telegram/TelegramMobileStack.vue';");
    expect(source).toContain("from '../modes/telegram/telegramRouteViewModel.js';");

    [
      'class="lw-telegram-left-pane"',
      'class="lw-telegram-mobile-stack__bar"',
      "telegramMobileCurrentRoute.name === 'conversationList'",
      "telegramMobileCurrentRoute.name === 'roleList'",
      "telegramMobileCurrentRoute.name === 'tool'",
      'const telegramMobileRouteTitle = computed'
    ].forEach((inlineTelegramDetail) => {
      expect(source).not.toContain(inlineTelegramDetail);
    });

    expect(source.split(/\r?\n/).length).toBeLessThan(620);
  });

  it('keeps Telegram route view-model behavior explicit and testable', async () => {
    const routeViewModelUrl = pathFromShellTest('modes/telegram/telegramRouteViewModel.ts');
    expect(existsSync(routeViewModelUrl), 'modes/telegram/telegramRouteViewModel.ts').toBe(true);

    const viewModel = await import(routeViewModelUrl.href);

    expect(viewModel.isTelegramMobileRootRoute({ name: 'conversationList' })).toBe(true);
    expect(viewModel.shouldShowTelegramMobileBottomNav(true, { name: 'profile' })).toBe(true);
    expect(viewModel.shouldShowTelegramMobileBottomNav(false, { name: 'profile' })).toBe(false);
    expect(viewModel.shouldShowTelegramMobileStackBar({ name: 'chat' })).toBe(false);
    expect(viewModel.resolveTelegramMobileRouteTitle({ name: 'tool', title: '工具箱' })).toBe('工具箱');
    expect(viewModel.resolveTelegramMobileRouteTitle({ name: 'tool' })).toBe('工具');
    expect(viewModel.resolveTelegramMobileToolContractId(
      { name: 'tool', panelId: 'lumina-settings' },
      {
        resolveRegisteredPanelContractId: (panelId: string) => `${panelId}.registered`,
        resolvePluginContractId: (pluginId: string) => `${pluginId}.plugin`
      }
    )).toBe('lumina-settings.registered');
    expect(viewModel.resolveTelegramMobileToolContractId(
      { name: 'tool', toolId: 'lumina-forge' },
      {
        resolveRegisteredPanelContractId: () => null,
        resolvePluginContractId: (pluginId: string) => `${pluginId}.plugin`
      }
    )).toBe('lumina-forge.plugin');
    expect(viewModel.resolveTelegramMobileToolAuxSidebarMode('forge.workspace')).toBe('hidden');
    expect(viewModel.resolveTelegramMobileToolAuxSidebarMode('settings.root')).toBeUndefined();
  });
});
