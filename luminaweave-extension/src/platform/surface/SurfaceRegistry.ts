import type {
    SurfaceContractDefinition,
    SurfaceContractId,
    SurfaceRendererDefinition,
    SurfaceResolutionRequest,
    SurfaceResolutionResult
} from './types';

type DesktopOverrideKey = `${string}:${string}`;

const createDesktopOverrideKey = (desktopModeId: string, contractId: SurfaceContractId): DesktopOverrideKey =>
    `${desktopModeId}:${contractId}`;

export class SurfaceRegistry {
    private readonly contracts = new Map<SurfaceContractId, SurfaceContractDefinition>();
    private readonly defaultRenderers = new Map<SurfaceContractId, SurfaceRendererDefinition>();
    private readonly businessRenderers = new Map<SurfaceContractId, SurfaceRendererDefinition>();
    private readonly desktopOverrides = new Map<DesktopOverrideKey, SurfaceRendererDefinition>();
    private emptyRenderer: SurfaceRendererDefinition | null = null;

    registerContract(contract: SurfaceContractDefinition): void {
        this.contracts.set(contract.id, contract);
        if (contract.defaultRenderer) {
            this.registerDefaultRenderer(contract.defaultRenderer);
        }
        if (contract.businessRenderer) {
            this.registerBusinessRenderer(contract.businessRenderer);
        }
    }

    registerDefaultRenderer(renderer: SurfaceRendererDefinition): void {
        this.defaultRenderers.set(renderer.contractId, {
            ...renderer,
            kind: 'core-default'
        });
    }

    registerBusinessRenderer(renderer: SurfaceRendererDefinition): void {
        this.businessRenderers.set(renderer.contractId, {
            ...renderer,
            kind: 'plugin-business'
        });
    }

    registerDesktopOverride(desktopModeId: string, renderer: SurfaceRendererDefinition): void {
        this.desktopOverrides.set(createDesktopOverrideKey(desktopModeId, renderer.contractId), {
            ...renderer,
            kind: 'desktop-override'
        });
    }

    registerEmptyRenderer(renderer: SurfaceRendererDefinition): void {
        this.emptyRenderer = {
            ...renderer,
            kind: 'empty'
        };
    }

    getContract(contractId: SurfaceContractId): SurfaceContractDefinition | undefined {
        return this.contracts.get(contractId);
    }

    listContracts(): SurfaceContractDefinition[] {
        return Array.from(this.contracts.values());
    }

    resolve<TState = unknown, TIntentMap extends Record<string, unknown> = Record<string, unknown>>(
        request: SurfaceResolutionRequest
    ): SurfaceResolutionResult<TState, TIntentMap> {
        const desktopOverride = this.desktopOverrides.get(createDesktopOverrideKey(request.desktopModeId, request.contractId));
        if (desktopOverride) {
            return {
                contractId: request.contractId,
                renderer: desktopOverride as SurfaceRendererDefinition<TState, TIntentMap>,
                source: 'desktop-override'
            };
        }

        const businessRenderer = this.businessRenderers.get(request.contractId);
        if (businessRenderer) {
            return {
                contractId: request.contractId,
                renderer: businessRenderer as SurfaceRendererDefinition<TState, TIntentMap>,
                source: 'plugin-business'
            };
        }

        const defaultRenderer = this.defaultRenderers.get(request.contractId);
        if (defaultRenderer) {
            return {
                contractId: request.contractId,
                renderer: defaultRenderer as SurfaceRendererDefinition<TState, TIntentMap>,
                source: 'core-default'
            };
        }

        if (!this.emptyRenderer) {
            throw new Error(`[SurfaceRegistry] No renderer registered for surface contract: ${request.contractId}`);
        }

        return {
            contractId: request.contractId,
            renderer: {
                ...this.emptyRenderer,
                contractId: request.contractId
            } as SurfaceRendererDefinition<TState, TIntentMap>,
            source: 'empty'
        };
    }
}

export const surfaceRegistry = new SurfaceRegistry();
