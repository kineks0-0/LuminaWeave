import { describe, expect, it, vi } from 'vitest';
import { ForgePromptPreviewPayloadBuilder } from '../store/ForgePromptPreviewPayloadBuilder.js';

const createBuilder = (overrides: Partial<ConstructorParameters<typeof ForgePromptPreviewPayloadBuilder>[0]> = {}) => {
    const promptContextService = {
        buildPromptPreviewPayload: vi.fn().mockReturnValue([{ role: 'system', content: 'primary' }]),
        buildPromptPreviewAssembly: vi.fn().mockReturnValue({
            trace: [{
                traceId: 'trace-1',
                unitId: 'unit-1',
                label: '能力索引',
                kind: 'context',
                sourceKind: 'forge-agent',
                inclusion: 'included',
                outputMessageIndex: 0
            }]
        }),
        buildExecutorPreviewPayload: vi.fn().mockReturnValue([{ role: 'system', content: 'executor' }]),
        buildExecutorPreviewAssembly: vi.fn().mockReturnValue({
            trace: [{
                traceId: 'trace-executor',
                unitId: 'executor',
                label: '执行模型',
                kind: 'system',
                sourceKind: 'forge-agent',
                inclusion: 'included',
                outputMessageIndex: 0
            }]
        })
    };
    const builder = new ForgePromptPreviewPayloadBuilder({
        getSelectedPresetId: () => 'preset-1',
        syncAutoChecklistToMemory: vi.fn(),
        fetchPresetDetail: vi.fn().mockResolvedValue({ preset: { blob: {} } }),
        resolveActiveLorebookView: () => ({ entries: [{ comment: 'lore' }] } as any),
        buildMemorySnapshot: () => ({ sourceId: 'forge' } as any),
        getPrimaryIntent: () => 'conversation',
        getMessages: () => [{ role: 'user', mesRaw: 'raw hello', mes: 'hello', name: 'You' } as any],
        runAgentGraph: vi.fn().mockResolvedValue({
            promptSourceUnits: [{ id: 'unit-1', label: '能力索引', kind: 'context', sourceKind: 'forge-agent' }],
            intent: 'conversation',
            trace: [],
            selectedSkills: ['技能'],
            loadedCapabilities: [],
            projectResources: [],
            workingStatement: '边界'
        }),
        getForgeMemoryTree: () => ({ entries: [] } as any),
        getStructuredState: () => ({ forms: {} } as any),
        getDraftTree: () => ({ nodes: [] } as any),
        getWorkflowSnapshot: () => ({ intent: 'conversation', reason: '当前原因' } as any),
        getCommitReadyEntries: () => [],
        getStagingEntries: () => [],
        resolveOriginalContent: () => '',
        getSessionChatId: () => 'session-1',
        getRuntimeContext: () => ({
            selectedPresetId: 'preset-1',
            sessionChatId: 'session-1'
        } as any),
        resolveRuntimePresetId: () => 'preset-1',
        buildRuntimeContextSnapshot: () => ({ kind: 'forge-runtime' } as any),
        summarizeRequestNodeSummary: () => [{ provider: 'test', model: 'model', label: '测试模型' }],
        resolvePromptPresetGenerationSettings: () => ({ temperature: 0.7 } as any),
        generateRequestId: () => 'req_preview',
        previewPiPrompt: vi.fn().mockResolvedValue({
            requestId: 'req_preview',
            prompt: [{ role: 'system', content: 'pi actual prompt' }],
            systemPrompt: 'pi actual prompt',
            branchMessages: [],
            contextBundleSummary: {
                files: [{ path: 'context/project.md', title: '项目概况', content: '# Forge' }],
                activeSkills: ['中文制卡技能'],
                loadedExtensions: ['@luminaweave/pi-forge-browser']
            },
            loadedExtensions: ['@luminaweave/pi-forge-browser'],
            activeTools: [{
                name: 'capability.search',
                description: '搜索能力',
                needsApproval: false
            }],
            piSessionState: {
                tree: [],
                activeNodeId: null,
                contextBundleSummary: null,
                loadedExtensions: []
            }
        }),
        promptContextService,
        logger: { warn: vi.fn() },
        ...overrides
    });
    return { builder, promptContextService };
};

