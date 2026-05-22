import type { Component } from 'vue';
import type { SettingDefinition } from '../../types/plugin.js';
import type { SurfaceContractId, SurfaceRendererDefinition } from '../surface/types.js';

export type DesktopShellKind = 'traditional' | 'freeform' | (string & {});

export interface DesktopNavigationModel {
    id: string;
    primarySurfaces?: SurfaceContractId[];
    contextualSurfaces?: SurfaceContractId[];
    mobileSurfaces?: SurfaceContractId[];
}

export interface DesktopInteractionPolicy {
    id: string;
    description?: string;
    openSurface?: 'main' | 'panel' | 'window' | 'modal' | 'temporary-tab';
    supportsOverlappingWindows?: boolean;
    supportsContextualTools?: boolean;
}

export interface DesktopModeManifestV2 {
    id: string;
    name: string;
    description?: string;
    icon?: string;
    shellKind: DesktopShellKind;
    shellRenderer?: Component;
    navigationModel: DesktopNavigationModel;
    surfaceMap?: Partial<Record<SurfaceContractId, SurfaceContractId>>;
    componentOverrides?: Partial<Record<SurfaceContractId, SurfaceRendererDefinition>>;
    interactionPolicy: DesktopInteractionPolicy;
    tokens?: Record<string, string | number>;
    settingsSchema?: Record<string, SettingDefinition>;
}
