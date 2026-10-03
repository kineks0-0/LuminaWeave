import { watch, type Ref } from 'vue';
import type { DynamicTabConfig } from '../../shell/types.js';

export interface StaleUiReconcilerOptions {
  /** 当前已注册的插件 id 集合（响应式读取）。 */
  getPluginIds: () => Iterable<string>;
  /** 当前已注册的面板 id 集合（响应式读取）。 */
  getPanelIds: () => Iterable<string>;
  activeRightPanel: Ref<string>;
  activeMainTab: Ref<string>;
  dynamicTabs: Ref<DynamicTabConfig[]>;
  /** App 现有的主视图切换函数，用于把已卸载插件的主标签回退到聊天。 */
  switchMainView: (tabId: string) => void;
  /** App 现有的标签关闭函数（同时清理对应的 workspace 窗口）。 */
  closeTab: (tabId: string) => void;
  /** 插件或面板 id 消失后，清理属于这些 id 的 workspace 窗口记录。 */
  onIdsDisappeared?: (ids: string[]) => void;
}

const FALLBACK_MAIN_TAB = 'lumina-chat';

/**
 * 插件/面板卸载后，让界面状态不再指向已不存在的对象。
 * 只比较前后两次 id 集合并处理“消失”的 id，不在启动时按“当前不存在”清理：
 * 运行时插件尚未注册时，持久化的 tab/panel 值不能被误清。
 */
export const useStaleUiReconciler = (options: StaleUiReconcilerOptions): void => {
  const diffDisappeared = (previous: Set<string>, current: Set<string>): string[] =>
    [...previous].filter(id => !current.has(id));

  let previousPluginIds = new Set(options.getPluginIds());
  let previousPanelIds = new Set(options.getPanelIds());

  watch(
    () => [[...options.getPluginIds()], [...options.getPanelIds()]] as const,
    ([pluginIds, panelIds]) => {
      const currentPlugins = new Set(pluginIds);
      const currentPanels = new Set(panelIds);
      const gonePlugins = diffDisappeared(previousPluginIds, currentPlugins);
      const gonePanels = diffDisappeared(previousPanelIds, currentPanels);
      previousPluginIds = currentPlugins;
      previousPanelIds = currentPanels;

      const goneIds = new Set([...gonePlugins, ...gonePanels]);
      if (goneIds.size === 0) return;

      if (goneIds.has(options.activeRightPanel.value)) {
        options.activeRightPanel.value = 'none';
      }

      // tab id 约定：panel:<id>（面板标签）与 mobile-widget:<id>（移动端临时小组件标签）。
      const staleTabIds = options.dynamicTabs.value
        .map(tab => tab.id)
        .filter(tabId => [...goneIds].some(id => tabId === `panel:${id}` || tabId === `mobile-widget:${id}`));
      staleTabIds.forEach(options.closeTab);

      if (gonePlugins.includes(options.activeMainTab.value)) {
        options.switchMainView(FALLBACK_MAIN_TAB);
      }

      options.onIdsDisappeared?.([...goneIds]);
    }
  );
};
