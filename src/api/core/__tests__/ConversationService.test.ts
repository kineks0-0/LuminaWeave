import { beforeEach, describe, expect, it, vi } from 'vitest';
import { LuminaWeaveAPIBase } from '../LuminaWeaveAPIBase';
import { WorldlineStore } from '../WorldlineStore';
import { ConversationService } from '../ConversationService';
import type { LuminaChatMessage } from '@shared/LuminaMessage.js';
import { STClient } from '../st-adapter/STClient';
import { BridgeDispatcher } from '@shared/api/BridgeDispatcher.js';

const mockState = vi.hoisted(() => ({
    currentChatId: 'chat_live',
    persistedChats: new Map<string, { nodes: LuminaChatMessage[]; activeLeafId: string | null }>(),
    savedConversationDocuments: new Map<string, any>(),
    chatSessions: [] as any[],
    forgeSessions: [] as any[],
    forgeSessionMap: new Map<string, any>(),
    forgeStore: {
        workspaceSessionId: 'forge_live',
        sessionChatId: 'lw_card_live',
        workspaceTitle: 'Live Forge',
        selectedChatSessionId: 'chat_live',
        selectedChatSnapshotId: null,
        activeLeafId: 'forge_leaf',
        timelineGraph: {} as Record<string, any>,
        messages: [] as LuminaChatMessage[],
        messageCount: 0,
        timelineRevision: 0,
        workspaceUpdatedAt: 0,
        openWorkspaceSession: vi.fn(async (id: string) => {
            const session = mockState.forgeSessionMap.get(id);
            if (!session) return false;
            mockState.forgeStore.workspaceSessionId = session.id;
            mockState.forgeStore.workspaceTitle = session.title;
            mockState.forgeStore.selectedChatSessionId = session.selectedChatSessionId || null;
            mockState.forgeStore.selectedChatSnapshotId = session.selectedChatSnapshotId || null;
            mockState.forgeStore.activeLeafId = session.activeLeafId;
            mockState.forgeStore.messages = session.worldlineNodes;
            mockState.forgeStore.timelineGraph = session.worldlineNodes.reduce((acc: Record<string, any>, node: LuminaChatMessage) => {
                acc[node.id] = {
                    ...node,
                    text: node.mes || node.mesRaw || '',
                    timestamp: node.createdAt || Date.now()
                };
                return acc;
            }, {});
            mockState.forgeStore.messageCount = session.worldlineNodes.length;
            mockState.forgeStore.timelineRevision += 1;
            return true;
        }),
        switchToNode: vi.fn((targetNodeId: string) => {
            mockState.forgeStore.activeLeafId = targetNodeId;
        }),
        branchFromNode: vi.fn(async (targetNodeId: string) => {
            mockState.forgeStore.activeLeafId = targetNodeId;
            return true;
        }),
        rollbackFromNode: vi.fn(async (targetNodeId: string) => {
            mockState.forgeStore.activeLeafId = targetNodeId;
            return true;
        }),
        getWorldlineStore: vi.fn()
    }
}));

vi.mock('../../storage.js', () => ({
    lwStorage: {
        _getContextIds: vi.fn(() => ({ chatId: mockState.currentChatId })),
        get: vi.fn((_: string, def: unknown) => def),
        set: vi.fn(),
        on: vi.fn()
    }
}));

vi.mock('../ChatSessionIndexService.js', () => ({
    buildTitleAndSummary: (chatId: string, previewMessage: string) => ({
        title: previewMessage ? previewMessage.slice(0, 22) : `聊天 ${chatId.slice(0, 10)}`,
        summary: previewMessage || '暂无预览内容'
    }),
    chatSessionIndexService: {
        listChatSessions: vi.fn(async () => mockState.chatSessions)
    }
}));

vi.mock('../../../plugins/forge/CardMakerStore.js', () => ({
    useCardMakerStore: () => mockState.forgeStore
}));

vi.mock('../ForgeSessionRepository.js', () => ({
    forgeSessionRepository: {
        refreshFromServer: vi.fn(async () => undefined),
        listSessions: vi.fn(() => mockState.forgeSessions),
        loadSession: vi.fn(async (id: string) => mockState.forgeSessionMap.get(id) || null)
    }
}));

