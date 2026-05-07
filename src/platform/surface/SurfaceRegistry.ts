import type {
    SurfaceContractDefinition,
    SurfaceContractId,
    SurfaceRendererDefinition,
    SurfaceResolutionRequest,
    SurfaceResolutionResult
} from './types.js';

type DesktopOverrideKey = `${string}:${string}`;

const createDesktopOverrideKey = (desktopModeId: string, contractId: SurfaceContractId): DesktopOverrideKey =>
    `${desktopModeId}:${contractId}`;

const selectRenderer = (
    renderers: SurfaceRendererDefinition[] | undefined,
    preferredVariant?: string
): SurfaceRendererDefinition | undefined => {
    if (!renderers?.length) return undefined;
    if (preferredVariant) {
        const exact = renderers.find(renderer => renderer.variant === preferredVariant);
        if (exact) return exact;
    }
    return renderers.find(renderer => !renderer.variant) || renderers[0];
};

const assertNoRendererConflict = (
    renderers: SurfaceRendererDefinition[] | undefined,
    renderer: SurfaceRendererDefinition,
    source: string
): void => {
    const duplicate = renderers?.find(existing => (existing.variant || '') === (renderer.variant || ''));
    if (!duplicate) return;
    throw new Error(
        `[SurfaceRegistry] Duplicate ${source} renderer for surface contract: ${renderer.contractId}` +
        ` (variant: ${renderer.variant || 'default'}, owners: ${duplicate.ownerId}, ${renderer.ownerId})`
    );
};

export class SurfaceRegistry {
    private readonly contracts = new Map<SurfaceContractId, SurfaceContractDefinition>();
    private readonly defaultRenderers = new Map<SurfaceContractId, SurfaceRendererDefinition[]>();
    private readonly businessRenderers = new Map<SurfaceContractId, SurfaceRendererDefinition[]>();
    private readonly desktopOverrides = new Map<DesktopOverrideKey, SurfaceRendererDefinition[]>();
    private emptyRenderer: SurfaceRendererDefinition | null = null;

    assertCanRegisterContract(contract: SurfaceContractDefinition): void {
        const existing = this.contracts.get(contract.id);
        if (existing?.ownerPluginId && contract.ownerPluginId && existing.ownerPluginId !== contract.ownerPluginId) {
            throw new Error(
                `[SurfaceRegistry] Surface contract ${contract.id} already belongs to ${existing.ownerPluginId}; ` +
                `cannot register owner ${contract.ownerPluginId}`
            );
        }
        if (contract.defaultRenderer) {
            this.assertCanRegisterDefaultRenderer(contract.defaultRenderer);
        }
        if (contract.businessRenderer) {
            this.assertCanRegisterBusinessRenderer(contract.businessRenderer);
        }
    }

    registerContract(contract: SurfaceContractDefinition): void {
        this.assertCanRegisterContract(contract);
        const existing = this.contracts.get(contract.id);

        this.contracts.set(contract.id, {
            ...existing,
            ...contract,
            ownerPluginId: contract.ownerPluginId || existing?.ownerPluginId
        });
        if (contract.defaultRenderer) {
            this.registerDefaultRenderer(contract.defaultRenderer);
        }
        if (contract.businessRenderer) {
            this.registerBusinessRenderer(contract.businessRenderer);
        }
    }

    assertCanRegisterDefaultRenderer(renderer: SurfaceRendererDefinition): void {
        const normalized = {
            ...renderer,
            kind: 'core-default'
        } satisfies SurfaceRendererDefinition;
        const renderers = this.defaultRenderers.get(renderer.contractId);
        assertNoRendererConflict(renderers, normalized, 'core default');
    }

    registerDefaultRenderer(renderer: SurfaceRendererDefinition): void {
        this.assertCanRegisterDefaultRenderer(renderer);
        const normalized = {
            ...renderer,
            kind: 'core-default'
        } satisfies SurfaceRendererDefinition;
        const renderers = this.defaultRenderers.get(renderer.contractId);
        this.defaultRenderers.set(renderer.contractId, [...(renderers || []), normalized]);
    }

    assertCanRegisterBusinessRenderer(renderer: SurfaceRendererDefinition): void {
        const normalized = {
            ...renderer,
            kind: 'plugin-business'
        } satisfies SurfaceRendererDefinition;
        const renderers = this.businessRenderers.get(renderer.contractId);
        assertNoRendererConflict(renderers, normalized, 'plugin business');
    }

    registerBusinessRenderer(renderer: SurfaceRendererDefinition): void {
        this.assertCanRegisterBusinessRenderer(renderer);
        const normalized = {
            ...renderer,
            kind: 'plugin-business'
        } satisfies SurfaceRendererDefinition;
        const renderers = this.businessRenderers.get(renderer.contractId);
        this.businessRenderers.set(renderer.contractId, [...(renderers || []), normalized]);
    }

    assertCanRegisterDesktopOverride(desktopModeId: string, renderer: SurfaceRendererDefinition): void {
        const key = createDesktopOverrideKey(desktopModeId, renderer.contractId);
        const normalized = {
            ...renderer,
            kind: 'desktop-override'
        } satisfies SurfaceRendererDefinition;
        const renderers = this.desktopOverrides.get(key);
        assertNoRendererConflict(renderers, normalized, `desktop override for ${desktopModeId}`);
    }

    registerDesktopOverride(desktopModeId: string, renderer: SurfaceRendererDefinition): void {
        this.assertCanRegisterDesktopOverride(desktopModeId, renderer);
        const key = createDesktopOverrideKey(desktopModeId, renderer.contractId);
        const normalized = {
            ...renderer,
            kind: 'desktop-override'
        } satisfies SurfaceRendererDefinition;
        const renderers = this.desktopOverrides.get(key);
        this.desktopOverrides.set(key, [...(renderers || []), normalized]);
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
        const desktopOverride = selectRenderer(
            this.desktopOverrides.get(createDesktopOverrideKey(request.desktopModeId, request.contractId)),
            request.preferredVariant
        );
        if (desktopOverride) {
            return {
                contractId: request.contractId,
                renderer: desktopOverride as SurfaceRendererDefinition<TState, TIntentMap>,
                source: 'desktop-override'
            };
        }

        const businessRenderer = selectRenderer(this.businessRenderers.get(request.contractId), request.preferredVariant);
        if (businessRenderer) {
            return {
                contractId: request.contractId,
                renderer: businessRenderer as SurfaceRendererDefinition<TState, TIntentMap>,
                source: 'plugin-business'
            };
        }

        const defaultRenderer = selectRenderer(this.defaultRenderers.get(request.contractId), request.preferredVariant);
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
