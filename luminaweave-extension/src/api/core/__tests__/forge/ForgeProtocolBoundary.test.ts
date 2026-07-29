import { describe, expect, it, vi } from 'vitest';
import { ForgePiCoreRuntime } from '@/api/core/forge/agent-app/ForgePiCoreRuntime.js';
import type { ForgeRuntimeContext } from '@/types/ForgeRuntimeTypes.js';

const createContext = (): ForgeRuntimeContext => ({
    workspaceSessionId: 'forge_project_alpha',
    sessionChatId: 'conversation_alpha',
    workspaceTitle: 'Forge Alpha',
    selectedPresetId: 'forge-agent',
    selectedChatSessionId: null,
    selectedChatSnapshotId: null,
    detailMode: 'quick',
    collectionMode: 'conversation',
    entryMode: null,
    activeLayer: 'concept',
    completedLayers: [],
    workflowSnapshot: {
        currentStage: 'narrative',
        intent: 'conversation',
        reason: '用户继续细化角色',
        completedStages: ['kickoff']
    } as any,
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
    latestUserInput: '继续',
    latestUserCommand: { type: 'send_user_input', input: '继续' }
});

describe('Forge protocol boundary', () => {
    it('Forge 主协议由 pi preparePrompt 提供，不再依赖旧 PromptBuilder Forge 协议块', async () => {
        const runtime = new ForgePiCoreRuntime({
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
                loadTools: vi.fn(() => [
                    { name: 'capabilitySearch', description: '搜索能力' },
                    { name: 'capabilityLoad', description: '加载能力' },
                    { name: 'skillList', description: '列出技能' },
                    { name: 'skillLoad', description: '加载技能' },
                    { name: 'readFile', description: '读取项目文件' },
                    { name: 'writeFile', description: '写入项目文件' },
                    { name: 'editFile', description: '编辑项目文件' },
                    { name: 'deleteFile', description: '删除项目文件' }
                ])
            } as any
        });

        const result = await runtime.previewPrompt({
            command: { type: 'send_user_input', input: '继续' },
            commandInput: '继续',
            context: createContext(),
            request: {
                requestId: 'req_boundary',
                intent: 'conversation',
                modelRoute: 'main',
                traceSource: 'conversation',
                messages: [],
                nodeSummary: []
            } as any
        });
        const content = String(result.prompt[0]?.content ?? '');

        expect(content).toContain('./.forge/agent/UI_DSL.md');
        expect(content).toContain('./.forge/agent/REASONING.md');
        expect(content).toContain('Forge <V> DSL');
        expect(content).toContain('<V>');
        expect(content).toContain('ForgeChoiceGroup(');
        expect(content).toContain('ForgeFacetChecklist(');
        expect(result.activeTools.map(tool => tool.name)).toEqual(expect.arrayContaining([
            'capabilitySearch',
            'skillLoad',
            'writeFile',
            'editFile',
            'deleteFile'
        ]));

        expect(content).not.toContain('writeProposal');
        expect(content).not.toContain('editProposal');
        expect(content).not.toContain('stageEntry');
        expect(content).not.toContain('Review Gate');
        expect(content).not.toContain('输出协议');
        expect(content).not.toContain('<forge_skill>');
        expect(content).not.toContain('<draft_plan>');
        expect(content).not.toContain('<entry_update>');
        expect(content).not.toContain('<memory_update>');
        expect(content).not.toContain('<context_read>');
    });
});
