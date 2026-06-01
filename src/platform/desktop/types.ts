import type { Component } from 'vue';
import type { SettingDefinition } from '../../types/plugin.js';
import type { SurfaceContractId, SurfaceRendererDefinition } from '../surface/types.js';
import type { DesktopModeManifest, DesktopModeShellKind } from '../../theme/types.js';

export type DesktopShellKind = DesktopModeShellKind | (string & {});

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

export interface DesktopModeRuntimeDescriptor {
    manifest: DesktopModeManifest;
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

/**
 * @deprecated DesktopModeManifest is the public protocol; runtime code should
 * use DesktopModeRuntimeDescriptor as the derived internal shape.
 */
export type DesktopModeManifestV2 = DesktopModeRuntimeDescriptor;
