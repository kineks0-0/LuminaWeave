import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const fromBuiltinsTest = (path: string) => new URL(`../${path}`, import.meta.url);
const readSource = (path: string) => readFileSync(fromBuiltinsTest(path), 'utf-8');

describe('Telegram mode package shell structure', () => {
  it('keeps Telegram desktop and mobile shell branches in dedicated files', () => {
    [
      'telegram/shell/TelegramShell.vue',
      'telegram/shell/TelegramDesktopPane.vue',
      'telegram/shell/TelegramMobileStack.vue',
      'telegram/shell/telegramRouteViewModel.ts'
    ].forEach((path) => {
      expect(existsSync(fromBuiltinsTest(path)), path).toBe(true);
    });
  });

  it('keeps the Telegram shell focused on composition instead of inline route details', () => {
    const source = readSource('telegram/shell/TelegramShell.vue');

    expect(source).toContain('TraditionalShell');
    expect(source).toContain('TelegramDesktopPane');
    expect(source).toContain('TelegramMobileStack');
    expect(source).toContain("from './telegramRouteViewModel.js'");

    [
      'class="lw-telegram-left-pane"',
      'class="lw-telegram-mobile-stack__bar"',
      "telegramMobileCurrentRoute.name === 'conversationList'",
      "telegramMobileCurrentRoute.name === 'roleList'",
      "telegramMobileCurrentRoute.name === 'tool'"
    ].forEach((inlineTelegramDetail) => {
      expect(source).not.toContain(inlineTelegramDetail);
    });
  });

  it('keeps Telegram route view-model behavior explicit and testable', async () => {
    const routeViewModelUrl = fromBuiltinsTest('telegram/shell/telegramRouteViewModel.ts');
    expect(existsSync(routeViewModelUrl), 'telegram/shell/telegramRouteViewModel.ts').toBe(true);

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
