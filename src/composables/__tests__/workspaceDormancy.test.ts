import { describe, expect, it } from 'vitest';
import {
  computeDisappearedAppIds,
  findAwakenedWindowIds,
  isDormantCapableAppId,
  partitionWorkspaceWindowIds,
  resolveActiveWorkspaceWindowId,
  shouldDropWorkspaceWindowOnReconcile,
  shouldSeedWorkspace
} from '../workspaceDormancy.js';

describe('workspace window dormancy', () => {
  const valid = new Set(['plugin:chat', 'tab:main']);

  it('treats plugin / widget / panel app ids as dormant-capable only', () => {
    expect(isDormantCapableAppId('plugin:rt-demo')).toBe(true);
    expect(isDormantCapableAppId('widget:rt-demo')).toBe(true);
    expect(isDormantCapableAppId('panel:rt-demo')).toBe(true);
    expect(isDormantCapableAppId('tab:foo')).toBe(false);
    expect(isDormantCapableAppId('')).toBe(false);
  });

  it('keeps a runtime plugin window while its plugin is not registered yet', () => {
    expect(shouldDropWorkspaceWindowOnReconcile('plugin:rt-demo', valid)).toBe(false);
    expect(shouldDropWorkspaceWindowOnReconcile('panel:rt-panel', valid)).toBe(false);
  });

  it('still drops stale records of other kinds and valid ones are kept', () => {
    expect(shouldDropWorkspaceWindowOnReconcile('tab:gone', valid)).toBe(true);
    expect(shouldDropWorkspaceWindowOnReconcile('', valid)).toBe(true);
    expect(shouldDropWorkspaceWindowOnReconcile('plugin:chat', valid)).toBe(false);
    expect(shouldDropWorkspaceWindowOnReconcile('tab:main', valid)).toBe(false);
  });

  it('counts only renderable windows and turns dormant ones visible once the app is registered', () => {
    const windows = {
      w1: { appId: 'plugin:chat' },
      w2: { appId: 'plugin:rt-demo' },
      w3: { appId: 'tab:main' }
    };
    const before = partitionWorkspaceWindowIds(['w1', 'w2', 'w3', 'missing'], windows, valid);
    expect(before.renderable).toEqual(['w1', 'w3']);
    expect(before.dormant).toEqual(['w2']);

    const after = partitionWorkspaceWindowIds(['w1', 'w2', 'w3'], windows, new Set([...valid, 'plugin:rt-demo']));
    expect(after.renderable).toEqual(['w1', 'w2', 'w3']);
    expect(after.dormant).toEqual([]);
  });

  it('expands disappeared plugin ids into app ids that are no longer in the catalog', () => {
    expect(computeDisappearedAppIds(['gone', 'still'], new Set(['plugin:still', 'widget:other']))).toEqual([
      'plugin:gone',
      'widget:gone',
      'panel:gone',
      'widget:still',
      'panel:still'
    ]);
    expect(computeDisappearedAppIds([], new Set())).toEqual([]);
  });

  describe('active window fallback', () => {
    const windows = {
      live: { appId: 'plugin:chat', zIndex: 1 },
      top: { appId: 'tab:main', zIndex: 5 },
      sleeping: { appId: 'plugin:rt-demo', zIndex: 9 }
    };

    it('keeps a valid active window', () => {
      expect(resolveActiveWorkspaceWindowId('live', ['live', 'top'], windows, valid)).toBe('live');
    });

    it('falls back to the highest renderable window when the active one is dormant or missing', () => {
      expect(resolveActiveWorkspaceWindowId('sleeping', ['live', 'top', 'sleeping'], windows, valid)).toBe('top');
      expect(resolveActiveWorkspaceWindowId('missing', ['live', 'top'], windows, valid)).toBe('top');
      expect(resolveActiveWorkspaceWindowId(null, ['live', 'top'], windows, valid)).toBe('top');
    });

    it('returns null when the stage only has dormant windows', () => {
      expect(resolveActiveWorkspaceWindowId('sleeping', ['sleeping'], windows, valid)).toBeNull();
    });
  });

  it('seeds the workspace when only dormant windows are left', () => {
    expect(shouldSeedWorkspace({}, valid)).toBe(true);
    expect(shouldSeedWorkspace({ a: { appId: 'plugin:rt-demo' } }, valid)).toBe(true);
    expect(shouldSeedWorkspace({ a: { appId: 'plugin:rt-demo' }, b: { appId: 'tab:main' } }, valid)).toBe(false);
  });

  it('finds windows that were woken by a newly registered app', () => {
    const windows = {
      w1: { appId: 'plugin:chat' },
      w2: { appId: 'plugin:rt-demo' },
      w3: { appId: 'plugin:other-sleeper' }
    };
    const previous = new Set(['plugin:chat']);
    const next = new Set(['plugin:chat', 'plugin:rt-demo']);

    expect(findAwakenedWindowIds(windows, previous, next)).toEqual(['w2']);
    expect(findAwakenedWindowIds(windows, next, next)).toEqual([]);
  });
});
