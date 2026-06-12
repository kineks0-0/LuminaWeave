import { describe, expect, it, vi } from 'vitest';
import {
    createAssistantMessageEventStream,
    type AssistantMessage
} from '@earendil-works/pi-ai';
import { ForgePiCoreRuntime } from '@/api/core/forge/agent-app/ForgePiCoreRuntime.js';
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
            {
                role: 'system',
                content: 'pi-system\n# Forge Alpha'
            },
            {
                role: 'user',
                content: '预览提示词'
            }
        ]);
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
            'message_end',
            'turn_end'
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

    it('appends direct tool results and workspace patches into the pi session tree', async () => {
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
                            const message = assistantMessage([{ type: 'text', text: '已写入项目。' }]);
                            stream.push({ type: 'start', partial: assistantMessage([]) });
                            stream.push({ type: 'text_start', contentIndex: 0, partial: assistantMessage([{ type: 'text', text: '' }]) });
                            stream.push({ type: 'text_delta', contentIndex: 0, delta: '已写入项目。', partial: message });
                            stream.push({ type: 'text_end', contentIndex: 0, content: '已写入项目。', partial: message });
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
                            workspacePatch: {
                                nodeId: 'tool:call_write',
                                changes: [{
                                    path: './card.md',
                                    kind: 'create',
                                    beforeHash: null,
                                    afterHash: 'after',
                                    beforeContentRef: null,
                                    afterContentRef: 'inline:new'
                                }],
                                sourceToolCallId: 'call_write',
                                sourceNodeId: 'tool:call_write',
                                createdAt: 1,
                                reversible: true
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
        expect(turn.piSessionState.tree.map(node => node.kind)).toContain('workspace_patch');
        expect(turn.piSessionState.tree.map(node => node.summary)).toContain('已写入项目。');
        expect(runtime.getAgentRuntimeEvents().map(event => event.type)).toEqual(expect.arrayContaining([
            'tool_execution_start',
            'tool_execution_end'
        ]));
        expect(runtime.getAgentRuntimeSnapshot().pendingToolCalls).toEqual([]);
        expect(calls).toBe(2);
    });
});
