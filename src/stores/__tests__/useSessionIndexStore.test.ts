import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';

import { useSessionIndexStore } from '../useSessionIndexStore.js';
import { chatSessionIndexService } from '../../api/core/conversation/ChatSessionIndexService.js';
import { forgeSessionRepository } from '../../api/core/forge/project/ForgeSessionRepository.js';
import { lwStorage } from '../../api/storage.js';
import { STClient } from '../../api/core/host-drivers/st/STClient.js';

vi.mock('../../api/core/conversation/ChatSessionIndexService.js', () => ({
    chatSessionIndexService: {
        listChatSessions: vi.fn()
    }
}));

vi.mock('../../api/core/forge/project/ForgeSessionRepository.js', () => ({
    forgeSessionRepository: {
        refreshFromServer: vi.fn(async () => undefined),
        listSessions: vi.fn(() => []),
        getActiveSessionId: vi.fn(() => null),
        setActiveSessionId: vi.fn(),
        createThread: vi.fn(),
        renameProject: vi.fn(),
        renameThread: vi.fn(),
        deleteThread: vi.fn(),
        deleteProject: vi.fn()
    }
}));

vi.mock('../../api/storage.js', () => ({
    lwStorage: {
        _getContextIds: vi.fn(() => ({ chatId: 'chat_live' }))
    }
}));

vi.mock('../../api/core/host-drivers/st/STClient.js', () => ({
    STClient: {
        normalizeChatId: vi.fn((value: unknown) => {
            if (typeof value !== 'string' && typeof value !== 'number') {
                return null;
            }
            const normalized = String(value).trim();
            return !normalized || normalized === 'null' || normalized === 'undefined' || normalized === 'default'
                ? null
                : normalized;
        })
    }
}));

