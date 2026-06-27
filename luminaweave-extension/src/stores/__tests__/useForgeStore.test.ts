import { beforeEach, describe, expect, it } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';

import { useForgeStore } from '../useForgeStore.js';
import type {
    ForgeModelRequestTrace,
    ForgePiModelRequestTrace
} from '../../types/ForgeRuntimeTypes.js';

describe('useForgeStore model request traces', () => {
    beforeEach(() => {
        setActivePinia(createPinia());
    });

    const createTrace = (overrides: Partial<ForgeModelRequestTrace> = {}): ForgeModelRequestTrace => ({
        id: 'req_1',
        source: 'planner',
        status: 'queued',
        workspaceSessionId: 'forge_ws_1',
        requestPrompt: [{ role: 'user', content: 'hello' }],
        requestParameters: { temperature: 0.7, top_p: 0.9 },
        contextSnapshot: {
            kind: 'forge-runtime',
            workspaceTitle: 'Forge Workspace',
            detailMode: 'quick',
            activeLayer: 'concept',
            sourceCommand: { type: 'send_user_input', input: 'hello' },
            workflowSnapshot: null,
            historyMessages: [{ role: 'user', content: 'hello' }],
            referenceChatSessionId: null,
            referenceChatSnapshotId: null,
            lorebookEntries: [],
            memorySnapshot: null,
            selectedPresetId: 'preset_1',
            testChatPresetId: null,
            nexusPresetId: null
        },
        responseRaw: '',
        responseDisplay: '',
        responseThinking: '',
        requestedAt: 100,
        firstResponseAt: null,
        completedAt: null,
        errorMessage: null,
        presetId: 'preset_1',
        nodeSummary: [{ provider: 'openai', model: 'gpt-test', label: 'openai / gpt-test' }],
        toolEvents: [],
        ...overrides
    });

    const createPiTrace = (overrides: Partial<ForgePiModelRequestTrace> = {}): ForgePiModelRequestTrace => ({
        traceId: 'pi-trace-1',
        requestId: 'req_pi',
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
        updatedAt: 100,
        ...overrides
    });

    it('creates, updates, completes, and clears transient model request traces', () => {
        const store = useForgeStore();

        store.createModelRequestTrace(createTrace());

        store.markModelRequestFirstResponse('req_1', 120);
        store.updateModelRequestStream({
            requestId: 'req_1',
            responseRaw: '<thinking>hi</thinking>hello',
            responseDisplay: 'hello',
            responseThinking: 'hi'
        });
        store.completeModelRequestTrace({
            requestId: 'req_1',
            responseRaw: '<thinking>hi</thinking>hello',
            responseDisplay: 'hello',
            responseThinking: 'hi',
            completedAt: 180
        });

        expect(store.modelRequestTraces).toHaveLength(1);
        expect(store.activeModelRequestTraceId).toBe('req_1');
        expect(store.modelRequestTraces[0]).toEqual(expect.objectContaining({
            status: 'completed',
            firstResponseAt: 120,
            completedAt: 180,
            responseDisplay: 'hello',
            responseThinking: 'hi'
        }));

        store.clearAll();

        expect(store.modelRequestTraces).toHaveLength(0);
        expect(store.activeModelRequestTraceId).toBeNull();
    });

    it('appends tool calling events to a transient model request trace', () => {
        const store = useForgeStore();
        store.createModelRequestTrace(createTrace({ id: 'req_tools' }));

        store.appendModelRequestToolEvent('req_tools', {
            id: 'tool_event_2',
            type: 'tool_result',
            toolCallId: 'call_1',
            toolName: 'capabilitySearch',
            payload: { capabilities: [] },
            createdAt: 120
        });
        store.appendModelRequestToolEvent('req_tools', {
            id: 'tool_event_1',
            type: 'tool_call',
            toolCallId: 'call_1',
            toolName: 'capabilitySearch',
            payload: { query: '世界书' },
            createdAt: 100
        });

        expect(store.modelRequestTraces[0].toolEvents).toEqual([
            expect.objectContaining({
                type: 'tool_call',
                toolName: 'capabilitySearch',
                payload: { query: '世界书' }
            }),
            expect.objectContaining({
                type: 'tool_result',
                toolName: 'capabilitySearch',
                payload: { capabilities: [] }
            })
        ]);
        expect(store.timelineItems).toHaveLength(0);
        expect(store.stagingArea).toHaveLength(0);
    });

    it('records a tool set summary on the transient model request trace', () => {
        const store = useForgeStore();
        store.createModelRequestTrace(createTrace({ id: 'req_toolset' }));

        store.setModelRequestToolSetSummary('req_toolset', [
            { name: 'capabilitySearch', description: '搜索能力', needsApproval: false },
            { name: 'stageEntry', description: '进入审阅', needsApproval: true },
            { name: 'bash', description: '执行命令', needsApproval: 'dynamic' }
        ]);

        expect(store.modelRequestTraces[0].toolSetSummary).toEqual([
            { name: 'capabilitySearch', description: '搜索能力', needsApproval: false },
            { name: 'stageEntry', description: '进入审阅', needsApproval: true },
            { name: 'bash', description: '执行命令', needsApproval: 'dynamic' }
        ]);
        expect(store.timelineItems).toHaveLength(0);
    });

    it('keeps every pi model call trace for a single Forge turn', () => {
        const store = useForgeStore();
        store.createModelRequestTrace(createTrace({ id: 'req_pi' }));

        store.setModelRequestPiTrace('req_pi', createPiTrace({
            traceId: 'pi-trace-1',
            finalText: '第一轮工具规划',
            updatedAt: 120
        }));
        store.setModelRequestPiTrace('req_pi', createPiTrace({
            traceId: 'pi-trace-2',
            finalText: '第二轮工具结果总结',
            updatedAt: 180
        }));
        store.setModelRequestPiTrace('req_pi', createPiTrace({
            traceId: 'pi-trace-1',
            finalText: '第一轮工具规划修正',
            updatedAt: 140
        }));

        expect(store.modelRequestTraces[0].piModelTrace).toEqual(expect.objectContaining({
            traceId: 'pi-trace-1',
            finalText: '第一轮工具规划修正'
        }));
        expect(store.modelRequestTraces[0].piModelTraces).toEqual([
            expect.objectContaining({ traceId: 'pi-trace-1', finalText: '第一轮工具规划修正' }),
            expect.objectContaining({ traceId: 'pi-trace-2', finalText: '第二轮工具结果总结' })
        ]);
    });

    it('marks request as aborted without touching persistence-bound state', () => {
        const store = useForgeStore();

        store.createModelRequestTrace({
            id: 'req_abort',
            source: 'test_chat',
            status: 'streaming',
            workspaceSessionId: 'forge_ws_2',
            requestPrompt: [],
            requestParameters: {},
            contextSnapshot: {
                kind: 'forge-test-chat',
                workspaceTitle: 'Forge Test',
                detailMode: null,
                activeLayer: null,
                sourceCommand: { type: 'send_user_input', input: 'ping' },
                workflowSnapshot: null,
                historyMessages: [],
                referenceChatSessionId: null,
                referenceChatSnapshotId: null,
                lorebookEntries: [],
                memorySnapshot: null,
                selectedPresetId: null,
                testChatPresetId: 'preset_test',
                nexusPresetId: 'nexus_test'
            },
            responseRaw: 'partial',
            responseDisplay: 'partial',
            responseThinking: '',
            requestedAt: 200,
            firstResponseAt: 210,
            completedAt: null,
            errorMessage: null,
            presetId: 'preset_test',
            nodeSummary: [],
            toolEvents: []
        });

        store.abortModelRequestTrace('req_abort');

        expect(store.modelRequestTraces[0]).toEqual(expect.objectContaining({
            id: 'req_abort',
            status: 'aborted'
        }));
        expect(store.timelineItems).toHaveLength(0);
        expect(store.stagingArea).toHaveLength(0);
        expect(store.commitReadyEntries).toHaveLength(0);
    });

    it('tracks tool approval requests and resolution state separately from staging', () => {
        const store = useForgeStore();

        store.upsertToolApproval({
            id: 'approval-call-1',
            requestId: 'req_approval',
            toolCallId: 'call_1',
            toolName: 'writeFile',
            args: { path: '/forge/card.md' },
            reason: '写入需要审阅',
            source: 'conversation',
            status: 'pending',
            createdAt: 100
        });

        store.upsertToolApproval({
            id: 'approval-call-1',
            requestId: 'req_approval',
            toolCallId: 'call_1',
            toolName: 'writeFile',
            args: { path: '/forge/card.md', content: 'next' },
            reason: '写入需要审阅',
            source: 'conversation',
            status: 'pending',
            createdAt: 100
        });

        expect(store.toolApprovals).toHaveLength(1);
        expect(store.pendingToolApprovals).toHaveLength(1);
        expect(store.reviewToolApprovals).toHaveLength(1);
        expect(store.composerToolApprovals).toHaveLength(0);
        expect(store.toolApprovals[0]).toEqual(expect.objectContaining({
            toolCallId: 'call_1',
            status: 'pending',
            args: { path: '/forge/card.md', content: 'next' }
        }));

        store.resolveToolApproval('call_1', true, '允许进入暂存审阅');

        expect(store.pendingToolApprovals).toHaveLength(0);
        expect(store.toolApprovals[0]).toEqual(expect.objectContaining({
            status: 'approved',
            message: '允许进入暂存审阅'
        }));
        expect(store.stagingArea).toHaveLength(0);
    });

    it('keeps Composer approval requests out of the Review queue', () => {
        const store = useForgeStore();

        store.upsertToolApproval({
            id: 'approval-network-call',
            approvalId: 'approval-call-network',
            requestId: 'req_network',
            toolCallId: 'call_network',
            toolName: 'bash',
            args: {
                command: 'curl -o fetched.txt https://api.example.com/resource',
                accessMode: 'network-request'
            },
            reason: 'Forge Agent 请求访问 https://api.example.com/',
            source: 'conversation',
            status: 'pending',
            createdAt: 200,
            approvalKind: 'network',
            displaySurface: 'composer',
            shellPermissionRequestId: 'shell-permission-request-network'
        });

        expect(store.pendingToolApprovals).toHaveLength(1);
        expect(store.reviewToolApprovals).toHaveLength(0);
        expect(store.composerToolApprovals).toEqual([expect.objectContaining({
            toolCallId: 'call_network',
            approvalKind: 'network',
            displaySurface: 'composer',
            shellPermissionRequestId: 'shell-permission-request-network'
        })]);
    });

    it('filters Composer approval requests to the active Forge thread', () => {
        const store = useForgeStore();

        store.upsertToolApproval({
            id: 'approval-old-network-call',
            approvalId: 'approval-call-old-network',
            requestId: 'req_old_network',
            toolCallId: 'call_old_network',
            toolName: 'bash',
            args: {
                command: 'curl https://old.example.com/',
                accessMode: 'network-request'
            },
            reason: 'Forge Agent 请求访问 https://old.example.com/',
            source: 'conversation',
            status: 'pending',
            createdAt: 100,
            approvalKind: 'network',
            displaySurface: 'composer',
            shellPermissionRequestId: 'shell-permission-request-old-network',
            forgeProjectId: 'forge_project_alpha',
            conversationId: 'conversation_old',
            sessionId: 'forge_project_alpha__conversation_old'
        });
        store.upsertToolApproval({
            id: 'approval-new-network-call',
            approvalId: 'approval-call-new-network',
            requestId: 'req_new_network',
            toolCallId: 'call_new_network',
            toolName: 'bash',
            args: {
                command: 'curl https://new.example.com/',
                accessMode: 'network-request'
            },
            reason: 'Forge Agent 请求访问 https://new.example.com/',
            source: 'conversation',
            status: 'pending',
            createdAt: 200,
            approvalKind: 'network',
            displaySurface: 'composer',
            shellPermissionRequestId: 'shell-permission-request-new-network',
            forgeProjectId: 'forge_project_alpha',
            conversationId: 'conversation_new',
            sessionId: 'forge_project_alpha__conversation_new'
        });

        expect(store.composerToolApprovalsForSession({
            forgeProjectId: 'forge_project_alpha',
            conversationId: 'conversation_new'
        })).toEqual([expect.objectContaining({
            toolCallId: 'call_new_network',
            conversationId: 'conversation_new'
        })]);
    });

    it('stores pi-core session tree and context summary separately from transient model request traces', () => {
        const store = useForgeStore();

        store.setForgePiSessionState({
            tree: [{
                id: 'pi_node_1',
                sessionId: 'forge_project__conversation_1',
                parentId: null,
                kind: 'metadata',
                title: 'Forge pi session',
                summary: 'metadata',
                createdAt: 100,
                payload: {},
                children: [{
                    id: 'pi_node_2',
                    sessionId: 'forge_project__conversation_1',
                    parentId: 'pi_node_1',
                    kind: 'user',
                    title: 'User turn',
                    summary: '扩展条目',
                    createdAt: 110,
                    payload: { input: '扩展条目' },
                    children: []
                }]
            }],
            entries: [{
                id: 'pi_node_1',
                sessionId: 'forge_project__conversation_1',
                parentId: null,
                kind: 'metadata',
                title: 'Forge pi session',
                summary: 'metadata',
                createdAt: 100,
                payload: {}
            }, {
                id: 'pi_node_2',
                sessionId: 'forge_project__conversation_1',
                parentId: 'pi_node_1',
                kind: 'user',
                title: 'User turn',
                summary: '扩展条目',
                createdAt: 110,
                payload: { input: '扩展条目' }
            }],
            activeNodeId: 'pi_node_2',
            contextBundleSummary: {
                files: [{ path: 'context/project.md', title: '项目概况', content: '...' }],
                activeSkills: ['虚拟世界书编辑'],
                loadedExtensions: ['@luminaweave/pi-forge']
            },
            loadedExtensions: ['@luminaweave/pi-forge']
        });

        expect(store.piSessionTree[0].children?.[0]).toEqual(expect.objectContaining({
            id: 'pi_node_2',
            kind: 'user'
        }));
        expect(store.piSessionEntries.map(entry => entry.id)).toEqual(['pi_node_1', 'pi_node_2']);
        expect(store.activePiNodeId).toBe('pi_node_2');
        expect(store.piContextBundleSummary?.files[0].path).toBe('context/project.md');
        expect(store.piLoadedSkills).toEqual(['虚拟世界书编辑']);
        expect(store.piLoadedExtensions).toEqual(['@luminaweave/pi-forge']);
        expect(store.modelRequestTraces).toHaveLength(0);
        expect(store.timelineItems).toHaveLength(0);
    });

    it('projects agent runtime snapshot into store and the matching model request trace', () => {
        const store = useForgeStore();
        store.createModelRequestTrace(createTrace({ id: 'req_runtime' }));

        store.setAgentRuntimeSnapshot({
            requestId: 'req_runtime',
            snapshot: {
                isStreaming: false,
                pendingToolCalls: [],
                messages: [{
                    id: 'req_runtime',
                    role: 'assistant',
                    blocks: [{ type: 'text', text: '完成总结' }],
                    status: 'complete'
                }],
                activeTools: [{
                    name: 'read',
                    description: '读取文件',
                    needsApproval: false
                }]
            }
        });

        expect(store.agentRuntimeSnapshot).toEqual(expect.objectContaining({
            isStreaming: false,
            messages: [expect.objectContaining({ id: 'req_runtime' })]
        }));
        expect(store.modelRequestTraces[0].agentRuntimeSnapshot).toEqual(store.agentRuntimeSnapshot);

        store.clearAll();

        expect(store.agentRuntimeSnapshot).toBeNull();
    });

    it('hydrates a persisted pi session into a tree suitable for branch checkout UI', () => {
        const store = useForgeStore();

        store.setForgePiPersistedSessionState({
            sessionId: 'forge_project__conversation_1',
            activeNodeId: 'pi_node_4',
            version: 1,
            entries: [{
                id: 'pi_node_1',
                sessionId: 'forge_project__conversation_1',
                parentId: null,
                kind: 'metadata',
                title: 'Forge pi session',
                summary: 'metadata',
                createdAt: 100,
                payload: {}
            }, {
                id: 'pi_node_2',
                sessionId: 'forge_project__conversation_1',
                parentId: 'pi_node_1',
                kind: 'user',
                title: 'User A',
                summary: '分支 A',
                createdAt: 110,
                payload: { text: '分支 A' }
            }, {
                id: 'pi_node_3',
                sessionId: 'forge_project__conversation_1',
                parentId: 'pi_node_2',
                kind: 'assistant',
                title: 'Assistant A',
                summary: '回复 A',
                createdAt: 120,
                payload: { text: '回复 A' }
            }, {
                id: 'pi_node_4',
                sessionId: 'forge_project__conversation_1',
                parentId: 'pi_node_1',
                kind: 'user',
                title: 'User B',
                summary: '分支 B',
                createdAt: 130,
                payload: { text: '分支 B' }
            }],
            contextBundleSummary: null,
            loadedExtensions: []
        });

        expect(store.piSessionTree).toHaveLength(1);
        expect(store.piSessionTree[0].children?.map(node => node.id)).toEqual(['pi_node_2', 'pi_node_4']);
        expect(store.piSessionTree[0].children?.[0].children?.[0]).toEqual(expect.objectContaining({
            id: 'pi_node_3',
            parentId: 'pi_node_2'
        }));
        expect(store.activePiNodeId).toBe('pi_node_4');
    });
});
