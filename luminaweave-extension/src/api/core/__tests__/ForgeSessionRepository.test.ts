import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ForgeSessionRepository } from '../ForgeSessionRepository';
import { BridgeDispatcher } from '@shared/api/BridgeDispatcher.js';

vi.mock('../../stores/useForgeStore.js', () => ({
    useForgeStore: () => ({
        stagingArea: [],
        commitReadyEntries: []
    })
}));

const STORAGE_KEY = 'lumina-forge.workspace-sessions';

function injectMockBridge(serverStorage: Map<string, any>) {
    const bridge = {
        chat: {
            listChats: vi.fn(),
            getChat: vi.fn(),
            saveChat: vi.fn(),
            patchChat: vi.fn(),
            saveMessage: vi.fn(),
            deleteMessage: vi.fn(),
            getSyncStatus: vi.fn(),
            getTransactions: vi.fn(),
            rollbackTransaction: vi.fn()
        },
        nexus: {
            generateStream: vi.fn(),
            attachStream: vi.fn(),
            stop: vi.fn(),
            fetchModels: vi.fn(),
            getStatus: vi.fn()
        },
        forge: {
            listSessions: vi.fn(async () => ({ sessions: Array.from(serverStorage.values()) })),
            getSession: vi.fn(async (id: string) => {
                const session = serverStorage.get(id);
                if (!session) {
                    throw new Error('Not Found');
                }
                return { session };
            }),
            saveSession: vi.fn(),
            updateSession: vi.fn(async (id: string, session: any) => {
                serverStorage.set(id, session);
                return { success: true };
            })
        },
        conversation: {
            listConversations: vi.fn(async () => ({
                conversations: Array.from(serverStorage.values()).map((document: any) => document.summary)
            })),
            getConversation: vi.fn(async (id: string) => ({
                document: serverStorage.get(id) || null
            })),
            saveConversation: vi.fn(async (id: string, document: any) => {
                const saved = {
                    ...document,
                    id,
                    summary: document.summary || {
                        id,
                        schemaVersion: document.schemaVersion,
                        conversationType: document.conversationType,
                        title: document.title,
                        createdAt: document.createdAt,
                        updatedAt: document.updatedAt,
                        activeLeafId: document.activeLeafId,
                        previewMessage: '',
                        messageCount: Array.isArray(document.nodes) ? document.nodes.length : 0
                    }
                };
                serverStorage.set(id, saved);
                return { success: true, document: saved, summary: saved.summary, lastCommittedSeq: 1 };
            }),
            mutateConversation: vi.fn(),
            getTransactions: vi.fn(async () => ({ success: true, transactions: [], lastCommittedSeq: 0 })),
            rollbackTransaction: vi.fn(async () => ({ success: true, lastCommittedSeq: 0 }))
        },
        settings: {
            getSettings: vi.fn(),
            saveSettings: vi.fn()
        },
        presets: {
            listPresets: vi.fn(),
            importPreset: vi.fn(),
            exportPreset: vi.fn(),
            restoreDefaults: vi.fn()
        },
        extensionStore: {
            getJson: vi.fn(),
            setJson: vi.fn(),
            updateJson: vi.fn(),
            deleteJson: vi.fn(),
            listKeys: vi.fn(),
            setBlob: vi.fn(),
            getBlob: vi.fn()
        }
    };

    BridgeDispatcher.inject(bridge as any);
    return bridge;
}

