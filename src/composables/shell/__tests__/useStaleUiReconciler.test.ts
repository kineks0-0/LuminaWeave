import { defineComponent, effectScope, nextTick, reactive, ref } from 'vue';
import { describe, expect, it, vi } from 'vitest';
import { PluginManager } from '../../../core/PluginManager.js';
import { DesktopSurfaceService } from '../../../api/services/DesktopSurfaceService.js';
import { useStaleUiReconciler } from '../useStaleUiReconciler.js';
import type { DynamicTabConfig } from '../../../shell/types.js';

const Stub = defineComponent({ name: 'ReconcilerStub', render: () => null });
const tab = (id: string): DynamicTabConfig => ({ id, name: id, icon: '' });

const setup = (initial: { plugins: string[]; panels: string[]; right?: string; main?: string; tabs?: string[] }) => {
  const state = reactive({ plugins: [...initial.plugins], panels: [...initial.panels] });
  const activeRightPanel = ref(initial.right ?? 'none');
  const activeMainTab = ref(initial.main ?? 'lumina-chat');
  const dynamicTabs = ref<DynamicTabConfig[]>((initial.tabs ?? []).map(tab));
  const switchMainView = vi.fn((id: string) => { activeMainTab.value = id; });
  const closeTab = vi.fn((id: string) => {
    dynamicTabs.value = dynamicTabs.value.filter(item => item.id !== id);
  });
  const onIdsDisappeared = vi.fn();
  const scope = effectScope();
  scope.run(() => useStaleUiReconciler({
    getPluginIds: () => state.plugins,
    getPanelIds: () => state.panels,
    activeRightPanel,
    activeMainTab,
    dynamicTabs,
    switchMainView,
    closeTab,
    onIdsDisappeared
  }));
  return { state, activeRightPanel, activeMainTab, dynamicTabs, switchMainView, closeTab, onIdsDisappeared, scope };
};

describe('useStaleUiReconciler', () => {
  it('resets right panel, main tab and stale tabs when a plugin disappears', async () => {
    const ctx = setup({
      plugins: ['a', 'b'], panels: [], right: 'a', main: 'a', tabs: ['mobile-widget:a', 'panel:b']
    });

    ctx.state.plugins = ['b'];
    await nextTick();

    expect(ctx.activeRightPanel.value).toBe('none');
    expect(ctx.switchMainView).toHaveBeenCalledWith('lumina-chat');
    expect(ctx.activeMainTab.value).toBe('lumina-chat');
    expect(ctx.dynamicTabs.value.map(item => item.id)).toEqual(['panel:b']);
    expect(ctx.onIdsDisappeared).toHaveBeenCalledWith(['a']);
    ctx.scope.stop();
  });

  it('leaves unrelated ids untouched', async () => {
    const ctx = setup({ plugins: ['a', 'b'], panels: [], right: 'b', main: 'b', tabs: ['panel:b'] });

    ctx.state.plugins = ['b'];
    await nextTick();

    expect(ctx.activeRightPanel.value).toBe('b');
    expect(ctx.activeMainTab.value).toBe('b');
    expect(ctx.switchMainView).not.toHaveBeenCalled();
    expect(ctx.dynamicTabs.value.map(item => item.id)).toEqual(['panel:b']);
    ctx.scope.stop();
  });

  it('does not clean persisted values that point at ids which never existed', async () => {
    const ctx = setup({ plugins: ['a'], panels: [], right: 'runtime-plugin', main: 'runtime-plugin', tabs: ['mobile-widget:runtime-plugin'] });

    ctx.state.plugins = ['a', 'c'];
    await nextTick();

    expect(ctx.activeRightPanel.value).toBe('runtime-plugin');
    expect(ctx.activeMainTab.value).toBe('runtime-plugin');
    expect(ctx.dynamicTabs.value).toHaveLength(1);
    ctx.scope.stop();
  });

  it('handles disappearing panels the same way', async () => {
    const ctx = setup({ plugins: [], panels: ['p1', 'p2'], right: 'p1', tabs: ['panel:p1', 'mobile-widget:p1', 'panel:p2'] });

    ctx.state.panels = ['p2'];
    await nextTick();

    expect(ctx.activeRightPanel.value).toBe('none');
    expect(ctx.dynamicTabs.value.map(item => item.id)).toEqual(['panel:p2']);
    expect(ctx.onIdsDisappeared).toHaveBeenCalledWith(['p1']);
    ctx.scope.stop();
  });

  it('detects disappearance through real reactive sources', async () => {
    const manager = new PluginManager();
    const surface = new DesktopSurfaceService(() => undefined);
    const onIdsDisappeared = vi.fn();
    const activeRightPanel = ref('real-panel');
    const scope = effectScope();
    scope.run(() => useStaleUiReconciler({
      getPluginIds: () => Object.keys(manager.plugins),
      getPanelIds: () => surface.registeredPanels.keys(),
      activeRightPanel,
      activeMainTab: ref('lumina-chat'),
      dynamicTabs: ref<DynamicTabConfig[]>([]),
      switchMainView: vi.fn(),
      closeTab: vi.fn(),
      onIdsDisappeared
    }));

    const entry = surface.registerPanel('real-panel', {} as never, { title: 'Real' });
    const handle = manager.register({ id: 'real-plugin', name: 'Real', icon: '', component: Stub });
    await nextTick();
    expect(onIdsDisappeared).not.toHaveBeenCalled();

    surface.unregisterPanel('real-panel', entry);
    handle?.dispose();
    await nextTick();

    expect(onIdsDisappeared).toHaveBeenCalledTimes(1);
    expect([...onIdsDisappeared.mock.calls[0][0]].sort()).toEqual(['real-panel', 'real-plugin']);
    expect(activeRightPanel.value).toBe('none');
    scope.stop();
  });
});
