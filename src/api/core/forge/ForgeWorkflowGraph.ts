import type {
    ForgeRuntimeContext,
    ForgeRuntimeDecision
} from '../../../types/ForgeRuntimeTypes.js';
import type {
    ForgeWorkflowSnapshot,
    ForgeWorkflowTurnInput
} from '../../../types/ForgeWorkflowTypes.js';

type ForgeWorkflowGraphRuntimeModule = typeof import('./ForgeWorkflowGraphRuntime.js');

const loadForgeWorkflowGraphRuntime = async (): Promise<ForgeWorkflowGraphRuntimeModule> => {
    return import('./ForgeWorkflowGraphRuntime.js');
};

export class ForgeWorkflowGraph {
    static async routeTurn(input: ForgeWorkflowTurnInput): Promise<ForgeWorkflowSnapshot> {
        const { ForgeWorkflowGraph: RuntimeForgeWorkflowGraph } = await loadForgeWorkflowGraphRuntime();
        return RuntimeForgeWorkflowGraph.routeTurn(input);
    }

    static async resolveDecision(context: ForgeRuntimeContext): Promise<ForgeRuntimeDecision> {
        const { ForgeWorkflowGraph: RuntimeForgeWorkflowGraph } = await loadForgeWorkflowGraphRuntime();
        return RuntimeForgeWorkflowGraph.resolveDecision(context);
    }
}
