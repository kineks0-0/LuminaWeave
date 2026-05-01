import type { Component } from 'vue';

export type SurfaceContractId =
    | 'chat.main'
    | 'chat.preview'
    | 'chat.composer'
    | 'settings.root'
    | 'settings.control'
    | 'forge.workspace'
    | 'forge.settings.summary'
    | 'forge.settings.workbench'
    | 'timeline.navigator'
    | 'stats.panel'
    | 'director.panel'
    | 'lorebook.workspace'
    | 'launcher.root'
    | 'dev.tools'
    | 'telegram.infoPanel'
    | (string & {});

export type SurfaceRendererKind = 'desktop-override' | 'plugin-business' | 'core-default' | 'empty';

export interface SurfaceThemeContext {
    desktopModeId: string;
    variant?: string;
    tokens?: Record<string, string | number>;
    cssVars?: Record<string, string | number>;
    containerProps?: Record<string, unknown>;
}

export interface SurfaceRuntimeContext<TState = unknown, TIntentMap extends Record<string, unknown> = Record<string, unknown>> {
    state: TState;
    intents: TIntentMap;
    theme: SurfaceThemeContext;
}

export interface SurfaceRendererDefinition<TState = unknown, TIntentMap extends Record<string, unknown> = Record<string, unknown>> {
    contractId: SurfaceContractId;
    component: Component;
    ownerId: string;
    kind: SurfaceRendererKind;
    variant?: string;
}

export interface SurfaceContractDefinition<TState = unknown, TIntentMap extends Record<string, unknown> = Record<string, unknown>> {
    id: SurfaceContractId;
    ownerPluginId?: string;
    description?: string;
    requiredIntents?: Array<keyof TIntentMap & string>;
    defaultRenderer?: SurfaceRendererDefinition<TState, TIntentMap>;
    businessRenderer?: SurfaceRendererDefinition<TState, TIntentMap>;
}

export interface SurfaceResolutionRequest {
    contractId: SurfaceContractId;
    desktopModeId: string;
    preferredVariant?: string;
}

export interface SurfaceResolutionResult<TState = unknown, TIntentMap extends Record<string, unknown> = Record<string, unknown>> {
    contractId: SurfaceContractId;
    renderer: SurfaceRendererDefinition<TState, TIntentMap>;
    source: SurfaceRendererKind;
}
