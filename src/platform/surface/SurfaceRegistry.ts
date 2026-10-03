import { z } from 'zod';
import type {
    SurfaceContractDefinition,
    SurfaceContractDefinitionUnion,
    SurfaceContractId,
    EmptySurfaceRendererDefinition,
    SurfaceInput,
    SurfaceRendererDefinition,
    SurfaceRendererDefinitionUnion,
    SurfaceResolutionRequest,
    SurfaceResolutionResult
} from './types.js';
import type { RegistrationDisposer } from '../plugin/PluginRegistrationScope.js';

type DesktopOverrideKey = `${string}:${string}`;

export type SurfaceRegistryErrorCode =
    | 'invalid-contract-registration'
    | 'invalid-renderer-registration'
    | 'missing-input-schema'
    | 'duplicate-contract'
    | 'input-schema-conflict'
    | 'duplicate-renderer'
    | 'duplicate-empty-renderer'
    | 'renderer-contract-unavailable'
    | 'renderer-contract-mismatch'
    | 'unknown-contract'
    | 'invalid-input'
    | 'renderer-unavailable';

export class SurfaceRegistryError extends Error {
    constructor(
        public readonly code: SurfaceRegistryErrorCode,
        message: string
    ) {
        super(message);
        this.name = 'SurfaceRegistryError';
    }
}

const createDesktopOverrideKey = (desktopModeId: string, contractId: SurfaceContractId): DesktopOverrideKey =>
    `${desktopModeId}:${contractId}`;

const surfaceRendererRegistrationSchema = z.object({
    contractId: z.string().min(1),
    component: z.custom<object | ((...args: never[]) => object)>(value => (
        (typeof value === 'object' && value !== null) || typeof value === 'function'
    )),
    ownerId: z.string().min(1),
    kind: z.enum(['desktop-override', 'plugin-business', 'core-default', 'empty']),
    variant: z.string().min(1).optional(),
    createContext: z.custom<(...args: never[]) => object>(value => typeof value === 'function').optional()
}).strict();

const surfaceContractRegistrationSchema = z.object({
    id: z.string().min(1),
    inputSchema: z.custom<z.ZodType>(value => (
        typeof value === 'object'
        && value !== null
        && 'safeParse' in value
        && typeof value.safeParse === 'function'
    )).optional(),
    ownerPluginId: z.string().min(1).optional(),
    description: z.string().optional(),
    requiredIntents: z.array(z.string().min(1)).optional(),
    defaultRenderer: surfaceRendererRegistrationSchema.optional(),
    businessRenderer: surfaceRendererRegistrationSchema.optional()
}).strict();

type SurfaceRendererRegistrationDefinition = SurfaceRendererDefinitionUnion | EmptySurfaceRendererDefinition;

export interface SurfaceRegistrationBatch {
    contracts?: SurfaceContractDefinitionUnion[];
    defaultRenderers?: SurfaceRendererDefinitionUnion[];
    businessRenderers?: SurfaceRendererDefinitionUnion[];
}

const assertValidRendererRegistration = (renderer: SurfaceRendererRegistrationDefinition): void => {
    const validation = surfaceRendererRegistrationSchema.safeParse(renderer);
    if (validation.success) return;
    throw new SurfaceRegistryError(
        'invalid-renderer-registration',
        '[SurfaceRegistry] Invalid surface renderer registration'
    );
};

const assertValidContractRegistration = (contract: SurfaceContractDefinitionUnion): void => {
    const validation = surfaceContractRegistrationSchema.safeParse(contract);
    if (validation.success) return;
    throw new SurfaceRegistryError(
        'invalid-contract-registration',
        '[SurfaceRegistry] Invalid surface contract registration'
    );
};