describe('useSessionIndexStore', () => {
    beforeEach(() => {
        setActivePinia(createPinia());
        vi.clearAllMocks();
        vi.mocked(chatSessionIndexService.listChatSessions).mockResolvedValue([
            {
                id: 'chat_a',
                title: 'A',
                source: 'lumina-server',
                createdAt: 1,
                updatedAt: 1,
                messageCount: 1,
                summary: '',
                previewMessage: '',
                activeLeafId: null,
                characterId: null,
                characterName: '',
                characterAvatarUrl: null
            },
            {
                id: 'chat_b',
                title: 'B',
                source: 'lumina-server',
                createdAt: 2,
                updatedAt: 2,
                messageCount: 1,
                summary: '',
                previewMessage: '',
                activeLeafId: null,
                characterId: null,
                characterName: '',
                characterAvatarUrl: null
            }
        ]);
        vi.mocked(forgeSessionRepository.listSessions).mockReturnValue([]);
        vi.mocked(lwStorage._getContextIds).mockReturnValue({ chatId: 'default' } as any);
        vi.mocked(STClient.normalizeChatId).mockImplementation((value: unknown) => {
            if (typeof value !== 'string' && typeof value !== 'number') {
                return null;
            }
            const normalized = String(value).trim();
            return !normalized || normalized === 'null' || normalized === 'undefined' || normalized === 'default'
                ? null
                : normalized;
        });
    });

    it('clears selected chat session when current live chat disappears instead of falling back to the first archived session', async () => {
        const store = useSessionIndexStore();
        store.selectChatSession('chat_b');

        await store.refresh();

        expect(store.chatSessions.map((session) => session.id)).toEqual(['chat_a', 'chat_b']);
        expect(store.selectedChatSessionId).toBeNull();
    });

    it('derives collaboration threads from the selected Forge project', async () => {
        vi.mocked(forgeSessionRepository.listSessions).mockReturnValue([
            {
                id: 'forge_thread_a1',
                forgeProjectId: 'forge_project_a',
                projectTitle: 'Project A',
                conversationId: 'conversation_a1',
                sessionChatId: 'conversation_a1',
                workspacePath: '/workspaces/forge/forge_project_a/chat/conversation_a1',
                title: 'Project A Thread 1',
                createdAt: 1,
                updatedAt: 10,
                messageCount: 2,
                activeLeafId: 'leaf_a1',
                selectedChatSessionId: null
            },
            {
                id: 'forge_thread_a2',
                forgeProjectId: 'forge_project_a',
                projectTitle: 'Project A',
                conversationId: 'conversation_a2',
                sessionChatId: 'conversation_a2',
                workspacePath: '/workspaces/forge/forge_project_a/chat/conversation_a2',
                title: 'Project A Thread 2',
                createdAt: 2,
                updatedAt: 20,
                messageCount: 4,
                activeLeafId: 'leaf_a2',
                selectedChatSessionId: null
            },
            {
                id: 'forge_thread_b1',
                forgeProjectId: 'forge_project_b',
                projectTitle: 'Project B',
                conversationId: 'conversation_b1',
                sessionChatId: 'conversation_b1',
                workspacePath: '/workspaces/forge/forge_project_b/chat/conversation_b1',
                title: 'Project B Thread 1',
                createdAt: 3,
                updatedAt: 30,
                messageCount: 1,
                activeLeafId: null,
                selectedChatSessionId: null
            }
        ]);

        const store = useSessionIndexStore();
        await store.refresh();
        store.selectForgeSession('forge_thread_a1');

        expect(store.forgeProjects.map((session) => session.forgeProjectId)).toEqual(['forge_project_b', 'forge_project_a']);
        expect(store.forgeProjects.map((session) => session.title)).toEqual(['Project B', 'Project A']);
        expect(store.selectedForgeProjectId).toBe('forge_project_a');
        expect(store.selectedForgeProjectThreads.map((session) => session.id)).toEqual(['forge_thread_a2', 'forge_thread_a1']);
        expect(store.selectedForgeProjectThreads.map((session) => session.title)).toEqual(['Project A Thread 2', 'Project A Thread 1']);
        expect(store.getForgeProjectThreads('forge_project_b').map((session) => session.id)).toEqual(['forge_thread_b1']);
    });

    it('treats legacy Forge sessions without project ids as single-thread projects', async () => {
        vi.mocked(forgeSessionRepository.listSessions).mockReturnValue([
            {
                id: 'legacy_forge_ws',
                conversationId: 'legacy_conversation',
                sessionChatId: 'legacy_conversation',
                workspacePath: '/workspaces/forge/legacy_forge_ws',
                title: 'Legacy Project',
                createdAt: 1,
                updatedAt: 12,
                messageCount: 3,
                activeLeafId: null,
                selectedChatSessionId: null
            }
        ]);

        const store = useSessionIndexStore();
        await store.refresh();

        expect(store.forgeProjects.map((session) => session.id)).toEqual(['legacy_forge_ws']);
        expect(store.selectedForgeProjectId).toBe('legacy_forge_ws');
        expect(store.selectedForgeProjectThreads.map((session) => session.id)).toEqual(['legacy_forge_ws']);
    });

    it('falls back to the most recently updated project when the selected thread is no longer indexed', async () => {
        vi.mocked(forgeSessionRepository.getActiveSessionId).mockReturnValue('deleted_thread');
        vi.mocked(forgeSessionRepository.listSessions).mockReturnValue([
            {
                id: 'forge_thread_old',
                forgeProjectId: 'forge_project_old',
                conversationId: 'conversation_old',
                sessionChatId: 'conversation_old',
                workspacePath: '/workspaces/forge/forge_project_old',
                title: 'Old Project',
                createdAt: 1,
                updatedAt: 10,
                messageCount: 1,
                activeLeafId: null,
                selectedChatSessionId: null
            },
            {
                id: 'forge_thread_recent',
                forgeProjectId: 'forge_project_recent',
                conversationId: 'conversation_recent',
                sessionChatId: 'conversation_recent',
                workspacePath: '/workspaces/forge/forge_project_recent',
                title: 'Recent Project',
                createdAt: 2,
                updatedAt: 20,
                messageCount: 2,
                activeLeafId: null,
                selectedChatSessionId: null
            }
        ]);

        const store = useSessionIndexStore();
        await store.refresh();

        expect(store.selectedForgeSessionId).toBe('deleted_thread');
        expect(store.selectedForgeProjectId).toBe('forge_project_recent');
        expect(store.selectedForgeProjectThreads.map((session) => session.id)).toEqual(['forge_thread_recent']);
    });

    it('creates and deletes Forge project threads through the session index boundary', async () => {
        vi.mocked(forgeSessionRepository.listSessions)
            .mockReturnValueOnce([
                {
                    id: 'forge_thread_seed',
                    forgeProjectId: 'forge_project_a',
                    conversationId: 'conversation_seed',
                    sessionChatId: 'conversation_seed',
                    workspacePath: '/workspaces/forge/forge_project_a',
                    title: 'Seed Thread',
                    createdAt: 1,
                    updatedAt: 10,
                    messageCount: 1,
                    activeLeafId: null,
                    selectedChatSessionId: null
                }
            ])
            .mockReturnValueOnce([
                {
                    id: 'forge_thread_new',
                    forgeProjectId: 'forge_project_a',
                    conversationId: 'conversation_new',
                    sessionChatId: 'conversation_new',
                    workspacePath: '/workspaces/forge/forge_project_a',
                    title: 'New Thread',
                    createdAt: 2,
                    updatedAt: 20,
                    messageCount: 0,
                    activeLeafId: null,
                    selectedChatSessionId: null
                }
            ])
            .mockReturnValueOnce([]);
        vi.mocked(forgeSessionRepository.createThread).mockResolvedValue({
            id: 'forge_thread_new',
            forgeProjectId: 'forge_project_a',
            conversationId: 'conversation_new',
            sessionChatId: 'conversation_new',
            workspacePath: '/workspaces/forge/forge_project_a',
            title: 'New Thread',
            createdAt: 2,
            updatedAt: 20,
            presetId: '',
            activeLeafId: null,
            worldlineNodes: [],
            selectedChatSessionId: null,
            selectedChatSnapshotId: null,
            draftInput: '',
            timelineItems: [],
            stagingEntries: [],
            commitReadyEntries: [],
            virtualLorebookEntries: [],
            importedLorebookId: null,
            workflowSnapshot: null,
            structuredState: { forms: {} } as any,
            draftTree: { nodes: [], lastUpdatedAt: 20 } as any,
            forgeMemoryTree: { nodes: [], lastUpdatedAt: 20 } as any,
            activeLayer: 'concept',
            completedLayers: [],
            publishState: 'drafting',
            workspaceMode: 'workspace'
        });
        vi.mocked(forgeSessionRepository.deleteThread).mockResolvedValue(true);
        vi.mocked(forgeSessionRepository.renameProject).mockResolvedValue(true);
        vi.mocked(forgeSessionRepository.renameThread).mockResolvedValue({
            id: 'forge_thread_new',
            forgeProjectId: 'forge_project_a',
            conversationId: 'conversation_new',
            sessionChatId: 'conversation_new',
            workspacePath: '/workspaces/forge/forge_project_a/chat/conversation_new',
            title: 'Renamed Thread',
            createdAt: 2,
            updatedAt: 30,
            presetId: '',
            activeLeafId: null,
            worldlineNodes: [],
            selectedChatSessionId: null,
            selectedChatSnapshotId: null,
            draftInput: '',
            timelineItems: [],
            stagingEntries: [],
            commitReadyEntries: [],
            virtualLorebookEntries: [],
            importedLorebookId: null,
            workflowSnapshot: null,
            structuredState: { forms: {} } as any,
            draftTree: { nodes: [], lastUpdatedAt: 20 } as any,
            forgeMemoryTree: { nodes: [], lastUpdatedAt: 20 } as any,
            activeLayer: 'concept',
            completedLayers: [],
            publishState: 'drafting',
            workspaceMode: 'workspace'
        });

        const store = useSessionIndexStore();
        await store.refresh();
        const created = await store.createForgeProjectThread('forge_project_a', 'New Thread');

        expect(created.id).toBe('forge_thread_new');
        expect(store.selectedForgeSessionId).toBe('forge_thread_new');
        expect(forgeSessionRepository.createThread).toHaveBeenCalledWith('forge_project_a', expect.objectContaining({
            title: 'New Thread'
        }));

        await store.deleteForgeThread('forge_thread_new');

        expect(forgeSessionRepository.deleteThread).toHaveBeenCalledWith('forge_thread_new');
        expect(store.selectedForgeSessionId).toBeNull();
    });

    it('renames Forge projects and collaboration threads through separate repository commands', async () => {
        vi.mocked(forgeSessionRepository.listSessions).mockReturnValue([
            {
                id: 'forge_thread_a1',
                forgeProjectId: 'forge_project_a',
                projectTitle: 'Project A',
                conversationId: 'conversation_a1',
                sessionChatId: 'conversation_a1',
                workspacePath: '/workspaces/forge/forge_project_a/chat/conversation_a1',
                title: 'Thread A1',
                createdAt: 1,
                updatedAt: 10,
                messageCount: 1,
                activeLeafId: null,
                selectedChatSessionId: null
            }
        ]);
        vi.mocked(forgeSessionRepository.renameProject).mockResolvedValue(true);
        vi.mocked(forgeSessionRepository.renameThread).mockResolvedValue({
            id: 'forge_thread_a1',
            forgeProjectId: 'forge_project_a',
            projectTitle: 'Renamed Project',
            conversationId: 'conversation_a1',
            sessionChatId: 'conversation_a1',
            workspacePath: '/workspaces/forge/forge_project_a/chat/conversation_a1',
            title: 'Renamed Thread',
            createdAt: 1,
            updatedAt: 20,
            presetId: '',
            activeLeafId: null,
            worldlineNodes: [],
            selectedChatSessionId: null,
            selectedChatSnapshotId: null,
            draftInput: '',
            timelineItems: [],
            stagingEntries: [],
            commitReadyEntries: [],
            virtualLorebookEntries: [],
            importedLorebookId: null,
            workflowSnapshot: null,
            structuredState: { forms: {} } as any,
            draftTree: { nodes: [], lastUpdatedAt: 20 } as any,
            forgeMemoryTree: { nodes: [], lastUpdatedAt: 20 } as any,
            activeLayer: 'concept',
            completedLayers: [],
            publishState: 'drafting',
            workspaceMode: 'workspace'
        });

        const store = useSessionIndexStore();
        await store.renameForgeProject('forge_project_a', 'Renamed Project');
        await store.renameForgeThread('forge_thread_a1', 'Renamed Thread');

        expect(forgeSessionRepository.renameProject).toHaveBeenCalledWith('forge_project_a', 'Renamed Project');
        expect(forgeSessionRepository.renameThread).toHaveBeenCalledWith('forge_thread_a1', 'Renamed Thread');
    });
});
