import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ForgeRuntimeContext } from '@/types/ForgeRuntimeTypes.js';

const agentConstructorSpy = vi.hoisted(() => vi.fn());
const agentPromptScript = vi.hoisted(() => ({
    run: null as null | ((agent: any, message: unknown) => Promise<void> | void)
}));

vi.mock('@earendil-works/pi-agent-core', () => {
    class MockAgent {
        state: { messages: unknown[] };
        private readonly listeners: Array<(event: any) => void> = [];
        subscribe = vi.fn((listener: (event: any) => void) => {
            this.listeners.push(listener);
            return () => {
                const index = this.listeners.indexOf(listener);
                if (index >= 0) this.listeners.splice(index, 1);
            };
        });

        constructor(options: { initialState?: { messages?: unknown[] } }) {
            agentConstructorSpy(options);
            this.state = {
                messages: [...(options.initialState?.messages ?? [])]
            };
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

        emit(event: any): void {
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

describe('ForgePiAgentSession', () => {
    beforeEach(() => {
        agentConstructorSpy.mockClear();
        agentPromptScript.run = null;
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
        expect(preview.systemPrompt).toContain('<process>...</process>');
        expect(preview.systemPrompt).toContain('<final>...</final>');
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
        agentPromptScript.run = async (agent, message) => {
            const firstAssistantMessage = {
                role: 'assistant',
                content: [{ type: 'text', text: '<final>正在搜索</final>' }],
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
                content: [{ type: 'text', text: '<final>正在搜索\n完成整理</final>' }]
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
        const runtimeEvents: any[] = [];

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
            } as any,
            onRuntimeEvent: event => runtimeEvents.push(event)
        });

        expect(runtimeEvents.filter(event => event.type === 'stream_chunk').map(event => event.displayText)).toEqual([
            '正在搜索',
            '正在搜索\n完成整理'
        ]);
        expect(result.events.filter(event => event.type === 'stream_chunk').map(event => event.displayText)).toEqual([
            '正在搜索',
            '正在搜索\n完成整理'
        ]);
    });

    it('persists explicit process blocks separately from final assistant replies', async () => {
        const { ForgePiAgentSession } = await import('@/api/core/forge/agent-app/session/ForgePiAgentSession.js');
        const { AgentRuntimeEventBus } = await import('@/api/core/agent-runtime/events/AgentRuntimeEventBus.js');
        agentPromptScript.run = async (agent, message) => {
            const assistantMessage = {
                role: 'assistant',
                content: [{
                    type: 'text',
                    text: [
                        '<process>',
                        '我需要先读取 xx.md 确认当前结构。',
                        '</process>',
                        '<final>',
                        '已完成修改，主要调整了说明。',
                        '</final>'
                    ].join('\n')
                }],
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

        expect(result.events.filter(event => event.type === 'stream_done')).toEqual([
            expect.objectContaining({
                rawText: '<process>\n我需要先读取 xx.md 确认当前结构。\n</process>\n<final>\n已完成修改，主要调整了说明。\n</final>',
                displayText: '已完成修改，主要调整了说明。',
                thinkingText: '我需要先读取 xx.md 确认当前结构。'
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
        expect(branchTexts).toContain('[Process]\n我需要先读取 xx.md 确认当前结构。');
        expect(branchTexts).toContain('已完成修改，主要调整了说明。');
    });

    it('emits parse diagnostics without persisting invalid assistant final text', async () => {
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
            expect.objectContaining({
                type: 'trace',
                requestId: 'req_invalid_output',
                tag: 'agent_output_parse',
                status: 'diagnostics:text_outside_block'
            }),
            expect.objectContaining({
                type: 'stream_done',
                displayText: '',
                thinkingText: ''
            })
        ]));
        expect(result.piSessionState.entries.map(entry => entry.kind)).toEqual([
            'metadata',
            'context_bundle',
            'user'
        ]);
    });
});
