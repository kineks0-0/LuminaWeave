import { shallowReactive, type Component } from 'vue';
import { activityFromLegacyMode, mergeActivityDescriptors } from '../../platform/activity/activityLaunchResolver.js';
import type {
    ActivityDescriptor,
    ActivityLaunchIntent,
    ActivityLaunchRole,
    LegacyActivityMode
} from '../../platform/activity/types.js';
import type { SurfaceContractId } from '../../platform/surface/types.js';
import {
    getDesktopMode,
    listDesktopModes,
    registerDesktopMode,
    unregisterDesktopMode
} from '../../desktop-modes/core/registry.js';
import { normalizeDesktopModePackage } from '../../desktop-modes/core/package.js';
import type { DesktopModeManifest, DesktopModePackage } from '../../desktop-modes/core/types.js';
import { OFFICIAL_SURFACE_CONTRACTS } from '../../platform/surface/officialContracts.js';

export interface RegisteredPanelConfig {
    title: string;
    icon?: string;
    defaultMode?: 'tab' | 'modal';
    surfaceContractId?: SurfaceContractId;
    defaultInput?: Record<string, unknown>;
    navigation?: {
        group?: string;
        hidden?: boolean;
    };
}

export interface RegisteredPanelEntry {
    id: string;
    component: Component;
    config: RegisteredPanelConfig;
}

export interface DynamicTabConfig {
    id: string;
    name: string;
    icon: string;
    component?: Component;
    surfaceContractId?: SurfaceContractId;
    props?: Record<string, unknown>;
    activity?: ActivityDescriptor;
}

export interface OpenPanelOptions {
    mode?: 'tab' | 'modal';
    role?: ActivityLaunchRole;
    activity?: ActivityDescriptor;
}

export type DesktopSurfaceEventEmitter = (event: string, ...args: unknown[]) => void;

export class DesktopSurfaceService {
    // 响应式 Map：运行时插件注册/注销面板后，useWidgetPanels 的 computed 才会刷新。
    public readonly registeredPanels: Map<string, RegisteredPanelEntry> = shallowReactive(new Map<string, RegisteredPanelEntry>());

    constructor(private readonly emit: DesktopSurfaceEventEmitter) {}

    registerPanel(id: string, component: Component, config: RegisteredPanelConfig = { title: '未命名面板' }): RegisteredPanelEntry {
        console.log(`[DesktopSurfaceService] 注册面板: ${id}`);
        const entry: RegisteredPanelEntry = { id, component, config };
        this.registeredPanels.set(id, entry);
        return entry;
    }

    /** 传入 entry 时只在当前登记的仍是该对象才移除，避免撤销过期注册误删新面板。 */
    unregisterPanel(id: string, entry?: RegisteredPanelEntry) {
        if (entry && this.registeredPanels.get(id) !== entry) return;
        this.registeredPanels.delete(id);
    }

    /** 返回撤销函数：只注销本次注册的 manifest（引用比较），重复调用无副作用。 */
    /** ownerPluginId：经插件 context 注册时传入，用于卸载插件时区分“自己的模式”与外部依赖。 */
    registerDesktopMode(input: DesktopModeManifest | DesktopModePackage, ownerPluginId?: string): () => void {
        const modePackage = normalizeDesktopModePackage(input);
        const { manifest } = modePackage;
        if (ownerPluginId) {
            // 官方 contract 是保留命名空间：运行时插件不得用自己的模式覆盖它。
            const officialOverride = (modePackage.componentOverrides ?? []).find(override =>
                (OFFICIAL_SURFACE_CONTRACTS as readonly string[]).includes(override.contractId)
            );
            if (officialOverride) {
                throw new Error(
                    `[DesktopSurfaceService] Runtime plugin cannot override official surface contract: ${officialOverride.contractId}`
                );
            }
        }
        registerDesktopMode(modePackage, ownerPluginId);
        this.emit('SETTINGS_CHANGED');
        this.emit('DESKTOP_MODES_CHANGED', manifest.id);
        let disposed = false;
        return () => {
            if (disposed) return;
            disposed = true;
            if (!unregisterDesktopMode(manifest.id, manifest)) return;
            this.emit('SETTINGS_CHANGED');
            this.emit('DESKTOP_MODES_CHANGED', manifest.id);
        };
    }

    listDesktopModes() {
        return listDesktopModes();
    }

    getDesktopMode(id: string) {
        return getDesktopMode(id);
    }

    openPanel(id: string, props: Record<string, unknown> = {}, options: OpenPanelOptions = {}) {
        const panel = this.registeredPanels.get(id);
        if (!panel) {
            console.error(`[DesktopSurfaceService] 尝试打开未注册的面板: ${id}`);
            return;
        }

        const mode = options.mode || panel.config.defaultMode || 'modal';

        if (mode === 'tab') {
            const surfaceContractId = panel.config.surfaceContractId;
            const activity = mergeActivityDescriptors(options.activity, { size: 'default', pageType: 'nested' });
            const role: ActivityLaunchRole = options.role || (activity.size === 'small' ? 'support' : 'primary');
            this.launchActivity({
                id: panel.id,
                title: panel.config.title,
                icon: panel.config.icon || '',
                role,
                target: surfaceContractId
                    ? { kind: 'surface', contractId: surfaceContractId }
                    : { kind: 'component', component: panel.component },
                activity,
                props: { ...props, isTabMode: true },
                dedupeKey: `panel:${panel.id}`
            });
            return;
        }

        this.emit(`OPEN_PANEL_${id.toUpperCase()}`, props);
    }

    launchActivity(intent: ActivityLaunchIntent) {
        console.log(`[DesktopSurfaceService] 请求启动 Activity: ${intent.title} (${intent.id || intent.dedupeKey || intent.target.kind})`);
        this.emit('LAUNCH_ACTIVITY', intent);
    }

    openTab(tabConfig: DynamicTabConfig) {
        console.log(`[DesktopSurfaceService] 请求打开标签页: ${tabConfig.name} (${tabConfig.id})`);
        const target = tabConfig.surfaceContractId
            ? { kind: 'surface' as const, contractId: tabConfig.surfaceContractId }
            : tabConfig.component
                ? { kind: 'component' as const, component: tabConfig.component }
                : null;
        if (!target) {
            console.error('[DesktopSurfaceService] Tab target unavailable', {
                tabId: tabConfig.id
            });
            return;
        }
        const props = tabConfig.props || {};
        const legacyActivity = activityFromLegacyMode(props.mode as LegacyActivityMode | undefined);
        const activity = mergeActivityDescriptors(tabConfig.activity || props.activity as ActivityDescriptor | undefined, legacyActivity);
        const role: ActivityLaunchRole = activity.size === 'small' || props.isTemporaryWidgetTab ? 'support' : 'primary';
        this.launchActivity({
            id: tabConfig.id,
            title: tabConfig.name,
            icon: tabConfig.icon,
            role,
            target,
            activity,
            props,
            dedupeKey: `tab:${tabConfig.id}`
        });
    }
}
