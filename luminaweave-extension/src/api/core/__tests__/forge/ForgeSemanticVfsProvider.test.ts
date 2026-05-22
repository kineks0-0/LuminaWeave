import { beforeEach, describe, expect, it, vi } from 'vitest';
import { initMockHAL } from '@/api/core/__tests__/support/halMock.js';
import { ForgeSemanticVfsProvider } from '@/api/core/forge/agent-app/vfs/ForgeSemanticVfsProvider.js';
import { ShellWorkspaceService } from '@/api/core/hal/shell/ShellWorkspaceService.js';
import type { ForgeRuntimeContext } from '@/types/ForgeRuntimeTypes.js';
import type { ForgeStructuredState } from '@/types/ForgeStructuredTypes.js';

const { store } = vi.hoisted(() => ({
    store: new Map<string, unknown>()
}));

const createContext = (): ForgeRuntimeContext => ({
    workspaceSessionId: 'forge_project_alpha',
    sessionChatId: 'conversation_alpha',
    workspaceTitle: 'Alpha Project',
    selectedPresetId: 'forge-main',
    selectedChatSessionId: null,
    selectedChatSnapshotId: null,
    detailMode: 'quick',
    collectionMode: 'conversation',
    entryMode: null,
    activeLayer: 'concept',
    completedLayers: [],
    workflowSnapshot: { promptMode: 'planner' } as ForgeRuntimeContext['workflowSnapshot'],
    publishState: 'drafting',
    activeLeafId: 'leaf_1',
    worldlineNodes: [],
    messages: [{
        id: 'msg_user_1',
        parentId: null,
        name: 'User',
        role: 'user',
        is_user: true,
        mesRaw: '当前线程内容',
        mes: '当前线程内容',
        fingerprint: 'fp_user_1',
        extra: {},
        syncStatus: 'local'
    }],
    timelineItems: [],
    structuredState: {
        activeFormId: null,
        forms: {},
        activeMessageFormId: null,
        submitConfigs: {},
        submittedScopes: {},
        lastUpdatedAt: 1
    } satisfies ForgeStructuredState,
    draftTree: { nodes: [], lastUpdatedAt: 1 },
    forgeMemoryTree: {
        entries: [{
            path: '用户偏好',
            title: '用户偏好',
            content: '偏好：克制。',
            summary: '偏好摘要',
            updatedAt: 1,
            source: 'user'
        }],
        lastUpdatedAt: 1
    },
    stagingEntries: [],
    commitReadyEntries: [],
    virtualLorebookEntries: [],
    latestUserInput: '继续',
    latestUserCommand: { type: 'send_user_input', input: '继续' }
});

describe('ForgeSemanticVfsProvider', () => {
    let workspaces: ShellWorkspaceService;
    let provider: ForgeSemanticVfsProvider;

    beforeEach(async () => {
        store.clear();
        initMockHAL({
            runtime: {
                extensionStore: {
                    listKeys: vi.fn(async () => Array.from(store.keys())),
                    getJson: vi.fn(async ({ key }: { key: string }) => store.get(key) ?? null),
                    setJson: vi.fn(async ({ key, value }: { key: string; value: unknown }) => {
                        store.set(key, value);
                    }),
                    updateJson: vi.fn(async ({ key, value }: { key: string; value: unknown }) => {
                        store.set(key, value);
                    }),
                    deleteJson: vi.fn(async ({ key }: { key: string }) => {
                        store.delete(key);
                    }),
                    setBlob: vi.fn(),
                    getBlob: vi.fn()
                }
            }
        });
        workspaces = new ShellWorkspaceService();
        provider = new ForgeSemanticVfsProvider({ workspaces });

        const fs = await workspaces.getFileSystem({
            projectId: 'forge_project_alpha',
            conversationId: 'conversation_alpha'
        });
        await fs.mkdir('/forge/forge_project_alpha/chat/conversation_alpha', { recursive: true });
        await fs.writeFile('/forge/forge_project_alpha/chat/conversation_alpha/messages.json', '[{"role":"user","content":"raw"}]');
        await fs.writeFile('/forge/forge_project_alpha/material.txt', '民俗素材');
        await workspaces.bindForgeConversation({
            forgeProjectId: 'forge_project_alpha',
            conversationId: 'conversation_alpha'
        });
    });

    it('reads prompts, skills, memory and current thread through one semantic VFS', async () => {
        const context = createContext();

        await expect(provider.readFile(context, './AGENTS.md')).resolves.toContain('工作契约');
        await expect(provider.readFile(context, './.forge/agent/SYSTEM.md')).resolves.toContain('Forge');
        await expect(provider.readFile(context, './.forge/agent/PLANNER.md')).resolves.toContain('Planner');
        await expect(provider.readFile(context, './.forge/PLANNER.md')).rejects.toThrow();
        await expect(provider.readFile(context, './agent/skills/virtual-lorebook-editor/SKILL.md')).resolves.toContain('虚拟世界书编辑器');
        await expect(provider.readFile(context, './memory/用户偏好.md')).resolves.toContain('偏好：克制。');
        await expect(provider.readFile(context, './threads/目前/messages.md')).resolves.toContain('当前线程内容');

        const paths = (await provider.listEntries(context)).map(entry => entry.path);
        expect(paths).toContain('./material.txt');
        expect(paths).not.toContain('./chat/conversation_alpha/messages.json');
        expect(JSON.stringify(paths)).not.toContain('forge_project_alpha');
    });
});
