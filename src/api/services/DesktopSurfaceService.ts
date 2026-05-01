import type { Component } from 'vue';
import { getSurfaceContractIdForRegisteredPanel } from '../../platform/plugin/officialPanelSurfaces';
import type { SurfaceContractId } from '../../platform/surface/types';
import {
    getDesktopMode,
    listDesktopModes,
    registerDesktopMode
} from '../../theme/themeRegistry';
import type { DesktopModeManifest } from '../../theme/types';

export interface RegisteredPanelConfig {
    title: string;
    icon?: string;
    defaultMode?: 'tab' | 'modal';
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
}

export interface OpenPanelOptions {
    mode?: 'tab' | 'modal';
}

export type DesktopSurfaceEventEmitter = (event: string, ...args: unknown[]) => void;

export class DesktopSurfaceService {
    public readonly registeredPanels = new Map<string, RegisteredPanelEntry>();

    constructor(private readonly emit: DesktopSurfaceEventEmitter) {}

    registerPanel(id: string, component: Component, config: RegisteredPanelConfig = { title: '未命名面板' }) {
        console.log(`[DesktopSurfaceService] 注册面板: ${id}`);
        this.registeredPanels.set(id, { id, component, config });
    }

    registerDesktopMode(manifest: DesktopModeManifest) {
        registerDesktopMode(manifest);
        this.emit('SETTINGS_CHANGED');
        this.emit('DESKTOP_MODES_CHANGED', manifest.id);
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
            const surfaceContractId = getSurfaceContractIdForRegisteredPanel(panel.id);
            this.openTab({
                id: panel.id,
                name: panel.config.title,
                icon: panel.config.icon || '',
                ...(surfaceContractId ? { surfaceContractId } : { component: panel.component }),
                props: { ...props, isTabMode: true }
            });
            return;
        }

        this.emit(`OPEN_PANEL_${id.toUpperCase()}`, props);
    }

    openTab(tabConfig: DynamicTabConfig) {
        console.log(`[DesktopSurfaceService] 请求打开标签页: ${tabConfig.name} (${tabConfig.id})`);
        this.emit('OPEN_TAB', tabConfig);
    }
}
