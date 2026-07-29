import { computed, inject, type ComputedRef, type InjectionKey, type Ref } from 'vue';
import type {
    SurfaceContractId,
    SurfaceInput,
    SurfaceRuntimeContext
} from './types.js';

type SurfaceRuntimeContextRef = Readonly<Ref<SurfaceRuntimeContext<SurfaceContractId> | null>>;

export const surfaceRuntimeContextKey: InjectionKey<SurfaceRuntimeContextRef> = Symbol('surface-runtime-context');

export const useSurfaceRuntimeContext = <K extends SurfaceContractId>(
    contractId: K
): ComputedRef<SurfaceRuntimeContext<K>> => {
    const injectedContext = inject(surfaceRuntimeContextKey);
    if (!injectedContext) {
        throw new Error('[SurfaceRuntime] Surface runtime context was not provided');
    }

    return computed(() => {
        const context = injectedContext.value;
        if (!context || context.contractId !== contractId) {
            throw new Error(`[SurfaceRuntime] Surface runtime context mismatch: ${contractId}`);
        }
        return context as SurfaceRuntimeContext<K>;
    });
};

export const useSurfaceInput = <K extends SurfaceContractId>(contractId: K): Readonly<SurfaceInput<K>> => {
    const context = useSurfaceRuntimeContext(contractId);
    return new Proxy({} as SurfaceInput<K>, {
        get(_target, property: PropertyKey) {
            return context.value.input[property as keyof SurfaceInput<K>];
        },
        has(_target, property: PropertyKey) {
            return property in context.value.input;
        },
        ownKeys() {
            return Reflect.ownKeys(context.value.input);
        },
        getOwnPropertyDescriptor(_target, property: PropertyKey) {
            const descriptor = Object.getOwnPropertyDescriptor(context.value.input, property);
            return descriptor ? { ...descriptor, configurable: true } : undefined;
        }
    });
};
