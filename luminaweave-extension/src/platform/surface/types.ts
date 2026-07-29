import type { Component } from 'vue';
import type { z } from 'zod';
import type { DesktopExperienceRuntime } from '../../api/services/DesktopExperienceRuntime.js';

export type SurfaceRendererKind = 'desktop-override' | 'plugin-business' | 'core-default' | 'empty';

export type SurfaceDisposer = () => void;

export type EmptySurfaceData = Readonly<Record<never, never>>;

export interface SurfaceContractSpec<
    TInput extends object,
    TState = EmptySurfaceData,
    TIntentMap extends object = EmptySurfaceData
> {
    input: TInput;
    state: TState;
    intents: TIntentMap;
}

/**
 * 第三方受信任插件必须通过 module augmentation 显式声明自己的 contract。
 */
export interface SurfaceContractMap {}

export type SurfaceContractId = Extract<keyof SurfaceContractMap, string>;

export type SurfaceInput<K extends SurfaceContractId> = SurfaceContractMap[K]['input'];
export type SurfaceState<K extends SurfaceContractId> = SurfaceContractMap[K]['state'];
export type SurfaceIntents<K extends SurfaceContractId> = SurfaceContractMap[K]['intents'];
export type SurfaceInputSchema<K extends SurfaceContractId> = z.ZodType<SurfaceInput<K>>;

export interface SurfaceThemeContext {
    desktopModeId: string;
    variant?: string;
    tokens?: Record<string, string | number>;
    cssVars?: Record<string, string | number>;
}

export interface SurfaceRuntimeContext<K extends SurfaceContractId> {
    contractId: K;
    input: SurfaceInput<K>;
    state: SurfaceState<K>;
    intents: SurfaceIntents<K>;
    runtime: DesktopExperienceRuntime;
    theme: SurfaceThemeContext;
    onDispose(disposer: SurfaceDisposer): void;
}

export interface SurfaceRendererContextFactoryInput<K extends SurfaceContractId> {
    input: SurfaceInput<K>;
    runtime: DesktopExperienceRuntime;
    onDispose(disposer: SurfaceDisposer): void;
}

export interface SurfaceRendererContextValues<K extends SurfaceContractId> {
    state: SurfaceState<K>;
    intents: SurfaceIntents<K>;
}

export interface SurfaceRendererDefinition<K extends SurfaceContractId = SurfaceContractId> {
    contractId: K;
    component: Component;
    ownerId: string;
    kind: SurfaceRendererKind;
    variant?: string;
    createContext?: (
        context: SurfaceRendererContextFactoryInput<K>
    ) => SurfaceRendererContextValues<K>;
}

export type SurfaceRendererDefinitionUnion = {
    [K in SurfaceContractId]: SurfaceRendererDefinition<K>;
}[SurfaceContractId];

export interface EmptySurfaceRendererDefinition {
    contractId: '__empty__';
    component: Component;
    ownerId: string;
    kind: 'empty';
    variant?: string;
}

export interface SurfaceContractDefinition<K extends SurfaceContractId = SurfaceContractId> {
    id: K;
    inputSchema?: SurfaceInputSchema<K>;
    ownerPluginId?: string;
    description?: string;
    requiredIntents?: Array<keyof SurfaceIntents<K> & string>;
    defaultRenderer?: SurfaceRendererDefinition<K>;
    businessRenderer?: SurfaceRendererDefinition<K>;
}

export type SurfaceContractDefinitionUnion = {
    [K in SurfaceContractId]: SurfaceContractDefinition<K>;
}[SurfaceContractId];

export interface SurfaceResolutionRequest<K extends SurfaceContractId = SurfaceContractId> {
    contractId: K;
    desktopModeId: string;
    preferredVariant?: string;
}

export interface SurfaceResolutionResult<K extends SurfaceContractId = SurfaceContractId> {
    contractId: K;
    renderer: SurfaceRendererDefinition<K>;
    source: SurfaceRendererKind;
}
