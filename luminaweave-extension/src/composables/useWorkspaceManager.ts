import { computed, onUnmounted, ref, watch, type ComputedRef, type Ref } from 'vue';
import { lwStorage } from '../api/storage';
import LauncherRoot from '../plugins/launcher/LauncherRoot.vue';
import CardMakerPanel from '../plugins/forge/CardMakerPanel.vue';
import ForgeAuxPanelView from '../plugins/forge/ForgeAuxPanelView.vue';
import ContextSwitcherPanel from '../components/ContextSwitcherPanel.vue';
import { useCardMakerStore } from '../plugins/forge/CardMakerStore';
import { useSessionIndexStore } from '../stores/useSessionIndexStore';
import { FORGE_AUX_PANEL_META, FORGE_AUX_PANEL_ORDER } from '../plugins/forge/forgeAuxPanels';
import { currentDetailedView } from '../plugins/settings/useSettings';

type WorkspaceAppKind = 'launcher' | 'main' | 'widget' | 'panel';

interface DynamicTabConfig {
  id: string;
  name: string;
  icon: string;
  component: any;
  props?: Record<string, unknown>;
}

interface WorkspaceLayout {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface WorkspaceStageRecord {
  id: string;
  windowIds: string[];
  createdAt: number;
  lastActiveAt: number;
}

interface WorkspaceWindowRecord {
  id: string;
  appId: string;
  stageId: string;
  layout: WorkspaceLayout;
  zIndex: number;
  createdAt: number;
  lastActiveAt: number;
}

interface WorkspaceAppDescriptor {
  id: string;
  title: string;
  icon: string;
  component: any;
  props: Record<string, unknown>;
  kind: WorkspaceAppKind;
  dockable: boolean;
  minWidth: number;
  maxWidth: number;
  minHeight: number;
  maxHeight: number;
  preferredWidth: number;
  preferredHeight: number;
  eyebrow: string;
}

const WORKSPACE_MAX_WINDOWS_PER_STAGE_KEY = 'lumina-settings.workspaceMaxWindowsPerStage';
const WORKSPACE_STAGE_SCENE_TOP = 18;
const WORKSPACE_STAGE_SCENE_RIGHT = 20;
const WORKSPACE_STAGE_SCENE_BOTTOM = 108;
const WORKSPACE_STAGE_SCENE_BOTTOM_MOBILE = 88;
const WORKSPACE_STAGE_SCENE_LEFT = 152;
const WORKSPACE_STAGE_SCENE_LEFT_MOBILE = 104;
const WORKSPACE_ALLOW_UNDER_STAGE_STRIP_KEY = 'lumina-settings.workspaceAllowUnderStageStrip';
const WORKSPACE_ALLOW_UNDER_DOCK_KEY = 'lumina-settings.workspaceAllowUnderDock';
const WORKSPACE_SHOW_STAGE_STRIP_KEY = 'lumina-settings.workspaceShowStageStrip';
const WORKSPACE_SHOW_DOCK_KEY = 'lumina-settings.workspaceShowDock';

const clampNumber = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);
const applyElasticBounds = (value: number, min: number, max: number, resistance = 0.18) => {
  if (value < min) return min - (min - value) * resistance;
  if (value > max) return max + (value - max) * resistance;
  return value;
};
const createWorkspaceStageId = () => `stage_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
const createWorkspaceWindowId = () => `window_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;

const normalizeWorkspaceStages = (input: unknown): WorkspaceStageRecord[] => {
  if (!Array.isArray(input)) return [];
  return input
    .filter((item): item is Record<string, unknown> => Boolean(item && typeof item === 'object'))
    .map((item) => ({
      id: typeof item.id === 'string' ? item.id : createWorkspaceStageId(),
      windowIds: Array.isArray(item.windowIds) ? item.windowIds.filter((value): value is string => typeof value === 'string') : [],
      createdAt: typeof item.createdAt === 'number' ? item.createdAt : Date.now(),
      lastActiveAt: typeof item.lastActiveAt === 'number' ? item.lastActiveAt : Date.now()
    }));
};

const normalizeWorkspaceWindows = (input: unknown): Record<string, WorkspaceWindowRecord> => {
  if (!input || typeof input !== 'object') return {};
  return Object.entries(input as Record<string, unknown>).reduce<Record<string, WorkspaceWindowRecord>>((acc, [key, raw]) => {
    if (!raw || typeof raw !== 'object') return acc;
    const item = raw as Record<string, unknown>;
    const layout = item.layout as Partial<WorkspaceLayout> | undefined;
    acc[key] = {
      id: typeof item.id === 'string' ? item.id : key,
      appId: typeof item.appId === 'string' ? item.appId : '',
      stageId: typeof item.stageId === 'string' ? item.stageId : '',
      layout: {
        x: typeof layout?.x === 'number' ? layout.x : 0,
        y: typeof layout?.y === 'number' ? layout.y : 0,
        width: typeof layout?.width === 'number' ? layout.width : 0,
        height: typeof layout?.height === 'number' ? layout.height : 0
      },
      zIndex: typeof item.zIndex === 'number' ? item.zIndex : 1,
      createdAt: typeof item.createdAt === 'number' ? item.createdAt : Date.now(),
      lastActiveAt: typeof item.lastActiveAt === 'number' ? item.lastActiveAt : Date.now()
    };
    return acc;
  }, {});
};

