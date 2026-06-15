import type {
    ForgeAgentGraphInput,
    ForgeAgentGraphResult
} from './ForgeAgentGraphRuntime.js';

export type {
    ForgeAgentGraphInput,
    ForgeAgentGraphResult
} from './ForgeAgentGraphRuntime.js';

type ForgeAgentGraphRuntimeModule = typeof import('./ForgeAgentGraphRuntime.js');

const loadForgeAgentGraphRuntime = async (): Promise<ForgeAgentGraphRuntimeModule> => {
    return import('./ForgeAgentGraphRuntime.js');
};

export class ForgeAgentGraph {
    static async run(input: ForgeAgentGraphInput): Promise<ForgeAgentGraphResult> {
        const { forgeAgentGraphRuntime } = await loadForgeAgentGraphRuntime();
        return forgeAgentGraphRuntime.run(input);
    }
}
