import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { initMockHAL } from '@/api/core/__tests__/support/halMock.js';
import { ForgeSessionRepository } from '@/api/core/forge/project/ForgeSessionRepository.js';
import { shellWorkspaceService } from '@/api/core/hal/shell/ShellWorkspaceService.js';

vi.mock('@/stores/useForgeStore.js', () => ({
    useForgeStore: () => ({
        stagingArea: [],
        commitReadyEntries: []
    })
}));

function injectMockBridge(serverStorage: Map<string, any>) {
    const runtimeStore = new Map<string, unknown>();
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
            rollbackTransaction: vi.fn(async () => ({ success: true, lastCommittedSeq: 0 })),
            deleteConversation: vi.fn(async (id: string) => {
                serverStorage.delete(id);
                return { success: true, id };
            })
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
            getJson: vi.fn(async ({ key }: { key: string }) => runtimeStore.get(key) ?? null),
            setJson: vi.fn(async ({ key, value }: { key: string; value: unknown }) => {
                runtimeStore.set(key, value);
            }),
            updateJson: vi.fn(async ({ key, value }: { key: string; value: unknown }) => {
                runtimeStore.set(key, value);
            }),
            deleteJson: vi.fn(async ({ key }: { key: string }) => {
                runtimeStore.delete(key);
            }),
            listKeys: vi.fn(async () => Array.from(runtimeStore.keys())),
            setBlob: vi.fn(),
            getBlob: vi.fn()
        }
    };

    initMockHAL({ runtime: { conversation: bridge.conversation, generation: bridge.nexus, settings: bridge.settings, presets: bridge.presets, extensionStore: bridge.extensionStore } });
    return { ...bridge, runtimeStore };
}

