import type { Component } from 'vue';
import type { SettingDefinition } from '../../types/plugin';
import type {
    SurfaceContractDefinition,
    SurfaceContractId,
    SurfaceRendererDefinition,
    SurfaceRuntimeContext
} from '../surface/types';

export interface PluginCapabilityDefinition {
    id: string;
    description?: string;
}

export type PluginStateSelector<TState = unknown> = (context: PluginRuntimeReadContext) => TState;
export type PluginIntentHandler<TPayload = unknown, TResult = unknown> = (
    payload: TPayload,
    context: PluginRuntimeWriteContext
) => TResult | Promise<TResult>;

export interface PluginRuntimeReadContext {
    getSetting: <TValue>(key: string, fallback: TValue) => TValue;
}

export interface PluginRuntimeWriteContext extends PluginRuntimeReadContext {
    updateSetting: <TValue>(key: string, value: TValue) => void | Promise<void>;
    openSurface: (contractId: SurfaceContractId, props?: Record<string, unknown>) => void;
}

export interface PluginBusinessRendererDefinition<TState = unknown, TIntentMap extends Record<string, unknown> = Record<string, unknown>> {
    contractId: SurfaceContractId;
    component: Component;
    createContext?: (runtime: PluginRuntimeReadContext) => SurfaceRuntimeContext<TState, TIntentMap>;
}

export interface PluginManifestV2 {
    id: string;
    name: string;
    description?: string;
    icon?: string;
    capabilities?: PluginCapabilityDefinition[];
    selectors?: Record<string, PluginStateSelector>;
    intents?: Record<string, PluginIntentHandler>;
    settingsSchema?: Record<string, SettingDefinition>;
    surfaces?: SurfaceContractDefinition[];
    businessRenderers?: Record<string, PluginBusinessRendererDefinition | SurfaceRendererDefinition>;
    fallbackRenderers?: Record<string, SurfaceRendererDefinition>;
    init?: () => void | Promise<void>;
}
