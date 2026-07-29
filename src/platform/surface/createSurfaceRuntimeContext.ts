import type { DesktopExperienceRuntime } from '../../api/services/DesktopExperienceRuntime.js';
import type {
    EmptySurfaceData,
    SurfaceContractId,
    SurfaceDisposer,
    SurfaceInput,
    SurfaceRendererDefinition,
    SurfaceRendererContextValues,
    SurfaceRuntimeContext,
    SurfaceState,
    SurfaceIntents,
    SurfaceThemeContext
} from './types.js';

export interface CreateSurfaceRuntimeContextInput<K extends SurfaceContractId> {
    contractId: K;
    input: SurfaceInput<K>;
    renderer: SurfaceRendererDefinition<K>;
    runtime: DesktopExperienceRuntime;
    theme: SurfaceThemeContext;
    requiredIntents?: readonly string[];
}

export interface CreatedSurfaceRuntimeContext<K extends SurfaceContractId> {
    context: SurfaceRuntimeContext<K>;
    dispose(): void;
}

const EMPTY_SURFACE_DATA: EmptySurfaceData = Object.freeze({});

export const createSurfaceRuntimeContext = <K extends SurfaceContractId>(
    input: CreateSurfaceRuntimeContextInput<K>
): CreatedSurfaceRuntimeContext<K> => {
    const disposers = new Set<SurfaceDisposer>();
    let disposed = false;

    const runDisposer = (disposer: SurfaceDisposer): void => {
        try {
            disposer();
        } catch (error) {
            console.error('[SurfaceRuntime] Disposer failed', {
                contractId: input.contractId,
                ownerId: input.renderer.ownerId,
                error
            });
        }
    };

    const disposeRegisteredCallbacks = (): void => {
        disposers.forEach(runDisposer);
        disposers.clear();
    };

    const onDispose = (disposer: SurfaceDisposer): void => {
        if (disposed) {
            runDisposer(disposer);
            return;
        }
        disposers.add(disposer);
    };

    let values: SurfaceRendererContextValues<K>;
    try {
        values = input.renderer.createContext?.({
            input: input.input,
            runtime: input.runtime,
            onDispose
        }) || {
            state: EMPTY_SURFACE_DATA as SurfaceState<K>,
            intents: EMPTY_SURFACE_DATA as SurfaceIntents<K>
        };
        input.requiredIntents?.forEach(intentId => {
            if (typeof Reflect.get(values.intents, intentId) !== 'function') {
                throw new Error(`[SurfaceRuntime] Required surface intent unavailable: ${intentId}`);
            }
        });
    } catch (error) {
        disposed = true;
        disposeRegisteredCallbacks();
        throw error;
    }

    const context: SurfaceRuntimeContext<K> = {
        contractId: input.contractId,
        input: input.input,
        state: values.state,
        intents: values.intents,
        runtime: input.runtime,
        theme: input.theme,
        onDispose
    };

    return {
        context,
        dispose(): void {
            if (disposed) return;
            disposed = true;
            disposeRegisteredCallbacks();
        }
    };
};
