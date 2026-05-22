import { beforeEach, describe, expect, it, vi } from 'vitest';
import { initMockHAL } from '@/api/core/__tests__/support/halMock.js';
import { ForgeProjectSemanticVfsService } from '@/api/core/forge/project/ForgeProjectSemanticVfsService.js';
import { ShellWorkspaceService } from '@/api/core/hal/shell/ShellWorkspaceService.js';
import { ForgeSkillRegistry } from '@/api/core/forge/skills/ForgeSkillRegistry.js';
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
    workflowSnapshot: null,
    publishState: 'drafting',
    activeLeafId: 'leaf_1',
    worldlineNodes: [],
    messages: [{
        id: 'msg_user_1',
        parentId: null,
        name: 'User',
        role: 'user',
        is_user: true,
        mesRaw: '需要一个偏民俗的城市设定。',
        mes: '需要一个偏民俗的城市设定。',
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
        entries: [
            {
                path: 'AUTO/Checklist',
                title: 'Checklist',
                content: '- [ ] 检查俗套\n- [ ] 检查世界书触发词',
                summary: '自动检查项',
                updatedAt: 1,
                source: 'system'
            },
            {
                path: '用户偏好',
                title: '用户偏好',
                content: '偏好：克制、民俗、低解释密度。',
                summary: '偏好摘要',
                updatedAt: 1,
                source: 'user'
            }
        ],
        lastUpdatedAt: 1
    },
    stagingEntries: [{
        id: 'stage_1',
        targetEntryId: 'city',
        originalContent: '',
        proposedContent: '候选世界书内容',
        description: '城市条目',
        timestamp: 1,
        layer: 'concept',
        sourceTag: null,
        sourceMessageId: null,
        sourceSessionId: null
    }],
    commitReadyEntries: [],
    virtualLorebookEntries: [{
        id: 'city',
        entry: {
            uid: 'city',
            comment: '城市',
            key: ['城市'],
            keysecondary: [],
            content: '电梯神龛和港口仪式。',
            constant: false,
            selective: false,
            selectiveLogic: 0,
            disable: false,
            position: 0,
            depth: 4,
            order: 100,
            probability: 100,
            scan_depth: 2
        },
        sourceBookId: null,
        createdAt: 1,
        updatedAt: 1
    }],
    latestUserInput: '继续',
    latestUserCommand: { type: 'send_user_input', input: '继续' }
});

