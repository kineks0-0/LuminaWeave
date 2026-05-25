import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ForgePiToolBridge } from '@/api/core/forge/agent-app/tools/ForgePiToolBridge.js';
import type { ForgeCapabilityRegistry } from '@/api/core/forge/skills/ForgeCapabilityRegistry.js';
import type { ForgeSkillLoadResult, ForgeSkillRegistry } from '@/api/core/forge/skills/ForgeSkillRegistry.js';
import type { ForgeRuntimeEffect } from '@/types/ForgeRuntimeTypes.js';
import type { ForgeRuntimeContext } from '@/types/ForgeRuntimeTypes.js';
import type { ForgeDraftTree, ForgeStructuredState } from '@/types/ForgeStructuredTypes.js';
import { initMockHAL } from '@/api/core/__tests__/support/halMock.js';
import { ShellWorkspaceService } from '@/api/core/hal/shell/ShellWorkspaceService.js';

const { store } = vi.hoisted(() => ({
    store: new Map<string, unknown>()
}));

const createContext = (): ForgeRuntimeContext => ({
    workspaceSessionId: 'forge_project_alpha',
    sessionChatId: 'conversation_alpha',
    workspaceTitle: 'Forge Alpha',
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
    messages: [],
    timelineItems: [],
    structuredState: {} as ForgeStructuredState,
    draftTree: { nodes: [], lastUpdatedAt: 1 } as ForgeDraftTree,
    forgeMemoryTree: { entries: [], lastUpdatedAt: 1 },
    stagingEntries: [],
    commitReadyEntries: [],
    virtualLorebookEntries: [],
    latestUserInput: 'hello',
    latestUserCommand: { type: 'send_user_input', input: 'hello' }
});

const createEmptySkills = (): Pick<ForgeSkillRegistry, 'listProjectSkills' | 'listBuiltInSkills' | 'loadSkill'> => ({
    listProjectSkills: vi.fn(async () => []),
    listBuiltInSkills: vi.fn(() => []),
    loadSkill: vi.fn()
});

const createEmptyCapabilities = (): Pick<ForgeCapabilityRegistry, 'search' | 'load' | 'listCapabilities'> => ({
    search: vi.fn(() => []),
    load: vi.fn(),
    listCapabilities: vi.fn(() => [])
});