const selectRenderer = <K extends SurfaceContractId>(
    renderers: SurfaceRendererDefinition<K>[] | undefined,
    preferredVariant?: string
): SurfaceRendererDefinition<K> | undefined => {
    if (!renderers?.length) return undefined;
    if (preferredVariant) {
        const exact = renderers.find(renderer => renderer.variant === preferredVariant);
        if (exact) return exact;
    }
    return renderers.find(renderer => !renderer.variant) || renderers[0];
};

const assertNoRendererConflict = (
    renderers: SurfaceRendererDefinitionUnion[] | undefined,
    renderer: SurfaceRendererDefinitionUnion,
    source: string
): void => {
    const duplicate = renderers?.find(existing => (existing.variant || '') === (renderer.variant || ''));
    if (!duplicate) return;
    throw new SurfaceRegistryError(
        'duplicate-renderer',
        `[SurfaceRegistry] Duplicate ${source} renderer for surface contract: ${renderer.contractId}`
        + ` (variant: ${renderer.variant || 'default'}, owners: ${duplicate.ownerId}, ${renderer.ownerId})`
    );
};

export class SurfaceRegistry {
    private readonly contracts = new Map<SurfaceContractId, SurfaceContractDefinitionUnion>();
    private readonly defaultRenderers = new Map<SurfaceContractId, SurfaceRendererDefinitionUnion[]>();
    private readonly businessRenderers = new Map<SurfaceContractId, SurfaceRendererDefinitionUnion[]>();
    private readonly desktopOverrides = new Map<DesktopOverrideKey, SurfaceRendererDefinitionUnion[]>();
    private emptyRenderer: EmptySurfaceRendererDefinition | null = null;

    private assertContractMetadataCanRegister(contract: SurfaceContractDefinitionUnion): void {
        assertValidContractRegistration(contract);
        const existing = this.contracts.get(contract.id);
        if (!existing && !contract.inputSchema) {
            throw new SurfaceRegistryError(
                'missing-input-schema',
                `[SurfaceRegistry] Surface contract requires an input schema: ${contract.id}`
            );
        }
        const enrichesUnownedContract = Boolean(existing && !existing.ownerPluginId && contract.ownerPluginId);
        if (existing && !enrichesUnownedContract) {
            throw new SurfaceRegistryError(
                'duplicate-contract',
                `[SurfaceRegistry] Duplicate surface contract registration: ${contract.id}`
            );
        }
        if (existing?.inputSchema && contract.inputSchema && existing.inputSchema !== contract.inputSchema) {
            throw new SurfaceRegistryError(
                'input-schema-conflict',
                `[SurfaceRegistry] Surface contract input schema conflict: ${contract.id}`
            );
        }
        if (contract.defaultRenderer && contract.defaultRenderer.contractId !== contract.id) {
            throw new SurfaceRegistryError(
                'renderer-contract-mismatch',
                `[SurfaceRegistry] Embedded renderer contract mismatch: ${contract.id}`
            );
        }
        if (contract.businessRenderer && contract.businessRenderer.contractId !== contract.id) {
            throw new SurfaceRegistryError(
                'renderer-contract-mismatch',
                `[SurfaceRegistry] Embedded renderer contract mismatch: ${contract.id}`
            );
        }
    }

    private assertRendererBatch(
        renderers: SurfaceRendererDefinitionUnion[],
        availableContractIds: ReadonlySet<SurfaceContractId>,
        existingRenderers: Map<SurfaceContractId, SurfaceRendererDefinitionUnion[]>,
        source: string
    ): void {
        const batchKeys = new Set<string>();
        renderers.forEach(renderer => {
            assertValidRendererRegistration(renderer);
            if (!availableContractIds.has(renderer.contractId)) {
                throw new SurfaceRegistryError(
                    'renderer-contract-unavailable',
                    `[SurfaceRegistry] Renderer target contract is unavailable: ${renderer.contractId}`
                );
            }
            const rendererKey = `${renderer.contractId}:${renderer.variant || ''}`;
            if (batchKeys.has(rendererKey)) {
                throw new SurfaceRegistryError(
                    'duplicate-renderer',
                    `[SurfaceRegistry] Duplicate ${source} renderer for surface contract: ${renderer.contractId}`
                    + ` (variant: ${renderer.variant || 'default'})`
                );
            }
            batchKeys.add(rendererKey);
            assertNoRendererConflict(existingRenderers.get(renderer.contractId), renderer, source);
        });
    }