describe('ForgePromptPreviewPayloadBuilder', () => {
    it('returns empty primary and executor previews when no preset is selected', async () => {
        const syncAutoChecklistToMemory = vi.fn();
        const { builder } = createBuilder({
            getSelectedPresetId: () => '',
            syncAutoChecklistToMemory
        });

        const bundle = await builder.buildPromptPreviewPayload();

        expect(bundle.primary.payload).toEqual([]);
        expect(bundle.primary.title).toBe('主模型 / Planner');
        expect(bundle.executor.payload).toEqual([]);
        expect(syncAutoChecklistToMemory).not.toHaveBeenCalled();
    });

    it('builds primary preview from pi prepared prompt while keeping source-unit assembly trace', async () => {
        const syncAutoChecklistToMemory = vi.fn();
        const { builder, promptContextService } = createBuilder({ syncAutoChecklistToMemory });

        const bundle = await builder.buildPromptPreviewPayload();

        expect(syncAutoChecklistToMemory).toHaveBeenCalledTimes(1);
        expect(promptContextService.buildPromptPreviewPayload).not.toHaveBeenCalled();
        expect(promptContextService.buildPromptPreviewAssembly).toHaveBeenCalledWith(expect.objectContaining({
            messages: [{ role: 'user', content: 'raw hello', name: 'You' }],
            forgeAgentSourceUnits: [{ id: 'unit-1', label: '能力索引', kind: 'context', sourceKind: 'forge-agent' }],
            intent: 'conversation'
        }));
        expect(bundle.primary).toMatchObject({
            key: 'primary',
            intent: 'conversation',
            title: '主模型 / Conversation',
            sourceLabel: '当前原因',
            targetEntryId: null
        });
        expect(bundle.primary.agent?.workingStatement).toBe('边界');
        expect(bundle.primary.payload).toEqual([{ role: 'system', content: 'pi actual prompt' }]);
        expect(bundle.primary.pi?.activeTools).toEqual([expect.objectContaining({ name: 'capability.search' })]);
        expect(bundle.primary.assembly).toEqual({
            trace: [{
                traceId: 'trace-1',
                unitId: 'unit-1',
                label: '能力索引',
                kind: 'context',
                sourceKind: 'forge-agent',
                inclusion: 'included',
                outputMessageIndex: 0
            }]
        });
    });

    it('passes no legacy Forge Prompt Context payload into the pi preview path', async () => {
        const previewPiPrompt = vi.fn().mockResolvedValue({
            requestId: 'req_preview',
            prompt: [{ role: 'system', content: 'pi exact system prompt' }],
            systemPrompt: 'pi exact system prompt',
            branchMessages: [],
            contextBundleSummary: { files: [], activeSkills: [], loadedExtensions: [] },
            loadedExtensions: [],
            activeTools: [],
            piSessionState: { tree: [], activeNodeId: null, contextBundleSummary: null, loadedExtensions: [] }
        });
        const { builder, promptContextService } = createBuilder({ previewPiPrompt } as any);

        const bundle = await builder.buildPromptPreviewPayload();

        expect(promptContextService.buildPromptPreviewPayload).not.toHaveBeenCalled();
        expect(previewPiPrompt).toHaveBeenCalledWith(expect.objectContaining({
            command: { type: 'send_user_input', input: 'raw hello' },
            commandInput: 'raw hello',
            request: expect.objectContaining({
                requestId: 'req_preview',
                traceSource: 'conversation',
                intent: 'conversation',
                modelRoute: 'main',
                messages: []
            })
        }));
        expect(bundle.primary.payload).toEqual([{ role: 'system', content: 'pi exact system prompt' }]);
        expect(bundle.primary.subtitle).toContain('pi agent');
    });

    it('uses latest commit-ready entry as executor preview seed before staging', async () => {
        const { builder, promptContextService } = createBuilder({
            getCommitReadyEntries: () => [{
                targetEntryId: 'entry-commit',
                description: '重写条目',
                originalContent: '原文'
            } as any],
            getStagingEntries: () => [{
                targetEntryId: 'entry-staging',
                description: '待审',
                originalContent: '待审原文'
            } as any]
        });

        const bundle = await builder.buildPromptPreviewPayload();

        expect(promptContextService.buildExecutorPreviewPayload).toHaveBeenCalledWith(expect.objectContaining({
            instruction: '重写条目',
            entryId: 'entry-commit',
            originalContent: '原文',
            sessionChatId: 'session-1',
            presetId: 'preset-1'
        }));
        expect(bundle.executor.sourceLabel).toBe('写回准备条目');
        expect(bundle.executor.targetEntryId).toBe('entry-commit');
    });
});
