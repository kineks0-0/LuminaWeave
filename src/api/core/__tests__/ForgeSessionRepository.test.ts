import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ForgeSessionRepository } from '../ForgeSessionRepository';
import { createEmptyStructuredState } from '../utils/forgeStateDefaults';

const { mockPluginFetch } = vi.hoisted(() => {
    const serverStorage = new Map<string, any>();
    return {
        mockPluginFetch: vi.fn(async (url: string, options?: any): Promise<{ ok: boolean; status?: number; json: () => Promise<any> }> => {
            const idMatch = url.match(/\/forge\/sessions\/([^/]+)$/);
            const id = idMatch ? idMatch[1] : null;

            if (options?.method === 'PUT' && id) {
                const body = JSON.parse(options.body);
                serverStorage.set(id, body);
                return { ok: true, status: 200, json: async () => ({ success: true }) };
            }

            if ((!options || options.method === 'GET') && id) {
                const session = serverStorage.get(id);
                return { 
                    ok: true, 
                    status: session ? 200 : 404,
                    json: async () => session ? { session } : {} 
                };
            }

            return { ok: true, status: 200, json: async () => ({}) };
        })
    };
});

vi.mock('../PluginHttpClient.js', () => ({
    pluginFetch: mockPluginFetch
}));

vi.mock('../../stores/useForgeStore.js', () => ({
    useForgeStore: () => ({
        stagingArea: [],
        commitReadyEntries: []
    })
}));

const STORAGE_KEY = 'lumina-forge.workspace-sessions';

describe('ForgeSessionRepository', () => {
    beforeEach(() => {
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

    it('应在 session 记录缺少 structuredState 时回退到本地缓存', async () => {
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

        const rawSessions = JSON.parse(globalThis.localStorage.getItem(STORAGE_KEY) || '[]');
        rawSessions[0].structuredState = {
            ...rawSessions[0].structuredState,
            forms: {
                ...rawSessions[0].structuredState.forms,
                role_core_profile: {
                    ...rawSessions[0].structuredState.forms.role_core_profile,
                    fields: {
                        identity: { value: '失忆的教会审讯官', locked: false, confirmed: true, source: 'manual', updatedAt: 2 }
                    }
                }
            }
        };
        globalThis.localStorage.setItem(STORAGE_KEY, JSON.stringify(rawSessions));

        // 模拟服务端尝试加载但失败（或返回无此 session），从而触发本地回退
        mockPluginFetch.mockResolvedValueOnce({
            ok: false,
            status: 404,
            json: async () => ({ error: 'Not Found' })
        });

        const loaded = await repository.loadSession('forge_ws_2');

        // 现在即使手动注入本地缓存，读取阶段也会强制脱水，因此不应能读到详细字段
        expect(loaded?.structuredState?.forms).toEqual({});
        expect(mockPluginFetch).toHaveBeenCalled();
    });

    it('应始终在 localStorage 中保存脱水后的存根', async () => {
        const repository = new ForgeSessionRepository();
        
        // 模拟同步失败
        mockPluginFetch.mockResolvedValueOnce({ ok: false, json: async () => ({}) });

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