    assertCanRegisterBatch(batch: SurfaceRegistrationBatch): void {
        const contracts = batch.contracts || [];
        const batchContractIds = new Set<SurfaceContractId>();
        contracts.forEach(contract => {
            if (batchContractIds.has(contract.id)) {
                throw new SurfaceRegistryError(
                    'duplicate-contract',
                    `[SurfaceRegistry] Duplicate surface contract in registration batch: ${contract.id}`
                );
            }
            batchContractIds.add(contract.id);
            this.assertContractMetadataCanRegister(contract);
        });

        const availableContractIds = new Set<SurfaceContractId>([
            ...this.contracts.keys(),
            ...batchContractIds
        ]);
        const defaultRenderers = [
            ...contracts.flatMap(contract => contract.defaultRenderer ? [contract.defaultRenderer] : []),
            ...(batch.defaultRenderers || [])
        ];
        const businessRenderers = [
            ...contracts.flatMap(contract => contract.businessRenderer ? [contract.businessRenderer] : []),
            ...(batch.businessRenderers || [])
        ];

        this.assertRendererBatch(defaultRenderers, availableContractIds, this.defaultRenderers, 'core default');
        this.assertRendererBatch(businessRenderers, availableContractIds, this.businessRenderers, 'plugin business');
    }

    private appendRenderer(
        target: Map<SurfaceContractId, SurfaceRendererDefinitionUnion[]>,
        renderer: SurfaceRendererDefinitionUnion,
        kind: 'core-default' | 'plugin-business'
    ): SurfaceRendererDefinitionUnion {
        const normalized = { ...renderer, kind } satisfies SurfaceRendererDefinitionUnion;
        const renderers = target.get(renderer.contractId);
        target.set(renderer.contractId, [...(renderers || []), normalized]);
        return normalized;
    }

    private removeRenderer(
        target: Map<SurfaceContractId, SurfaceRendererDefinitionUnion[]>,
        renderer: SurfaceRendererDefinitionUnion
    ): void {
        const remaining = (target.get(renderer.contractId) || []).filter(existing => existing !== renderer);
        if (remaining.length > 0) {
            target.set(renderer.contractId, remaining);
        } else {
            target.delete(renderer.contractId);
        }
    }

    /** 原子注册一个批次，返回撤销函数：按引用移除本批次追加的 renderer，并删除或恢复本批次写入的 contract。 */
    registerBatch(batch: SurfaceRegistrationBatch): RegistrationDisposer {
        this.assertCanRegisterBatch(batch);
        const contracts = batch.contracts || [];
        const contractChanges = contracts.map(contract => {
            const previous = this.contracts.get(contract.id);
            const next = {
                ...previous,
                ...contract,
                inputSchema: contract.inputSchema || previous?.inputSchema,
                ownerPluginId: contract.ownerPluginId || previous?.ownerPluginId
            } as SurfaceContractDefinitionUnion;
            this.contracts.set(contract.id, next);
            return { id: contract.id, previous, next };
        });
        const appended: Array<{
            target: Map<SurfaceContractId, SurfaceRendererDefinitionUnion[]>;
            renderer: SurfaceRendererDefinitionUnion;
        }> = [];
        const append = (
            target: Map<SurfaceContractId, SurfaceRendererDefinitionUnion[]>,
            renderer: SurfaceRendererDefinitionUnion,
            kind: 'core-default' | 'plugin-business'
        ): void => {
            appended.push({ target, renderer: this.appendRenderer(target, renderer, kind) });
        };
        contracts.forEach(contract => {
            if (contract.defaultRenderer) append(this.defaultRenderers, contract.defaultRenderer, 'core-default');
            if (contract.businessRenderer) append(this.businessRenderers, contract.businessRenderer, 'plugin-business');
        });
        (batch.defaultRenderers || []).forEach(renderer => append(this.defaultRenderers, renderer, 'core-default'));
        (batch.businessRenderers || []).forEach(renderer => append(this.businessRenderers, renderer, 'plugin-business'));

        return () => {
            [...appended].reverse().forEach(({ target, renderer }) => this.removeRenderer(target, renderer));
            [...contractChanges].reverse().forEach(change => {
                // 只撤销仍由本批次写入的定义，避免覆盖之后的注册。
                // 删除 contract 时不处理其他插件挂在该 contract 上的 renderer（交叉依赖由 E2b 处理）。
                if (this.contracts.get(change.id) !== change.next) return;
                if (change.previous) {
                    this.contracts.set(change.id, change.previous);
                } else {
                    this.contracts.delete(change.id);
                }
            });
        };
    }

