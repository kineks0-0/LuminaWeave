import type { Component } from 'vue';
import type { SettingDefinition } from '../../types/plugin.js';
import type { PluginInitContext } from './PluginInitContext.js';
import type { ActivityDescriptor } from '../activity/types.js';
import type {
    SurfaceContractDefinitionUnion,
    SurfaceContractId,
    SurfaceInput,
    SurfaceRendererDefinition,
    SurfaceRendererDefinitionUnion
} from '../surface/types.js';

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
    openSurface: <K extends SurfaceContractId>(contractId: K, input: SurfaceInput<K>) => void;
}

export interface PluginBusinessRendererDefinition<K extends SurfaceContractId = SurfaceContractId> {
    contractId: K;
    component: Component;
    createContext?: SurfaceRendererDefinition<K>['createContext'];
}

export type PluginBusinessRendererDefinitionUnion = {
    [K in SurfaceContractId]: PluginBusinessRendererDefinition<K>;
}[SurfaceContractId];

export type PluginRendererDefinitionUnion =
    | PluginBusinessRendererDefinitionUnion
    | SurfaceRendererDefinitionUnion;

export type PluginBusinessRendererMap = Partial<{
    [K in SurfaceContractId]: PluginBusinessRendererDefinition<K> | SurfaceRendererDefinition<K>;
}>;

export type PluginFallbackRendererMap = Partial<{
    [K in SurfaceContractId]: SurfaceRendererDefinition<K>;
}>;

export interface PluginManifestV2 {
    id: string;
    name: string;
    description?: string;
    icon?: string;
    capabilities?: PluginCapabilityDefinition[];
    primarySurface?: SurfaceContractId;
    activity?: ActivityDescriptor;
    navigationSlots?: ('mainView' | 'widget' | 'headerCenter' | 'headerRight')[];
    selectors?: Record<string, PluginStateSelector>;
    intents?: Record<string, PluginIntentHandler>;
    settingsSchema?: Record<string, SettingDefinition>;
    surfaces?: SurfaceContractDefinitionUnion[];
    businessRenderers?: PluginBusinessRendererMap;
    fallbackRenderers?: PluginFallbackRendererMap;
    init?: (context: PluginInitContext) => void | Promise<void>;
}
