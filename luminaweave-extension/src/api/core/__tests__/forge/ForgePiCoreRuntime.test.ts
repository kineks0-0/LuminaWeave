import { describe, expect, it, vi } from 'vitest';
import {
    createAssistantMessageEventStream,
    Type,
    type AssistantMessage
} from '@earendil-works/pi-ai';
import {
    ForgePiCoreRuntime,
    type ForgePiCoreRuntimeDeps
} from '@/api/core/forge/agent-app/ForgePiCoreRuntime.js';
import type { AgentRuntimeExtension } from '@/api/core/agent-runtime/index.js';
import type { ForgeRuntimeContext } from '@/types/ForgeRuntimeTypes.js';

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
    structuredState: {} as any,
    draftTree: { nodes: [], lastUpdatedAt: 1 } as any,
    forgeMemoryTree: { entries: [], lastUpdatedAt: 1 },
    stagingEntries: [],
    commitReadyEntries: [],
    virtualLorebookEntries: [],
    latestUserInput: 'hello',
    latestUserCommand: { type: 'send_user_input', input: 'hello' }
});

const assistantMessage = (content: AssistantMessage['content'], stopReason: AssistantMessage['stopReason'] = 'stop'): AssistantMessage => ({
    role: 'assistant',
    content,
    api: 'test',
    provider: 'test',
    model: 'test',
    usage: {
        input: 0,
        output: 0,
        cacheRead: 0,
        cacheWrite: 0,
        totalTokens: 0,
        cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 }
    },
    stopReason,
    timestamp: 1
});

const textStreamFn = (text: string) => () => {
    const stream = createAssistantMessageEventStream();
    const message = assistantMessage([{ type: 'text', text }]);
    stream.push({ type: 'start', partial: assistantMessage([]) });
    stream.push({ type: 'text_start', contentIndex: 0, partial: assistantMessage([{ type: 'text', text: '' }]) });
    stream.push({ type: 'text_delta', contentIndex: 0, delta: text, partial: message });
    stream.push({ type: 'text_end', contentIndex: 0, content: text, partial: message });
    stream.push({ type: 'done', reason: 'stop', message });
    stream.end(message);
    return stream;
};

