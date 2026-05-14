import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ForgeAgentGraphRuntime } from '../forge/ForgeAgentGraphRuntime.js';
import { ForgeProjectDataService } from '../forge/ForgeProjectDataService.js';
import { ShellWorkspaceService } from '../hal/shell/ShellWorkspaceService.js';
import type { ForgeWorkspaceSession } from '../../../types/SessionTypes.js';

const { store } = vi.hoisted(() => ({
    store: new Map<string, unknown>()
}));

vi.mock('@shared/api/BridgeDispatcher.js', () => ({
    BridgeDispatcher: {
        extensionStore: {
            getJson: vi.fn(async ({ key }: { key: string }) => store.get(key) ?? null),
            setJson: vi.fn(async ({ key, value }: { key: string; value: unknown }) => {
                store.set(key, value);
            }),
            listKeys: vi.fn(async () => Array.from(store.keys()))
        }
    }
}));

const createSession = (overrides: Partial<ForgeWorkspaceSession> = {}): ForgeWorkspaceSession => ({
    id: 'forge_ws_alpha',
    forgeProjectId: 'forge_project_alpha',
    conversationId: 'conversation_alpha',
    workspacePath: '/workspaces/forge/forge_project_alpha',
    sessionChatId: 'conversation_alpha',
    title: 'Forge Project Alpha',
    createdAt: 100,
    updatedAt: 200,
    presetId: 'preset_main',
    activeLeafId: 'leaf_1',
    worldlineNodes: [],
    selectedChatSessionId: null,
    selectedChatSnapshotId: null,
    draftInput: '',
    timelineItems: [],
    stagingEntries: [],
    commitReadyEntries: [],
    virtualLorebookEntries: [{
        id: 'entry_city',
        entry: {
            uid: 'entry_city',
            comment: 'City',
            key: ['city'],
            keysecondary: [],
            content: 'Ritual city',
            constant: false,
            selective: false,
            selectiveLogic: 0,
            disable: false,
            enabled: true,
            position: 0,
            depth: 0,
            order: 0,
            probability: 100,
            scan_depth: 0
        } as any,
        sourceBookId: null,
        createdAt: 100,
        updatedAt: 200
    }],
    forgeMemoryTree: {
        entries: [{
            path: '约束/禁忌',
            title: '禁忌',
            content: '不要改世界观基调。',
            summary: '保持基调',
            updatedAt: 200,
            source: 'user'
        }],
        lastUpdatedAt: 200
    },
    draftTree: {
        nodes: [{
            id: 'draft_1',
            title: 'Draft',
            layer: 'concept',
            content: 'Draft content',
            status: 'proposal',
            sourceMessageId: 'message_1',
            sourceEntryId: null,
            sourceTag: 'draft',
            sourceSessionId: 'forge_project_alpha',
            updatedAt: 200
        }],
        lastUpdatedAt: 200
    },
    workflowSnapshot: null,
    activeLayer: 'concept',
    completedLayers: [],
    publishState: 'drafting',
    activeAuxPanel: 'lorebook',
    auxPresentationMode: 'detached',
    workspaceMode: 'workspace',
    ...overrides
});

describe('ForgeAgentGraphRuntime', () => {
    let runtime: ForgeAgentGraphRuntime;

    beforeEach(() => {
        store.clear();
        runtime = new ForgeAgentGraphRuntime(new ForgeProjectDataService(new ShellWorkspaceService()));
    });

    it('routes material search into capability loading and project-readonly shell profile', async () => {
        const result = await runtime.run({
            session: createSession(),
            userInput: '请搜索素材文件，提取可以进入世界书的片段'
        });

        expect(result.intent).toBe('edit');
        expect(result.loadedCapabilities.map(item => item.capability.id)).toEqual(['material-analyzer']);
        expect(result.loadedCapabilities[0].shellProfile).toBe('project-readonly');
        expect(result.promptSourceUnits.map(unit => unit.id)).toContain('shell-profile:project-readonly');
        expect(result.projectResources).toMatchObject({
            lorebookEntryCount: 1,
            memoryEntryCount: 1,
            draftNodeCount: 1
        });
    });

    it('selects memory skill for preference and constraint updates', async () => {
        const result = await runtime.run({
            session: createSession(),
            userInput: '记忆一下我的偏好：不要改掉禁忌设定'
        });

        expect(result.intent).toBe('edit');
        expect(result.selectedSkills).toEqual(['memory-curator']);
        expect(result.loadedCapabilities.map(item => item.capability.id)).toEqual(['memory-curator']);
        expect(result.promptSourceUnits).toEqual(expect.arrayContaining([
            expect.objectContaining({
                id: 'skill:memory-curator',
                slot: 'skill_full',
                forgeSlot: 'skill_full',
                forgeRegion: 'task_context',
                sourceKind: 'skill'
            })
        ]));
        expect(result.promptSourceUnits).toEqual(expect.arrayContaining([
            expect.objectContaining({
                id: 'working-statement:forge_project_alpha',
                slot: 'working_statement',
                forgeRegion: 'tail_restatement'
            })
        ]));
        expect(result.workingStatement).toMatchObject({
            forgeProjectId: 'forge_project_alpha',
            conversationId: 'conversation_alpha',
            intent: 'edit',
            selectedSkills: ['memory-curator']
        });
        expect(result.trace.map(item => item.node)).toEqual([
            'intent_router',
            'skill_selector',
            'capability_loader',
            'context_loader',
            'working_statement_builder',
            'prompt_context_builder'
        ]);
    });

    it('does not persist project files while running the graph skeleton', async () => {
        await runtime.run({
            session: createSession({ forgeProjectId: 'forge_project_no_write' }),
            userInput: '帮我规划下一步'
        });

        expect(Array.from(store.keys())).toEqual([]);
    });
});