    assertCanRegisterContract(contract: SurfaceContractDefinitionUnion): void {
        this.assertCanRegisterBatch({ contracts: [contract] });
    }

    registerContract(contract: SurfaceContractDefinitionUnion): void {
        this.registerBatch({ contracts: [contract] });
    }

    assertCanRegisterDefaultRenderer(renderer: SurfaceRendererDefinitionUnion): void {
        this.assertCanRegisterBatch({ defaultRenderers: [renderer] });
    }

    registerDefaultRenderer(renderer: SurfaceRendererDefinitionUnion): void {
        this.registerBatch({ defaultRenderers: [renderer] });
    }

    assertCanRegisterBusinessRenderer(renderer: SurfaceRendererDefinitionUnion): void {
        this.assertCanRegisterBatch({ businessRenderers: [renderer] });
    }

    registerBusinessRenderer(renderer: SurfaceRendererDefinitionUnion): void {
        this.registerBatch({ businessRenderers: [renderer] });
    }

    assertCanRegisterDesktopOverride(desktopModeId: string, renderer: SurfaceRendererDefinitionUnion): void {
        this.assertCanRegisterDesktopOverrides(desktopModeId, [renderer]);
    }

    registerDesktopOverride(desktopModeId: string, renderer: SurfaceRendererDefinitionUnion): void {
        this.registerDesktopOverrides(desktopModeId, [renderer]);
    }

    assertCanRegisterDesktopOverrides(
        desktopModeId: string,
        renderers: SurfaceRendererDefinitionUnion[]
    ): void {
        const batchKeys = new Set<string>();
        renderers.forEach(renderer => {
            assertValidRendererRegistration(renderer);
            if (!this.contracts.has(renderer.contractId)) {
                throw new SurfaceRegistryError(
                    'renderer-contract-unavailable',
                    `[SurfaceRegistry] Renderer target contract is unavailable: ${renderer.contractId}`
                );
            }
            const rendererKey = `${renderer.contractId}:${renderer.variant || ''}`;
            if (batchKeys.has(rendererKey)) {
                throw new SurfaceRegistryError(
                    'duplicate-renderer',
                    `[SurfaceRegistry] Duplicate desktop override renderer for surface contract: ${renderer.contractId}`
                );
            }
            batchKeys.add(rendererKey);
            const key = createDesktopOverrideKey(desktopModeId, renderer.contractId);
            assertNoRendererConflict(
                this.desktopOverrides.get(key),
                renderer,
                `desktop override for ${desktopModeId}`
            );
        });
    }

    registerDesktopOverrides(desktopModeId: string, renderers: SurfaceRendererDefinitionUnion[]): void {
        this.assertCanRegisterDesktopOverrides(desktopModeId, renderers);
        renderers.forEach(renderer => {
            const key = createDesktopOverrideKey(desktopModeId, renderer.contractId);
            const normalized = { ...renderer, kind: 'desktop-override' } satisfies SurfaceRendererDefinitionUnion;
            const registeredRenderers = this.desktopOverrides.get(key);
            this.desktopOverrides.set(key, [...(registeredRenderers || []), normalized]);
        });
    }

