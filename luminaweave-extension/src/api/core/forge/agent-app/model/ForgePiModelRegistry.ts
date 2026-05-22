import { type Api, type Model, type Context, type SimpleStreamOptions, type AssistantMessageEventStream } from '@earendil-works/pi-ai';
import type { StreamFn } from '@earendil-works/pi-agent-core';
import type {
    ForgeExecutionRequest,
    ForgePiModelRequestTrace,
    ForgeRuntimeContext
} from '../../../../../types/ForgeRuntimeTypes.js';
import { forgePiNexusProvider } from './ForgePiNexusProvider.js';

export type { ForgePiRunSimple } from './ForgePiNexusProvider.js';

export interface ForgePiModelRunConfig {
    model: Model<Api>;
    streamFn: StreamFn;
}

export interface ForgePiModelProviderPort {
    createModelForRequest(request: ForgeExecutionRequest, context: ForgeRuntimeContext): Model<Api>;
    streamSimple(model: Model<Api>, context: Context, options?: SimpleStreamOptions): AssistantMessageEventStream;
    getTrace(requestId: string): ForgePiModelRequestTrace | null;
    getTraces(requestId: string): ForgePiModelRequestTrace[];
}

export interface ForgePiModelRegistryDeps {
    nexusProvider?: ForgePiModelProviderPort;
}

export class ForgePiModelRegistry {
    private readonly nexusProvider: ForgePiModelProviderPort;

    constructor(deps: ForgePiModelRegistryDeps = {}) {
        this.nexusProvider = deps.nexusProvider ?? forgePiNexusProvider;
    }

    resolveRunConfig(input: {
        request: ForgeExecutionRequest;
        context: ForgeRuntimeContext;
    }): ForgePiModelRunConfig {
        const model = this.nexusProvider.createModelForRequest(input.request, input.context);
        return {
            model,
            streamFn: (runtimeModel, agentContext, options) =>
                this.nexusProvider.streamSimple(runtimeModel as Model<Api>, agentContext, options)
        };
    }

    getTrace(requestId: string): ForgePiModelRequestTrace | null {
        return this.nexusProvider.getTrace(requestId);
    }

    getTraces(requestId: string): ForgePiModelRequestTrace[] {
        return this.nexusProvider.getTraces(requestId);
    }
}

export const forgePiModelRegistry = new ForgePiModelRegistry();
