import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CharacterChannelService } from '@/api/core/conversation/CharacterChannelService.js';
import type {
    CreateChatConversationInput,
    DeleteChatConversationInput,
    DuplicateChatConversationInput,
    RenameChatConversationInput
} from '@/types/ConversationContextTypes.js';
import type { ChatSessionRef } from '@/types/SessionTypes.js';
import type { ResourceDocument } from '@shared/resources/index.js';

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
    supportsCurrentWindowInfo: true,
    supportsCharacterImport: true
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
    public readonly duplicateChatSession = vi.fn(async (input: DuplicateChatConversationInput) => ({
        previousSessionId: input.sessionId,
        sessionId: `${input.sessionId}_copy`,
        title: `${input.title || input.sessionId} 副本`,
        characterId: input.characterId == null ? null : String(input.characterId),
        characterName: input.characterName || '',
        characterAvatarUrl: input.characterAvatarUrl ?? null
    }));
    public readonly waitForReady = vi.fn(async () => false);
    public readonly syncFromST = vi.fn(async () => undefined);
    public readonly importCharacterCard = vi.fn(async (): Promise<ResourceDocument> => ({
        ref: {
            sourceId: 'local',
            resourceType: 'character',
            resourceId: 'alice',
            path: '/sources/local/characters/alice',
            writable: true
        },
        raw: {},
        summary: { id: 'alice', type: 'character', name: 'Alice', format: 'st-character' },
        capabilities: {
            readable: true,
            writable: true,
            forkable: true,
            importable: true,
            exportable: true,
            searchable: true
        }
    }));
    public readonly getAssistantName = vi.fn(() => 'Assistant');
    public readonly getCharAvatar = vi.fn((name: string) => `/avatar/${name}.png`);
    public readonly getUserAvatar = vi.fn((name?: string) => `/avatar/user/${name || 'User'}.png`);
    private readonly listeners = new Map<string, Function[]>();

    on(event: string, callback: Function): void {
        const bucket = this.listeners.get(event) || [];
        bucket.push(callback);
        this.listeners.set(event, bucket);
    }

    off(event: string, callback: Function): void {
        const bucket = this.listeners.get(event) || [];
        this.listeners.set(event, bucket.filter((listener) => listener !== callback));
    }

    emit(event: string): void {
        for (const listener of this.listeners.get(event) || []) {
            listener();
        }
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

    it('resolves message avatars through the character runtime boundary', () => {
        const service = new CharacterChannelService(api, contextStore, hostProvider);
        const resolveMessageAvatar = Reflect.get(service, 'resolveMessageAvatar');
        expect(typeof resolveMessageAvatar).toBe('function');
        if (typeof resolveMessageAvatar !== 'function') return;

        expect(resolveMessageAvatar.call(service, {
            id: 'direct',
            parentId: null,
            name: 'Alice',
            role: 'assistant',
            is_user: false,
            mesRaw: '',
            mes: '',
            fingerprint: 'direct',
            extra: {},
            avatarUrl: '/direct.png'
        })).toBe('/direct.png');
        expect(resolveMessageAvatar.call(service, {
            id: 'user',
            parentId: null,
            name: 'User',
            role: 'user',
            is_user: true,
            mesRaw: '',
            mes: '',
            fingerprint: 'user',
            extra: {}
        })).toBe('/avatar/user/User.png');
        expect(resolveMessageAvatar.call(service, {
            id: 'assistant',
            parentId: null,
            name: 'Alice',
            role: 'assistant',
            is_user: false,
            mesRaw: '',
            mes: '',
            fingerprint: 'assistant',
            extra: {}
        })).toBe('/avatar/Alice.png');

        api.getCharAvatar.mockReturnValueOnce('');
        expect(resolveMessageAvatar.call(service, {
            id: 'fallback',
            parentId: null,
            name: 'Unknown',
            role: 'assistant',
            is_user: false,
            mesRaw: '',
            mes: '',
            fingerprint: 'fallback',
            extra: {}
        })).toBe('/default.png');
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

    it('syncs the live store after the host opens a session', async () => {
        const service = new CharacterChannelService(api as any, contextStore as any, hostProvider);
        await service.refresh();

        await service.openSession('session_live');

        expect(api.syncFromST).toHaveBeenCalled();
        expect(contextStore.selectViewSession).toHaveBeenCalledWith(null);
    });

    it('marks the switching status synchronously before host I/O completes', async () => {
        let resolveOpen: (value: boolean) => void = () => {};
        hostProvider.openSession.mockImplementationOnce(() => new Promise<boolean>((resolve) => {
            resolveOpen = resolve;
        }));
        const service = new CharacterChannelService(api as any, contextStore as any, hostProvider);
        await service.refresh();

        const pending = service.openSession('session_live');

        expect(service.state.value.status).toMatchObject({
            kind: 'switching',
            sessionId: 'session_live',
            characterName: 'Alice'
        });

        resolveOpen(true);
        await pending;
    });

    it('imports a character card and refreshes the roster', async () => {
        const service = new CharacterChannelService(api as any, contextStore as any, hostProvider);
        const refresh = vi.spyOn(service, 'refresh').mockResolvedValue();

        await service.importCharacterCard(new File(['{}'], 'hero.json', { type: 'application/json' }));

        expect(api.importCharacterCard).toHaveBeenCalledTimes(1);
        expect(refresh).toHaveBeenCalled();
    });

    it('records an error status when character import fails', async () => {
        const service = new CharacterChannelService(api as any, contextStore as any, hostProvider);
        api.importCharacterCard.mockRejectedValueOnce(new Error('bad card'));

        await service.importCharacterCard(new File(['x'], 'hero.png', { type: 'image/png' }));

        expect(service.state.value.status).toMatchObject({
            kind: 'error',
            text: '角色导入失败',
            error: 'bad card'
        });
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

    it('duplicates a session through the unified chat service and refreshes the session options', async () => {
        const service = new CharacterChannelService(api as any, contextStore as any, hostProvider);

        await service.duplicateSession({
            sessionId: 'session_live',
            title: 'Alice latest',
            characterId: 'alice',
            characterName: 'Alice',
            characterAvatarUrl: '/alice.png'
        });

        expect(api.duplicateChatSession).toHaveBeenCalledWith({
            sessionId: 'session_live',
            title: 'Alice latest',
            characterId: 'alice',
            characterName: 'Alice',
            characterAvatarUrl: '/alice.png'
        });
        expect(contextStore.refreshSessionOptions).toHaveBeenCalled();
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

    it('unsubscribes runtime events when disposed', () => {
        const service = new CharacterChannelService(api as any, contextStore as any, hostProvider);
        const refresh = vi.spyOn(service, 'refresh').mockResolvedValue();

        api.emit('CHAT_CHANGED');
        expect(refresh).toHaveBeenCalledTimes(1);

        service.dispose();
        api.emit('CHAT_CHANGED');

        expect(refresh).toHaveBeenCalledTimes(1);
    });
});