export const useWorkspaceManager = ({
  mainPlugins,
  widgetPlugins,
  dynamicTabs,
  activeMainTab,
  activeRightPanel,
  isMobile,
  freeformStageRef,
  workspaceNavigationVisible,
  componentMap,
  getPluginName
}: {
  mainPlugins: ComputedRef<any[]>;
  widgetPlugins: ComputedRef<any[]>;
  dynamicTabs: Ref<DynamicTabConfig[]>;
  activeMainTab: Ref<string>;
  activeRightPanel: Ref<string>;
  isMobile: Ref<boolean>;
  freeformStageRef: Ref<HTMLElement | null>;
  workspaceNavigationVisible: Ref<boolean> | ComputedRef<boolean>;
  componentMap: Record<string, any>;
  getPluginName: (pluginId: string | null) => string;
}) => {
  let workspacePersistTimer: ReturnType<typeof setTimeout> | null = null;
  const forgeStore = useCardMakerStore();
  const workspaceStages = ref<WorkspaceStageRecord[]>(normalizeWorkspaceStages(lwStorage.get('luminaWeave.workspaceStages', [], 'Global')));
  const workspaceWindows = ref<Record<string, WorkspaceWindowRecord>>(normalizeWorkspaceWindows(lwStorage.get('luminaWeave.workspaceWindows', {}, 'Global')));
  const activeWorkspaceStageId = ref<string>(typeof lwStorage.get('luminaWeave.workspaceActiveStageId', '', 'Global') === 'string'
    ? lwStorage.get('luminaWeave.workspaceActiveStageId', '', 'Global')
    : '');
  const activeWorkspaceWindowId = ref<string | null>(typeof lwStorage.get('luminaWeave.workspaceActiveWindowId', null, 'Global') === 'string'
    ? lwStorage.get('luminaWeave.workspaceActiveWindowId', null, 'Global')
    : null);
  const workspaceZSeed = ref<number>(Number(lwStorage.get('luminaWeave.workspaceZSeed', 18, 'Global')) || 18);
  const workspaceAllowUnderStageStrip = ref(Boolean(lwStorage.get(WORKSPACE_ALLOW_UNDER_STAGE_STRIP_KEY, false, 'Global')));
  const workspaceAllowUnderDock = ref(Boolean(lwStorage.get(WORKSPACE_ALLOW_UNDER_DOCK_KEY, false, 'Global')));
  const workspaceShowStageStrip = ref(lwStorage.get(WORKSPACE_SHOW_STAGE_STRIP_KEY, true, 'Global') !== false);
  const workspaceShowDock = ref(lwStorage.get(WORKSPACE_SHOW_DOCK_KEY, true, 'Global') !== false);

  const workspaceStaticApps = computed<WorkspaceAppDescriptor[]>(() => {
    const apps: WorkspaceAppDescriptor[] = [
      {
        id: 'plugin:lumina-launcher',
        title: '启动台',
        icon: '<svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="2" fill="none"><rect x="3" y="3" width="7" height="7"></rect><rect x="14" y="3" width="7" height="7"></rect><rect x="14" y="14" width="7" height="7"></rect><rect x="3" y="14" width="7" height="7"></rect></svg>',
        component: LauncherRoot,
        props: { activeMainTab: activeMainTab.value },
        kind: 'launcher',
        dockable: true,
        minWidth: 180,
        maxWidth: 1460,
        minHeight: 460,
        maxHeight: 1100,
        preferredWidth: 1180,
        preferredHeight: 720,
        eyebrow: 'Workspace Index'
      },
      {
        id: 'panel:card_maker',
        title: '制卡工坊',
        icon: '🧩',
        component: CardMakerPanel,
        props: { embeddedInWorkspaceWindow: true },
        kind: 'panel',
        dockable: true,
        minWidth: 180,
        maxWidth: 1500,
        minHeight: 520,
        maxHeight: 1100,
        preferredWidth: 1160,
        preferredHeight: 760,
        eyebrow: 'Forge Workspace'
      }
    ];

    FORGE_AUX_PANEL_ORDER.forEach((kind) => {
      const panel = FORGE_AUX_PANEL_META[kind];
      const isWidePanel = kind === 'lorebook' || kind === 'review';
      const isTallPanel = kind === 'memory' || kind === 'post_tracks';
      apps.push({
        id: `panel:${panel.id}`,
        title: panel.title,
        icon: panel.icon,
        component: ForgeAuxPanelView,
        props: { kind },
        kind: 'panel',
        dockable: false,
        minWidth: 360,
        maxWidth: 980,
        minHeight: 320,
        maxHeight: 980,
        preferredWidth: isWidePanel ? 520 : 460,
        preferredHeight: isTallPanel ? 720 : 620,
        eyebrow: 'Workspace Sheet'
      });
    });

    const mainPluginIds = new Set<string>();
    for (const plugin of mainPlugins.value) {
      if (plugin.id === 'lumina-launcher') continue;
      mainPluginIds.add(plugin.id);
      apps.push({
        id: `plugin:${plugin.id}`,
        title: plugin.name,
        icon: plugin.icon,
        component: plugin.component,
        props: { mode: 'large', isMobile: isMobile.value },
        kind: 'main',
        dockable: true,
        minWidth: 180,
        maxWidth: 1460,
        minHeight: 420,
        maxHeight: 1100,
        preferredWidth: plugin.id === 'lumina-chat' ? 980 : 1080,
        preferredHeight: plugin.id === 'lumina-timeline' ? 700 : 760,
        eyebrow: plugin.id === 'lumina-chat' ? 'Primary Workspace' : 'Creative Workspace'
      });
    }

    for (const plugin of widgetPlugins.value) {
      // 如果插件同时拥有主视图位槽，则使用 widget: 前缀以区分身份
      const isDualRole = mainPluginIds.has(plugin.id);
      apps.push({
        id: isDualRole ? `widget:${plugin.id}` : `plugin:${plugin.id}`,
        title: plugin.name,
        icon: plugin.icon,
        component: plugin.component,
        props: { mode: 'small', isMobile: isMobile.value },
        kind: 'widget',
        dockable: true,
        minWidth: 360,
        maxWidth: 920,
        minHeight: 320,
        maxHeight: 940,
        preferredWidth: plugin.id === 'lumina-settings' ? 560 : 460,
        preferredHeight: plugin.id === 'lumina-settings' ? 700 : 560,
        eyebrow: 'Support Tool'
      });
    }

    apps.push({
      id: 'plugin:context-switcher',
      title: '会话切换',
      icon: '<svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"><polyline points="17 1 21 5 17 9"></polyline><path d="M3 11V9a4 4 0 0 1 4-4h14"></path><polyline points="7 23 3 19 7 15"></polyline><path d="M21 13v2a4 4 0 0 1-4 4H3"></path></svg>',
      component: ContextSwitcherPanel,
      props: {},
      kind: 'widget',
      dockable: false,
      minWidth: 320,
      maxWidth: 560,
      minHeight: 320,
      maxHeight: 880,
      preferredWidth: 420,
      preferredHeight: 520,
      eyebrow: 'Context'
    });

    return apps;
  });

  const workspaceDynamicApps = computed<WorkspaceAppDescriptor[]>(() =>
    dynamicTabs.value.map((tab) => ({
      id: `tab:${tab.id}`,
      title: tab.name,
      icon: tab.icon || '',
      component: componentMap[tab.component] || tab.component,
      props: tab.props || {},
      kind: 'panel',
      dockable: false,
      minWidth: 180,
      maxWidth: 1480,
      minHeight: 420,
      maxHeight: 1100,
      preferredWidth: 1080,
      preferredHeight: 720,
      eyebrow: 'Workspace Sheet'
    }))
  );

  const workspaceApps = computed(() => [...workspaceStaticApps.value, ...workspaceDynamicApps.value]);
  const workspaceAppMap = computed(() => new Map<string, WorkspaceAppDescriptor>(workspaceApps.value.map((app) => [app.id, app])));

  const getWorkspaceStage = (stageId: string | null | undefined) => {
    if (!stageId) return null;
    return workspaceStages.value.find((stage) => stage.id === stageId) ?? null;
  };

  const getWorkspaceSceneBounds = () => {
    const stageWidth = (freeformStageRef.value?.clientWidth && freeformStageRef.value.clientWidth > 0)
      ? freeformStageRef.value.clientWidth
      : window.innerWidth;
    const stageHeight = (freeformStageRef.value?.clientHeight && freeformStageRef.value.clientHeight > 0)
      ? freeformStageRef.value.clientHeight
      : window.innerHeight;

    const shouldReserveStageStrip = workspaceNavigationVisible.value
      && workspaceShowStageStrip.value
      && !workspaceAllowUnderStageStrip.value;
    const shouldReserveDock = workspaceNavigationVisible.value
      && workspaceShowDock.value
      && !workspaceAllowUnderDock.value;
      
    const left = workspaceNavigationVisible.value
      ? (shouldReserveStageStrip ? (isMobile.value ? WORKSPACE_STAGE_SCENE_LEFT_MOBILE : WORKSPACE_STAGE_SCENE_LEFT) : (isMobile.value ? 12 : 18))
      : (isMobile.value ? 12 : 18);
    const top = WORKSPACE_STAGE_SCENE_TOP;
    const right = WORKSPACE_STAGE_SCENE_RIGHT;
    const bottom = workspaceNavigationVisible.value
      ? (shouldReserveDock ? (isMobile.value ? WORKSPACE_STAGE_SCENE_BOTTOM_MOBILE : WORKSPACE_STAGE_SCENE_BOTTOM) : (isMobile.value ? 14 : 18))
      : (isMobile.value ? 14 : 18);
      
    return {
      left,
      top,
      width: Math.max(300, stageWidth - left - right),
      height: Math.max(minWindowHeight, stageHeight - top - bottom)
    };
  };

  const minWindowHeight = isMobile.value ? 240 : 280;


  const workspaceSceneInsets = computed(() => {
    const stageWidth = freeformStageRef.value?.clientWidth ?? window.innerWidth;
    const stageHeight = freeformStageRef.value?.clientHeight ?? window.innerHeight;
    const bounds = getWorkspaceSceneBounds();
    return {
      left: bounds.left,
      top: bounds.top,
      right: Math.max(0, stageWidth - bounds.left - bounds.width),
      bottom: Math.max(0, stageHeight - bounds.top - bounds.height)
    };
  });

  const snapToClosest = (value: number, candidates: number[], threshold: number) => {
    let closest = value;
    let smallestDistance = Infinity;
    for (const candidate of candidates) {
      const distance = Math.abs(value - candidate);
      if (distance < smallestDistance) {
        smallestDistance = distance;
        closest = candidate;
      }
    }
    return smallestDistance <= threshold ? closest : value;
  };

  const getWorkspaceAppIdForMainTab = (tabId: string) => {
    if (dynamicTabs.value.some((tab) => tab.id === tabId)) return `tab:${tabId}`;
    if (tabId === 'card_maker') return 'panel:card_maker';
    return `plugin:${tabId}`;
  };

  const ensureWorkspaceStageExists = () => {
    if (workspaceStages.value.length === 0) {
      const now = Date.now();
      workspaceStages.value = [{
        id: createWorkspaceStageId(),
        windowIds: [],
        createdAt: now,
        lastActiveAt: now
      }];
      activeWorkspaceStageId.value = workspaceStages.value[0].id;
      activeWorkspaceWindowId.value = null;
      return;
    }
    if (!getWorkspaceStage(activeWorkspaceStageId.value)) {
      activeWorkspaceStageId.value = workspaceStages.value[0].id;
    }
  };

  const getWorkspaceWindowEntriesForStage = (stageId: string | null | undefined) => {
    const stage = getWorkspaceStage(stageId);
    if (!stage) return [];
    return stage.windowIds
      .map((windowId) => {
        const window = workspaceWindows.value[windowId];
        const app = window ? workspaceAppMap.value.get(window.appId) : null;
        if (!window || !app) return null;
        return { window, app };
      })
      .filter((entry): entry is { window: WorkspaceWindowRecord; app: WorkspaceAppDescriptor } => Boolean(entry));
  };

  const getWorkspaceDefaultLayout = (app: WorkspaceAppDescriptor, stageId?: string): WorkspaceLayout => {
    const bounds = getWorkspaceSceneBounds();
    const stageWindowCount = stageId ? (getWorkspaceStage(stageId)?.windowIds.length ?? 0) : 0;
    const minWidth = Math.min(app.minWidth, bounds.width);
    const maxWidth = Math.max(minWidth, Math.min(app.maxWidth, bounds.width));
    const minHeight = Math.min(app.minHeight, bounds.height);
    const maxHeight = Math.max(minHeight, Math.min(app.maxHeight, bounds.height));
    const mobilePrimaryWidth = Math.round(bounds.width * (app.kind === 'widget' ? 0.92 : 0.96));
    const mobilePrimaryHeight = Math.round(bounds.height * (app.kind === 'widget' ? 0.56 : 0.78));
    const width = clampNumber(
      isMobile.value ? mobilePrimaryWidth : app.preferredWidth,
      minWidth,
      maxWidth
    );
    const height = clampNumber(
      isMobile.value ? mobilePrimaryHeight : app.preferredHeight,
      minHeight,
      maxHeight
    );
    const horizontalBaseOffset = isMobile.value ? 14 : 36;
    const verticalBaseOffset = isMobile.value ? 18 : 24;
    const offsetStepX = isMobile.value ? 20 : 34;
    const offsetStepY = isMobile.value ? 16 : 28;
    return {
      x: clampNumber(bounds.left + horizontalBaseOffset + Math.min(stageWindowCount * offsetStepX, Math.max(0, bounds.width - width - 16)), bounds.left, bounds.left + bounds.width - width),
      y: clampNumber(bounds.top + verticalBaseOffset + Math.min(stageWindowCount * offsetStepY, Math.max(0, bounds.height - height - 16)), bounds.top, bounds.top + bounds.height - height),
      width,
      height
    };
  };

  const normalizeWorkspaceLayout = (
    app: WorkspaceAppDescriptor,
    layout: WorkspaceLayout,
    options: { interaction?: 'move' | 'resize'; isFinal?: boolean } = {}
  ): WorkspaceLayout => {
    const bounds = getWorkspaceSceneBounds();
    const isLiveMove = options.interaction === 'move' && !options.isFinal;
    const isLiveResize = options.interaction === 'resize' && !options.isFinal;
    const minWidth = Math.min(app.minWidth, bounds.width);
    const maxWidth = Math.max(minWidth, Math.min(app.maxWidth, bounds.width));
    const minHeight = Math.min(app.minHeight, bounds.height);
    const maxHeight = Math.max(minHeight, Math.min(app.maxHeight, bounds.height));
    const rawWidth = layout.width || app.preferredWidth;
    const rawHeight = layout.height || app.preferredHeight;
    let width = isLiveResize
      ? applyElasticBounds(rawWidth, minWidth, maxWidth, isMobile.value ? 0.16 : 0.14)
      : clampNumber(rawWidth, minWidth, maxWidth);
    let height = isLiveResize
      ? applyElasticBounds(rawHeight, minHeight, maxHeight, isMobile.value ? 0.16 : 0.14)
      : clampNumber(rawHeight, minHeight, maxHeight);
    const layoutMaxX = Math.max(bounds.left, bounds.left + bounds.width - width);
    const layoutMaxY = Math.max(bounds.top, bounds.top + bounds.height - height);
    let x = isLiveMove
      ? applyElasticBounds(layout.x, bounds.left, layoutMaxX, isMobile.value ? 0.18 : 0.16)
      : clampNumber(layout.x, bounds.left, layoutMaxX);
    let y = isLiveMove
      ? applyElasticBounds(layout.y, bounds.top, layoutMaxY, isMobile.value ? 0.18 : 0.16)
      : clampNumber(layout.y, bounds.top, layoutMaxY);

    if (options.interaction === 'resize') {
      x = clampNumber(x, bounds.left, bounds.left + bounds.width - width);
      y = clampNumber(y, bounds.top, bounds.top + bounds.height - height);
    }

    return { x, y, width, height };
  };

  const syncSelectionFromWorkspaceApp = (appId: string) => {
    if (appId.startsWith('plugin:')) {
      const pluginId = appId.slice(7);
      if (mainPlugins.value.some((plugin) => plugin.id === pluginId)) {
        activeMainTab.value = pluginId;
      }
      if (widgetPlugins.value.some((plugin) => plugin.id === pluginId)) {
        activeRightPanel.value = pluginId;
      }
      return;
    }

    if (appId.startsWith('tab:')) {
      activeMainTab.value = appId.slice(4);
    }
  };

  const normalizeZIndices = () => {
    const windows = Object.values(workspaceWindows.value)
      .sort((a, b) => a.zIndex - b.zIndex);
    
    windows.forEach((win, index) => {
      win.zIndex = index + 1;
    });
    
    workspaceZSeed.value = windows.length;
  };

  const focusWorkspaceWindow = (windowId: string) => {
    const record = workspaceWindows.value[windowId];
    if (!record) return;
    
    activeWorkspaceStageId.value = record.stageId;
    activeWorkspaceWindowId.value = windowId;
    
    // 归一化检查：如果种子数值过大（如 1000+），则进行全量层级重排，防止数值无限增长
    if (workspaceZSeed.value > 1000) {
      normalizeZIndices();
    }
    
    workspaceZSeed.value += 1;
    record.zIndex = workspaceZSeed.value;
    record.lastActiveAt = Date.now();
    
    const stage = getWorkspaceStage(record.stageId);
    if (stage) {
      stage.lastActiveAt = record.lastActiveAt;
    }
    syncSelectionFromWorkspaceApp(record.appId);
  };

  const activateWorkspaceStage = (stageId: string) => {
    const stage = getWorkspaceStage(stageId);
    if (!stage) return;
    activeWorkspaceStageId.value = stageId;
    stage.lastActiveAt = Date.now();
    const topWindow = stage.windowIds
      .map((windowId) => workspaceWindows.value[windowId])
      .filter((window): window is WorkspaceWindowRecord => Boolean(window))
      .sort((left, right) => right.zIndex - left.zIndex)[0];
    activeWorkspaceWindowId.value = topWindow?.id ?? null;
    if (topWindow) {
      syncSelectionFromWorkspaceApp(topWindow.appId);
    }
  };

  const createWorkspaceStage = (activate = false): WorkspaceStageRecord => {
    const now = Date.now();
    const stage: WorkspaceStageRecord = {
      id: createWorkspaceStageId(),
      windowIds: [],
      createdAt: now,
      lastActiveAt: now
    };
    workspaceStages.value = [stage, ...workspaceStages.value];
    if (activate) {
      activeWorkspaceStageId.value = stage.id;
      activeWorkspaceWindowId.value = null;
    }
    return stage;
  };

  const removeWorkspaceWindowRecord = (windowId: string) => {
    const record = workspaceWindows.value[windowId];
    if (!record) return;
    const stage = getWorkspaceStage(record.stageId);
    if (stage) {
      stage.windowIds = stage.windowIds.filter((id) => id !== windowId);
      stage.lastActiveAt = Date.now();
    }
    delete workspaceWindows.value[windowId];

    if (stage && stage.windowIds.length === 0 && activeWorkspaceStageId.value !== stage.id) {
      workspaceStages.value = workspaceStages.value.filter((item) => item.id !== stage.id);
    }

    if (activeWorkspaceWindowId.value === windowId) {
      const fallbackWindow = (stage?.windowIds ?? [])
        .map((id) => workspaceWindows.value[id])
        .filter((window): window is WorkspaceWindowRecord => Boolean(window))
        .sort((left, right) => right.zIndex - left.zIndex)[0];
      activeWorkspaceWindowId.value = fallbackWindow?.id ?? null;
    }

    ensureWorkspaceStageExists();
  };

  const closeTab = (tabId: string, options: { removeWorkspace?: boolean } = {}) => {
    const removeWorkspace = options.removeWorkspace !== false;
    const index = dynamicTabs.value.findIndex((tab) => tab.id === tabId);
    if (index !== -1) {
      dynamicTabs.value.splice(index, 1);
    }
    if (removeWorkspace) {
      for (const windowId of Object.keys(workspaceWindows.value)) {
        if (workspaceWindows.value[windowId]?.appId === `tab:${tabId}`) {
          removeWorkspaceWindowRecord(windowId);
        }
      }
    }
    if (activeMainTab.value === tabId) {
      activeMainTab.value = 'lumina-chat';
    }
  };

  const closeWorkspaceWindow = (windowId: string) => {
    const record = workspaceWindows.value[windowId];
    if (!record) return;
    if (record.appId.startsWith('tab:')) {
      closeTab(record.appId.slice(4), { removeWorkspace: false });
    }
    removeWorkspaceWindowRecord(windowId);
  };

  const closeWorkspaceApps = (appIds: string[]) => {
    const targetIds = new Set(appIds);
    Object.values(workspaceWindows.value)
      .filter((window) => targetIds.has(window.appId))
      .forEach((window) => closeWorkspaceWindow(window.id));
  };

  const openWorkspaceApp = (
    appId: string,
    options: { forceNewStage?: boolean; allowDuplicate?: boolean; stageId?: string } = {}
  ) => {
    const app = workspaceAppMap.value.get(appId);
    if (!app) return;

    ensureWorkspaceStageExists();
    
    const maxWindows = lwStorage.get(WORKSPACE_MAX_WINDOWS_PER_STAGE_KEY, 4, 'Global');

    if (!options.allowDuplicate) {
      const existing = Object.values(workspaceWindows.value).find((window) => window.appId === appId);
      if (existing) {
        // 激活窗口所在的舞台并强制聚焦提升层级
        activateWorkspaceStage(existing.stageId);
        focusWorkspaceWindow(existing.id);
        return;
      }
    }

    let targetStage = options.stageId ? getWorkspaceStage(options.stageId) : getWorkspaceStage(activeWorkspaceStageId.value);
    if (!targetStage || options.forceNewStage || targetStage.windowIds.length >= maxWindows) {
      targetStage = createWorkspaceStage(true);
    }

    const now = Date.now();
    const windowId = createWorkspaceWindowId();
    workspaceZSeed.value += 1;
    workspaceWindows.value[windowId] = {
      id: windowId,
      appId,
      stageId: targetStage.id,
      layout: normalizeWorkspaceLayout(app, getWorkspaceDefaultLayout(app, targetStage.id)),
      zIndex: workspaceZSeed.value,
      createdAt: now,
      lastActiveAt: now
    };
    targetStage.windowIds = [...targetStage.windowIds, windowId];
    targetStage.lastActiveAt = now;
    activeWorkspaceStageId.value = targetStage.id;
    activeWorkspaceWindowId.value = windowId;
    syncSelectionFromWorkspaceApp(appId);
  };

  const reflowWorkspaceWindows = () => {
    for (const window of Object.values(workspaceWindows.value)) {
      const app = workspaceAppMap.value.get(window.appId);
      if (!app) continue;
      window.layout = normalizeWorkspaceLayout(app, window.layout);
    }
  };

  const handleWorkspaceBoundarySettingChange = (payload: unknown) => {
    const data = payload as { key?: string } | null;
    if (!data?.key) return;
    if (data.key === WORKSPACE_SHOW_STAGE_STRIP_KEY) {
      workspaceShowStageStrip.value = lwStorage.get(WORKSPACE_SHOW_STAGE_STRIP_KEY, true, 'Global') !== false;
      reflowWorkspaceWindows();
      return;
    }
    if (data.key === WORKSPACE_SHOW_DOCK_KEY) {
      workspaceShowDock.value = lwStorage.get(WORKSPACE_SHOW_DOCK_KEY, true, 'Global') !== false;
      reflowWorkspaceWindows();
      return;
    }
    if (data.key === WORKSPACE_ALLOW_UNDER_STAGE_STRIP_KEY) {
      workspaceAllowUnderStageStrip.value = Boolean(lwStorage.get(WORKSPACE_ALLOW_UNDER_STAGE_STRIP_KEY, false, 'Global'));
      reflowWorkspaceWindows();
      return;
    }
    if (data.key === WORKSPACE_ALLOW_UNDER_DOCK_KEY) {
      workspaceAllowUnderDock.value = Boolean(lwStorage.get(WORKSPACE_ALLOW_UNDER_DOCK_KEY, false, 'Global'));
      reflowWorkspaceWindows();
    }
  };

  lwStorage.on('*', handleWorkspaceBoundarySettingChange);
  onUnmounted(() => {
    lwStorage.off('*', handleWorkspaceBoundarySettingChange);
  });

  const reconcileWorkspaceState = (seedIfEmpty = false) => {
    const validAppIds = new Set(workspaceApps.value.map((app) => app.id));
    for (const [windowId, window] of Object.entries(workspaceWindows.value)) {
      if (!validAppIds.has(window.appId)) {
        delete workspaceWindows.value[windowId];
      }
    }

    workspaceStages.value = workspaceStages.value
      .map((stage) => ({
        ...stage,
        windowIds: stage.windowIds.filter((windowId) => Boolean(workspaceWindows.value[windowId]))
      }))
      .filter((stage) => stage.windowIds.length > 0 || stage.id === activeWorkspaceStageId.value);

    ensureWorkspaceStageExists();

    if (!activeWorkspaceWindowId.value || !workspaceWindows.value[activeWorkspaceWindowId.value]) {
      const activeStage = getWorkspaceStage(activeWorkspaceStageId.value);
      const fallbackWindow = (activeStage?.windowIds ?? [])
        .map((windowId) => workspaceWindows.value[windowId])
        .filter((window): window is WorkspaceWindowRecord => Boolean(window))
        .sort((left, right) => right.zIndex - left.zIndex)[0];
      activeWorkspaceWindowId.value = fallbackWindow?.id ?? null;
    }

    reflowWorkspaceWindows();

    if (seedIfEmpty && Object.keys(workspaceWindows.value).length === 0) {
      openWorkspaceApp(getWorkspaceAppIdForMainTab(activeMainTab.value || 'lumina-chat'), { allowDuplicate: true });
      if (!isMobile.value && activeRightPanel.value !== 'none') {
        openWorkspaceApp(`plugin:${activeRightPanel.value}`, { allowDuplicate: true });
      }
    }
  };

  const updateWorkspaceLayout = (
    windowId: string,
    patch: Partial<WorkspaceLayout> & { interaction?: 'move' | 'resize'; isFinal?: boolean }
  ) => {
    const record = workspaceWindows.value[windowId];
    if (!record) return;
    const app = workspaceAppMap.value.get(record.appId);
    if (!app) return;
    record.layout = normalizeWorkspaceLayout(
      app,
      { ...record.layout, ...patch },
      { interaction: patch.interaction, isFinal: patch.isFinal }
    );
  };

  const focusAdjacentWorkspaceWindow = (windowId: string, direction: 'prev' | 'next') => {
    const record = workspaceWindows.value[windowId];
    if (!record) return;
    const entries = getWorkspaceWindowEntriesForStage(record.stageId)
      .map((entry) => entry.window)
      .sort((left, right) => right.zIndex - left.zIndex);
    if (entries.length < 2) return;
    const currentIndex = entries.findIndex((entry) => entry.id === windowId);
    if (currentIndex === -1) return;
    const nextIndex = direction === 'next'
      ? (currentIndex + 1) % entries.length
      : (currentIndex - 1 + entries.length) % entries.length;
    focusWorkspaceWindow(entries[nextIndex].id);
  };

  const createStageWithLauncher = () => {
    const stage = createWorkspaceStage(true);
    openWorkspaceApp('plugin:lumina-launcher', { allowDuplicate: true, stageId: stage.id });
  };

  const openWorkspaceSettings = () => {
    openWorkspaceApp('plugin:lumina-settings');
  };

  const handleWorkspaceDockOpen = (appId: string) => {
    openWorkspaceApp(appId);
  };

  const workspaceStageStripItems = computed(() =>
    [...workspaceStages.value]
      .sort((left, right) => {
        if (left.id === activeWorkspaceStageId.value) return -1;
        if (right.id === activeWorkspaceStageId.value) return 1;
        return right.lastActiveAt - left.lastActiveAt;
      })
      .map((stage, index) => {
        const entries = getWorkspaceWindowEntriesForStage(stage.id)
          .sort((left, right) => right.window.zIndex - left.window.zIndex)
          .slice(0, 3);
        return {
          id: stage.id,
          label: stage.id === activeWorkspaceStageId.value ? '当前舞台' : `舞台 ${String(index + 1).padStart(2, '0')}`,
          isActive: stage.id === activeWorkspaceStageId.value,
          isEmpty: stage.windowIds.length === 0,
          windowCount: stage.windowIds.length,
          appIcons: entries.map((entry) => entry.app.icon),
          previewTitles: entries.map((entry) => entry.app.title)
        };
      })
  );

  const workspaceDockItems = computed(() => {
    const sessionIndexStore = useSessionIndexStore();
    const hasMultipleSessions = (sessionIndexStore.chatSessions.length + sessionIndexStore.forgeSessions.length) > 1;
    const runningAppIds = new Set(Object.values(workspaceWindows.value).map((window) => window.appId));
    const activeStageAppIds = new Set(getWorkspaceWindowEntriesForStage(activeWorkspaceStageId.value).map((entry) => entry.window.appId));
    return workspaceStaticApps.value
      .filter((app) => app.dockable || (app.id === 'plugin:context-switcher' && hasMultipleSessions))
      .map((app) => ({
        id: app.id,
        title: app.title,
        icon: app.icon,
        isRunning: runningAppIds.has(app.id),
        isActive: activeStageAppIds.has(app.id)
      }));
  });

  const activeStageWindowEntries = computed(() =>
    getWorkspaceWindowEntriesForStage(activeWorkspaceStageId.value)
      .map(({ window, app }) => ({
        id: window.id,
        appId: app.id,
        title: app.id === 'plugin:lumina-settings' && currentDetailedView.value
          ? `${getPluginName(currentDetailedView.value)} 设置`
          : app.id === 'panel:card_maker'
            ? (forgeStore.workspaceTitle || app.title)
            : app.title,
        icon: app.icon,
        component: app.component,
        props: app.props,
        kind: app.kind,
        eyebrow: app.eyebrow,
        minWidth: app.minWidth,
        maxWidth: app.maxWidth,
        minHeight: app.minHeight,
        maxHeight: app.maxHeight,
        zIndex: window.zIndex,
        layout: window.layout,
        isCompact:
          window.layout.width <= 768 ||
          window.layout.height <= 520 ||
          (app.kind === 'widget' && window.layout.width <= 560)
      }))
  );

  const persistWorkspaceMetadata = () => {
    if (workspacePersistTimer) clearTimeout(workspacePersistTimer);
    workspacePersistTimer = setTimeout(() => {
      lwStorage.set('luminaWeave.workspaceStages', workspaceStages.value, 'Global');
      lwStorage.set('luminaWeave.workspaceWindows', workspaceWindows.value, 'Global');
      workspacePersistTimer = null;
    }, 600);
  };

  watch(workspaceStages, persistWorkspaceMetadata, { deep: true });
  watch(workspaceWindows, persistWorkspaceMetadata, { deep: true });

  watch(activeWorkspaceStageId, (value) => {
    lwStorage.set('luminaWeave.workspaceActiveStageId', value, 'Global');
  });

  watch(activeWorkspaceWindowId, (value) => {
    lwStorage.set('luminaWeave.workspaceActiveWindowId', value, 'Global');
  });

  watch(workspaceZSeed, (value) => {
    lwStorage.set('luminaWeave.workspaceZSeed', value, 'Global');
  });

  watch(dynamicTabs, () => {
    reconcileWorkspaceState(false);
  }, { deep: true });

  return {
    activeWorkspaceWindowId,
    activeStageWindowEntries,
    workspaceStageStripItems,
    workspaceDockItems,
    workspaceSceneInsets,
    reconcileWorkspaceState,
    reflowWorkspaceWindows,
    updateWorkspaceLayout,
    focusWorkspaceWindow,
    focusAdjacentWorkspaceWindow,
    closeWorkspaceWindow,
    activateWorkspaceStage,
    createWorkspaceStage,
    createStageWithLauncher,
    openWorkspaceSettings,
    handleWorkspaceDockOpen,
    openWorkspaceApp,
    closeWorkspaceApps,
    closeTab,
    getWorkspaceAppIdForMainTab,
    workspaceAppMap
  };
};
