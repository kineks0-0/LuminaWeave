import { describe, expect, it } from 'vitest';
import {
  normalizeActivityDescriptor,
  resolveActivityLaunchPlacement,
  activityFromLegacyMode
} from '../activityLaunchResolver.js';
import type { ActivityLaunchIntent } from '../types.js';

const supportSurfaceIntent: ActivityLaunchIntent = {
  id: 'stats.panel',
  title: 'Stats',
  icon: '',
  role: 'support',
  target: {
    kind: 'surface',
    contractId: 'stats.panel'
  },
  activity: {
    size: 'small'
  }
};

describe('activity launch resolver', () => {
  it('maps legacy large and small modes to Activity descriptors', () => {
    expect(activityFromLegacyMode('large')).toEqual({
      size: 'default',
      pageType: 'nested'
    });
    expect(activityFromLegacyMode('small')).toEqual({
      size: 'small',
      pageType: 'nested'
    });
  });

  it('normalizes missing Activity fields to default nested pages', () => {
    expect(normalizeActivityDescriptor({ statusBar: { iconColor: 'dark' } })).toEqual({
      size: 'default',
      pageType: 'nested',
      statusBar: { iconColor: 'dark' }
    });
  });

  it('resolves support small activities to the traditional desktop right panel', () => {
    const resolved = resolveActivityLaunchPlacement(supportSurfaceIntent, {
      shellKind: 'traditional',
      isMobile: false,
      desktopModeId: 'traditional'
    });

    expect(resolved.placement).toBe('right-panel');
    expect(resolved.panelId).toBe('stats.panel');
    expect(resolved.panel).toEqual({
      panelId: 'stats.panel',
      title: 'Stats',
      icon: '',
      contractId: 'stats.panel',
      activity: { size: 'small', pageType: 'nested' },
      props: {}
    });
  });

  it('resolves support small activities to temporary tabs on traditional mobile', () => {
    const resolved = resolveActivityLaunchPlacement(supportSurfaceIntent, {
      shellKind: 'traditional',
      isMobile: true,
      desktopModeId: 'traditional'
    });

    expect(resolved.placement).toBe('temporary-tab');
    expect(resolved.tab?.id).toBe('mobile-widget:stats.panel');
    expect(resolved.tab?.props).toMatchObject({
      activity: { size: 'small', pageType: 'nested' },
      isMobile: true,
      isTemporaryWidgetTab: true
    });
  });

  it('resolves support small activities to workspace windows in freeform mode', () => {
    const resolved = resolveActivityLaunchPlacement(supportSurfaceIntent, {
      shellKind: 'freeform',
      isMobile: false,
      desktopModeId: 'custom-freeform'
    });

    expect(resolved.placement).toBe('workspace-window');
    expect(resolved.workspaceAppId).toBe('plugin:stats.panel');
  });

  it('resolves Telegram mobile standalone activities to the Telegram stack', () => {
    const resolved = resolveActivityLaunchPlacement({
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

    expect(resolved.placement).toBe('telegram-stack');
    expect(resolved.telegramRoute).toEqual({
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
});