describe('ForgePiToolBridge', () => {
    beforeEach(() => {
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
    });

    it('exposes direct workspace write tools without Review Gate metadata', () => {
        const bridge = new ForgePiToolBridge({
            skills: createEmptySkills(),
            capabilities: createEmptyCapabilities()
        });

        const tools = bridge.getTools(createContext());

        expect(tools.map(tool => tool.name)).toEqual([
            'capabilitySearch',
            'capabilityLoad',
            'skillList',
            'skillLoad',
            'bash',
            'readFile',
            'writeFile',
            'editFile',
            'deleteFile'
        ]);
        expect(tools.find(tool => tool.name === 'writeFile')?.needsApproval).toBeUndefined();
        expect(tools.find(tool => tool.name === 'editFile')?.needsApproval).toBeUndefined();
        expect(tools.find(tool => tool.name === 'deleteFile')?.needsApproval).toBeUndefined();
    });

    it('applies writeFile directly to the Forge project workspace and returns a workspace patch', async () => {
        const workspaces = new ShellWorkspaceService();
        const bridge = new ForgePiToolBridge({
            skills: createEmptySkills(),
            capabilities: createEmptyCapabilities(),
            workspaces
        });
        const writeFile = bridge.getTools(createContext()).find(tool => tool.name === 'writeFile');

        const result = await writeFile?.execute('call_write', {
            path: './card.md',
            content: '# Card\n\nUpdated.'
        });
        const fs = await workspaces.getFileSystem({
            projectId: 'forge_project_alpha',
            conversationId: 'conversation_alpha'
        });
        const persisted = await fs.readFile('/forge/forge_project_alpha/card.md');

        expect(String(persisted)).toBe('# Card\n\nUpdated.');
        expect(result?.details).toMatchObject({
            path: './card.md',
            applied: true,
            workspacePatch: {
                sourceToolCallId: 'call_write',
                changes: [expect.objectContaining({
                    path: './card.md',
                    kind: 'create',
                    beforeContentRef: null,
                    afterContentRef: expect.stringContaining('inline:')
                })]
            }
        });
    });

    it('applies editFile and deleteFile directly without staging effects', async () => {
        const effects: ForgeRuntimeEffect[] = [];
        const workspaces = new ShellWorkspaceService();
        const fs = await workspaces.getFileSystem({
            projectId: 'forge_project_alpha',
            conversationId: 'conversation_alpha'
        });
        await fs.mkdir('/forge/forge_project_alpha', { recursive: true });
        await fs.writeFile('/forge/forge_project_alpha/card.md', 'old content');

        const bridge = new ForgePiToolBridge({
            skills: createEmptySkills(),
            capabilities: createEmptyCapabilities(),
            workspaces,
            onEffects: next => effects.push(...next)
        });
        const tools = bridge.getTools(createContext());
        const editFile = tools.find(tool => tool.name === 'editFile');
        const deleteFile = tools.find(tool => tool.name === 'deleteFile');

        const edited = await editFile?.execute('call_edit', {
            path: './card.md',
            old_string: 'old',
            new_string: 'new'
        });
        const deleted = await deleteFile?.execute('call_delete', {
            path: './card.md'
        });

        await expect(fs.readFile('/forge/forge_project_alpha/card.md')).rejects.toThrow();
        expect(effects).toEqual([]);
        expect(edited?.details).toMatchObject({
            path: './card.md',
            applied: true,
            workspacePatch: {
                sourceToolCallId: 'call_edit',
                changes: [expect.objectContaining({ kind: 'update' })]
            }
        });
        expect(deleted?.details).toMatchObject({
            path: './card.md',
            applied: true,
            workspacePatch: {
                sourceToolCallId: 'call_delete',
                changes: [expect.objectContaining({ kind: 'delete' })]
            }
        });
    });

    it('returns semantic skill paths from skill tools', async () => {
        const projectSkill: ForgeSkillLoadResult = {
            source: 'project',
            path: './agent/skills/custom-skill/SKILL.md',
            skill: {
                name: 'custom-skill',
                description: '项目技能',
                files: [{ path: 'SKILL.md', content: '# 项目技能' }]
            }
        };
        const builtInSkill: ForgeSkillLoadResult = {
            source: 'built-in',
            path: './agent/skills/memory-curator/SKILL.md',
            skill: {
                name: 'memory-curator',
                description: '整理记忆',
                files: [{ path: 'SKILL.md', content: '# 项目记忆整理员' }]
            }
        };
        const bridge = new ForgePiToolBridge({
            skills: {
                listProjectSkills: vi.fn(async () => [projectSkill]),
                listBuiltInSkills: vi.fn(() => [{
                    name: 'memory-curator',
                    title: '项目记忆整理员',
                    description: '整理记忆',
                    defaultWriteScope: './memory/',
                    resourcePath: 'src/resources/forge-skills/memory-curator.md',
                    builtIn: true
                }]),
                loadSkill: vi.fn(async () => builtInSkill)
            },
            capabilities: createEmptyCapabilities()
        });

        const context = createContext();
        const skillList = bridge.getTools(context).find(tool => tool.name === 'skillList');
        const skillLoad = bridge.getTools(context).find(tool => tool.name === 'skillLoad');

        const listResult = await skillList?.execute('call_list', {});
        const loadResult = await skillLoad?.execute('call_load', { skillName: 'memory-curator' });

        expect(listResult?.details).toMatchObject({
            projectSkills: [expect.objectContaining({ path: './agent/skills/custom-skill/SKILL.md' })],
            builtInSkills: [expect.objectContaining({ path: './agent/skills/memory-curator/SKILL.md' })]
        });
        expect(loadResult?.details).toMatchObject({
            path: './agent/skills/memory-curator/SKILL.md'
        });
    });

    it('lists and loads preset-provided reference skills through the semantic VFS', async () => {
        const bridge = new ForgePiToolBridge({
            skills: createEmptySkills(),
            capabilities: createEmptyCapabilities()
        });
        const context = createContext();
        const skillList = bridge.getTools(context).find(tool => tool.name === 'skillList');
        const skillLoad = bridge.getTools(context).find(tool => tool.name === 'skillLoad');

        const listResult = await skillList?.execute('call_list', {});
        const loadResult = await skillLoad?.execute('call_load', { skillName: 'reference-anti-cliche' });
        const titleLoadResult = await skillLoad?.execute('call_load_title', { skillName: '反八股与偏向强化' });

        expect(listResult?.details).toMatchObject({
            presetSkills: expect.arrayContaining([
                expect.objectContaining({
                    name: 'reference-anti-cliche',
                    title: '反八股与偏向强化',
                    path: './agent/skills/reference-anti-cliche/SKILL.md',
                    loadPolicy: 'on_demand'
                })
            ])
        });
        expect(loadResult?.details).toMatchObject({
            name: 'reference-anti-cliche',
            path: './agent/skills/reference-anti-cliche/SKILL.md',
            files: [expect.objectContaining({
                content: expect.stringContaining('反八股与偏向强化')
            })]
        });
        expect(titleLoadResult?.details).toMatchObject({
            name: 'reference-anti-cliche',
            path: './agent/skills/reference-anti-cliche/SKILL.md'
        });
    });

    it('reads contract, Forge prompt files, and built-in skill files through semantic VFS', async () => {
        const builtInSkill: ForgeSkillLoadResult = {
            source: 'built-in',
            path: './agent/skills/memory-curator/SKILL.md',
            skill: {
                name: 'memory-curator',
                description: '整理记忆',
                files: [{ path: 'SKILL.md', content: '# 项目记忆整理员\n\n整理稳定偏好。' }]
            }
        };
        const bridge = new ForgePiToolBridge({
            skills: {
                ...createEmptySkills(),
                loadSkill: vi.fn(async () => builtInSkill)
            },
            capabilities: createEmptyCapabilities()
        });
        const readFile = bridge.getTools(createContext()).find(tool => tool.name === 'readFile');

        const agents = await readFile?.execute('call_agents', { path: './AGENTS.md' });
        const systemPrompt = await readFile?.execute('call_system', { path: './.forge/agent/SYSTEM.md' });
        const conversationPrompt = await readFile?.execute('call_prompt', { path: './.forge/agent/CONVERSATION.md' });
        const skill = await readFile?.execute('call_skill', { path: './agent/skills/memory-curator/SKILL.md' });

        expect(agents?.details).toMatchObject({
            path: './AGENTS.md',
            content: expect.stringContaining('工作契约')
        });
        expect(systemPrompt?.details).toMatchObject({
            path: './.forge/agent/SYSTEM.md',
            content: expect.any(String)
        });
        expect(conversationPrompt?.details).toMatchObject({
            path: './.forge/agent/CONVERSATION.md',
            content: expect.any(String)
        });
        expect(skill?.details).toMatchObject({
            path: './agent/skills/memory-curator/SKILL.md',
            source: 'built-in',
            content: expect.stringContaining('项目记忆整理员')
        });
    });

    it('reads long-term memory bodies through the readFile tool', async () => {
        const bridge = new ForgePiToolBridge({
            skills: createEmptySkills(),
            capabilities: createEmptyCapabilities()
        });
        const context: ForgeRuntimeContext = {
            ...createContext(),
            forgeMemoryTree: {
                entries: [{
                    path: '偏好/禁忌',
                    title: '禁忌',
                    content: '完整正文中才会出现的长句',
                    summary: '避免俗套',
                    updatedAt: 1,
                    source: 'user'
                }],
                lastUpdatedAt: 1
            }
        };
        const readFile = bridge.getTools(context).find(tool => tool.name === 'readFile');

        const result = await readFile?.execute('call_memory', { path: './memory/偏好/禁忌.md' });

        expect(result?.details).toMatchObject({
            path: './memory/偏好/禁忌.md',
            content: expect.stringContaining('完整正文中才会出现的长句')
        });
    });

    it('rejects writes to built-in skill resources instead of creating overlay proposals', async () => {
        const bridge = new ForgePiToolBridge({
            skills: createEmptySkills(),
            capabilities: createEmptyCapabilities()
        });
        const writeFile = bridge.getTools(createContext()).find(tool => tool.name === 'writeFile');

        const result = await writeFile?.execute('call_write', {
            path: './agent/skills/memory-curator/SKILL.md',
            content: '# patched skill'
        });

        expect(result?.details).toMatchObject({
            path: './agent/skills/memory-curator/SKILL.md',
            applied: false,
            error: expect.stringContaining('read-only')
        });
    });

    it('reads stable historical thread paths from Forge workspace projections', async () => {
        const workspaces = new ShellWorkspaceService();
        await workspaces.bindForgeConversation({
            forgeProjectId: 'forge_project_alpha',
            conversationId: 'conversation_alpha'
        });
        await workspaces.bindForgeConversation({
            forgeProjectId: 'forge_project_alpha',
            conversationId: 'conversation_beta'
        });
        await workspaces.writeForgeConversationProjection({
            forgeProjectId: 'forge_project_alpha',
            conversationId: 'conversation_alpha',
            workspaceSessionId: 'forge_project_alpha',
            workspacePath: '/workspaces/forge/forge_project_alpha/chat/conversation_alpha',
            title: '目前线程',
            createdAt: 1,
            updatedAt: 1,
            activeLeafId: null,
            messages: [{ role: 'user', content: 'current' }]
        });
        await workspaces.writeForgeConversationProjection({
            forgeProjectId: 'forge_project_alpha',
            conversationId: 'conversation_beta',
            workspaceSessionId: 'forge_project_alpha',
            workspacePath: '/workspaces/forge/forge_project_alpha/chat/conversation_beta',
            title: '历史线程',
            createdAt: 2,
            updatedAt: 2,
            activeLeafId: null,
            messages: [{ role: 'user', content: 'historical' }]
        });
        const bridge = new ForgePiToolBridge({
            skills: createEmptySkills(),
            capabilities: createEmptyCapabilities(),
            workspaces
        });
        const readFile = bridge.getTools(createContext()).find(tool => tool.name === 'readFile');

        const result = await readFile?.execute('call_thread', {
            path: './threads/02历史线程/messages.md'
        });

        expect(result?.details).toMatchObject({
            path: './threads/02历史线程/messages.md',
            content: expect.stringContaining('historical')
        });
    });

    it('reads the current thread markdown alias from runtime context', async () => {
        const bridge = new ForgePiToolBridge({
            skills: createEmptySkills(),
            capabilities: createEmptyCapabilities()
        });
        const context = {
            ...createContext(),
            messages: [{
                id: 'msg_user_1',
                parentId: null,
                name: 'User',
                role: 'user',
                is_user: true,
                mesRaw: '当前线程语义内容',
                mes: '当前线程语义内容',
                fingerprint: 'fp_user_1',
                extra: {},
                syncStatus: 'local' as const
            }]
        };
        const readFile = bridge.getTools(context).find(tool => tool.name === 'readFile');

        const result = await readFile?.execute('call_current_thread', {
            path: './threads/目前/messages.md'
        });

        expect(result?.details).toMatchObject({
            path: './threads/目前/messages.md',
            content: expect.stringContaining('当前线程语义内容')
        });
        expect(JSON.stringify(result?.details)).not.toContain('conversation_alpha');
    });

    it('reads the current thread metadata alias without leaking internal ids', async () => {
        const bridge = new ForgePiToolBridge({
            skills: createEmptySkills(),
            capabilities: createEmptyCapabilities()
        });
        const readFile = bridge.getTools(createContext()).find(tool => tool.name === 'readFile');

        const result = await readFile?.execute('call_current_thread_meta', {
            path: './threads/目前/thread.md'
        });

        expect(result?.details).toMatchObject({
            path: './threads/目前/thread.md',
            content: expect.stringContaining('Forge Alpha')
        });
        expect(result?.details).toMatchObject({
            content: expect.stringContaining('concept')
        });
        expect(JSON.stringify(result?.details)).not.toContain('conversation_alpha');
        expect(JSON.stringify(result?.details)).not.toContain('forge_project_alpha');
    });

    it('reports semantic directories instead of treating them as missing files', async () => {
        const bridge = new ForgePiToolBridge({
            skills: createEmptySkills(),
            capabilities: createEmptyCapabilities()
        });
        const readFile = bridge.getTools(createContext()).find(tool => tool.name === 'readFile');

        const result = await readFile?.execute('call_current_thread_dir', {
            path: './threads/目前/'
        });

        expect(result?.content?.[0]).toMatchObject({
            type: 'text',
            text: expect.stringContaining('Path is a directory')
        });
        expect(result?.details).toMatchObject({
            path: './threads/目前/',
            directory: true,
            entries: expect.arrayContaining([
                expect.objectContaining({ path: './threads/目前/messages.md', kind: 'file' })
            ])
        });
        expect(result?.details).not.toMatchObject({
            error: expect.stringContaining('File not found')
        });
    });
});
