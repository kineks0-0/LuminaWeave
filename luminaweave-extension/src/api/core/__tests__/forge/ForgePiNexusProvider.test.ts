import { describe, expect, it, vi } from 'vitest';
import {
    createAssistantMessageEventStream,
    type AssistantMessage,
    type Context,
    type Message,
    type Usage
} from '@earendil-works/pi-ai';
import {
    ForgePiNexusProvider,
    type ForgePiRunSimple
} from '@/api/core/forge/agent-app/model/ForgePiNexusProvider.js';
import type {
    ForgeExecutionRequest,
    ForgeRequestContextSnapshot,
    ForgeRuntimeContext
} from '@/types/ForgeRuntimeTypes.js';
import type { ForgeDraftTree, ForgeStructuredState } from '@/types/ForgeStructuredTypes.js';
import type { NexusNode } from '@/types/nexus.js';

const usage: Usage = {
    input: 0,
    output: 0,
    cacheRead: 0,
    cacheWrite: 0,
    totalTokens: 0,
    cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 }
};

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
    requestId: 'req_provider_trace',
    traceSource: 'conversation',
    contextSnapshot: createContextSnapshot(),
    nodeSummary: [{ provider: 'test', model: 'test-model', label: 'Test Model' }],
    generationSettings: { temperature: 0.2, max_tokens: 512 },
    mode: 'conversation',
    messages: [],
    sessionChatId: 'conversation_alpha',
    charName: 'Forge Assistant',
    presetId: 'forge-main',
    sourceCommand: { type: 'send_user_input', input: 'hello' }
});

const createAssistant = (text: string): AssistantMessage => ({
    role: 'assistant',
    content: [{ type: 'text', text }],
    api: 'openai-completions',
    provider: 'test',
    model: 'test-model',
    usage,
    stopReason: 'stop',
    timestamp: 123
});

describe('ForgePiNexusProvider', () => {
    it('streams through pi-ai while recording native pi request trace data', async () => {
        let observedMessages: Message[] = [];
        const runSimple = vi.fn<ForgePiRunSimple>((model, context, options) => {
            observedMessages = context.messages;
            void options?.onPayload?.({ messages: context.messages, tools: context.tools }, model);
            const output = createAssistantMessageEventStream();
            queueMicrotask(() => {
                const assistant = createAssistant('工具结果已读取。');
                output.push({ type: 'start', partial: assistant });
                output.push({ type: 'text_start', contentIndex: 0, partial: assistant });
                output.push({ type: 'text_delta', contentIndex: 0, delta: '工具结果已读取。', partial: assistant });
                output.push({ type: 'text_end', contentIndex: 0, content: '工具结果已读取。', partial: assistant });
                output.push({ type: 'done', reason: 'stop', message: assistant });
                output.end(assistant);
            });
            return output;
        });
        const nexusNodes: NexusNode[] = [{
            provider: 'test',
            model: 'test-model',
            url: 'https://example.test/v1',
            key: 'test-key'
        }];
        const provider = new ForgePiNexusProvider({
            resolveNodesFromPreset: vi.fn(() => nexusNodes),
            readApiConfigs: vi.fn(() => []),
            runSimple,
            now: () => 123
        });
        const request = createRequest();
        const runtimeContext = createContext();
        const model = provider.createModelForRequest(request, runtimeContext);
        const branchMessages: Message[] = [
            { role: 'user', content: '测试 shell 交互', timestamp: 1 },
            {
                role: 'assistant',
                content: [
                    { type: 'text', text: '先查看工作区。' },
                    {
                        type: 'toolCall',
                        id: 'call_bash',
                        name: 'bash',
                        arguments: { command: 'ls -la /workspaces/forge/demo', accessMode: 'project-readonly' }
                    }
                ],
                api: 'openai-completions',
                provider: 'test',
                model: 'test-model',
                usage,
                stopReason: 'toolUse',
                timestamp: 2
            },
            {
                role: 'toolResult',
                toolCallId: 'call_bash',
                toolName: 'bash',
                content: [{ type: 'text', text: 'README.md' }],
                details: { stdout: 'README.md', exitCode: 0 },
                isError: false,
                timestamp: 3
            },
            { role: 'user', content: '继续', timestamp: 5 }
        ];
        const agentContext: Context = {
            systemPrompt: 'system',
            messages: branchMessages,
            tools: []
        };

        const output = provider.streamSimple(model, agentContext);
        const events = [];
        for await (const event of output) {
            events.push(event);
        }

        expect(runSimple).toHaveBeenCalledOnce();
        expect(events).toEqual(expect.arrayContaining([
            expect.objectContaining({ type: 'text_delta', delta: '工具结果已读取。' }),
            expect.objectContaining({ type: 'done' })
        ]));
        expect(observedMessages).toBe(branchMessages);
        expect(provider.getTrace(request.requestId)).toMatchObject({
            requestId: request.requestId,
            systemPrompt: 'system',
            finalText: '工具结果已读取。',
            piMessages: expect.arrayContaining([expect.objectContaining({ role: 'assistant' })]),
            transformedPiMessages: expect.arrayContaining([expect.objectContaining({ role: 'toolResult' })]),
            providerPayload: expect.objectContaining({
                messages: branchMessages
            })
        });
    });

    it('keeps separate provider traces for repeated pi-ai calls in one Forge request', async () => {
        const runSimple = vi.fn<ForgePiRunSimple>((model) => {
            const output = createAssistantMessageEventStream();
            queueMicrotask(() => {
                const callNumber = runSimple.mock.calls.length;
                const assistant = createAssistant(`第 ${callNumber} 次模型调用`);
                output.push({ type: 'text_delta', contentIndex: 0, delta: `第 ${callNumber} 次模型调用`, partial: assistant });
                output.push({ type: 'done', reason: 'stop', message: assistant });
                output.end(assistant);
            });
            return output;
        });
        const provider = new ForgePiNexusProvider({
            resolveNodesFromPreset: vi.fn(() => [{
                provider: 'test',
                model: 'test-model',
                url: 'https://example.test/v1',
                key: 'test-key'
            }]),
            readApiConfigs: vi.fn(() => []),
            runSimple,
            now: () => 200 + runSimple.mock.calls.length
        });
        const request = createRequest();
        const runtimeContext = createContext();
        const model = provider.createModelForRequest(request, runtimeContext);
        const agentContext: Context = {
            systemPrompt: 'system',
            messages: [{ role: 'user', content: '继续', timestamp: 1 }],
            tools: []
        };

        for (let index = 0; index < 2; index += 1) {
            const output = provider.streamSimple(model, agentContext);
            for await (const _event of output) {
                // drain stream
            }
        }

        expect(provider.getTraces(request.requestId)).toEqual([
            expect.objectContaining({ traceId: 'pi-trace-req_provider_trace-1', finalText: '第 1 次模型调用' }),
            expect.objectContaining({ traceId: 'pi-trace-req_provider_trace-2', finalText: '第 2 次模型调用' })
        ]);
        expect(provider.getTrace(request.requestId)).toEqual(expect.objectContaining({
            traceId: 'pi-trace-req_provider_trace-2',
            finalText: '第 2 次模型调用'
        }));
    });
});