describe('ForgeSessionRepository', () => {
    let bridge: ReturnType<typeof injectMockBridge>;
    let serverStorage: Map<string, any>;

    beforeEach(() => {
        serverStorage = new Map<string, any>();
        bridge = injectMockBridge(serverStorage);
        const storage = new Map<string, string>();
        vi.clearAllMocks();
        Object.defineProperty(globalThis, 'localStorage', {
            value: {
                getItem: (key: string) => storage.get(key) ?? null,
                setItem: (key: string, value: string) => {
                    storage.set(key, String(value));
                },
                removeItem: (key: string) => {
                    storage.delete(key);
                },
                clear: () => {
                    storage.clear();
                }
            },
            configurable: true
        });
    });

    it('应在保存后恢复 structuredState 字段值', async () => {
        const repository = new ForgeSessionRepository();

        await repository.saveSession({
            id: 'forge_ws_1',
            sessionChatId: 'lw_card_1',
            title: 'Test Workspace',
            createdAt: 100,
            updatedAt: 100,
            presetId: 'preset_1',
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
            entryMode: 'structured',
            structuredState: {
                activeFormId: 'role_core_profile',
                activeMessageFormId: null,
                lastUpdatedAt: 123,
                forms: {
                    role_core_profile: {
                        id: 'role_core_profile',
                        layer: 'concept',
                        title: '概念层',
                        lastSubmittedAt: null,
                        missingFields: [],
                        fields: {
                            name: { value: '林雾', locked: false, confirmed: true, source: 'manual', updatedAt: 1 }
                        }
                    }
                }
            },
            draftTree: { nodes: [], lastUpdatedAt: 123 },
            activeLayer: 'concept',
            completedLayers: [],
            publishState: 'drafting',
            workspaceMode: 'workspace'
        });

        const loaded = await repository.loadSession('forge_ws_1');

        expect(loaded?.structuredState?.forms.role_core_profile.fields.name.value).toBe('林雾');
        expect(Array.isArray(loaded?.draftTree?.nodes)).toBe(true);
    });

    it('应在服务端不可用时回退到本地存根', async () => {
        const repository = new ForgeSessionRepository();

        await repository.saveSession({
            id: 'forge_ws_2',
            sessionChatId: 'lw_card_2',
            title: 'Cached Workspace',
            createdAt: 200,
            updatedAt: 200,
            presetId: 'preset_1',
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
            entryMode: 'structured',
            structuredState: {
                activeFormId: 'role_core_profile',
                activeMessageFormId: null,
                lastUpdatedAt: 999,
                forms: {
                    role_core_profile: {
                        id: 'role_core_profile',
                        layer: 'concept',
                        title: '概念层',
                        lastSubmittedAt: null,
                        missingFields: [],
                        fields: {
                            identity: { value: '失忆的教会审讯官', locked: false, confirmed: true, source: 'manual', updatedAt: 2 }
                        }
                    }
                }
            },
            draftTree: { nodes: [], lastUpdatedAt: 999 },
            activeLayer: 'concept',
            completedLayers: [],
            publishState: 'drafting',
            workspaceMode: 'workspace'
        });

        bridge.conversation.getConversation.mockRejectedValueOnce(new Error('Not Found'));

        const loaded = await repository.loadSession('forge_ws_2');

        expect(loaded?.structuredState?.forms).toEqual({});
        expect(bridge.conversation.getConversation).toHaveBeenCalledWith('forge_ws_2');
    });

    it('应始终在 localStorage 中保存脱水后的存根', async () => {
        const repository = new ForgeSessionRepository();
        
        // 模拟同步失败
        bridge.conversation.saveConversation.mockRejectedValueOnce(new Error('sync failed'));

        await repository.saveSession({
            id: 'forge_ws_3',
            sessionChatId: 'lw_card_3',
            title: 'No Logs Local',
            worldlineNodes: [{ id: 'm1', content: 'hello' } as any],
            structuredState: { 
                forms: { f1: { id: 'f1' } } 
            } as any,
            workspaceMode: 'workspace'
        } as any);

        const rawSessions = JSON.parse(globalThis.localStorage.getItem(STORAGE_KEY) || '[]');
        const sessionInLocal = rawSessions.find((s: any) => s.id === 'forge_ws_3');
        
        expect(sessionInLocal.worldlineNodes).toEqual([]);
        expect(sessionInLocal.structuredState.forms).toEqual({});
        expect(sessionInLocal.workspaceMode).toBe('stub');
    });
});
