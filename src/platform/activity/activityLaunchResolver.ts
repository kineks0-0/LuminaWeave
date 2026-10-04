import type { Component } from 'vue';
import type { SurfaceContractId } from '../surface/types.js';
import type {
  ActivityDescriptor,
  ActivityDynamicTabConfig,
  ActivityLaunchEnvironment,
  ActivityLaunchIntent,
  ActivityLaunchResolution,
  ActivityPanelPayload,
  LegacyActivityMode,
  NormalizedActivityDescriptor
} from './types.js';

export const activityFromLegacyMode = (mode: LegacyActivityMode | undefined): ActivityDescriptor | undefined => {
  if (mode === 'large') {
    return { size: 'default', pageType: 'nested' };
  }
  if (mode === 'small') {
    return { size: 'small', pageType: 'nested' };
  }
  return undefined;
};

export const normalizeActivityDescriptor = (
  activity: ActivityDescriptor | undefined,
  fallback?: ActivityDescriptor
): NormalizedActivityDescriptor => ({
  size: activity?.size || fallback?.size || 'default',
  pageType: activity?.pageType || fallback?.pageType || 'nested',
  ...(activity?.statusBar || fallback?.statusBar ? { statusBar: activity?.statusBar || fallback?.statusBar } : {}),
  ...(activity?.titleBar || fallback?.titleBar ? { titleBar: activity?.titleBar || fallback?.titleBar } : {}),
  ...(activity?.secondaryMenu || fallback?.secondaryMenu
    ? { secondaryMenu: activity?.secondaryMenu || fallback?.secondaryMenu }
    : {})
});

export const mergeActivityDescriptors = (
  activity: ActivityDescriptor | undefined,
  fallback?: ActivityDescriptor
): ActivityDescriptor => normalizeActivityDescriptor(activity, fallback);

export const getActivityTargetId = (intent: ActivityLaunchIntent): string => {
  if (intent.id) return intent.id;
  if (intent.target.kind === 'surface') return intent.target.contractId;
  if (intent.target.kind === 'plugin') return intent.target.pluginId;
  if (intent.target.kind === 'registered-panel') return intent.target.panelId;
  return intent.title;
};

const getActivityPanelId = (intent: ActivityLaunchIntent): string => {
  if (intent.target.kind === 'registered-panel') return intent.target.panelId;
  if (intent.target.kind === 'plugin') return intent.target.pluginId;
  return getActivityTargetId(intent);
};

const getWorkspaceAppId = (intent: ActivityLaunchIntent): string => {
  if (intent.target.kind === 'registered-panel') return `panel:${intent.target.panelId}`;
  if (intent.target.kind === 'plugin') return `plugin:${intent.target.pluginId}`;
  return `plugin:${getActivityTargetId(intent)}`;
};

const getSurfaceContractId = (intent: ActivityLaunchIntent): SurfaceContractId | null => {
  if (intent.target.kind === 'surface') return intent.target.contractId;
  if (intent.target.kind === 'plugin') return intent.target.contractId || null;
  if (intent.target.kind === 'registered-panel') return intent.target.contractId || null;
  return null;
};

const getComponent = (intent: ActivityLaunchIntent): Component | undefined => (
  intent.target.kind === 'component' ? intent.target.component : undefined
);

const createTabConfig = (
  intent: ActivityLaunchIntent,
  activity: NormalizedActivityDescriptor,
  options: { temporary: boolean; isMobile: boolean }
): ActivityDynamicTabConfig => {
  const targetId = getActivityTargetId(intent);
  const surfaceContractId = getSurfaceContractId(intent);
  const component = getComponent(intent);
  const tabId = options.temporary ? `mobile-widget:${targetId}` : targetId;
  const props = {
    ...(intent.props || {}),
    activity,
    ...(options.isMobile ? { isMobile: true } : {}),
    ...(options.temporary ? { isTemporaryWidgetTab: true } : {})
  };

  return {
    id: tabId,
    name: intent.title,
    icon: intent.icon || '',
    ...(surfaceContractId ? { surfaceContractId } : {}),
    ...(component ? { component } : {}),
    props,
    activity
  };
};

const createPanelPayload = (
  intent: ActivityLaunchIntent,
  activity: NormalizedActivityDescriptor
): ActivityPanelPayload => {
  const contractId = getSurfaceContractId(intent);
  const component = getComponent(intent);
  return {
    panelId: getActivityPanelId(intent),
    title: intent.title,
    icon: intent.icon || '',
    ...(contractId ? { contractId } : {}),
    ...(component ? { component } : {}),
    activity,
    props: intent.props || {}
  };
};

const isPrimaryDefaultActivity = (intent: ActivityLaunchIntent, activity: NormalizedActivityDescriptor) => (
  (intent.role || 'primary') === 'primary' && activity.size === 'default'
);

export const resolveActivityLaunchPlacement = (
  intent: ActivityLaunchIntent,
  environment: ActivityLaunchEnvironment
): ActivityLaunchResolution => {
  const activity = normalizeActivityDescriptor(intent.activity);
  const role = intent.role || 'primary';
  const panelId = getActivityPanelId(intent);
  const shellKind = environment.shellKind || environment.layoutMode || 'traditional';

  if (role === 'dialog') {
    return {
      placement: 'modal',
      intent,
      activity,
      panelId,
      modalEvent: `OPEN_PANEL_${panelId.toUpperCase()}`
    };
  }

  if (shellKind === 'freeform') {
    return {
      placement: 'workspace-window',
      intent,
      activity,
      panelId,
      workspaceAppId: getWorkspaceAppId(intent),
      tab: createTabConfig(intent, activity, { temporary: false, isMobile: environment.isMobile })
    };
  }

  if (environment.isMobile && !isPrimaryDefaultActivity(intent, activity)) {
    return {
      placement: 'temporary-tab',
      intent,
      activity,
      panelId,
      tab: createTabConfig(intent, activity, { temporary: true, isMobile: true })
    };
  }

  if (role === 'support' || role === 'auxiliary' || activity.size === 'small') {
    return {
      placement: 'right-panel',
      intent,
      activity,
      panelId,
      panel: createPanelPayload(intent, activity)
    };
  }

  return {
    placement: 'main',
    intent,
    activity,
    panelId,
    tab: createTabConfig(intent, activity, { temporary: false, isMobile: environment.isMobile })
  };
};
