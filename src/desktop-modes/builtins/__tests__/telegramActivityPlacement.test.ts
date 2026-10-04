import { describe, expect, it, vi } from 'vitest';
import { createTelegramActivityModeHandler } from '../telegram/shell/telegramActivityPlacement.js';

describe('telegram activity mode handler', () => {
  it('routes standalone mobile activities into the Telegram page stack', () => {
    const pushRoute = vi.fn();
    const handler = createTelegramActivityModeHandler(pushRoute);

    const result = handler({
      id: 'card_maker',
      title: '制卡工坊',
      icon: 'card',
      role: 'support',
      target: {
        kind: 'surface',
        contractId: 'forge.workspace'
      },
      activity: {
        size: 'small',
        pageType: 'standalone',
        statusBar: {
          background: 'var(--lw-bg)',
          iconColor: 'dark'
        }
      },
      props: { isTabMode: true }
    }, {
      shellKind: 'traditional',
      isMobile: true,
      desktopModeId: 'telegram'
    });

    expect(result).toMatchObject({ placement: 'telegram-stack', panelId: 'card_maker' });
    expect(pushRoute).toHaveBeenCalledWith({
      name: 'tool',
      panelId: 'card_maker',
      title: '制卡工坊',
      icon: 'card',
      contractId: 'forge.workspace',
      activity: {
        size: 'small',
        pageType: 'standalone',
        statusBar: {
          background: 'var(--lw-bg)',
          iconColor: 'dark'
        }
      },
      props: { isTabMode: true }
    });
  });

  it('ignores other modes, desktop viewports, and nested activities', () => {
    const pushRoute = vi.fn();
    const handler = createTelegramActivityModeHandler(pushRoute);
    const intent = {
      id: 'settings-tab',
      title: 'Settings',
      target: { kind: 'surface' as const, contractId: 'settings.root' as const },
      activity: { size: 'small' as const, pageType: 'nested' as const }
    };

    expect(handler(intent, { shellKind: 'traditional', isMobile: true, desktopModeId: 'discord' })).toBe(false);
    expect(handler(intent, { shellKind: 'traditional', isMobile: false, desktopModeId: 'telegram' })).toBe(false);
    expect(handler(intent, { shellKind: 'traditional', isMobile: true, desktopModeId: 'telegram' })).toBe(false);
    expect(pushRoute).not.toHaveBeenCalled();
  });
});
