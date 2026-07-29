import { beforeEach, describe, expect, it, vi } from 'vitest';
import type {
    ForgeExecutionRequest,
    ForgeRequestContextSnapshot,
    ForgeRuntimeContext
} from '@/types/ForgeRuntimeTypes.js';
import type { ForgePiToolBridge } from '@/api/core/forge/agent-app/tools/ForgePiToolBridge.js';

interface MockAgentInstance {
    state: {
        messages: unknown[];
        model?: unknown;
    };
    beforeToolCall?: (context: unknown) => Promise<{ block?: boolean; reason?: string } | undefined>;
    emit(event: unknown): void;
}

const agentConstructorSpy = vi.hoisted(() => vi.fn());
const agentPromptScript = vi.hoisted(() => ({
    run: null as null | ((agent: MockAgentInstance, message: unknown) => Promise<void> | void),
    continueRun: null as null | ((agent: MockAgentInstance) => Promise<void> | void)
}));

vi.mock('@earendil-works/pi-agent-core', () => {
    class MockAgent {
        state: { messages: unknown[]; model?: unknown };
        private readonly listeners: Array<(event: unknown) => void> = [];
        subscribe = vi.fn((listener: (event: unknown) => void) => {
            this.listeners.push(listener);
            return () => {
                const index = this.listeners.indexOf(listener);
                if (index >= 0) this.listeners.splice(index, 1);
            };
        });

        beforeToolCall?: (context: unknown) => Promise<{ block?: boolean; reason?: string } | undefined>;

        constructor(options: {
            initialState?: { messages?: unknown[]; model?: unknown };
            beforeToolCall?: (context: unknown) => Promise<{ block?: boolean; reason?: string } | undefined>;
        }) {
            agentConstructorSpy(options);
            this.state = {
                messages: [...(options.initialState?.messages ?? [])],
                model: options.initialState?.model
            };
            this.beforeToolCall = options.beforeToolCall;
        }

        async prompt(message: unknown): Promise<void> {
            if (agentPromptScript.run) {
                await agentPromptScript.run(this, message);
                return;
            }
            this.state.messages = [
                ...this.state.messages,
                message,
                {
                    role: 'assistant',
                    content: [{ type: 'text', text: 'ok' }],
                    provider: 'test',
                    model: 'test',
                    responseModel: 'test',
                    timestamp: 1
                }
            ];
        }

        async continue(): Promise<void> {
            if (agentPromptScript.continueRun) {
                await agentPromptScript.continueRun(this);
            }
        }

        emit(event: unknown): void {
            for (const listener of this.listeners) {
                listener(event);
            }
        }
    }

    return { Agent: MockAgent };
});

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

const createExecutionRequest = (overrides: Partial<ForgeExecutionRequest> = {}): ForgeExecutionRequest => ({
    requestId: 'req_forge_pi_session',
    traceSource: 'conversation',
    contextSnapshot: createContextSnapshot(),
    nodeSummary: [],
    generationSettings: {},
    mode: 'conversation',
    messages: [],
    sessionChatId: 'conversation_alpha',
    charName: 'Forge Assistant',
    presetId: 'forge-main',
    sourceCommand: { type: 'send_user_input', input: 'hello' },
    ...overrides
});

