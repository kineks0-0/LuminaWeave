import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ForgeRuntimeContext } from '@/types/ForgeRuntimeTypes.js';

const agentConstructorSpy = vi.hoisted(() => vi.fn());

vi.mock('@earendil-works/pi-agent-core', () => {
    class MockAgent {
        state: { messages: unknown[] };
        subscribe = vi.fn();

        constructor(options: { initialState?: { messages?: unknown[] } }) {
            agentConstructorSpy(options);
            this.state = {
                messages: [...(options.initialState?.messages ?? [])]
            };
        }

        async prompt(message: unknown): Promise<void> {
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
    });
});