describe('ForgeSessionRepository', () => {
    let bridge: ReturnType<typeof injectMockBridge>;
    let serverStorage: Map<string, any>;

    beforeEach(() => {
        setActivePinia(createPinia());
        shellWorkspaceService.resetForTests({ clearStorage: true });
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
                submitConfigs: {},
                submittedScopes: {},
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
                submitConfigs: {},
                submittedScopes: {},
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

        expect(loaded?.structuredState?.forms.role_core_profile.fields.identity.value).toBe('失忆的教会审讯官');
        expect(bridge.conversation.getConversation).toHaveBeenCalledWith('forge_ws_2');
    });

    it('应始终在存储索引中保存脱水后的存根', async () => {
        const repository = new ForgeSessionRepository();

        // 模拟同步失败
        bridge.conversation.saveConversation.mockRejectedValueOnce(new Error('sync failed'));

        await repository.saveSession({
            id: 'forge_ws_3',
            sessionChatId: 'lw_card_3',
            title: 'No Logs Local',
            worldlineNodes: [{ id: 'm1', content: 'hello' } as any],
            piSession: {
                sessionId: 'forge_ws_3__lw_card_3',
                activeNodeId: 'tool_result_1',
                entries: [{
                    id: 'tool_result_1',
                    sessionId: 'forge_ws_3__lw_card_3',
                    parentId: null,
                    kind: 'tool_result',
                    title: 'Tool result',
                    summary: 'large payload',
                    createdAt: 1,
                    payload: {
                        toolCallId: 'tool_1',
                        toolName: 'write',
                        result: {
                            content: 'x'.repeat(4096)
                        }
                    }
                }],
                contextBundleSummary: null,
                loadedExtensions: [],
                version: 1
            },
            structuredState: {
                forms: { f1: { id: 'f1' } }
            } as any,
            workspaceMode: 'workspace'
        } as any);

        const rawSessions = (bridge.runtimeStore.get('sessions') as any[]) ?? [];
        const sessionInLocal = rawSessions.find((s: any) => s.id === 'forge_ws_3');

        expect(sessionInLocal.worldlineNodes).toEqual([]);
        expect(sessionInLocal.piSession).toBeUndefined();
        expect(sessionInLocal.structuredState.forms).toEqual({});
        expect(sessionInLocal.workspaceMode).toBe('stub');
        expect(bridge.extensionStore.setJson).toHaveBeenCalledWith(expect.objectContaining({
            namespace: 'lumina.forge',
            table: 'pi-sessions',
            key: 'forge_ws_3',
            value: expect.objectContaining({
                sessionId: 'forge_ws_3__lw_card_3',
                entries: [expect.objectContaining({
                    kind: 'tool_result',
                    payload: expect.objectContaining({
                        result: expect.objectContaining({
                            content: expect.stringContaining('x')
                        })
                    })
                })]
            })
        }));

        const loaded = await repository.loadSession('forge_ws_3');

        expect(loaded?.piSession?.activeNodeId).toBe('tool_result_1');
        expect(loaded?.piSession?.entries[0]?.payload).toMatchObject({
            result: {
                content: 'x'.repeat(4096)
            }
        });
    });

    it('应把 Forge 会话保存为项目级 workspace 绑定', async () => {
        const repository = new ForgeSessionRepository();

        await repository.saveSession({
            id: 'forge_ws_project',
            sessionChatId: 'lw_card_conversation',
            title: 'Project Workspace',
            createdAt: 300,
            updatedAt: 300,
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
            structuredState: { forms: {} } as any,
            draftTree: { nodes: [], lastUpdatedAt: 300 } as any,
            forgeMemoryTree: { nodes: [], lastUpdatedAt: 300 } as any,
            activeLayer: 'concept',
            completedLayers: [],
            publishState: 'drafting',
            workspaceMode: 'workspace'
        });

        const saved = serverStorage.get('forge_ws_project');
        expect(saved.pluginState.forge).toMatchObject({
            forgeProjectId: 'forge_ws_project',
            conversationId: 'lw_card_conversation',
            workspacePath: '/workspaces/forge/forge_ws_project/chat/lw_card_conversation',
            sessionChatId: 'lw_card_conversation'
        });
        expect(bridge.extensionStore.setJson).toHaveBeenCalledWith(expect.objectContaining({
            namespace: 'lumina.resource-runtime',
            table: 'shell-workspaces',
            key: 'forge-project-bindings.v1',
            value: expect.objectContaining({
                bindings: expect.objectContaining({
                    lw_card_conversation: expect.objectContaining({
                        forgeProjectId: 'forge_ws_project',
                        workspacePath: '/workspaces/forge/forge_ws_project/chat/lw_card_conversation'
                    })
                })
            })
        }));
        const fs = await shellWorkspaceService.getFileSystem({ projectId: 'forge_ws_project' });
        await expect(fs.readFile('/forge/forge_ws_project/project.json')).resolves.toContain('"title": "Project Workspace"');
        await expect(fs.stat('/forge/forge_ws_project/chat/lw_card_conversation')).resolves.toMatchObject({ isDirectory: true });
        await expect(fs.readFile('/chat/lw_card_conversation/thread.json')).resolves.toContain('"title": "Project Workspace"');
        await expect(fs.readFile('/chat/lw_card_conversation/messages.json')).resolves.toContain('[]');
        await expect(fs.readFile('/forge/forge_ws_project/chat/lw_card_conversation/thread.json')).resolves.toContain('"workspaceSessionId": "forge_ws_project"');
        await expect(fs.readFile('/forge/forge_ws_project/chat/lw_card_conversation/messages.json')).resolves.toContain('[]');
        await expect(fs.readFile('/forge/forge_ws_project/drafts/tree.json')).resolves.toContain('"nodes": []');
        await expect(fs.readFile('/forge/forge_ws_project/review/staging.json')).resolves.toContain('"stagingEntries": []');
    });

    it('列表引用应暴露项目与协作线程标识', async () => {
        const repository = new ForgeSessionRepository();

        await repository.saveSession({
            id: 'forge_ws_thread_ref',
            forgeProjectId: 'forge_project_ref',
            conversationId: 'conversation_ref',
            workspacePath: '/workspaces/forge/forge_project_ref',
            sessionChatId: 'conversation_ref',
            title: 'Thread Ref',
            createdAt: 400,
            updatedAt: 500,
            presetId: 'preset_1',
            activeLeafId: 'leaf_ref',
            worldlineNodes: [{ id: 'leaf_ref', mes: 'hello' } as any],
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
            draftTree: { nodes: [], lastUpdatedAt: 500 } as any,
            forgeMemoryTree: { nodes: [], lastUpdatedAt: 500 } as any,
            activeLayer: 'concept',
            completedLayers: [],
            publishState: 'drafting',
            workspaceMode: 'workspace'
        });

        const refs = await repository.listSessions();

        expect(refs[0]).toMatchObject({
            id: 'forge_ws_thread_ref',
            forgeProjectId: 'forge_project_ref',
            conversationId: 'conversation_ref',
            sessionChatId: 'conversation_ref',
            workspacePath: '/workspaces/forge/forge_project_ref/chat/conversation_ref',
            activeLeafId: 'leaf_ref'
        });
    });

    it('应在既有项目下创建新的协作线程并继承项目资源', async () => {
        const repository = new ForgeSessionRepository();

        await repository.createSession({
            id: 'forge_thread_seed',
            forgeProjectId: 'forge_project_threadable',
            conversationId: 'conversation_seed',
            sessionChatId: 'conversation_seed',
            title: 'Threadable Project',
            structuredState: {
                activeFormId: 'role_core_profile',
                activeMessageFormId: null,
                submitConfigs: {},
                submittedScopes: {},
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
            } as any
        });

        const created = await repository.createThread('forge_project_threadable', {
            id: 'forge_thread_new',
            conversationId: 'conversation_new',
            sessionChatId: 'conversation_new',
            title: '第二协作线程'
        });

        expect(created).toMatchObject({
            id: 'forge_thread_new',
            forgeProjectId: 'forge_project_threadable',
            conversationId: 'conversation_new',
            workspacePath: '/workspaces/forge/forge_project_threadable/chat/conversation_new',
            title: '第二协作线程'
        });
        expect(created.structuredState?.forms.role_core_profile.fields.name.value).toBe('林雾');
        expect((await repository.listSessions()).filter(ref => ref.forgeProjectId === 'forge_project_threadable').map(ref => ref.id))
            .toEqual(['forge_thread_new', 'forge_thread_seed']);
    });

    it('删除协作线程时不应删除同项目的资源与其他线程', async () => {
        const repository = new ForgeSessionRepository();

        await repository.createSession({
            id: 'forge_thread_delete_a',
            forgeProjectId: 'forge_project_keep_resources',
            conversationId: 'conversation_delete_a',
            sessionChatId: 'conversation_delete_a',
            title: 'Thread A'
        });
        await repository.createSession({
            id: 'forge_thread_delete_b',
            forgeProjectId: 'forge_project_keep_resources',
            conversationId: 'conversation_delete_b',
            sessionChatId: 'conversation_delete_b',
            title: 'Thread B'
        });

        await repository.deleteThread('forge_thread_delete_a');

        expect(serverStorage.has('forge_thread_delete_a')).toBe(false);
        expect(serverStorage.has('forge_thread_delete_b')).toBe(true);
        expect((await repository.listSessions()).map(ref => ref.id)).toEqual(['forge_thread_delete_b']);
        const fs = await shellWorkspaceService.getFileSystem({ projectId: 'forge_project_keep_resources' });
        await expect(fs.readFile('/forge/forge_project_keep_resources/project.json')).resolves.toContain('"forgeProjectId": "forge_project_keep_resources"');
        await expect(fs.readFile('/chat/conversation_delete_a/thread.json')).rejects.toThrow();
        await expect(fs.readFile('/forge/forge_project_keep_resources/chat/conversation_delete_a/thread.json')).rejects.toThrow();
        await expect(fs.readFile('/chat/conversation_delete_b/thread.json')).resolves.toContain('"title": "Thread B"');
        await expect(fs.readFile('/forge/forge_project_keep_resources/chat/conversation_delete_b/thread.json')).resolves.toContain('"title": "Thread B"');
    });

    it('删除项目时应删除项目内所有线程与项目 VFS', async () => {
        const repository = new ForgeSessionRepository();

        await repository.createSession({
            id: 'forge_thread_project_a1',
            forgeProjectId: 'forge_project_delete',
            conversationId: 'conversation_project_a1',
            sessionChatId: 'conversation_project_a1',
            title: 'Delete Project A1'
        });
        await repository.createSession({
            id: 'forge_thread_project_a2',
            forgeProjectId: 'forge_project_delete',
            conversationId: 'conversation_project_a2',
            sessionChatId: 'conversation_project_a2',
            title: 'Delete Project A2'
        });
        await repository.createSession({
            id: 'forge_thread_project_b1',
            forgeProjectId: 'forge_project_survive',
            conversationId: 'conversation_project_b1',
            sessionChatId: 'conversation_project_b1',
            title: 'Survive Project'
        });

        await repository.deleteProject('forge_project_delete');

        expect(serverStorage.has('forge_thread_project_a1')).toBe(false);
        expect(serverStorage.has('forge_thread_project_a2')).toBe(false);
        expect(serverStorage.has('forge_thread_project_b1')).toBe(true);
        expect((await repository.listSessions()).map(ref => ref.id)).toEqual(['forge_thread_project_b1']);
        const fs = await shellWorkspaceService.getFileSystem({ projectId: 'forge_project_delete' });
        await expect(fs.readFile('/forge/forge_project_delete/project.json')).rejects.toThrow();
        await expect(fs.readFile('/chat/conversation_project_a1/thread.json')).rejects.toThrow();
        await expect(fs.readFile('/chat/conversation_project_a2/thread.json')).rejects.toThrow();
        await expect(fs.readFile('/chat/conversation_project_b1/thread.json')).resolves.toContain('"title": "Survive Project"');
        expect(bridge.conversation.deleteConversation).toHaveBeenCalledWith('forge_thread_project_a1');
        expect(bridge.conversation.deleteConversation).toHaveBeenCalledWith('forge_thread_project_a2');
    });

    it('新建协作线程不应把项目标题覆盖成线程标题', async () => {
        const repository = new ForgeSessionRepository();

        await repository.createSession({
            id: 'forge_thread_project_title_seed',
            forgeProjectId: 'forge_project_title_stable',
            conversationId: 'conversation_project_title_seed',
            sessionChatId: 'conversation_project_title_seed',
            title: '稳定项目名'
        });

        await repository.createThread('forge_project_title_stable', {
            id: 'forge_thread_project_title_new',
            conversationId: 'conversation_project_title_new',
            sessionChatId: 'conversation_project_title_new',
            title: '新的协作线程名'
        });

        const fs = await shellWorkspaceService.getFileSystem({ projectId: 'forge_project_title_stable' });
        await expect(fs.readFile('/forge/forge_project_title_stable/project.json')).resolves.toContain('"title": "稳定项目名"');
        const loadedThread = await repository.loadSession('forge_thread_project_title_new');
        expect(loadedThread?.title).toBe('新的协作线程名');
    });

    it('重命名项目时只应修改项目标题，不应覆盖协作线程标题', async () => {
        const repository = new ForgeSessionRepository();

        await repository.createSession({
            id: 'forge_thread_rename_project_a',
            forgeProjectId: 'forge_project_rename',
            conversationId: 'conversation_rename_project_a',
            sessionChatId: 'conversation_rename_project_a',
            projectTitle: '旧项目名',
            title: '线程 A'
        });
        await repository.createThread('forge_project_rename', {
            id: 'forge_thread_rename_project_b',
            conversationId: 'conversation_rename_project_b',
            sessionChatId: 'conversation_rename_project_b',
            title: '线程 B'
        });

        await repository.renameProject('forge_project_rename', '新项目名');

        const refs = (await repository.listSessions()).filter(ref => ref.forgeProjectId === 'forge_project_rename');
        expect(refs.map(ref => ref.projectTitle)).toEqual(['新项目名', '新项目名']);
        expect(refs.find(ref => ref.id === 'forge_thread_rename_project_a')?.title).toBe('线程 A');
        expect(refs.find(ref => ref.id === 'forge_thread_rename_project_b')?.title).toBe('线程 B');
        expect(serverStorage.get('forge_thread_rename_project_a').title).toBe('线程 A');
        expect(serverStorage.get('forge_thread_rename_project_b').title).toBe('线程 B');
        expect(serverStorage.get('forge_thread_rename_project_a').pluginState.forge.projectTitle).toBe('新项目名');
        expect(serverStorage.get('forge_thread_rename_project_b').pluginState.forge.projectTitle).toBe('新项目名');

        const fs = await shellWorkspaceService.getFileSystem({ projectId: 'forge_project_rename' });
        await expect(fs.readFile('/forge/forge_project_rename/project.json')).resolves.toContain('"title": "新项目名"');
    });

    it('重命名协作线程时只应修改线程标题，不应覆盖项目标题', async () => {
        const repository = new ForgeSessionRepository();

        await repository.createSession({
            id: 'forge_thread_rename_thread',
            forgeProjectId: 'forge_project_thread_title',
            conversationId: 'conversation_rename_thread',
            sessionChatId: 'conversation_rename_thread',
            projectTitle: '稳定项目名',
            title: '旧线程名'
        });

        await repository.renameThread('forge_thread_rename_thread', '新线程名');

        const ref = (await repository.listSessions()).find(item => item.id === 'forge_thread_rename_thread');
        expect(ref?.projectTitle).toBe('稳定项目名');
        expect(ref?.title).toBe('新线程名');
        expect(serverStorage.get('forge_thread_rename_thread').title).toBe('新线程名');
        expect(serverStorage.get('forge_thread_rename_thread').pluginState.forge.projectTitle).toBe('稳定项目名');

        const fs = await shellWorkspaceService.getFileSystem({ projectId: 'forge_project_thread_title' });
        await expect(fs.readFile('/forge/forge_project_thread_title/project.json')).resolves.toContain('"title": "稳定项目名"');
        await expect(fs.readFile('/forge/forge_project_thread_title/chat/conversation_rename_thread/thread.json')).resolves.toContain('"title": "新线程名"');
    });
});
