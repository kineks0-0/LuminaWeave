import { describe, expect, it, vi } from 'vitest';
import { ForgePiRuntimeClient } from '@/api/core/forge/runtime/ForgePiRuntimeClient.js';
import type { ForgeRuntimeContext } from '@/types/ForgeRuntimeTypes.js';

const createContext = (): ForgeRuntimeContext => ({
    workspaceSessionId: 'forge_project',
    sessionChatId: 'conversation_1',
    workspaceTitle: 'Forge Project',
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
    latestUserInput: '生成角色卡',
    latestUserCommand: { type: 'send_user_input', input: '生成角色卡' }
});

describe('ForgePiRuntimeClient', () => {
    it('previews a pi prompt through the local runtime without calling server /forge/pi endpoints', async () => {
        const fetchSpy = vi.spyOn(globalThis, 'fetch');
        const runtime = {
            previewPrompt: vi.fn(async () => ({
                requestId: 'req_preview',
                prompt: [{ role: 'system', content: 'pi actual prompt' }],
                systemPrompt: 'pi actual prompt',
                branchMessages: [],
                contextBundleSummary: {
                    files: [],
                    activeSkills: ['中文制卡技能'],
                    loadedExtensions: ['@luminaweave/forge-browser-adapters']
                },
                loadedExtensions: ['@luminaweave/forge-browser-adapters'],
                activeTools: [{
                    name: 'capability.search',
                    description: '搜索能力',
                    needsApproval: false
                }],
                piSessionState: {
                    tree: [],
                    activeNodeId: null,
                    contextBundleSummary: {
                        files: [],
                        activeSkills: ['中文制卡技能'],
                        loadedExtensions: ['@luminaweave/forge-browser-adapters']
                    },
                    loadedExtensions: ['@luminaweave/forge-browser-adapters']
                }
            }))
        };

        const client = new ForgePiRuntimeClient({ runtime: runtime as any });
        const result = await client.previewPrompt({
            command: { type: 'send_user_input', input: '生成角色卡' },
            commandInput: '生成角色卡',
            context: createContext(),
            request: {
                requestId: 'req_preview',
                mode: 'conversation',
                messages: [],
                traceSource: 'conversation'
            } as any
        });

        expect(runtime.previewPrompt).toHaveBeenCalledOnce();
        expect(fetchSpy).not.toHaveBeenCalled();
        expect(result.prompt).toEqual([{ role: 'system', content: 'pi actual prompt' }]);
        expect(result.activeTools).toEqual([expect.objectContaining({ name: 'capability.search' })]);
    });

    it('runs the browser pi-core runtime locally without calling server /forge/pi endpoints', async () => {
        const fetchSpy = vi.spyOn(globalThis, 'fetch');
        const runtime = {
            runTurn: vi.fn(async () => ({
                events: [{
                    type: 'stream_done' as const,
                    requestId: 'req_1',
                    rawText: 'local pi-core reply',
                    displayText: 'local pi-core reply',
                    thinkingText: '',
                    completedAt: 10
                }],
                effects: [],
                piSessionState: {
                    tree: [{
                        id: 'pi_node_1',
                        sessionId: 'forge_project__conversation_1',
                        parentId: null,
                        kind: 'assistant' as const,
                        title: 'Assistant',
                        summary: 'local pi-core reply',
                        createdAt: 10,
                        payload: { text: 'local pi-core reply' },
                        children: []
                    }],
                    activeNodeId: 'pi_node_1',
                    contextBundleSummary: {
                        files: [],
                        activeSkills: ['虚拟世界书编辑器'],
                        loadedExtensions: ['@luminaweave/forge-browser-adapters']
                    },
                    loadedExtensions: ['@luminaweave/forge-browser-adapters']
                }
            }))
        };

        const client = new ForgePiRuntimeClient({ runtime: runtime as any });
        const result = await client.runTurn({
            command: { type: 'send_user_input', input: '生成角色卡' },
            commandInput: '生成角色卡',
            context: createContext(),
            request: {
                requestId: 'req_1',
                mode: 'conversation',
                messages: [],
                traceSource: 'conversation'
            } as any
        });

        expect(runtime.runTurn).toHaveBeenCalledOnce();
        expect(fetchSpy).not.toHaveBeenCalled();
        expect(result.events).toEqual([expect.objectContaining({
            type: 'stream_done',
            requestId: 'req_1',
            displayText: 'local pi-core reply'
        })]);
        expect(result.piSessionState.activeNodeId).toBe('pi_node_1');
        expect(result.piSessionState.loadedExtensions).toEqual(['@luminaweave/forge-browser-adapters']);
    });

    it('resolves tool approval through the local runtime instead of a server endpoint', async () => {
        const fetchSpy = vi.spyOn(globalThis, 'fetch');
        const runtime = {
            runTurn: vi.fn(),
            resolveToolApproval: vi.fn(async () => ({
                resolved: true,
                events: [{
                    type: 'tool_approval_resolved' as const,
                    requestId: 'req_1',
                    approvalId: 'approval-call_write',
                    toolCallId: 'call_write',
                    toolName: 'stageEntry',
                    approved: true,
                    message: '允许进入暂存',
                    source: 'conversation' as const
                }],
                effects: []
            }))
        };

        const client = new ForgePiRuntimeClient({ runtime: runtime as any });
        const result = await client.resolveToolApproval('call_write', true, '允许进入暂存');

        expect(runtime.resolveToolApproval).toHaveBeenCalledWith('call_write', true, '允许进入暂存');
        expect(fetchSpy).not.toHaveBeenCalled();
        expect(result.resolved).toBe(true);
        expect(result.events).toEqual([expect.objectContaining({
            type: 'tool_approval_resolved',
            toolCallId: 'call_write',
            approved: true
        })]);
    });

    it('forwards checkout and user-node branch operations to the local runtime', () => {
        const runtime = {
            checkout: vi.fn(() => ({
                piSessionState: {
                    tree: [],
                    entries: [],
                    activeNodeId: 'node_1',
                    contextBundleSummary: null,
                    loadedExtensions: []
                }
            })),
            branchFromUserNode: vi.fn(() => ({
                input: '原始请求',
                userNodeId: 'node_user',
                piSessionState: {
                    tree: [],
                    entries: [],
                    activeNodeId: 'node_parent',
                    contextBundleSummary: null,
                    loadedExtensions: []
                }
            }))
        };

        const client = new ForgePiRuntimeClient({ runtime: runtime as any });
        const checkout = client.checkout({ context: createContext(), nodeId: 'node_1' });
        const branch = client.branchFromUserNode({ context: createContext(), userNodeId: 'node_user' });

        expect(runtime.checkout).toHaveBeenCalledWith({ context: expect.any(Object), nodeId: 'node_1' });
        expect(checkout.piSessionState.activeNodeId).toBe('node_1');
        expect(runtime.branchFromUserNode).toHaveBeenCalledWith({ context: expect.any(Object), userNodeId: 'node_user' });
        expect(branch).toEqual(expect.objectContaining({
            input: '原始请求',
            userNodeId: 'node_user',
            piSessionState: expect.objectContaining({ activeNodeId: 'node_parent' })
        }));
    });
});
