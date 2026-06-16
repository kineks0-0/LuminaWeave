import type {
    Api,
    Model,
    SimpleStreamOptions
} from '@earendil-works/pi-ai';

export interface AgentRuntimeModelGenerationSettings {
    temperature?: number;
    max_tokens?: number;
}

export interface AgentRuntimeModelRequest {
    presetId?: string;
    headers?: Record<string, string>;
    generationSettings?: AgentRuntimeModelGenerationSettings;
}

export interface AgentRuntimeModelProvider {
    getModel(input?: AgentRuntimeModelRequest): Model<Api>;
    getStreamOptions(input?: AgentRuntimeModelRequest): SimpleStreamOptions;
    listModels(providerId: string): Promise<string[]>;
}