describe('ForgeProjectSemanticVfsService', () => {
    let workspaces: ShellWorkspaceService;
    let service: ForgeProjectSemanticVfsService;

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
        service = new ForgeProjectSemanticVfsService({
            workspaces,
            skills: new ForgeSkillRegistry(workspaces)
        });

        const fs = await workspaces.getFileSystem({
            projectId: 'forge_project_alpha',
            conversationId: 'conversation_alpha'
        });
        await fs.mkdir('/forge/forge_project_alpha/chat/conversation_alpha', { recursive: true });
        await fs.mkdir('/forge/forge_project_alpha/lorebook/entries', { recursive: true });
        await fs.mkdir('/forge/forge_project_alpha/memory', { recursive: true });
        await fs.mkdir('/forge/forge_project_alpha/drafts', { recursive: true });
        await fs.mkdir('/forge/forge_project_alpha/review', { recursive: true });
        await fs.writeFile('/forge/forge_project_alpha/project.json', '{"id":"forge_project_alpha"}');
        await fs.writeFile('/forge/forge_project_alpha/chat/conversation_alpha/messages.json', '[{"role":"user","content":"raw"}]');
        await fs.writeFile('/forge/forge_project_alpha/chat/conversation_alpha/thread.json', '{"title":"内部线程标题"}');
        await fs.writeFile('/forge/forge_project_alpha/lorebook/entries/raw-city.json', '{"content":"raw city"}');
        await fs.writeFile('/forge/forge_project_alpha/memory/tree.json', '{"entries":[]}');
        await fs.writeFile('/forge/forge_project_alpha/drafts/tree.json', '{"nodes":[]}');
        await fs.writeFile('/forge/forge_project_alpha/review/staging.json', '[]');
        await fs.writeFile('/forge/forge_project_alpha/material.txt', '民俗素材');
        await workspaces.bindForgeConversation({
            forgeProjectId: 'forge_project_alpha',
            conversationId: 'conversation_alpha'
        });
    });

    it('exposes the plan-aligned semantic project VFS instead of raw storage paths', async () => {
        const entries = await service.listEntries(createContext());
        const paths = entries.map(entry => entry.path);

        expect(paths).toEqual(expect.arrayContaining([
            './AGENTS.md',
            './.forge/agent/SYSTEM.md',
            './.forge/agent/PLANNER.md',
            './.forge/agent/CONVERSATION.md',
            './.forge/agent/ANALYST.md',
            './.forge/agent/EXECUTOR.md',
            './agent/skills/virtual-lorebook-editor/SKILL.md',
            './memory/AUTO/Checklist.md',
            './memory/用户偏好.md',
            './threads/目前/thread.md',
            './threads/目前/messages.md',
            './lorebook/entries/city.md',
            './review/staging.json',
            './material.txt'
        ]));
        expect(paths.some(path => path.startsWith('./chat/'))).toBe(false);
        expect(paths).not.toContain('./project.json');
        expect(paths).not.toContain('./memory/tree.json');
        expect(paths).not.toContain('./drafts/tree.json');
        expect(paths).not.toContain('./lorebook/entries/raw-city.json');
        expect(JSON.stringify(entries)).not.toContain('conversation_alpha');
        expect(JSON.stringify(entries)).not.toContain('forge_project_alpha');
        expect(paths.some(path => path.startsWith('./.pi/agent/prompts/'))).toBe(false);
        expect(paths.some(path => /^\.\/\.forge\/(PLANNER|CONVERSATION|ANALYST|EXECUTOR)\.md$/.test(path))).toBe(false);
        const agentsContent = entries.find(entry => entry.path === './AGENTS.md')?.content ?? '';
        expect(agentsContent).toContain('工作契约');
        expect(agentsContent).toContain('Review Gate');
        expect(agentsContent).not.toContain('基础身份');
        expect(entries.find(entry => entry.path === './.forge/agent/SYSTEM.md')?.content).toContain('Forge');
        expect(entries.find(entry => entry.path === './.forge/agent/CONVERSATION.md')?.content).toContain('Forge');
        expect(entries.find(entry => entry.path === './threads/目前/thread.md')?.content).toContain('Alpha Project');
        expect(entries.find(entry => entry.path === './threads/目前/messages.md')?.content).toContain('民俗的城市设定');
        expect(entries.find(entry => entry.path === './review/staging.json')?.content).toContain('候选世界书内容');
    });

    it('exposes preset reference skills through semantic VFS', async () => {
        const entries = await service.listEntries(createContext());

        expect(entries).toEqual(expect.arrayContaining([
            expect.objectContaining({
                path: './agent/skills/reference-needs-capture/SKILL.md',
                source: 'resource',
                content: expect.stringContaining('需求捕捉与支撑点识别')
            }),
            expect.objectContaining({
                path: './agent/skills/reference-anti-cliche/SKILL.md',
                source: 'resource',
                content: expect.stringContaining('反八股与偏向强化')
            }),
            expect.objectContaining({
                path: './agent/skills/reference-xp-capture/SKILL.md',
                source: 'resource',
                content: expect.stringContaining('XP 捕捉附加条目')
            })
        ]));
    });

    it('lets project skills override preset-provided skills with the same semantic path', async () => {
        const fs = await workspaces.getFileSystem({
            projectId: 'forge_project_alpha',
            conversationId: 'conversation_alpha'
        });
        await fs.mkdir('/forge/forge_project_alpha/agent/skills/reference-anti-cliche', { recursive: true });
        await fs.writeFile(
            '/forge/forge_project_alpha/agent/skills/reference-anti-cliche/SKILL.md',
            '# 项目覆盖反八股\n\n项目自定义内容。'
        );

        const entries = await service.listEntries(createContext());
        const skill = entries.find(entry => entry.path === './agent/skills/reference-anti-cliche/SKILL.md');

        expect(skill).toEqual(expect.objectContaining({
            source: 'workspace',
            content: expect.stringContaining('项目覆盖反八股')
        }));
        expect(skill?.content).not.toContain('反八股与偏向强化');
    });
});