describe('ForgePiCoreRuntime', () => {
    it('previews the exact pi AgentSession prompt without running the model or mutating the session tree', async () => {
        const streamFn = vi.fn(textStreamFn('不应被调用'));
        const resourceLoader = {
            buildContextBundle: vi.fn(async () => ({
                files: [{ path: 'context/project.md', title: '项目概况', content: '# Forge Alpha' }],
                activeSkills: ['中文制卡技能'],
                loadedExtensions: ['@luminaweave/pi-forge-browser']
            })),
            buildSystemPrompt: vi.fn(({ systemFragments, contextBundle }) =>
                ['pi-system', ...systemFragments, ...contextBundle.files.map((file: any) => file.content)].join('\n')
            )
        };
        const runtime = new ForgePiCoreRuntime({
            createNodeId: (() => {
                let index = 0;
                return () => `pi_preview_node_${++index}`;
            })(),
            resourceLoader: resourceLoader as any,
            modelRegistry: {
                resolveRunConfig: vi.fn(() => ({
                    model: {
                        id: 'test',
                        name: 'test',
                        api: 'test',
                        provider: 'test',
                        baseUrl: '',
                        reasoning: false,
                        input: [],
                        cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
                        contextWindow: 0,
                        maxTokens: 0
                    },
                    streamFn
                }))
            } as any,
            extensionRunner: {
                loadTools: vi.fn(() => [{
                    name: 'capability.search',
                    label: '搜索能力',
                    description: '按中文查询 Forge 能力'
                }])
            } as any
        });

        const result = await runtime.previewPrompt({
            command: { type: 'send_user_input', input: '预览提示词' },
            commandInput: '预览提示词',
            context: createContext(),
            request: {
                requestId: 'req_preview',
                mode: 'conversation',
                traceSource: 'conversation',
                messages: [
                    { role: 'system', content: 'legacy system fragment' },
                    { role: 'user', content: '预览提示词' }
                ],
                nodeSummary: []
            } as any
        });

        expect(result.prompt).toEqual([
            expect.objectContaining({
                role: 'system',
                content: expect.stringContaining('pi-system\n# Forge Alpha')
            }),
            {
                role: 'user',
                content: '预览提示词'
            }
        ]);
        expect(result.prompt[0]?.content).toContain('Provider-native structured messages');
        expect(result.prompt[0]?.content).not.toContain('<process>');
        expect(result.prompt[0]?.content).not.toContain('<final>');
        expect(resourceLoader.buildSystemPrompt).toHaveBeenCalledWith(expect.objectContaining({
            systemFragments: []
        }));
        expect(result.contextBundleSummary.activeSkills).toEqual(['中文制卡技能']);
        expect(result.loadedExtensions).toEqual(['@luminaweave/pi-forge-browser']);
        expect(result.activeTools).toEqual([{
            name: 'capability.search',
            description: '按中文查询 Forge 能力',
            needsApproval: false
        }]);
        expect(result.piSessionState.tree).toEqual([]);
        expect(result.piSessionState.activeNodeId).toBeNull();
        expect(streamFn).not.toHaveBeenCalled();
    });

    it('routes SDK extension workflow hooks and tools through Forge prompt preview', async () => {
        const streamFn = vi.fn(textStreamFn('不应被调用'));
        const resourceLoader = {
            buildContextBundle: vi.fn(async () => ({
                files: [{ path: 'context/project.md', title: '项目概况', content: '# Forge Alpha' }],
                activeSkills: [],
                loadedExtensions: ['@luminaweave/pi-forge-browser']
            })),
            buildSystemPrompt: vi.fn(({ contextBundle }) => contextBundle.files[0]?.content ?? '')
        };
        const sdkExtension: AgentRuntimeExtension = {
            id: 'sdk-forge-extension',
            setup: context => {
                context.events.onBeforeAgentStart(event => ({
                    messages: [{
                        customType: 'sdk-hidden-context',
                        content: {
                            prompt: event.prompt,
                            source: 'sdk-forge-extension'
                        },
                        display: false
                    }],
                    systemPrompt: `${event.systemPrompt}\n\nSDK extension saw: ${event.prompt}`
                }));
                context.tools.register({
                    name: 'sdk.inspect',
                    label: 'SDK Inspect',
                    description: 'Read SDK registered extension context.',
                    parameters: Type.Object({ query: Type.String() }),
                    execute: async (_toolCallId, args: { query: string }) => ({
                        content: [{ type: 'text', text: `sdk:${args.query}` }],
                        details: { query: args.query }
                    })
                });
                context.resources.onDiscover(() => ({
                    skillPaths: ['./agent/skills/sdk/SKILL.md']
                }));
            }
        };
        const runtime = new ForgePiCoreRuntime({
            createNodeId: (() => {
                let index = 0;
                return () => `pi_sdk_extension_node_${++index}`;
            })(),
            resourceLoader: resourceLoader as unknown as ForgePiCoreRuntimeDeps['resourceLoader'],
            modelRegistry: {
                resolveRunConfig: vi.fn(() => ({
                    model: {
                        id: 'test',
                        name: 'test',
                        api: 'test',
                        provider: 'test',
                        baseUrl: '',
                        reasoning: false,
                        input: [],
                        cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
                        contextWindow: 0,
                        maxTokens: 0
                    },
                    streamFn
                }))
            } as unknown as ForgePiCoreRuntimeDeps['modelRegistry'],
            extensionRunner: {
                loadTools: vi.fn(() => []),
                emitBeforeAgentStart: vi.fn(async event => ({ systemPrompt: event.systemPrompt })),
                getLoadedExtensions: vi.fn(() => ['@luminaweave/pi-forge-browser'])
            } as unknown as ForgePiCoreRuntimeDeps['extensionRunner'],
            extensions: [sdkExtension]
        });

        const result = await runtime.previewPrompt({
            command: { type: 'send_user_input', input: '使用 SDK 扩展' },
            commandInput: '使用 SDK 扩展',
            context: createContext(),
            request: {
                requestId: 'req_sdk_extension_preview',
                mode: 'conversation',
                traceSource: 'conversation',
                messages: [{ role: 'user', content: '使用 SDK 扩展' }],
                nodeSummary: []
            } as unknown as Parameters<ForgePiCoreRuntime['previewPrompt']>[0]['request']
        });

        expect(result.systemPrompt).toContain('SDK extension saw: 使用 SDK 扩展');
        expect(result.systemPrompt).toContain('## sdk-hidden-context');
        expect(result.systemPrompt).toContain('"source": "sdk-forge-extension"');
        expect(result.activeTools).toEqual([{
            name: 'sdk.inspect',
            description: 'Read SDK registered extension context.',
            needsApproval: false
        }]);
        await expect(runtime.discoverResources({ reason: 'startup' })).resolves.toEqual({
            skillPaths: ['./agent/skills/sdk/SKILL.md']
        });
        expect(streamFn).not.toHaveBeenCalled();
    });

    it('executes SDK registered extension tools through the Forge pi-agent adapter', async () => {
        let calls = 0;
        const executeSdkTool = vi.fn(async (_toolCallId: string, args: { query: string }) => ({
            content: [{ type: 'text', text: `sdk:${args.query}` }],
            details: { query: args.query }
        }));
        const sdkExtension: AgentRuntimeExtension = {
            id: 'sdk-tool-extension',
            setup: context => {
                context.tools.register({
                    name: 'sdk.inspect',
                    label: 'SDK Inspect',
                    description: 'Read SDK registered extension context.',
                    parameters: Type.Object({ query: Type.String() }),
                    execute: executeSdkTool
                });
            }
        };
        const runtime = new ForgePiCoreRuntime({
            createNodeId: (() => {
                let index = 0;
                return () => `pi_sdk_tool_node_${++index}`;
            })(),
            resourceLoader: {
                buildContextBundle: vi.fn(async () => ({
                    files: [{ path: 'context/project.md', title: '项目概况', content: '# Forge Alpha' }],
                    activeSkills: [],
                    loadedExtensions: []
                })),
                buildSystemPrompt: vi.fn(({ contextBundle }) => contextBundle.files[0]?.content ?? '')
            } as unknown as ForgePiCoreRuntimeDeps['resourceLoader'],
            modelRegistry: {
                resolveRunConfig: vi.fn(() => ({
                    model: {
                        id: 'test',
                        name: 'test',
                        api: 'test',
                        provider: 'test',
                        baseUrl: '',
                        reasoning: false,
                        input: [],
                        cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
                        contextWindow: 0,
                        maxTokens: 0
                    },
                    streamFn: () => {
                        calls += 1;
                        const stream = createAssistantMessageEventStream();
                        if (calls === 1) {
                            const toolCall = {
                                type: 'toolCall',
                                id: 'call_sdk_inspect',
                                name: 'sdk.inspect',
                                arguments: { query: 'alpha' }
                            } as Extract<AssistantMessage['content'][number], { type: 'toolCall' }>;
                            const message = assistantMessage([toolCall], 'toolUse');
                            stream.push({ type: 'start', partial: assistantMessage([]) });
                            stream.push({ type: 'toolcall_start', contentIndex: 0, partial: assistantMessage([]) });
                            stream.push({ type: 'toolcall_end', contentIndex: 0, toolCall, partial: message });
                            stream.push({ type: 'done', reason: 'toolUse', message });
                            stream.end(message);
                            return stream;
                        }
                        const text = 'SDK 工具已执行。';
                        const message = assistantMessage([{ type: 'text', text }]);
                        stream.push({ type: 'start', partial: assistantMessage([]) });
                        stream.push({ type: 'text_start', contentIndex: 0, partial: assistantMessage([{ type: 'text', text: '' }]) });
                        stream.push({ type: 'text_delta', contentIndex: 0, delta: text, partial: message });
                        stream.push({ type: 'text_end', contentIndex: 0, content: text, partial: message });
                        stream.push({ type: 'done', reason: 'stop', message });
                        stream.end(message);
                        return stream;
                    }
                }))
            } as unknown as ForgePiCoreRuntimeDeps['modelRegistry'],
            extensionRunner: {
                loadTools: vi.fn(() => []),
                emitBeforeAgentStart: vi.fn(async event => ({ systemPrompt: event.systemPrompt })),
                getLoadedExtensions: vi.fn(() => [])
            } as unknown as ForgePiCoreRuntimeDeps['extensionRunner'],
            extensions: [sdkExtension]
        });

        const result = await runtime.runTurn({
            command: { type: 'send_user_input', input: '调用 SDK 工具' },
            commandInput: '调用 SDK 工具',
            context: createContext(),
            request: {
                requestId: 'req_sdk_tool_run',
                mode: 'conversation',
                traceSource: 'conversation',
                messages: [{ role: 'user', content: '调用 SDK 工具' }],
                nodeSummary: []
            } as unknown as Parameters<ForgePiCoreRuntime['runTurn']>[0]['request']
        });

        expect(executeSdkTool).toHaveBeenCalledWith('call_sdk_inspect', { query: 'alpha' });
        expect(result.events).toEqual(expect.arrayContaining([
            expect.objectContaining({ type: 'tool_call', toolCallId: 'call_sdk_inspect', toolName: 'sdk.inspect' }),
            expect.objectContaining({
                type: 'tool_result',
                toolCallId: 'call_sdk_inspect',
                result: expect.objectContaining({ query: 'alpha' })
            }),
            expect.objectContaining({ type: 'stream_done', displayText: 'SDK 工具已执行。' })
        ]));
        expect(runtime.getAgentRuntimeEvents()
            .filter(event => 'toolCallId' in event && event.toolCallId === 'call_sdk_inspect')
            .map(event => event.type)
        ).toEqual([
            'tool_execution_start',
            'tool_execution_update',
            'tool_execution_end'
        ]);
    });

    it('runs a pi AgentSession turn and records context/user/assistant tree entries', async () => {
        const runtime = new ForgePiCoreRuntime({
            createNodeId: (() => {
                let index = 0;
                return () => `pi_node_${++index}`;
            })(),
            resourceLoader: {
                buildContextBundle: vi.fn(async () => ({
                    files: [{ path: 'context/project.md', title: '项目概况', content: '# Forge Alpha' }],
                    activeSkills: ['虚拟世界书编辑器'],
                    loadedExtensions: ['@luminaweave/pi-forge-browser']
                })),
                buildSystemPrompt: vi.fn(({ contextBundle }) => contextBundle.files[0]?.content ?? '')
            } as any,
            modelRegistry: {
                resolveRunConfig: vi.fn(() => ({
                    model: {
                        id: 'test',
                        name: 'test',
                        api: 'test',
                        provider: 'test',
                        baseUrl: '',
                        reasoning: false,
                        input: [],
                        cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
                        contextWindow: 0,
                        maxTokens: 0
                    },
                    streamFn: textStreamFn('已读取项目上下文。')
                }))
            } as any,
            extensionRunner: {
                loadTools: vi.fn(() => [])
            } as any
        });

        const result = await runtime.runTurn({
            command: { type: 'send_user_input', input: 'hello' },
            commandInput: 'hello',
            context: createContext(),
            request: {
                requestId: 'req_1',
                mode: 'conversation',
                traceSource: 'conversation',
                messages: [{ role: 'user', content: 'hello' }],
                nodeSummary: []
            } as any
        });

        expect(result.events).toEqual(expect.arrayContaining([
            expect.objectContaining({ type: 'request_started', requestId: 'req_1' }),
            expect.objectContaining({ type: 'prompt_ready', requestId: 'req_1' }),
            expect.objectContaining({ type: 'first_response', requestId: 'req_1' }),
            expect.objectContaining({ type: 'stream_done', displayText: '已读取项目上下文。' })
        ]));
        expect(result.piSessionState.contextBundleSummary.activeSkills).toEqual(['虚拟世界书编辑器']);
        expect(result.piSessionState.tree.map(node => node.kind)).toEqual([
            'metadata',
            'context_bundle',
            'user',
            'assistant'
        ]);
        expect(result.piSessionState.activeNodeId).toBe('pi_node_4');
        const eventTypes = runtime.getAgentRuntimeEvents().map(event => event.type);
        expect(eventTypes.slice(0, 3)).toEqual([
            'agent_start',
            'turn_start',
            'message_start'
        ]);
        expect(eventTypes.filter(type => type === 'message_update').length).toBeGreaterThan(0);
        expect(eventTypes.slice(-2)).toEqual([
            'turn_end',
            'agent_end'
        ]);
        expect(runtime.getAgentRuntimeSnapshot()).toMatchObject({
            isStreaming: false,
            pendingToolCalls: [],
            messages: [{
                id: 'req_1',
                role: 'assistant',
                blocks: [{ type: 'text', text: '已读取项目上下文。' }],
                status: 'complete'
            }]
        });
    });

    it('appends complete direct tool results with workspace write summaries into the pi session tree', async () => {
        let calls = 0;
        const runtime = new ForgePiCoreRuntime({
            createNodeId: (() => {
                let index = 0;
                return () => `pi_approval_node_${++index}`;
            })(),
            resourceLoader: {
                buildContextBundle: vi.fn(async () => ({
                    files: [{ path: 'context/project.md', title: '项目概况', content: '# Forge Alpha' }],
                    activeSkills: [],
                    loadedExtensions: []
                })),
                buildSystemPrompt: vi.fn(() => 'system')
            } as any,
            modelRegistry: {
                resolveRunConfig: vi.fn(() => ({
                    model: {
                        id: 'test',
                        name: 'test',
                        api: 'test',
                        provider: 'test',
                        baseUrl: '',
                        reasoning: false,
                        input: [],
                        cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
                        contextWindow: 0,
                        maxTokens: 0
                    },
                    streamFn: () => {
                        calls += 1;
                        const stream = createAssistantMessageEventStream();
                        if (calls === 2) {
                            const text = '已写入项目。';
                            const message = assistantMessage([{ type: 'text', text }]);
                            stream.push({ type: 'start', partial: assistantMessage([]) });
                            stream.push({ type: 'text_start', contentIndex: 0, partial: assistantMessage([{ type: 'text', text: '' }]) });
                            stream.push({ type: 'text_delta', contentIndex: 0, delta: text, partial: message });
                            stream.push({ type: 'text_end', contentIndex: 0, content: text, partial: message });
                            stream.push({ type: 'done', reason: 'stop', message });
                            stream.end(message);
                            return stream;
                        }
                        const message = assistantMessage([{
                            type: 'toolCall',
                            id: 'call_write',
                            name: 'write',
                            arguments: { path: './card.md', content: 'new' }
                        }], 'toolUse');
                        stream.push({ type: 'start', partial: assistantMessage([]) });
                        stream.push({ type: 'toolcall_start', contentIndex: 0, partial: assistantMessage([]) });
                        stream.push({ type: 'toolcall_end', contentIndex: 0, toolCall: message.content[0] as any, partial: message });
                        stream.push({ type: 'done', reason: 'toolUse', message });
                        stream.end(message);
                        return stream;
                    }
                }))
            } as any,
            extensionRunner: {
                loadTools: vi.fn(() => [{
                    name: 'write',
                    label: '写入文件',
                    description: '直接写入 Forge 项目 VFS',
                    parameters: {} as any,
                    execute: vi.fn(async () => ({
                        content: [{ type: 'text', text: '已写入项目文件：./card.md' }],
                        details: {
                            path: './card.md',
                            applied: true,
                            workspaceWriteSummary: {
                                sourceToolCallId: 'call_write',
                                writeCount: 1,
                                changedFiles: [{
                                    path: './card.md',
                                    kind: 'create',
                                    beforeHash: null,
                                    afterHash: 'after'
                                }],
                                errors: [],
                                gitCommitHash: 'abc123',
                                gitParentHash: null
                            }
                        }
                    }))
                }])
            } as any
        });

        const turn = await runtime.runTurn({
            command: { type: 'send_user_input', input: 'hello' },
            commandInput: 'hello',
            context: createContext(),
            request: {
                requestId: 'req_approval',
                mode: 'conversation',
                traceSource: 'conversation',
                messages: [{ role: 'user', content: 'hello' }],
                nodeSummary: []
            } as any
        });
        expect(turn.events).toEqual(expect.arrayContaining([
            expect.objectContaining({ type: 'tool_call', toolCallId: 'call_write', toolName: 'write' }),
            expect.objectContaining({ type: 'tool_result', toolCallId: 'call_write', result: expect.objectContaining({ applied: true }) }),
            expect.objectContaining({ type: 'stream_done', displayText: '已写入项目。' })
        ]));
        expect(turn.effects).toEqual([]);
        expect(turn.piSessionState.tree.map(node => node.kind)).toContain('tool_result');
        expect(turn.piSessionState.tree.map(node => node.summary)).toContain('已写入项目。');
        const toolResult = turn.piSessionState.entries.find(entry => entry.kind === 'tool_result');
        expect(JSON.stringify(toolResult?.payload)).toContain('workspaceWriteSummary');
        expect(JSON.stringify(toolResult?.payload)).toContain('abc123');
        expect(runtime.getAgentRuntimeEvents().map(event => event.type)).toEqual(expect.arrayContaining([
            'tool_execution_start',
            'tool_execution_end'
        ]));
        expect(runtime.getAgentRuntimeSnapshot().pendingToolCalls).toEqual([]);
        expect(calls).toBe(2);
    });
});
