import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CharacterChannelService } from '../CharacterChannelService.js';
import type {
    CreateChatConversationInput,
    DeleteChatConversationInput,
    RenameChatConversationInput
} from '../../../types/ConversationContextTypes.js';
import type { ChatSessionRef } from '../../../types/SessionTypes.js';

const CAPABILITIES = {
    supportsCharacterRoster: true,
    supportsCreateSession: true,
    supportsRenameSession: true,
    supportsDeleteSession: true,
    supportsCloseCurrentSession: true,
    supportsNativeOpenSession: true,
    supportsHostHistory: true,
    supportsHostSearch: true,
    supportsFindLastMessage: true,
    supportsStableSessionId: true,
    supportsCurrentWindowInfo: true
};

class MockCharacterChannelApi {
    public readonly DEFAULT_AVATAR = '/default.png';
    public readonly createChatSession = vi.fn(async (input: CreateChatConversationInput) => ({
        sessionId: 'chat_created',
        title: 'chat_created',
        characterId: input.characterId == null ? null : String(input.characterId),
        characterName: input.characterName || '',
        characterAvatarUrl: input.characterAvatarUrl ?? null
    }));
    public readonly renameChatSession = vi.fn(async (input: RenameChatConversationInput) => ({
        previousSessionId: input.sessionId,
        sessionId: `${input.sessionId}_renamed`,
        title: input.nextTitle,
        characterId: input.characterId == null ? null : String(input.characterId),
        characterName: input.characterName || '',
        characterAvatarUrl: input.characterAvatarUrl ?? null
    }));
    public readonly deleteChatSession = vi.fn(async (input: DeleteChatConversationInput) => ({
        sessionId: input.sessionId,
        characterId: input.characterId == null ? null : String(input.characterId),
        characterName: input.characterName || '',
        characterAvatarUrl: input.characterAvatarUrl ?? null
    }));
    public readonly waitForReady = vi.fn(async () => false);
    public readonly getAssistantName = vi.fn(() => 'Assistant');
    public readonly getCharAvatar = vi.fn((name: string) => `/avatar/${name}.png`);
    private readonly listeners = new Map<string, Function[]>();

    on(event: string, callback: Function): void {
        const bucket = this.listeners.get(event) || [];
        bucket.push(callback);
        this.listeners.set(event, bucket);
    }
}

const createContextStore = () => {
    const order: string[] = [];
    const store = {
        chatSessions: [] as Array<ChatSessionRef & { sourceId?: 'chat' }>,
        activeSourceId: 'chat' as const,
        activeSessionId: 'session_live',
        selectedViewSessionId: null as string | null,
        currentChatSessionId: 'session_live',
        sessionSwitchState: {
            isSwitching: false,
            targetSessionId: null as string | null,
            targetCharacterName: '',
            statusText: '',
            startedAt: null as number | null
        },
        refreshFromApi: vi.fn(async () => {
            order.push('refreshFromApi');
        }),
        refreshSessionOptions: vi.fn(async () => {
            order.push('refreshSessionOptions');
        }),
        selectViewSession: vi.fn(async (id: string | null) => {
            order.push(`selectViewSession:${id === null ? 'null' : id}`);
            store.selectedViewSessionId = id;
        }),
        syncCurrentChatSelection: vi.fn(() => {
            order.push('syncCurrentChatSelection');
        }),
        beginSessionSwitch: vi.fn((payload?: { sessionId?: string | null; characterName?: string | null; statusText?: string | null }) => {
            store.sessionSwitchState = {
                ...store.sessionSwitchState,
                isSwitching: true,
                targetSessionId: payload?.sessionId ?? null,
                targetCharacterName: payload?.characterName ?? '',
                statusText: payload?.statusText ?? '',
                startedAt: Date.now()
            };
            order.push('beginSessionSwitch');
        }),
        updateSessionSwitch: vi.fn((payload?: { statusText?: string | null; sessionId?: string | null; characterName?: string | null }) => {
            store.sessionSwitchState = {
                ...store.sessionSwitchState,
                targetSessionId: payload?.sessionId ?? store.sessionSwitchState.targetSessionId,
                targetCharacterName: payload?.characterName ?? store.sessionSwitchState.targetCharacterName,
                statusText: payload?.statusText ?? store.sessionSwitchState.statusText
            };
            order.push('updateSessionSwitch');
        }),
        endSessionSwitch: vi.fn(() => {
            store.sessionSwitchState = {
                ...store.sessionSwitchState,
                isSwitching: false,
                targetSessionId: null,
                targetCharacterName: '',
                statusText: '',
                startedAt: null
            };
            order.push('endSessionSwitch');
        })
    };

    return { store, order };
};