    clearDesktopOverridesForTests(): void {
        this.desktopOverrides.clear();
    }

    registerEmptyRenderer(renderer: EmptySurfaceRendererDefinition): void {
        assertValidRendererRegistration(renderer);
        if (this.emptyRenderer) {
            throw new SurfaceRegistryError(
                'duplicate-empty-renderer',
                '[SurfaceRegistry] Duplicate empty renderer registration'
            );
        }
        this.emptyRenderer = { ...renderer, kind: 'empty' };
    }

    getContract<K extends SurfaceContractId>(contractId: K): SurfaceContractDefinition<K> | undefined {
        return this.contracts.get(contractId) as SurfaceContractDefinition<K> | undefined;
    }

    hasContract(contractId: string): contractId is SurfaceContractId {
        return this.contracts.has(contractId as SurfaceContractId);
    }

    listContracts(): SurfaceContractDefinitionUnion[] {
        return Array.from(this.contracts.values());
    }

    /** 诊断/测试接口：列出某一来源下全部已注册 renderer。 */
    listRenderers(source: 'core-default' | 'plugin-business'): SurfaceRendererDefinitionUnion[] {
        const target = source === 'core-default' ? this.defaultRenderers : this.businessRenderers;
        return Array.from(target.values()).flat();
    }

    parseInput<K extends SurfaceContractId>(contractId: K, input: object): SurfaceInput<K> {
        const contract = this.getContract(contractId);
        if (!contract?.inputSchema) {
            throw new SurfaceRegistryError(
                'unknown-contract',
                `[SurfaceRegistry] Unknown surface contract: ${contractId}`
            );
        }
        const result = contract.inputSchema.safeParse(input);
        if (!result.success) {
            throw new SurfaceRegistryError(
                'invalid-input',
                `[SurfaceRegistry] Invalid input for surface contract: ${contractId}`
            );
        }
        return result.data;
    }

    resolve<K extends SurfaceContractId>(request: SurfaceResolutionRequest<K>): SurfaceResolutionResult<K> {
        if (!this.contracts.has(request.contractId)) {
            throw new SurfaceRegistryError(
                'unknown-contract',
                `[SurfaceRegistry] Unknown surface contract: ${request.contractId}`
            );
        }
        const desktopOverride = selectRenderer(
            this.desktopOverrides.get(createDesktopOverrideKey(request.desktopModeId, request.contractId)) as
                SurfaceRendererDefinition<K>[] | undefined,
            request.preferredVariant
        );
        if (desktopOverride) {
            return { contractId: request.contractId, renderer: desktopOverride, source: 'desktop-override' };
        }

        const businessRenderer = selectRenderer(
            this.businessRenderers.get(request.contractId) as SurfaceRendererDefinition<K>[] | undefined,
            request.preferredVariant
        );
        if (businessRenderer) {
            return { contractId: request.contractId, renderer: businessRenderer, source: 'plugin-business' };
        }

        const defaultRenderer = selectRenderer(
            this.defaultRenderers.get(request.contractId) as SurfaceRendererDefinition<K>[] | undefined,
            request.preferredVariant
        );
        if (defaultRenderer) {
            return { contractId: request.contractId, renderer: defaultRenderer, source: 'core-default' };
        }

        if (!this.emptyRenderer) {
            throw new SurfaceRegistryError(
                'renderer-unavailable',
                `[SurfaceRegistry] No renderer registered for surface contract: ${request.contractId}`
            );
        }

        return {
            contractId: request.contractId,
            renderer: { ...this.emptyRenderer, contractId: request.contractId } as SurfaceRendererDefinition<K>,
            source: 'empty'
        };
    }
}

export const surfaceRegistry = new SurfaceRegistry();