describe('ForgePiAgentSession', () => {
    beforeEach(() => {
        agentConstructorSpy.mockClear();
        agentPromptScript.run = null;
        agentPromptScript.continueRun = null;
    });

    it('passes the stable Forge pi session id to pi-agent-core Agent', async () => {
        const { ForgePiAgentSession } = await import('@/api/core/forge/agent-app/session/ForgePiAgentSession.js');
        const session = new ForgePiAgentSession(
            'forge-pi-session-alpha',
            {
                forgeProjectId: 'forge_project_alpha',
                conversationId: 'conversation_alpha',
                workspaceTitle: 'Forge Alpha'
            },
            {
                resourceLoader: {
                    buildContextBundle: vi.fn(async () => ({
                        files: [{ path: './AGENTS.md', title: 'Agent 工作契约', content: '# Contract' }],
                        activeSkills: [],
                        loadedExtensions: []
                    })),
                    buildSystemPrompt: vi.fn(() => '# Contract')
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
                        streamFn: vi.fn()
                    }))
                } as any,
                extensionRunner: {
                    loadTools: vi.fn(() => [])
                } as any
            }
        );

        await session.prompt({
            command: { type: 'send_user_input', input: 'hello' },
            commandInput: 'hello',
            context: createContext(),
            request: {
                requestId: 'req_session_id',
                mode: 'conversation',
                traceSource: 'conversation',
                messages: [{ role: 'user', content: 'hello' }],
                nodeSummary: []
            } as any
        });

        expect(agentConstructorSpy).toHaveBeenCalledWith(expect.objectContaining({
            sessionId: 'forge-pi-session-alpha'
        }));
    }, 15000);

    it('reuses the SDK prepared prompt object between preview and real generation for the same request id', async () => {
        const { ForgePiAgentSession } = await import('@/api/core/forge/agent-app/session/ForgePiAgentSession.js');
        let buildIndex = 0;
        const resourceLoader = {
            buildContextBundle: vi.fn(async () => {
                buildIndex += 1;
                return {
                    files: [{ path: './AGENTS.md', title: 'Agent 工作契约', content: `# Version ${buildIndex}` }],
                    activeSkills: [],
                    loadedExtensions: []
                };
            }),
            buildSystemPrompt: vi.fn(({ contextBundle }) => contextBundle.files[0]?.content ?? '')
        };
        const session = new ForgePiAgentSession(
            'forge-pi-session-preview-run',
            {
                forgeProjectId: 'forge_project_alpha',
                conversationId: 'conversation_alpha',
                workspaceTitle: 'Forge Alpha'
            },
            {
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
                        streamFn: vi.fn()
                    }))
                } as any,
                extensionRunner: {
                    loadTools: vi.fn(() => [])
                } as any
            }
        );
        const turnInput = {
            command: { type: 'send_user_input', input: 'hello' },
            commandInput: 'hello',
            context: createContext(),
            request: {
                requestId: 'req_preview_run_same',
                mode: 'conversation',
                traceSource: 'conversation',
                messages: [{ role: 'user', content: 'hello' }],
                nodeSummary: []
            } as any
        } as const;

        const preview = await session.preparePrompt(turnInput);
        const result = await session.prompt(turnInput);

        expect(preview.systemPrompt).toContain('# Version 1');
        expect(preview.systemPrompt).toContain('Provider-native structured messages');
        expect(preview.systemPrompt).not.toContain('<process>');
        expect(preview.systemPrompt).not.toContain('<final>');
        expect(preview.prompt).toEqual([
            { role: 'system', content: preview.systemPrompt },
            { role: 'user', content: 'hello' }
        ]);
        expect(result.events).toEqual(expect.arrayContaining([
            expect.objectContaining({
                type: 'prompt_ready',
                prompt: preview.prompt
            })
        ]));
        expect(resourceLoader.buildContextBundle).toHaveBeenCalledTimes(1);
        expect(agentConstructorSpy).toHaveBeenLastCalledWith(expect.objectContaining({
            initialState: expect.objectContaining({
                systemPrompt: preview.systemPrompt,
                messages: []
            })
        }));
    });

    it('keeps extension hidden context, active tools, skill catalog, and branch messages shared between preview and run', async () => {
        const { ForgePiAgentSession } = await import('@/api/core/forge/agent-app/session/ForgePiAgentSession.js');
        const resourceLoader = {
            buildContextBundle: vi.fn(async () => ({
                files: [{ path: './AGENTS.md', title: 'Agent 工作契约', content: '# Contract' }],
                activeSkills: ['writer: ./agent/skills/writer/SKILL.md'],
                loadedExtensions: ['forge-plan-extension']
            })),
            buildSystemPrompt: vi.fn(({ contextBundle }) => [
                contextBundle.files[0]?.content ?? '',
                'Skills:',
                ...contextBundle.activeSkills
            ].join('\n'))
        };
        const readTool = {
            name: 'read',
            label: 'Read',
            description: 'Read semantic VFS file.',
            needsApproval: false
        };
        const extensionRunner = {
            loadTools: vi.fn(() => [readTool]),
            emitBeforeAgentStart: vi.fn(async event => ({
                messages: [{
                    customType: 'hidden-skill-index',
                    content: 'hidden context: ./agent/skills/writer/SKILL.md',
                    display: false
                }],
                systemPrompt: `${event.systemPrompt}\n\nExtension mode: ${event.prompt}`
            })),
            getLoadedExtensions: vi.fn(() => ['forge-plan-extension'])
        };
        const session = new ForgePiAgentSession(
            'forge-pi-session-extension-preview-run',
            {
                forgeProjectId: 'forge_project_alpha',
                conversationId: 'conversation_alpha',
                workspaceTitle: 'Forge Alpha'
            },
            {
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
                        streamFn: vi.fn()
                    }))
                } as any,
                extensionRunner: extensionRunner as any,
                initialState: {
                    sessionId: 'forge-pi-session-extension-preview-run',
                    activeNodeId: 'node_assistant_seed',
                    entries: [
                        {
                            id: 'node_user_seed',
                            sessionId: 'forge-pi-session-extension-preview-run',
                            parentId: null,
                            kind: 'user',
                            title: 'User',
                            summary: '历史请求',
                            createdAt: 1,
                            payload: {
                                agentMessage: { role: 'user', content: '历史请求', timestamp: 1 },
                                text: '历史请求'
                            }
                        },
                        {
                            id: 'node_assistant_seed',
                            sessionId: 'forge-pi-session-extension-preview-run',
                            parentId: 'node_user_seed',
                            kind: 'assistant',
                            title: 'Assistant',
                            summary: '历史回复',
                            createdAt: 2,
                            payload: {
                                agentMessage: {
                                    role: 'assistant',
                                    content: [{ type: 'text', text: '历史回复' }],
                                    provider: 'test',
                                    model: 'test',
                                    responseModel: 'test',
                                    timestamp: 2
                                },
                                text: '历史回复'
                            }
                        }
                    ],
                    contextBundleSummary: null,
                    loadedExtensions: [],
                    version: 1
                }
            } as any
        );
        const turnInput = {
            command: { type: 'send_user_input', input: '继续整理技能' },
            commandInput: '继续整理技能',
            context: createContext(),
            request: {
                requestId: 'req_extension_preview_run_same',
                mode: 'conversation',
                traceSource: 'conversation',
                messages: [{ role: 'user', content: '继续整理技能' }],
                nodeSummary: []
            } as any
        } as const;

        const preview = await session.preparePrompt(turnInput);
        await session.prompt(turnInput);

        expect(extensionRunner.emitBeforeAgentStart).toHaveBeenCalledTimes(1);
        expect(preview.systemPrompt).toContain('Extension mode: 继续整理技能');
        expect(preview.systemPrompt).toContain('hidden context: ./agent/skills/writer/SKILL.md');
        expect(preview.systemPrompt).toContain('writer: ./agent/skills/writer/SKILL.md');
        expect(preview.activeTools).toEqual([{
            name: 'read',
            description: 'Read semantic VFS file.',
            needsApproval: false
        }]);
        expect(preview.branchMessages.map(message => message.role)).toEqual(['user', 'assistant']);
        expect(preview.prompt).toEqual([
            { role: 'system', content: preview.systemPrompt },
            ...preview.branchMessages,
            { role: 'user', content: '继续整理技能' }
        ]);
        expect(agentConstructorSpy).toHaveBeenLastCalledWith(expect.objectContaining({
            initialState: expect.objectContaining({
                systemPrompt: preview.systemPrompt,
                messages: preview.branchMessages,
                tools: [readTool]
            })
        }));
    });

    it('emits stream chunks only when assistant text changes during Pi message updates', async () => {
        const { ForgePiAgentSession } = await import('@/api/core/forge/agent-app/session/ForgePiAgentSession.js');
        const { AgentRuntimeEventBus } = await import('@/api/core/agent-runtime/events/AgentRuntimeEventBus.js');
        agentPromptScript.run = async (agent, message) => {
            const firstAssistantMessage = {
                role: 'assistant',
                content: [{ type: 'text', text: '正在搜索' }],
                provider: 'test',
                model: 'test',
                responseModel: 'test',
                timestamp: 1
            };
            agent.state.messages = [...agent.state.messages, message, firstAssistantMessage];
            agent.emit({ type: 'message_update', message: firstAssistantMessage });
            agent.emit({ type: 'message_update', message: firstAssistantMessage });

            const secondAssistantMessage = {
                ...firstAssistantMessage,
                content: [{ type: 'text', text: '正在搜索\n完成整理' }]
            };
            agent.state.messages = [...agent.state.messages.slice(0, -1), secondAssistantMessage];
            agent.emit({ type: 'message_update', message: secondAssistantMessage });
            agent.emit({ type: 'message_update', message: secondAssistantMessage });
            agent.emit({ type: 'message_end', message: secondAssistantMessage });
        };
        const session = new ForgePiAgentSession(
            'forge-pi-session-stream-update',
            {
                forgeProjectId: 'forge_project_alpha',
                conversationId: 'conversation_alpha',
                workspaceTitle: 'Forge Alpha'
            },
            {
                resourceLoader: {
                    buildContextBundle: vi.fn(async () => ({
                        files: [{ path: './AGENTS.md', title: 'Agent 工作契约', content: '# Contract' }],
                        activeSkills: [],
                        loadedExtensions: []
                    })),
                    buildSystemPrompt: vi.fn(() => '# Contract')
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
                        streamFn: vi.fn()
                    }))
                } as any,
                extensionRunner: {
                    loadTools: vi.fn(() => [])
                } as any
            }
        );
        const runtimeBus = new AgentRuntimeEventBus();
        session.setAgentRuntimeEvents(runtimeBus);

        const result = await session.prompt({
            command: { type: 'send_user_input', input: '搜索一下' },
            commandInput: '搜索一下',
            context: createContext(),
            request: {
                requestId: 'req_stream_update_dedupe',
                mode: 'conversation',
                traceSource: 'conversation',
                messages: [{ role: 'user', content: '搜索一下' }],
                nodeSummary: []
            } as any
        });

        expect(runtimeBus.getEvents()
            .filter(event => event.type === 'message_update')
            .map(event => event.block.text)).toEqual([
            '正在搜索',
            '正在搜索\n完成整理'
        ]);
        expect(result.events).toEqual(expect.arrayContaining([
            expect.objectContaining({ type: 'first_response', requestId: 'req_stream_update_dedupe' })
        ]));
    });

    it('persists provider-native thinking blocks separately from final assistant replies', async () => {
        const { ForgePiAgentSession } = await import('@/api/core/forge/agent-app/session/ForgePiAgentSession.js');
        const { AgentRuntimeEventBus } = await import('@/api/core/agent-runtime/events/AgentRuntimeEventBus.js');
        agentPromptScript.run = async (agent, message) => {
            const assistantMessage = {
                role: 'assistant',
                content: [
                    { type: 'thinking', thinking: '我需要先读取 xx.md 确认当前结构。' },
                    { type: 'text', text: '已完成修改，主要调整了说明。' }
                ],
                provider: 'test',
                model: 'test',
                responseModel: 'test',
                timestamp: 1
            };
            agent.state.messages = [...agent.state.messages, message, assistantMessage];
            agent.emit({ type: 'message_update', message: assistantMessage });
            agent.emit({ type: 'message_end', message: assistantMessage });
        };
        const session = new ForgePiAgentSession(
            'forge-pi-session-process-final',
            {
                forgeProjectId: 'forge_project_alpha',
                conversationId: 'conversation_alpha',
                workspaceTitle: 'Forge Alpha'
            },
            {
                resourceLoader: {
                    buildContextBundle: vi.fn(async () => ({
                        files: [{ path: './AGENTS.md', title: 'Agent 工作契约', content: '# Contract' }],
                        activeSkills: [],
                        loadedExtensions: []
                    })),
                    buildSystemPrompt: vi.fn(() => '# Contract')
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
                        streamFn: vi.fn()
                    }))
                } as any,
                extensionRunner: {
                    loadTools: vi.fn(() => [])
                } as any
            }
        );
        const runtimeBus = new AgentRuntimeEventBus();
        session.setAgentRuntimeEvents(runtimeBus);

        const result = await session.prompt({
            command: { type: 'send_user_input', input: '修改说明' },
            commandInput: '修改说明',
            context: createContext(),
            request: {
                requestId: 'req_process_final',
                mode: 'conversation',
                traceSource: 'conversation',
                messages: [{ role: 'user', content: '修改说明' }],
                nodeSummary: []
            } as any
        });

        expect(runtimeBus.getSnapshot('forge-pi-session-process-final').messages).toEqual([
            expect.objectContaining({
                role: 'assistant',
                status: 'complete',
                blocks: [
                    { type: 'thinking', contentIndex: 0, text: '我需要先读取 xx.md 确认当前结构。', redacted: false },
                    { type: 'text', contentIndex: 1, text: '已完成修改，主要调整了说明。' }
                ]
            })
        ]);
        expect(result.piSessionState.entries.map(entry => entry.kind)).toEqual([
            'metadata',
            'context_bundle',
            'user',
            'process',
            'assistant'
        ]);
        expect(result.piSessionState.entries.find(entry => entry.kind === 'process')?.payload).toEqual(expect.objectContaining({
            text: '我需要先读取 xx.md 确认当前结构。'
        }));
        expect(result.piSessionState.entries.find(entry => entry.kind === 'assistant')?.payload).toEqual(expect.objectContaining({
            text: '已完成修改，主要调整了说明。'
        }));
        expect(runtimeBus.getEvents().map(event => event.type).slice(-3)).toEqual([
            'message_end',
            'turn_end',
            'agent_end'
        ]);

        const preview = await session.preparePrompt({
            command: { type: 'send_user_input', input: '继续' },
            commandInput: '继续',
            context: createContext(),
            request: {
                requestId: 'req_process_final_replay',
                mode: 'conversation',
                traceSource: 'conversation',
                messages: [{ role: 'user', content: '继续' }],
                nodeSummary: []
            } as any
        });

        const branchTexts = preview.branchMessages
            .filter(message => message.role === 'assistant')
            .map(message => Array.isArray(message.content)
                ? message.content
                    .filter((part: any) => part.type === 'text')
                    .map((part: any) => part.text)
                    .join('')
                : '');
        expect(branchTexts).not.toContain('[Process]\n我需要先读取 xx.md 确认当前结构。');
        expect(branchTexts).toContain('已完成修改，主要调整了说明。');
    });

    it('persists plain provider-native text without parse diagnostics', async () => {
        const { ForgePiAgentSession } = await import('@/api/core/forge/agent-app/session/ForgePiAgentSession.js');
        agentPromptScript.run = async (agent, message) => {
            const assistantMessage = {
                role: 'assistant',
                content: [{ type: 'text', text: '没有使用输出协议的回复。' }],
                provider: 'test',
                model: 'test',
                responseModel: 'test',
                timestamp: 1
            };
            agent.state.messages = [...agent.state.messages, message, assistantMessage];
            agent.emit({ type: 'message_update', message: assistantMessage });
            agent.emit({ type: 'message_end', message: assistantMessage });
        };
        const session = new ForgePiAgentSession(
            'forge-pi-session-invalid-output',
            {
                forgeProjectId: 'forge_project_alpha',
                conversationId: 'conversation_alpha',
                workspaceTitle: 'Forge Alpha'
            },
            {
                resourceLoader: {
                    buildContextBundle: vi.fn(async () => ({
                        files: [{ path: './AGENTS.md', title: 'Agent 工作契约', content: '# Contract' }],
                        activeSkills: [],
                        loadedExtensions: []
                    })),
                    buildSystemPrompt: vi.fn(() => '# Contract')
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
                        streamFn: vi.fn()
                    }))
                } as any,
                extensionRunner: {
                    loadTools: vi.fn(() => [])
                } as any
            }
        );

        const result = await session.prompt({
            command: { type: 'send_user_input', input: '回复我' },
            commandInput: '回复我',
            context: createContext(),
            request: {
                requestId: 'req_invalid_output',
                mode: 'conversation',
                traceSource: 'conversation',
                messages: [{ role: 'user', content: '回复我' }],
                nodeSummary: []
            } as any
        });

        expect(result.events).toEqual(expect.arrayContaining([
            expect.objectContaining({ type: 'first_response', requestId: 'req_invalid_output' })
        ]));
        expect(result.piSessionState.entries.map(entry => entry.kind)).toEqual([
            'metadata',
            'context_bundle',
            'user',
            'assistant'
        ]);
    });

    it('projects network approval requests before returning a bash tool result', async () => {
        const { ForgePiAgentSession } = await import('@/api/core/forge/agent-app/session/ForgePiAgentSession.js');
        const networkArgs = {
            command: 'curl -o fetched.txt https://api.example.com/resource',
            accessMode: 'network-request'
        };
        const requestToolApproval = vi.fn(() => ({
            approvalKind: 'network' as const,
            displaySurface: 'composer' as const,
            toolCallId: 'call_network',
            toolName: 'bash',
            args: networkArgs,
            shellPermissionRequestId: 'shell-permission-request-network',
            reason: 'Forge Agent 请求访问 https://api.example.com/'
        }));
        agentPromptScript.run = async (agent) => {
            const assistantMessage = {
                role: 'assistant' as const,
                content: [{
                    type: 'toolCall' as const,
                    id: 'call_network',
                    name: 'bash',
                    arguments: networkArgs
                }],
                api: 'test',
                provider: 'test',
                model: 'test',
                responseModel: 'test',
                usage: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, totalTokens: 0, cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 } },
                stopReason: 'toolUse' as const,
                timestamp: 1
            };
            agent.emit({
                type: 'tool_execution_start',
                toolCallId: 'call_network',
                toolName: 'bash',
                args: networkArgs
            });
            const beforeResult = await agent.beforeToolCall?.({
                assistantMessage,
                toolCall: assistantMessage.content[0],
                args: networkArgs,
                context: {}
            });
            expect(beforeResult).toEqual(expect.objectContaining({
                block: true,
                reason: expect.stringContaining('call_network')
            }));
            const transientToolResult = {
                role: 'toolResult' as const,
                toolCallId: 'call_network',
                toolName: 'bash',
                content: [{ type: 'text' as const, text: beforeResult?.reason ?? '' }],
                details: {},
                isError: true,
                timestamp: 2
            };
            agent.emit({
                type: 'tool_execution_end',
                toolCallId: 'call_network',
                toolName: 'bash',
                isError: true,
                result: {
                    content: [{ type: 'text', text: beforeResult?.reason ?? '' }],
                    details: {}
                }
            });
            agent.state.messages = [...agent.state.messages, transientToolResult];
            agent.emit({ type: 'message_end', message: transientToolResult });
            expect(agent.state.messages).not.toEqual(expect.arrayContaining([expect.objectContaining({
                role: 'toolResult',
                toolCallId: 'call_network'
            })]));
        };
        const session = new ForgePiAgentSession(
            'forge-pi-session-network-approval',
            {
                forgeProjectId: 'forge_project_alpha',
                conversationId: 'conversation_alpha',
                workspaceTitle: 'Forge Alpha'
            },
            {
                resourceLoader: {
                    buildContextBundle: vi.fn(async () => ({
                        files: [{ path: './AGENTS.md', title: 'Agent 工作契约', content: '# Contract' }],
                        activeSkills: [],
                        loadedExtensions: []
                    })),
                    buildSystemPrompt: vi.fn(() => '# Contract')
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
                        streamFn: vi.fn()
                    }))
                } as any,
                extensionRunner: {
                    loadTools: vi.fn(() => [])
                } as any,
                toolBridge: {
                    requestToolApproval
                } as any
            }
        );
        const events: unknown[] = [];

        const result = await session.prompt({
            command: { type: 'send_user_input', input: '下载参考资料' },
            commandInput: '下载参考资料',
            context: createContext(),
            request: {
                requestId: 'req_network_approval',
                mode: 'conversation',
                traceSource: 'conversation',
                messages: [{ role: 'user', content: '下载参考资料' }],
                nodeSummary: []
            } as any,
            onRuntimeEvent: event => events.push(event)
        });

        expect(events).toEqual(expect.arrayContaining([expect.objectContaining({
            type: 'tool_approval_needed',
            requestId: 'req_network_approval',
            toolCallId: 'call_network',
            toolName: 'bash',
            approvalKind: 'network',
            displaySurface: 'composer',
            shellPermissionRequestId: 'shell-permission-request-network'
        })]));
        expect(events).not.toEqual(expect.arrayContaining([expect.objectContaining({
            type: 'tool_result',
            toolCallId: 'call_network'
        })]));
        expect(events).not.toEqual(expect.arrayContaining([expect.objectContaining({
            type: 'stream_done',
            requestId: 'req_network_approval'
        })]));
        expect(result.events).not.toEqual(expect.arrayContaining([expect.objectContaining({
            type: 'stream_done',
            requestId: 'req_network_approval'
        })]));
        expect(requestToolApproval).toHaveBeenCalledWith(expect.objectContaining({
            requestId: 'req_network_approval',
            toolCallId: 'call_network',
            toolName: 'bash',
            args: networkArgs
        }));
        expect(result.piSessionState.entries).toEqual(expect.arrayContaining([expect.objectContaining({
            kind: 'approval_needed',
            payload: expect.objectContaining({
                type: 'tool_approval_needed',
                displaySurface: 'composer'
            })
        })]));
    });

    it('keeps approved network tool results paired with their assistant tool call for continue and replay', async () => {
        const { ForgePiAgentSession } = await import('@/api/core/forge/agent-app/session/ForgePiAgentSession.js');
        const networkArgs = {
            command: 'curl -s https://api.example.com/data',
            accessMode: 'network-request'
        };
        const requestToolApproval = vi.fn(() => ({
            approvalKind: 'network' as const,
            displaySurface: 'composer' as const,
            toolCallId: 'call_network',
            toolName: 'bash',
            args: networkArgs,
            shellPermissionRequestId: 'shell-permission-request-network',
            reason: 'Forge Agent 请求访问 https://api.example.com/'
        }));
        const resolveToolApproval = vi.fn(async () => ({
            resolved: true,
            events: [
                {
                    type: 'tool_approval_resolved' as const,
                    requestId: 'req_network_replay',
                    approvalId: 'approval-call_network',
                    toolCallId: 'call_network',
                    toolName: 'bash',
                    approved: true,
                    message: '允许联网',
                    source: 'conversation' as const,
                    approvalKind: 'network' as const,
                    displaySurface: 'composer' as const,
                    shellPermissionRequestId: 'shell-permission-request-network',
                    forgeProjectId: 'forge_project_alpha',
                    conversationId: 'conversation_alpha',
                    sessionId: 'forge-pi-session-network-replay'
                },
                {
                    type: 'tool_result' as const,
                    requestId: 'req_network_replay',
                    toolCallId: 'call_network',
                    toolName: 'bash',
                    result: { stdout: 'downloaded', exitCode: 0 },
                    source: 'conversation' as const
                }
            ],
            effects: [],
            toolResultMessage: {
                role: 'toolResult' as const,
                toolCallId: 'call_network',
                toolName: 'bash',
                content: [{ type: 'text' as const, text: 'downloaded' }],
                details: { stdout: 'downloaded', exitCode: 0 },
                isError: false,
                timestamp: 2
            }
        }));
        const toolBridge = {
            requestToolApproval,
            resolveToolApproval
        } as unknown as ForgePiToolBridge;
        let continueMessages: unknown[] = [];
        agentPromptScript.run = async (agent) => {
            const assistantMessage = {
                role: 'assistant' as const,
                content: [{
                    type: 'toolCall' as const,
                    id: 'call_network',
                    name: 'bash',
                    arguments: networkArgs
                }],
                api: 'test',
                provider: 'test',
                model: 'test',
                responseModel: 'test',
                usage: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, totalTokens: 0, cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 } },
                stopReason: 'toolUse' as const,
                timestamp: 1
            };
            agent.emit({
                type: 'tool_execution_start',
                toolCallId: 'call_network',
                toolName: 'bash',
                args: networkArgs
            });
            const beforeResult = await agent.beforeToolCall?.({
                assistantMessage,
                toolCall: assistantMessage.content[0],
                args: networkArgs,
                context: {}
            });
            agent.emit({
                type: 'tool_execution_end',
                toolCallId: 'call_network',
                toolName: 'bash',
                isError: true,
                result: {
                    content: [{ type: 'text', text: beforeResult?.reason ?? '' }],
                    details: {}
                }
            });
        };
        agentPromptScript.continueRun = (agent) => {
            continueMessages = [...agent.state.messages];
            const assistantMessage = {
                role: 'assistant' as const,
                content: [{ type: 'text' as const, text: '已完成下载。' }],
                api: 'test',
                provider: 'test',
                model: 'test',
                responseModel: 'test',
                usage: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, totalTokens: 0, cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 } },
                stopReason: 'stop' as const,
                timestamp: 3
            };
            agent.state.messages = [...agent.state.messages, assistantMessage];
            agent.emit({ type: 'message_end', message: assistantMessage });
        };
        const session = new ForgePiAgentSession(
            'forge-pi-session-network-replay',
            {
                forgeProjectId: 'forge_project_alpha',
                conversationId: 'conversation_alpha',
                workspaceTitle: 'Forge Alpha'
            },
            {
                resourceLoader: {
                    buildContextBundle: vi.fn(async () => ({
                        files: [{ path: './AGENTS.md', title: 'Agent 工作契约', content: '# Contract' }],
                        activeSkills: [],
                        loadedExtensions: []
                    })),
                    buildSystemPrompt: vi.fn(() => '# Contract')
                },
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
                        streamFn: vi.fn()
                    }))
                },
                extensionRunner: {
                    loadTools: vi.fn(() => [])
                },
                toolBridge
            } as unknown as ConstructorParameters<typeof ForgePiAgentSession>[2]
        );
        const request: ForgeExecutionRequest = createExecutionRequest({
            requestId: 'req_network_replay',
            sourceCommand: { type: 'send_user_input', input: '下载参考资料' }
        });

        await session.prompt({
            command: { type: 'send_user_input', input: '下载参考资料' },
            commandInput: '下载参考资料',
            context: createContext(),
            request
        });
        const approval = await session.resolveToolApproval('req_network_replay', 'call_network', true, '允许联网');
        const preview = await session.preparePrompt({
            command: { type: 'send_user_input', input: '继续' },
            commandInput: '继续',
            context: createContext(),
            request: {
                ...request,
                requestId: 'req_network_replay_preview',
                sourceCommand: { type: 'send_user_input', input: '继续' }
            }
        });

        const continueToolResultIndex = continueMessages.findIndex(message =>
            Boolean(message)
            && typeof message === 'object'
            && (message as { role?: unknown }).role === 'toolResult'
            && (message as { toolCallId?: unknown }).toolCallId === 'call_network'
        );
        expect(continueToolResultIndex).toBeGreaterThan(0);
        expect(continueMessages[continueToolResultIndex - 1]).toEqual(expect.objectContaining({
            role: 'assistant',
            content: [expect.objectContaining({
                type: 'toolCall',
                id: 'call_network',
                name: 'bash'
            })]
        }));

        const replayToolResultIndex = preview.branchMessages.findIndex(message =>
            message.role === 'toolResult' && message.toolCallId === 'call_network'
        );
        expect(replayToolResultIndex).toBeGreaterThan(0);
        expect(preview.branchMessages[replayToolResultIndex - 1]).toEqual(expect.objectContaining({
            role: 'assistant',
            content: [expect.objectContaining({
                type: 'toolCall',
                id: 'call_network',
                name: 'bash'
            })]
        }));
        expect(approval.resolved).toBe(true);
    });
});