describe('CharacterChannelService', () => {
    let sessions: ChatSessionRef[];
    let summaries: Record<string, { preview: string; updatedAt: number; messageCount: number; stableSessionId: string | null } | null>;
    let metas: Record<string, { characterId: string | null; characterName: string | null; characterAvatarUrl: string | null } | null>;
    let hostProvider: any;
    let api: MockCharacterChannelApi;
    let contextStore: ReturnType<typeof createContextStore>['store'];
    let order: string[];

    beforeEach(() => {
        sessions = [
            {
                id: 'session_live',
                title: 'Alice latest',
                source: 'lumina-server',
                createdAt: 10,
                updatedAt: 300,
                messageCount: 5,
                summary: 'server summary',
                previewMessage: 'server preview',
                activeLeafId: 'leaf_live',
                characterId: 'alice',
                characterName: 'Alice',
                characterAvatarUrl: null
            },
            {
                id: 'session_empty',
                title: 'Untitled',
                source: 'lumina-server',
                createdAt: 9,
                updatedAt: 150,
                messageCount: 0,
                summary: '',
                previewMessage: '',
                activeLeafId: null,
                characterId: null,
                characterName: '',
                characterAvatarUrl: null
            },
            {
                id: 'session_assistant',
                title: 'Assistant archived',
                source: 'lumina-server',
                createdAt: 8,
                updatedAt: 120,
                messageCount: 2,
                summary: 'assistant summary',
                previewMessage: 'assistant preview',
                activeLeafId: 'leaf_assistant',
                characterId: 'assistant-role',
                characterName: 'Assistant',
                characterAvatarUrl: '/assistant.png'
            }
        ];
        summaries = {
            session_live: {
                preview: 'Alice newest preview',
                updatedAt: 300,
                messageCount: 5,
                stableSessionId: 'stable-live'
            },
            session_empty: {
                preview: '',
                updatedAt: 150,
                messageCount: 0,
                stableSessionId: 'stable-empty'
            },
            session_assistant: {
                preview: 'Assistant should stay hidden',
                updatedAt: 120,
                messageCount: 2,
                stableSessionId: 'stable-assistant'
            }
        };
        metas = {
            session_live: {
                characterId: 'alice',
                characterName: 'Alice',
                characterAvatarUrl: '/meta/alice.png'
            },
            session_empty: {
                characterId: 'alice',
                characterName: 'Alice',
                characterAvatarUrl: '/meta/alice.png'
            },
            session_assistant: {
                characterId: 'assistant-role',
                characterName: 'Assistant',
                characterAvatarUrl: '/meta/assistant.png'
            }
        };

        hostProvider = {
            getCapabilityFlags: vi.fn(() => CAPABILITIES),
            buildSessionDescriptor: vi.fn((sessionId: string, target: Record<string, unknown> = {}) => ({
                sessionId,
                characterId: (target.characterId as string | null | undefined) ?? null,
                characterName: (target.characterName as string | null | undefined) ?? null,
                characterAvatarUrl: (target.characterAvatarUrl as string | null | undefined) ?? null
            })),
            listSessions: vi.fn(async () => sessions),
            listCharacterRoster: vi.fn(async () => ([
                {
                    characterId: 'alice',
                    characterName: 'Alice',
                    characterAvatarUrl: '/roster/alice.png'
                },
                {
                    characterId: 'bob',
                    characterName: 'Bob',
                    characterAvatarUrl: '/roster/bob.png'
                },
                {
                    characterId: 'assistant-role',
                    characterName: 'Assistant',
                    characterAvatarUrl: '/roster/assistant.png'
                }
            ])),
            resolveSessionCharacterMeta: vi.fn(async (sessionId: string) => metas[sessionId] || null),
            getSessionSummary: vi.fn(async (target: { sessionId: string }) => summaries[target.sessionId] || null),
            openSession: vi.fn(async () => true),
            closeCurrentSession: vi.fn(async () => true)
        };

        api = new MockCharacterChannelApi();
        ({ store: contextStore, order } = createContextStore());
    });

    it('builds stable character groups from roster, summary and helper-resolved session character metadata', async () => {
        const service = new CharacterChannelService(api as any, contextStore as any, hostProvider);

        await service.refresh();

        expect(service.state.value.capabilityFlags).toEqual(CAPABILITIES);
        expect(service.state.value.characterGroups).toHaveLength(2);
        expect(service.state.value.characterGroups.find((group) => group.characterName === 'Assistant')).toBeUndefined();
        expect(service.state.value.characterGroups[0]).toMatchObject({
            key: 'alice',
            characterName: 'Alice',
            characterAvatarUrl: '/roster/alice.png',
            recentPreview: 'Alice newest preview'
        });
        expect(service.state.value.characterGroups[0].sessions.map((session) => session.id)).toEqual([
            'session_live',
            'session_empty'
        ]);
        expect(service.state.value.characterGroups[0].sessions[1]).toMatchObject({
            characterId: 'alice',
            characterName: 'Alice',
            recentHistoryPreview: '暂无最近对话',
            stableSessionId: 'stable-empty'
        });
        expect(service.state.value.characterGroups[1]).toMatchObject({
            key: 'bob',
            characterName: 'Bob',
            sessions: [],
            recentPreview: '暂无历史对话'
        });
        expect(service.state.value.expandedCharacterKey).toBe('alice');
    });

    it('renames the selected session through the unified chat service and rebinds selected view state', async () => {
        contextStore.selectedViewSessionId = 'session_live';
        const service = new CharacterChannelService(api as any, contextStore as any, hostProvider);

        await service.renameSession({
            sessionId: 'session_live',
            nextTitle: 'Alice renamed',
            characterId: 'alice',
            characterName: 'Alice',
            characterAvatarUrl: '/alice.png'
        });

        expect(api.renameChatSession).toHaveBeenCalledWith({
            sessionId: 'session_live',
            nextTitle: 'Alice renamed',
            characterId: 'alice',
            characterName: 'Alice',
            characterAvatarUrl: '/alice.png'
        });
        expect(contextStore.selectViewSession).toHaveBeenCalledWith('session_live_renamed');
        expect(contextStore.refreshFromApi).toHaveBeenCalled();
        expect(service.state.value.busySessionIds).toEqual([]);
    });

    it('clears the selected view before deleting the currently active chat session', async () => {
        contextStore.activeSessionId = 'session_live';
        contextStore.selectedViewSessionId = 'session_live';
        const deleteOrderApi = vi.fn(async (input: DeleteChatConversationInput) => {
            order.push(`deleteChatSession:${input.sessionId}`);
            return {
                sessionId: input.sessionId,
                characterId: input.characterId == null ? null : String(input.characterId),
                characterName: input.characterName || '',
                characterAvatarUrl: input.characterAvatarUrl ?? null
            };
        });
        api.deleteChatSession.mockImplementation(deleteOrderApi);
        const service = new CharacterChannelService(api as any, contextStore as any, hostProvider);

        await service.deleteSession({
            sessionId: 'session_live',
            characterId: 'alice',
            characterName: 'Alice',
            characterAvatarUrl: '/alice.png'
        });

        expect(order.indexOf('selectViewSession:null')).toBeGreaterThanOrEqual(0);
        expect(order.indexOf('deleteChatSession:session_live')).toBeGreaterThan(order.indexOf('selectViewSession:null'));
        expect(contextStore.refreshSessionOptions).not.toHaveBeenCalled();
        expect(contextStore.refreshFromApi).toHaveBeenCalled();
        expect(service.state.value.busySessionIds).toEqual([]);
    });
});
