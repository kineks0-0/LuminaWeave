import { describe, expect, it, vi } from 'vitest';
import type { Api, Model } from '@earendil-works/pi-ai';
import {
    ForgePiModelRegistry,
    type ForgePiModelProviderPort
} from '@/api/core/forge/agent-app/model/ForgePiModelRegistry.js';
import type {
    ForgeExecutionRequest,
    ForgePiModelRequestTrace,
    ForgeRequestContextSnapshot,
    ForgeRuntimeContext
} from '@/types/ForgeRuntimeTypes.js';
import type { ForgeDraftTree, ForgeStructuredState } from '@/types/ForgeStructuredTypes.js';

const structuredState: ForgeStructuredState = {
    activeFormId: null,
    forms: {},
    activeMessageFormId: null,
    submitConfigs: {},
    submittedScopes: {},
    lastUpdatedAt: 1
};

const draftTree: ForgeDraftTree = {
    nodes: [],
    lastUpdatedAt: 1
};

const createContext = (): ForgeRuntimeContext => ({
    workspaceSessionId: 'forge_project_alpha',
    sessionChatId: 'conversation_alpha',
    workspaceTitle: 'Forge Alpha',
    selectedPresetId: 'forge-main',
    selectedChatSessionId: null,
    selectedChatSnapshotId: null,
    detailMode: 'quick',
    collectionMode: 'conversation',
    entryMode: null,
    activeLayer: 'concept',
    completedLayers: [],
    workflowSnapshot: null,
    publishState: 'drafting',
    activeLeafId: 'leaf_1',
    worldlineNodes: [],
    messages: [],
    timelineItems: [],
    structuredState,
    draftTree,
    forgeMemoryTree: { entries: [], lastUpdatedAt: 1 },
    stagingEntries: [],
    commitReadyEntries: [],
    virtualLorebookEntries: [],
    latestUserInput: 'hello',
    latestUserCommand: { type: 'send_user_input', input: 'hello' }
});

const createContextSnapshot = (): ForgeRequestContextSnapshot => ({
    kind: 'forge-runtime',
    workspaceTitle: 'Forge Alpha',
    detailMode: 'quick',
    activeLayer: 'concept',
    sourceCommand: { type: 'send_user_input', input: 'hello' },
    workflowSnapshot: null,
    historyMessages: [],
    referenceChatSessionId: null,
    referenceChatSnapshotId: null,
    lorebookEntries: [],
    memorySnapshot: null,
    selectedPresetId: 'forge-main',
    testChatPresetId: null,
    nexusPresetId: null
});

const createRequest = (): ForgeExecutionRequest => ({
    requestId: 'req_registry',
    traceSource: 'conversation',
    contextSnapshot: createContextSnapshot(),
    nodeSummary: [{ provider: 'test', model: 'test-model', label: 'Test Model' }],
    generationSettings: {},
    intent: 'conversation',
    modelRoute: 'main',
    messages: [],
    sessionChatId: 'conversation_alpha',
    charName: 'Forge Assistant',
    presetId: 'forge-main',
    sourceCommand: { type: 'send_user_input', input: 'hello' }
});

const createModel = (): Model<Api> => ({
    id: 'test-model',
    name: 'Test Model',
    api: 'lumina-nexus',
    provider: 'test',
    baseUrl: '',
    reasoning: false,
    input: ['text'],
    cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
    contextWindow: 0,
    maxTokens: 0
});

describe('ForgePiModelRegistry', () => {
    it('returns a pi-ai streamSimple compatible model config from the Nexus provider', () => {
        const model = createModel();
        const provider: ForgePiModelProviderPort = {
            createModelForRequest: vi.fn(() => model),
            streamSimple: vi.fn(),
            getTrace: vi.fn(() => null),
            getTraces: vi.fn(() => [])
        };
        const registry = new ForgePiModelRegistry({ nexusProvider: provider });
        const context = createContext();
        const request = createRequest();

        const config = registry.resolveRunConfig({ request, context });
        expect(config.model).toBe(model);
        expect(provider.createModelForRequest).toHaveBeenCalledWith(request, context);
        expect(config.streamFn).toEqual(expect.any(Function));
    });

    it('exposes every pi-ai provider trace collected for a Forge request', () => {
        const traces: ForgePiModelRequestTrace[] = [
            {
                traceId: 'pi-trace-req_registry-1',
                requestId: 'req_registry',
                api: 'lumina-nexus',
                modelId: 'test-model',
                providerId: 'test',
                systemPrompt: 'system',
                piMessages: [],
                transformedPiMessages: [],
                providerPayload: null,
                providerResponse: null,
                tools: [],
                generationSettings: {},
                contextBundleSummary: null,
                lifecycle: [],
                finalText: 'first',
                errorMessage: null,
                createdAt: 1,
                updatedAt: 2
            }
        ];
        const provider: ForgePiModelProviderPort = {
            createModelForRequest: vi.fn(() => createModel()),
            streamSimple: vi.fn(),
            getTrace: vi.fn(() => null),
            getTraces: vi.fn(() => traces)
        };
        const registry = new ForgePiModelRegistry({ nexusProvider: provider });

        expect(registry.getTraces('req_registry')).toEqual([
            expect.objectContaining({
                traceId: 'pi-trace-req_registry-1',
                finalText: 'first'
            })
        ]);
    });
});
