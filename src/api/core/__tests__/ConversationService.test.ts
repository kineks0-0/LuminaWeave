import { beforeEach, describe, expect, it, vi } from 'vitest';
import { LuminaWeaveAPIBase } from '../LuminaWeaveAPIBase';
import { WorldlineStore } from '../WorldlineStore';
import { ConversationService } from '../ConversationService';
import type { LuminaChatMessage } from '../../../../../shared/LuminaMessage.js';

const mockState = vi.hoisted(() => ({
    currentChatId: 'chat_live',
    persistedChats: new Map<string, { nodes: LuminaChatMessage[]; activeLeafId: string | null }>(),
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
});
