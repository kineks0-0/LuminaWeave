import type { Component } from 'vue';
import ContextSwitcherPanel from '../components/ContextSwitcherPanel.vue';
import ConflictDiffViewer from '../plugins/chat/ConflictDiffViewer.vue';
import SyncReportViewer from '../plugins/chat/SyncReportViewer.vue';

export interface LegacyPanelDefinition {
  id: string;
  component: Component;
  title: string;
  icon: string;
  legacyTabComponentName?: string;
}

export const legacyPanelDefinitions = [
  {
    id: 'conflict',
    component: ConflictDiffViewer,
    title: '版本分歧比对',
    icon: '⚡',
    legacyTabComponentName: 'ConflictDiffViewer'
  },
  {
    id: 'sync_report',
    component: SyncReportViewer,
    title: '同步对比报告',
    icon: '🧾',
    legacyTabComponentName: 'SyncReportViewer'
  },
  {
    id: 'context-switcher',
    component: ContextSwitcherPanel,
    title: '会话切换',
    icon: '🔄'
  }
] satisfies LegacyPanelDefinition[];

export const legacyTabComponentRegistry = legacyPanelDefinitions.reduce<Record<string, Component>>((registry, panel) => {
  if (panel.legacyTabComponentName) {
    registry[panel.legacyTabComponentName] = panel.component;
  }
  return registry;
}, {});

export const getLegacyPanelDefinition = (panelId: string): LegacyPanelDefinition | null =>
  legacyPanelDefinitions.find((panel) => panel.id === panelId) ?? null;
