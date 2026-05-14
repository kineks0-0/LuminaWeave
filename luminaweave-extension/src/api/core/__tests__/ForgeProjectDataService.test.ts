import { beforeEach, describe, expect, it, vi } from 'vitest';
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
    id: 'forge_ws_legacy',
    sessionChatId: 'lw_card_legacy',
    title: 'Legacy Forge Session',
    createdAt: 100,
    updatedAt: 200,
    presetId: 'preset_main',
    activeLeafId: 'leaf_1',
    worldlineNodes: [],
    selectedChatSessionId: 'chat_ref',
    selectedChatSnapshotId: 'snapshot_ref',
    draftInput: '',
    timelineItems: [],
    stagingEntries: [{
        id: 'staging_1',
        originalContent: 'old',
        proposedContent: 'new',
        description: 'Update entry',
        targetEntryId: 'entry_a',
        timestamp: 300,
        layer: 'concept',
        sourceTag: 'entry_update',
        sourceMessageId: 'message_1',
        sourceSessionId: 'forge_project_alpha'
    }],
    commitReadyEntries: [{
        id: 'commit_1',
        originalContent: 'draft',
        proposedContent: 'ready',
        description: 'Ready entry',
        targetEntryId: 'entry_b',
        timestamp: 310,
        layer: 'entity',
        sourceTag: 'review',
        sourceMessageId: 'message_2',
        sourceSessionId: 'forge_project_alpha'
    }],
    virtualLorebookEntries: [{
        id: 'entry_a',
        entry: {
            uid: 'entry_a',
            comment: 'City Core',
            key: ['city'],
            keysecondary: [],
            content: 'A vertical city with ritual elevators.',
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
        createdAt: 120,
        updatedAt: 320
    }],
    importedLorebookId: 'virtual_book',
    workflowSnapshot: null,
    detailMode: 'detailed',
    entryMode: 'structured',
    structuredState: {
        activeFormId: 'core',
        activeMessageFormId: null,
        submitConfigs: {},
        submittedScopes: {},
        lastUpdatedAt: 330,
        forms: {
            core: {
                id: 'core',
                layer: 'concept',
                title: 'Core',
                fields: {
                    premise: {
                        value: 'ritual city',
                        locked: false,
                        confirmed: true,
                        source: 'manual',
                        updatedAt: 331
                    }
                },
                missingFields: [],
                lastSubmittedAt: null
            }
        }
    },
    draftTree: {
        nodes: [{
            id: 'draft_1',
            title: 'Premise',
            layer: 'concept',
            content: 'Ritual city premise',
            status: 'approved_for_workspace',
            sourceMessageId: 'message_1',
            sourceEntryId: 'entry_a',
            sourceTag: 'draft',
            sourceSessionId: 'forge_project_alpha',
            updatedAt: 332
        }],
        lastUpdatedAt: 332
    },
    forgeMemoryTree: {
        entries: [{
            path: '设定决议/城市',
            title: '城市决议',
            content: '城市以仪式电梯分层。',
            summary: '仪式电梯城市',
            updatedAt: 333,
            source: 'user'
        }],
        lastUpdatedAt: 333
    },
    activeLayer: 'concept',
    completedLayers: ['concept'],
    publishState: 'workspace_frozen',
    activeAuxPanel: 'memory',
    auxPresentationMode: 'widget',
    workspaceMode: 'workspace',
    ...overrides
});

describe('ForgeProjectDataService', () => {
    let workspaces: ShellWorkspaceService;
    let service: ForgeProjectDataService;

    beforeEach(() => {
        store.clear();
        workspaces = new ShellWorkspaceService();
        service = new ForgeProjectDataService(workspaces);
    });

    it('normalizes legacy sessions into stable project ids, conversation ids, and workspace paths', async () => {
        const result = await service.loadOrCreateFromSession(createSession());

        expect(result.migratedFromSession).toBe(true);
        expect(result.session).toMatchObject({
            forgeProjectId: 'forge_ws_legacy',
            conversationId: 'lw_card_legacy',
            sessionChatId: 'lw_card_legacy',
            workspacePath: '/workspaces/forge/forge_ws_legacy'
        });

        const fs = await workspaces.getFileSystem({ projectId: 'forge_ws_legacy' });
        await expect(fs.readFile('/forge/forge_ws_legacy/project.json')).resolves.toContain('"forgeProjectId": "forge_ws_legacy"');
    });

    it('hydrates project resources from VFS after save', async () => {
        const session = createSession({
            forgeProjectId: 'forge_project_alpha',
            conversationId: 'conversation_alpha',
            workspacePath: '/workspaces/forge/forge_project_alpha'
        });

        await service.saveFromSession(session);
        const hydrated = await service.loadForSession({
            ...session,
            title: 'Stale Title',
            virtualLorebookEntries: [],
            forgeMemoryTree: { entries: [], lastUpdatedAt: 1 },
            draftTree: { nodes: [], lastUpdatedAt: 1 },
            stagingEntries: [],
            commitReadyEntries: []
        });

        expect(hydrated).toMatchObject({
            forgeProjectId: 'forge_project_alpha',
            conversationId: 'conversation_alpha',
            workspacePath: '/workspaces/forge/forge_project_alpha',
            title: 'Legacy Forge Session',
            presetId: 'preset_main',
            publishState: 'workspace_frozen',
            activeAuxPanel: 'memory',
            auxPresentationMode: 'widget'
        });
        expect(hydrated?.virtualLorebookEntries?.map(entry => entry.id)).toEqual(['entry_a']);
        expect(hydrated?.forgeMemoryTree?.entries[0].path).toBe('设定决议/城市');
        expect(hydrated?.structuredState?.forms.core.fields.premise.value).toBe('ritual city');
        expect(hydrated?.draftTree?.nodes[0].status).toBe('approved_for_workspace');
        expect(hydrated?.stagingEntries[0].id).toBe('staging_1');
        expect(hydrated?.commitReadyEntries?.[0].id).toBe('commit_1');
    });

    it('rewrites VFS lorebook entry files to match the current virtual project state', async () => {
        const session = createSession({
            forgeProjectId: 'forge_project_cleanup',
            conversationId: 'conversation_cleanup',
            workspacePath: '/workspaces/forge/forge_project_cleanup'
        });

        await service.saveFromSession(session);
        await service.saveFromSession({
            ...session,
            virtualLorebookEntries: [{
                ...session.virtualLorebookEntries![0],
                id: 'entry_b',
                entry: {
                    ...(session.virtualLorebookEntries![0].entry as any),
                    uid: 'entry_b',
                    comment: 'Replacement',
                    key: ['replacement'],
                    content: 'Replacement lore.'
                } as any
            }]
        });

        const fs = await workspaces.getFileSystem({ projectId: 'forge_project_cleanup' });
        await expect(fs.readFile('/forge/forge_project_cleanup/lorebook/entries/entry_b.json')).resolves.toContain('Replacement lore');
        await expect(fs.readFile('/forge/forge_project_cleanup/lorebook/entries/entry_a.json')).rejects.toThrow();
    });
});
