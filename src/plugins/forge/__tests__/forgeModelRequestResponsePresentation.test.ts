import { describe, expect, it } from 'vitest';

import { resolveForgeModelRequestResponseText } from '../inspector/forgeModelRequestResponsePresentation.js';
import type {
    ForgeModelRequestTrace,
    ForgePiModelRequestTrace
} from '../../../types/ForgeRuntimeTypes.js';
import type { ForgePiTreeNode } from '@shared/ForgePiTypes.js';

const createTrace = (overrides: Partial<ForgeModelRequestTrace> = {}): ForgeModelRequestTrace => ({
    id: 'req_response',
    source: 'conversation',
    status: 'completed',
    workspaceSessionId: 'forge_project_alpha',
    requestPrompt: [{ role: 'user', content: 'hello' }],
    requestParameters: {},
    contextSnapshot: {
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
    },
    responseRaw: '',
    responseDisplay: '',
    responseThinking: '',
    requestedAt: 100,
    firstResponseAt: 110,
    completedAt: 180,
    errorMessage: null,
    presetId: 'forge-main',
    nodeSummary: [],
    toolEvents: [],
    ...overrides
});

const assistantNode = (text: string): ForgePiTreeNode => ({
    id: 'node_assistant',
    sessionId: 'session_1',
    parentId: null,
    kind: 'assistant',
    title: 'Assistant',
    summary: text,
    createdAt: 100,
    payload: {
        text,
        agentMessage: {
            role: 'assistant',
            content: [{ type: 'text', text }]
        }
    },
    children: []
});

const createPiTrace = (overrides: Partial<ForgePiModelRequestTrace> = {}): ForgePiModelRequestTrace => ({
    traceId: 'trace_1',
    requestId: 'req_response',
    api: 'lumina-nexus',
    modelId: 'gpt-test',
    providerId: 'openai',
    systemPrompt: 'system',
    piMessages: [],
    transformedPiMessages: [],
    providerPayload: null,
    providerResponse: null,
    tools: [],
    generationSettings: {},
    contextBundleSummary: null,
    lifecycle: [],
    finalText: '',
    errorMessage: null,
    createdAt: 100,
    updatedAt: 120,
    ...overrides
});

describe('forgeModelRequestResponsePresentation', () => {
    it('prefers streamed display text', () => {
        const text = resolveForgeModelRequestResponseText({
            trace: createTrace({ responseDisplay: 'streamed reply' }),
            sessionTree: [assistantNode('tree reply')]
        });

        expect(text).toBe('streamed reply');
    });

    it('falls back to pi model final text when the request response is blank', () => {
        const text = resolveForgeModelRequestResponseText({
            trace: createTrace({
                piModelTrace: createPiTrace({ finalText: 'final pi reply' })
            }),
            sessionTree: [assistantNode('tree reply')]
        });

        expect(text).toBe('final pi reply');
    });

    it('uses the latest nonblank pi model call when a Forge turn has multiple provider calls', () => {
        const text = resolveForgeModelRequestResponseText({
            trace: {
                ...createTrace(),
                piModelTraces: [
                    createPiTrace({ traceId: 'trace_1', finalText: 'tool planning', updatedAt: 120 }),
                    createPiTrace({ traceId: 'trace_2', finalText: 'final synthesized reply', updatedAt: 180 })
                ]
            },
            sessionTree: [assistantNode('tree reply')]
        });

        expect(text).toBe('final synthesized reply');
    });

    it('falls back to the latest assistant node when model trace is also blank', () => {
        const text = resolveForgeModelRequestResponseText({
            trace: createTrace(),
            sessionTree: [assistantNode('tree reply')]
        });

        expect(text).toBe('tree reply');
    });
});
