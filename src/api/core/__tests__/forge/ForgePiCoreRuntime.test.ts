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
        const runtime = new ForgePiCoreRuntime({
            createNodeId: (() => {
                let index = 0;
                return () => `pi_preview_node_${++index}`;
            })(),
            resourceLoader: {
                buildContextBundle: vi.fn(async () => ({
                    files: [{ path: 'context/project.md', title: '项目概况', content: '# Forge Alpha' }],
                    activeSkills: ['中文制卡技能'],
                    loadedExtensions: ['@luminaweave/pi-forge-browser']
                })),
                buildSystemPrompt: vi.fn(({ systemFragments, contextBundle }) =>
                    ['pi-system', ...systemFragments, ...contextBundle.files.map((file: any) => file.content)].join('\n')
                )
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

        expect(result.prompt).toEqual([{
            role: 'system',
            content: 'pi-system\nlegacy system fragment\n# Forge Alpha'
        }]);
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
    });

    it('appends approval resolution and approved tool results into the pi session tree', async () => {
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
                            const message = assistantMessage([{ type: 'text', text: '等待审阅。' }]);
                            stream.push({ type: 'start', partial: assistantMessage([]) });
                            stream.push({ type: 'text_start', contentIndex: 0, partial: assistantMessage([{ type: 'text', text: '' }]) });
                            stream.push({ type: 'text_delta', contentIndex: 0, delta: '等待审阅。', partial: message });
                            stream.push({ type: 'text_end', contentIndex: 0, content: '等待审阅。', partial: message });
                            stream.push({ type: 'done', reason: 'stop', message });
                            stream.end(message);
                            return stream;
                        }
                        if (calls === 3) {
                            const message = assistantMessage([{ type: 'text', text: '已完成暂存。' }]);
                            stream.push({ type: 'start', partial: assistantMessage([]) });
                            stream.push({ type: 'text_start', contentIndex: 0, partial: assistantMessage([{ type: 'text', text: '' }]) });
                            stream.push({ type: 'text_delta', contentIndex: 0, delta: '已完成暂存。', partial: message });
                            stream.push({ type: 'text_end', contentIndex: 0, content: '已完成暂存。', partial: message });
                            stream.push({ type: 'done', reason: 'stop', message });
                            stream.end(message);
                            return stream;
                        }
                        const message = assistantMessage([{
                            type: 'toolCall',
                            id: 'call_stage',
                            name: 'stageEntry',
                            arguments: { targetEntryId: 'entry.1', title: '候选', content: 'new' }
                        }], 'toolUse');
                        stream.push({ type: 'start', partial: assistantMessage([]) });
                        stream.push({ type: 'toolcall_start', contentIndex: 0, partial: assistantMessage([]) });
                        stream.push({ type: 'toolcall_end', contentIndex: 0, toolCall: message.content[0] as any, partial: message });
                        stream.push({ type: 'done', reason: 'toolUse', message });
                        stream.end(message);
                        return stream;
                    }
                }))
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
        const approved = await runtime.resolveToolApproval('call_stage', true, '允许进入暂存');

        expect(turn.events).toEqual(expect.arrayContaining([
            expect.objectContaining({ type: 'tool_approval_needed', toolCallId: 'call_stage' })
        ]));
        expect(approved.events).toEqual(expect.arrayContaining([
            expect.objectContaining({ type: 'tool_approval_resolved', toolCallId: 'call_stage', approved: true }),
            expect.objectContaining({ type: 'tool_result', toolCallId: 'call_stage', result: expect.objectContaining({ staged: true }) }),
            expect.objectContaining({ type: 'stream_done', displayText: '已完成暂存。' })
        ]));
        expect(approved.effects).toEqual([
            expect.objectContaining({ type: 'upsert_staging_entry' })
        ]);
        expect(approved.piSessionState?.tree.map(node => node.kind)).toContain('approval_resolved');
        expect(approved.piSessionState?.tree.map(node => node.kind)).toContain('tool_result');
        expect(approved.piSessionState?.tree.map(node => node.summary)).toContain('已完成暂存。');
        expect(calls).toBe(3);
    });
});
