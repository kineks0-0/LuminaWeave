import { z } from 'zod';
import type {
    DesktopCompositionActivitySlotNode,
    DesktopCompositionGroupNode,
    DesktopCompositionNode,
    DesktopCompositionSurfaceNode,
    DesktopCompositionViewport,
    DesktopModeComposition
} from '../../desktop-modes/core/types.js';
import { SurfaceRegistryError, type SurfaceRegistry } from '../surface/SurfaceRegistry.js';
import type { SurfaceContractId, SurfaceInput } from '../surface/types.js';

export type DesktopCompositionRuntimeErrorCode =
    | 'unsupported-version'
    | 'invalid-layout'
    | 'duplicate-node-id'
    | 'unknown-contract'
    | 'invalid-surface-input';

const ERROR_MESSAGES: Record<DesktopCompositionRuntimeErrorCode, string> = {
    'unsupported-version': '[DesktopCompositionRuntime] Unsupported composition version',
    'invalid-layout': '[DesktopCompositionRuntime] Invalid composition layout',
    'duplicate-node-id': '[DesktopCompositionRuntime] Duplicate composition node id',
    'unknown-contract': '[DesktopCompositionRuntime] Unknown surface contract',
    'invalid-surface-input': '[DesktopCompositionRuntime] Invalid surface input'
};

export class DesktopCompositionRuntimeError extends Error {
    constructor(public readonly code: DesktopCompositionRuntimeErrorCode) {
        super(ERROR_MESSAGES[code]);
        this.name = 'DesktopCompositionRuntimeError';
    }
}

interface ParsedCompositionNodeLayout {
    id: string;
    size: DesktopCompositionNode['size'];
    visibility: DesktopCompositionNode['visibility'];
}

interface ParsedCompositionGroupNode extends ParsedCompositionNodeLayout {
    kind: 'group';
    direction: DesktopCompositionGroupNode['direction'];
    children: ParsedCompositionNode[];
}

interface ParsedCompositionSurfaceNode extends ParsedCompositionNodeLayout {
    kind: 'surface';
    contractId: string;
    input: object;
}

interface ParsedCompositionActivitySlotNode extends ParsedCompositionNodeLayout {
    kind: 'activity-slot';
}

type ParsedCompositionNode =
    | ParsedCompositionGroupNode
    | ParsedCompositionSurfaceNode
    | ParsedCompositionActivitySlotNode;

interface ParsedDesktopModeComposition {
    version: 1;
    desktop: ParsedCompositionNode;
    mobile: ParsedCompositionNode;
}

const nodeLayoutSchema = z.object({
    id: z.string().min(1),
    size: z.enum(['content', 'fill']),
    visibility: z.enum(['visible', 'hidden'])
});

const compositionNodeSchema: z.ZodType<ParsedCompositionNode> = z.lazy(() => z.discriminatedUnion('kind', [
    nodeLayoutSchema.extend({
        kind: z.literal('group'),
        direction: z.enum(['row', 'column']),
        children: z.array(compositionNodeSchema).min(1)
    }).strict(),
    nodeLayoutSchema.extend({
        kind: z.literal('surface'),
        contractId: z.string().min(1),
        input: z.record(z.string(), z.unknown())
    }).strict(),
    nodeLayoutSchema.extend({
        kind: z.literal('activity-slot')
    }).strict()
]));

const compositionVersionSchema = z.object({
    version: z.literal(1)
}).passthrough();

const desktopModeCompositionSchema: z.ZodType<ParsedDesktopModeComposition> = z.object({
    version: z.literal(1),
    desktop: compositionNodeSchema,
    mobile: compositionNodeSchema
}).strict();

const parseComposition = (composition: DesktopModeComposition): ParsedDesktopModeComposition => {
    if (!compositionVersionSchema.safeParse(composition).success) {
        throw new DesktopCompositionRuntimeError('unsupported-version');
    }

    const result = desktopModeCompositionSchema.safeParse(composition);
    if (!result.success) {
        throw new DesktopCompositionRuntimeError('invalid-layout');
    }
    return result.data;
};

const validateSurfaceNode = (
    node: ParsedCompositionSurfaceNode,
    surfaces: SurfaceRegistry
): DesktopCompositionSurfaceNode => {
    if (!surfaces.hasContract(node.contractId)) {
        throw new DesktopCompositionRuntimeError('unknown-contract');
    }

    try {
        // contract 存在且 input 已通过对应 schema 后，二者才可恢复为映射联合。
        return {
            ...node,
            contractId: node.contractId,
            input: surfaces.parseInput(node.contractId, node.input)
        } as DesktopCompositionSurfaceNode;
    } catch (error: unknown) {
        if (error instanceof SurfaceRegistryError && error.code === 'invalid-input') {
            throw new DesktopCompositionRuntimeError('invalid-surface-input');
        }
        throw error;
    }
};

const validateCompositionNode = (
    node: ParsedCompositionNode,
    surfaces: SurfaceRegistry,
    nodeIds: Set<string>
): DesktopCompositionNode => {
    if (nodeIds.has(node.id)) {
        throw new DesktopCompositionRuntimeError('duplicate-node-id');
    }
    nodeIds.add(node.id);

    if (node.kind === 'surface') {
        return validateSurfaceNode(node, surfaces);
    }
    if (node.kind === 'activity-slot') {
        return { ...node } satisfies DesktopCompositionActivitySlotNode;
    }
    return {
        ...node,
        children: node.children.map(child => validateCompositionNode(child, surfaces, nodeIds))
    } satisfies DesktopCompositionGroupNode;
};

export const validateDesktopModeComposition = (
    composition: DesktopModeComposition,
    surfaces: SurfaceRegistry
): DesktopModeComposition => {
    const parsed = parseComposition(composition);
    const nodeIds = new Set<string>();
    return {
        version: 1,
        desktop: validateCompositionNode(parsed.desktop, surfaces, nodeIds),
        mobile: validateCompositionNode(parsed.mobile, surfaces, nodeIds)
    };
};

const cloneCompositionValue = <T>(value: T): T => {
    if (Array.isArray(value)) {
        return value.map(item => cloneCompositionValue(item)) as T;
    }
    if (value !== null && typeof value === 'object') {
        const prototype = Object.getPrototypeOf(value);
        if (prototype !== Object.prototype && prototype !== null) {
            return value;
        }
        const clonedEntries = Object.entries(value).map(([key, entryValue]) => [
            key,
            cloneCompositionValue(entryValue)
        ]);
        return Object.fromEntries(clonedEntries) as T;
    }
    return value;
};

const cloneCompositionNode = (node: DesktopCompositionNode): DesktopCompositionNode => {
    if (node.kind === 'group') {
        return {
            ...node,
            children: node.children.map(cloneCompositionNode)
        };
    }
    if (node.kind === 'surface') {
        // 节点判别字段与 input 在注册期已成对校验，克隆不会改变该关联。
        return {
            ...node,
            input: cloneCompositionValue(node.input) as SurfaceInput<SurfaceContractId>
        } as DesktopCompositionSurfaceNode;
    }
    return { ...node };
};

export const resolveDesktopComposition = (
    composition: DesktopModeComposition,
    viewport: DesktopCompositionViewport
): DesktopCompositionNode => cloneCompositionNode(composition[viewport]);