vi.mock('../PersistenceService', () => ({
    PersistenceService: vi.fn(function (store: WorldlineStore) {
        return {
            loadFromIndependentChat: vi.fn(async (chatId: string) => {
                const snapshot = mockState.persistedChats.get(chatId);
                store.setNodes(snapshot?.nodes.map((node) => ({ ...node })) || []);
                store.activeLeafId = snapshot?.activeLeafId || null;
                return true;
            }),
            saveToIndependentChat: vi.fn(async (chatId: string) => {
                mockState.persistedChats.set(chatId, {
                    nodes: store.nodePool.map((node) => ({ ...node })),
                    activeLeafId: store.activeLeafId
                });
                return true;
            })
        };
    })
}));

vi.mock('../STAdapter.js', () => ({
    STAdapter: {
        getSnapshot: vi.fn(async () => ({
            lumina: [],
            st: [],
            idToIndex: new Map<string, number>()
        }))
    }
}));

vi.mock('@shared/api/BridgeDispatcher.js', () => ({
    BridgeDispatcher: {
        conversation: {
            getConversation: vi.fn(async (id: string) => ({
                document: mockState.savedConversationDocuments.get(id) || null
            })),
            saveConversation: vi.fn(async (id: string, document: any) => {
                mockState.savedConversationDocuments.set(id, document);
                mockState.chatSessions = [
                    {
                        id,
                        title: document.title,
                        source: 'lumina-server',
                        createdAt: document.createdAt,
                        updatedAt: document.updatedAt,
                        messageCount: document.summary?.messageCount ?? 0,
                        summary: document.summary?.previewMessage || '暂无预览内容',
                        previewMessage: document.summary?.previewMessage || '',
                        activeLeafId: document.activeLeafId,
                        characterId: document.pluginState?.chat?.characterId ?? null,
                        characterName: document.pluginState?.chat?.characterName || '',
                        characterAvatarUrl: document.pluginState?.chat?.characterAvatarUrl ?? null
                    },
                    ...mockState.chatSessions.filter((session) => session.id !== id)
                ];
                return {
                    success: true,
                    document,
                    summary: {
                        id,
                        schemaVersion: document.schemaVersion,
                        conversationType: document.conversationType,
                        title: document.title,
                        createdAt: document.createdAt,
                        updatedAt: document.updatedAt,
                        activeLeafId: document.activeLeafId,
                        previewMessage: document.summary?.previewMessage || '',
                        messageCount: document.summary?.messageCount ?? 0,
                        characterId: document.pluginState?.chat?.characterId ?? null,
                        characterName: document.pluginState?.chat?.characterName || '',
                        characterAvatarUrl: document.pluginState?.chat?.characterAvatarUrl ?? null
                    },
                    lastCommittedSeq: 0
                };
            }),
            deleteConversation: vi.fn(async (id: string) => {
                mockState.savedConversationDocuments.delete(id);
                mockState.chatSessions = mockState.chatSessions.filter((session) => session.id !== id);
                return {
                    success: true,
                    id
                };
            })
        }
    }
}));

const createMessage = (
    id: string,
    parentId: string | null,
    mesRaw: string,
    extra: Record<string, any> = {}
): LuminaChatMessage => ({
    id,
    parentId,
    name: 'Assistant',
    role: 'assistant',
    mesRaw,
    mes: mesRaw,
    fingerprint: `fp_${id}`,
    extra,
    createdAt: extra.send_date || Date.now()
});

class MockApi extends LuminaWeaveAPIBase {
    public chatManager: {
        store: WorldlineStore;
        activeLeafId: string | null;
        persistence: any;
        branchFromNode: ReturnType<typeof vi.fn>;
        rollbackFromNode: ReturnType<typeof vi.fn>;
    };
    public syncFromST = vi.fn(async () => undefined);
    public beginControlledChatCreation = vi.fn(() => undefined);
    public markControlledChatCreationFinalChat = vi.fn(() => undefined);
    public flushDeferredPromptWorldInfoSync = vi.fn(async () => undefined);
    public endControlledChatCreation = vi.fn(() => undefined);

    constructor(store: WorldlineStore) {
        super();
        this.chatManager = {
            store,
            get activeLeafId() {
                return store.activeLeafId;
            },
            set activeLeafId(value: string | null) {
                store.activeLeafId = value;
            },
            persistence: {},
            branchFromNode: vi.fn(async (targetNodeId: string) => {
                store.activeLeafId = targetNodeId;
                return true;
            }),
            rollbackFromNode: vi.fn(async (targetNodeId: string) => {
                const trace = store.getTrace(store.activeLeafId);
                const targetIndex = trace.findIndex((node) => node.id === targetNodeId);
                trace.slice(targetIndex + 1).forEach((node) => store.removeNode(node.id, true));
                store.activeLeafId = targetNodeId;
                return true;
            })
        };
    }

}

describe('ConversationService', () => {
    let api: MockApi;
    let service: ConversationService;

    beforeEach(() => {
        vi.clearAllMocks();
        mockState.currentChatId = 'chat_live';
        mockState.persistedChats.clear();
        mockState.savedConversationDocuments.clear();
        mockState.chatSessions = [
            {
                id: 'chat_live',
                title: 'Live Chat',
                source: 'lumina-server',
                createdAt: 1,
                updatedAt: 2,
                messageCount: 2,
                summary: 'live',
                previewMessage: 'live',
                activeLeafId: 'chat_live_leaf'
            },
            {
                id: 'chat_archive',
                title: 'Archived Chat',
                source: 'lumina-server',
                createdAt: 3,
                updatedAt: 4,
                messageCount: 2,
                summary: 'archive',
                previewMessage: 'archive',
                activeLeafId: 'chat_archive_leaf'
            }
        ];
        mockState.forgeSessions = [
            {
                id: 'forge_live',
                title: 'Live Forge',
                createdAt: 10,
                updatedAt: 11,
                messageCount: 1,
                selectedChatSessionId: 'chat_live'
            },
            {
                id: 'forge_alt',
                title: 'Alt Forge',
                createdAt: 12,
                updatedAt: 13,
                messageCount: 2,
                selectedChatSessionId: 'chat_archive'
            }
        ];
        mockState.forgeSessionMap = new Map<string, any>([
            ['forge_alt', {
                id: 'forge_alt',
                title: 'Alt Forge',
                activeLeafId: 'forge_alt_leaf',
                selectedChatSessionId: 'chat_archive',
                selectedChatSnapshotId: null,
                worldlineNodes: [
                    createMessage('forge_alt_root', null, 'Forge Root'),
                    createMessage('forge_alt_leaf', 'forge_alt_root', 'Forge Leaf')
                ]
            }]
        ]);

        const liveChatStore = new WorldlineStore();
        liveChatStore.setNodes([
            createMessage('chat_live_root', null, 'Live Root'),
            createMessage('chat_live_leaf', 'chat_live_root', 'Live Leaf')
        ]);
        liveChatStore.activeLeafId = 'chat_live_leaf';

        const liveForgeStore = new WorldlineStore();
        liveForgeStore.setNodes([
            createMessage('forge_root', null, 'Forge Root'),
            createMessage('forge_leaf', 'forge_root', 'Forge Leaf')
        ]);
        liveForgeStore.activeLeafId = 'forge_leaf';
        mockState.forgeStore.workspaceSessionId = 'forge_live';
        mockState.forgeStore.workspaceTitle = 'Live Forge';
        mockState.forgeStore.selectedChatSessionId = 'chat_live';
        mockState.forgeStore.selectedChatSnapshotId = null;
        mockState.forgeStore.activeLeafId = 'forge_leaf';
        mockState.forgeStore.messages = liveForgeStore.getTrace(liveForgeStore.activeLeafId);
        mockState.forgeStore.timelineGraph = liveForgeStore.nodePool.reduce<Record<string, any>>((acc, node) => {
            acc[node.id] = {
                ...node,
                text: node.mes || node.mesRaw || '',
                timestamp: node.createdAt || Date.now()
            };
            return acc;
        }, {});
        mockState.forgeStore.messageCount = liveForgeStore.nodePool.length;
        mockState.forgeStore.getWorldlineStore.mockReturnValue(liveForgeStore);

        mockState.persistedChats.set('chat_archive', {
            nodes: [
                createMessage('chat_archive_root', null, 'Archive Root'),
                createMessage('chat_archive_leaf', 'chat_archive_root', 'Archive Leaf')
            ],
            activeLeafId: 'chat_archive_leaf'
        });

        api = new MockApi(liveChatStore);
        service = new ConversationService(api as any);
    });

    it('returns live and archived chat contexts through one API', async () => {
        const sources = await service.listConversationSources();
        expect(sources.map((source) => source.id)).toEqual(['chat', 'forge']);
        expect(sources.find((source) => source.id === 'chat')?.sessionId).toBe('chat_live');

        const liveContext = await service.getConversationContext();
        expect(liveContext.source).toBe('chat');
        expect(liveContext.sessionId).toBe('chat_live');
        expect(liveContext.activeLeafId).toBe('chat_live_leaf');
        expect(liveContext.messages.map((message) => message.id)).toEqual(['chat_live_root', 'chat_live_leaf']);
        expect(liveContext.meta?.isLive).toBe(true);

        const archivedContext = await service.getConversationContext({
            sourceId: 'chat',
            sessionId: 'chat_archive'
        });
        expect(archivedContext.sessionId).toBe('chat_archive');
        expect(archivedContext.messages.map((message) => message.id)).toEqual(['chat_archive_root', 'chat_archive_leaf']);
        expect(archivedContext.meta?.isLive).toBe(false);
    });

    it('switches forge context through the forge adapter', async () => {
        const context = await service.switchConversationContext({
            sourceId: 'forge',
            sessionId: 'forge_alt'
        });

        expect(mockState.forgeStore.openWorkspaceSession).toHaveBeenCalledWith('forge_alt');
        expect(context.source).toBe('forge');
        expect(context.sessionId).toBe('forge_alt');
        expect(context.activeLeafId).toBe('forge_alt_leaf');
        expect(context.meta?.workspaceTitle).toBe('Alt Forge');
        expect(context.meta?.selectedChatSessionId).toBe('chat_archive');
    });

    it('branches and rolls back archived chat sessions without touching live ST sync', async () => {
        await service.switchConversationContext({
            sourceId: 'chat',
            sessionId: 'chat_archive'
        });

        const switched = vi.fn();
        const rolledBack = vi.fn();
        service.on('CONVERSATION_WORLDLINE_SWITCHED', switched);
        service.on('CONVERSATION_WORLDLINE_ROLLED_BACK', rolledBack);

        const branchResult = await service.branchConversationNode({ targetNodeId: 'chat_archive_root' });
        expect(branchResult).toBe(true);
        expect(api.chatManager.branchFromNode).not.toHaveBeenCalled();
        expect(mockState.persistedChats.get('chat_archive')?.activeLeafId).toBe('chat_archive_root');
        expect(switched).toHaveBeenCalled();

        await service.switchConversationNode({ targetNodeId: 'chat_archive_leaf' });
        const rollbackResult = await service.rollbackConversationNode({ targetNodeId: 'chat_archive_root' });
        expect(rollbackResult).toBe(true);
        expect(api.chatManager.rollbackFromNode).not.toHaveBeenCalled();
        expect(mockState.persistedChats.get('chat_archive')?.nodes.map((node) => node.id)).toEqual(['chat_archive_root']);
        expect(rolledBack).toHaveBeenCalled();
    });

    it('treats default and undefined live chat ids as non-live while keeping archived sessions readable', async () => {
        mockState.currentChatId = 'default';

        const liveContext = await service.getConversationContext();
        expect(liveContext.sessionId).toBeNull();
        expect(liveContext.meta?.currentChatSessionId).toBeNull();
        expect(liveContext.meta?.isLive).toBe(false);

        const archivedContext = await service.getConversationContext({
            sourceId: 'chat',
            sessionId: 'chat_archive'
        });
        expect(archivedContext.sessionId).toBe('chat_archive');
        expect(archivedContext.meta?.isLive).toBe(false);

        mockState.currentChatId = undefined as unknown as string;
        const fallbackContext = await service.getConversationContext({
            sourceId: 'chat',
            sessionId: 'chat_archive'
        });
        expect(fallbackContext.sessionId).toBe('chat_archive');
        expect(fallbackContext.meta?.currentChatSessionId).toBeNull();
    });

    it('creates a new chat session and persists an empty conversation document immediately', async () => {
        vi.spyOn(STClient, 'createNewCharacterChat').mockResolvedValue({
            success: true,
            resolvedCharacterId: '1',
            resolvedCharacterName: 'Beta',
            resolvedCharacterAvatarUrl: '/thumbnail/avatar/beta.png',
            resolvedChatFile: 'chat_beta_new'
        });

        const sessionsUpdated = vi.fn();
        service.on('CONVERSATION_SESSIONS_UPDATED', sessionsUpdated);

        const result = await service.createChatSession({
            characterId: '1',
            characterName: 'Beta',
            characterAvatarUrl: '/thumbnail/avatar/beta.png'
        });

        expect(result).toEqual({
            sessionId: 'chat_beta_new',
            title: '聊天 chat_beta_',
            characterId: '1',
            characterName: 'Beta',
            characterAvatarUrl: '/thumbnail/avatar/beta.png'
        });

        const saved = mockState.savedConversationDocuments.get('chat_beta_new');
        expect(saved).toBeTruthy();
        expect(saved.conversationType).toBe('chat');
        expect(saved.nodes).toEqual([]);
        expect(saved.pluginState.chat).toEqual({
            characterId: '1',
            characterName: 'Beta',
            characterAvatarUrl: '/thumbnail/avatar/beta.png'
        });
        expect(mockState.chatSessions[0]).toMatchObject({
            id: 'chat_beta_new',
            source: 'lumina-server',
            characterId: '1',
            characterName: 'Beta'
        });
        expect(api.beginControlledChatCreation).toHaveBeenCalledWith('1');
        expect(api.markControlledChatCreationFinalChat).toHaveBeenCalledWith('chat_beta_new');
        expect(api.syncFromST).toHaveBeenCalledTimes(1);
        expect(api.flushDeferredPromptWorldInfoSync).toHaveBeenCalledWith('createChatSession');
        expect(api.endControlledChatCreation).toHaveBeenCalledWith(true);
        expect(sessionsUpdated).toHaveBeenCalledTimes(1);
    });

    it('does not persist an empty conversation document when host chat creation fails', async () => {
        vi.spyOn(STClient, 'createNewCharacterChat').mockResolvedValue({
            success: false,
            resolvedCharacterId: '1',
            resolvedCharacterName: 'Beta',
            resolvedCharacterAvatarUrl: '/thumbnail/avatar/beta.png',
            resolvedChatFile: null,
            reason: 'character_switch_failed'
        });

        await expect(service.createChatSession({
            characterId: '1',
            characterName: 'Beta',
            characterAvatarUrl: '/thumbnail/avatar/beta.png'
        })).rejects.toThrow('character_switch_failed');

        expect(mockState.savedConversationDocuments.size).toBe(0);
        expect(mockState.chatSessions.some((session) => session.id === 'chat_beta_new')).toBe(false);
        expect(api.beginControlledChatCreation).toHaveBeenCalledWith('1');
        expect(api.syncFromST).not.toHaveBeenCalled();
        expect(api.endControlledChatCreation).toHaveBeenCalledWith(false);
        expect(service['contextSelection']).toEqual({
            sourceId: 'chat',
            sessionId: null
        });
    });

    it('renames a chat session and migrates the unified conversation document to the new session id', async () => {
        mockState.savedConversationDocuments.set('chat_archive', {
            id: 'chat_archive',
            schemaVersion: 1,
            conversationType: 'chat',
            title: 'Archived Chat',
            createdAt: 3,
            updatedAt: 4,
            activeLeafId: 'chat_archive_leaf',
            nodes: [],
            pluginState: {
                chat: {
                    characterId: '1',
                    characterName: 'Beta',
                    characterAvatarUrl: '/thumbnail/avatar/beta.png'
                }
            },
            transaction: {
                lastCommittedSeq: 0,
                lastTransactionId: null
            },
            summary: {
                previewMessage: '',
                messageCount: 0
            }
        });
        vi.spyOn(STClient, 'renameCharacterChat').mockResolvedValue({
            success: true,
            previousChatFile: 'chat_archive',
            resolvedCharacterId: '1',
            resolvedCharacterName: 'Beta',
            resolvedCharacterAvatarUrl: '/thumbnail/avatar/beta.png',
            resolvedChatFile: 'Renamed Archive'
        });

        await service.switchConversationContext({
            sourceId: 'chat',
            sessionId: 'chat_archive'
        });

        const result = await service.renameChatSession({
            sessionId: 'chat_archive',
            nextTitle: 'Renamed Archive',
            characterId: '1',
            characterName: 'Beta',
            characterAvatarUrl: '/thumbnail/avatar/beta.png'
        });

        expect(result).toEqual({
            previousSessionId: 'chat_archive',
            sessionId: 'Renamed Archive',
            title: 'Renamed Archive',
            characterId: '1',
            characterName: 'Beta',
            characterAvatarUrl: '/thumbnail/avatar/beta.png'
        });
        expect(mockState.savedConversationDocuments.has('chat_archive')).toBe(false);
        expect(mockState.savedConversationDocuments.get('Renamed Archive')).toMatchObject({
            id: 'Renamed Archive',
            title: 'Renamed Archive'
        });
        expect(service['contextSelection']).toEqual({
            sourceId: 'chat',
            sessionId: 'Renamed Archive'
        });
    });

    it('deletes the current archived chat session and falls back to the default live chat context', async () => {
        vi.spyOn(STClient, 'deleteCharacterChat').mockResolvedValue({
            success: true,
            resolvedCharacterId: '1',
            resolvedCharacterName: 'Beta',
            resolvedCharacterAvatarUrl: '/thumbnail/avatar/beta.png',
            resolvedChatFile: 'chat_archive'
        });

        await service.switchConversationContext({
            sourceId: 'chat',
            sessionId: 'chat_archive'
        });

        const result = await service.deleteChatSession({
            sessionId: 'chat_archive',
            characterId: '1',
            characterName: 'Beta',
            characterAvatarUrl: '/thumbnail/avatar/beta.png'
        });

        expect(result).toEqual({
            sessionId: 'chat_archive',
            characterId: '1',
            characterName: 'Beta',
            characterAvatarUrl: '/thumbnail/avatar/beta.png'
        });
        expect(mockState.chatSessions.some((session) => session.id === 'chat_archive')).toBe(false);
        expect(service['contextSelection']).toEqual({
            sourceId: 'chat',
            sessionId: null
        });

        const liveContext = await service.getConversationContext();
        expect(liveContext.sessionId).toBe('chat_live');
        expect(liveContext.meta?.isLive).toBe(true);
    });

    it('treats missing unified conversation documents as an idempotent success when deleting a chat session', async () => {
        vi.spyOn(STClient, 'deleteCharacterChat').mockResolvedValue({
            success: true,
            resolvedCharacterId: '1',
            resolvedCharacterName: 'Beta',
            resolvedCharacterAvatarUrl: '/thumbnail/avatar/beta.png',
            resolvedChatFile: 'chat_archive'
        });
        vi.mocked(BridgeDispatcher.conversation.deleteConversation).mockRejectedValueOnce(
            new Error('Failed to delete chat default_Seraphina/Seraphina - 2026-04-19@17h28m44s049ms: Not found: Chat not found: default_Seraphina/Seraphina - 2026-04-19@17h28m44s049ms')
        );

        const result = await service.deleteChatSession({
            sessionId: 'chat_archive',
            characterId: '1',
            characterName: 'Beta',
            characterAvatarUrl: '/thumbnail/avatar/beta.png'
        });

        expect(result).toEqual({
            sessionId: 'chat_archive',
            characterId: '1',
            characterName: 'Beta',
            characterAvatarUrl: '/thumbnail/avatar/beta.png'
        });
    });
});
