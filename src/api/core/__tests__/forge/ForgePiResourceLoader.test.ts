import { describe, expect, it, vi } from 'vitest';
import { ForgePiResourceLoader } from '@/api/core/forge/agent-app/resources/ForgePiResourceLoader.js';
import type { ForgeSemanticVfsReader } from '@/api/core/forge/agent-app/vfs/ForgeSemanticVfsProvider.js';
import type { ForgeRuntimeContext } from '@/types/ForgeRuntimeTypes.js';

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
    completedLayers: ['concept'],
    workflowSnapshot: {
        currentStage: 'narrative',
        promptMode: 'conversation',
        reason: '用户继续细化角色',
        completedStages: ['kickoff', 'skeleton']
    } as any,
    publishState: 'drafting',
    activeLeafId: 'leaf_1',
    worldlineNodes: [],
    messages: [],
    timelineItems: [],
    structuredState: {} as any,
    draftTree: { nodes: [], lastUpdatedAt: 1 } as any,
    forgeMemoryTree: { entries: [{ path: '偏好/禁忌', title: '禁忌', content: '完整正文中才会出现的长句', summary: '避免俗套', updatedAt: 1, source: 'user' }], lastUpdatedAt: 1 },
    stagingEntries: [{ id: 'stage_1', targetEntryId: 'entry.1', originalContent: '', proposedContent: 'new', description: '候选条目', timestamp: 1, layer: 'concept', sourceTag: null, sourceMessageId: null, sourceSessionId: null }],
    commitReadyEntries: [],
    virtualLorebookEntries: [{ id: 'entry.1', entry: { comment: '角色概念', content: '旧内容' } as any, createdAt: 1, updatedAt: 1, sourceBookId: null }],
    latestUserInput: '继续',
    latestUserCommand: { type: 'send_user_input', input: '继续' }
});

describe('ForgePiResourceLoader', () => {
    it('reads AGENTS and mode prompt content from the semantic VFS reader', async () => {
        const semanticVfs: ForgeSemanticVfsReader = {
            readFile: vi.fn(async (_context, path) => {
                if (path === './AGENTS.md') return '# Custom Contract';
                if (path === './.forge/agent/SYSTEM.md') return '# Custom System Prompt';
                if (path === './.forge/agent/CONVERSATION.md') return '# Custom Conversation Prompt';
                throw new Error(`Unexpected path: ${path}`);
            }),
            listEntries: vi.fn(async () => [])
        };
        const loader = new ForgePiResourceLoader({
            semanticVfs,
            capabilities: { listCapabilities: vi.fn(() => []) } as any,
            skills: {
                listBuiltInSkills: vi.fn(() => []),
                listProjectSkills: vi.fn(async () => [])
            } as any
        });

        const bundle = await loader.buildContextBundle(createContext());
        const systemPrompt = loader.buildSystemPrompt({ systemFragments: [], contextBundle: bundle });

        expect(semanticVfs.readFile).toHaveBeenCalledWith(createContext(), './AGENTS.md');
        expect(semanticVfs.readFile).toHaveBeenCalledWith(createContext(), './.forge/agent/SYSTEM.md');
        expect(semanticVfs.readFile).toHaveBeenCalledWith(createContext(), './.forge/agent/CONVERSATION.md');
        expect(systemPrompt).toContain('# Custom Contract');
        expect(systemPrompt).toContain('# Custom System Prompt');
        expect(systemPrompt).toContain('# Custom Conversation Prompt');
    });

    it('builds Chinese context files and capability index without loading full skill text', async () => {
        const loader = new ForgePiResourceLoader({
            capabilities: {
                listCapabilities: vi.fn(() => [{
                    id: 'virtual-lorebook-editor',
                    title: '虚拟世界书编辑器',
                    summary: '编辑虚拟世界书。',
                    triggers: ['世界书'],
                    loadAs: 'skill',
                    namespace: 'forge.lorebook',
                    skillName: 'virtual-lorebook-editor',
                    risk: 'medium'
                }])
            } as any,
            skills: {
                listBuiltInSkills: vi.fn(() => [{
                    name: 'virtual-lorebook-editor',
                    title: '虚拟世界书编辑器',
                    description: '编辑虚拟世界书。',
                    defaultWriteScope: '/workspaces/forge/<projectId>/lorebook/entries/',
                    builtIn: true
                }]),
                listProjectSkills: vi.fn(async () => [])
            } as any
        });

        const bundle = await loader.buildContextBundle(createContext());

        expect(bundle.loadedExtensions).toEqual(['@luminaweave/pi-forge-browser']);
        expect(bundle.activeSkills).toContain('虚拟世界书编辑器 (skillName: virtual-lorebook-editor, path: ./agent/skills/virtual-lorebook-editor/SKILL.md)');
        expect(bundle.activeSkills).toContain('需求捕捉与支撑点识别 (skillName: reference-needs-capture, path: ./agent/skills/reference-needs-capture/SKILL.md)');
        expect(bundle.files.map(file => file.path)).toEqual(expect.arrayContaining([
            './AGENTS.md',
            './.forge/agent/SYSTEM.md',
            './.forge/agent/CONVERSATION.md',
            './.forge/agent/UI_DSL.md',
            './.forge/agent/REASONING.md',
            './.pi/agent/context/project.md',
            './.pi/agent/context/workflow.md',
            './.pi/agent/context/write-boundary.md',
            './.pi/agent/context/capability-index.md',
            './.pi/agent/context/project-resources.md'
        ]));
        expect(bundle.files.find(file => file.path === './.pi/agent/context/project.md')?.content)
            .not.toContain('forge_project_alpha');
        expect(bundle.files.find(file => file.path === './.pi/agent/context/write-boundary.md')?.content).toContain('默认直接应用');
        expect(bundle.files.find(file => file.path === './.pi/agent/context/write-boundary.md')?.content).toContain('workspace_patch');
        expect(bundle.files.find(file => file.path === './.pi/agent/context/capability-index.md')?.content)
            .toContain('./agent/skills/virtual-lorebook-editor/SKILL.md');
        expect(bundle.files.find(file => file.path === './AGENTS.md')?.title).toContain('工作契约');
        expect(bundle.files.find(file => file.path === './.forge/agent/SYSTEM.md')?.title).toContain('默认系统提示词');
        expect(bundle.files.find(file => file.path === './.forge/agent/CONVERSATION.md')?.title).toContain('模式提示词');
        expect(bundle.files.find(file => file.path === './.forge/agent/UI_DSL.md')?.content).toContain('Forge <V> DSL');
        expect(bundle.files.find(file => file.path === './.forge/agent/UI_DSL.md')?.content).toContain('ForgeChoiceGroup(');
        expect(bundle.files.find(file => file.path === './.forge/agent/REASONING.md')?.content).toContain('隐藏思维链');
        expect(JSON.stringify(bundle)).toContain('真实 ST 世界书');
    });

    it('does not inject current thread messages into the default system prompt', async () => {
        const loader = new ForgePiResourceLoader({
            capabilities: { listCapabilities: vi.fn(() => []) } as any,
            skills: {
                listBuiltInSkills: vi.fn(() => []),
                listProjectSkills: vi.fn(async () => [])
            } as any
        });
        const context = createContext();
        context.messages = [{ role: 'user', content: '这句话只能出现在 branch messages 或 VFS 文件里' }] as any;

        const bundle = await loader.buildContextBundle(context);
        const systemPrompt = loader.buildSystemPrompt({ systemFragments: [], contextBundle: bundle });

        expect(systemPrompt).not.toContain('这句话只能出现在 branch messages 或 VFS 文件里');
        expect(bundle.files.map(file => file.path)).not.toContain('./threads/目前/messages.md');
    });

    it('keeps the default system prompt stable when only runtime messages change', async () => {
        const loader = new ForgePiResourceLoader({
            capabilities: { listCapabilities: vi.fn(() => []) } as any,
            skills: {
                listBuiltInSkills: vi.fn(() => []),
                listProjectSkills: vi.fn(async () => [])
            } as any
        });

        const first = await loader.buildContextBundle({ ...createContext(), messages: [] as any });
        const second = await loader.buildContextBundle({
            ...createContext(),
            messages: [{ role: 'user', content: '新消息' }] as any
        });

        expect(loader.buildSystemPrompt({ systemFragments: [], contextBundle: first }))
            .toBe(loader.buildSystemPrompt({ systemFragments: [], contextBundle: second }));
    });

    it('exposes a memory index without injecting full memory text', async () => {
        const loader = new ForgePiResourceLoader({
            capabilities: { listCapabilities: vi.fn(() => []) } as any,
            skills: {
                listBuiltInSkills: vi.fn(() => []),
                listProjectSkills: vi.fn(async () => [])
            } as any
        });

        const bundle = await loader.buildContextBundle(createContext());
        const memoryIndex = bundle.files.find(file => file.path === './.pi/agent/context/memory-index.md');
        const systemPrompt = loader.buildSystemPrompt({ systemFragments: [], contextBundle: bundle });

        expect(memoryIndex?.content).toContain('# 项目长期记忆索引');
        expect(memoryIndex?.content).toContain('./memory/偏好/禁忌.md');
        expect(memoryIndex?.content).toContain('禁忌');
        expect(memoryIndex?.content).toContain('Source：user');
        expect(memoryIndex?.content).toContain('Updated：1');
        expect(memoryIndex?.content).toContain('避免俗套');
        expect(systemPrompt).toContain('./.pi/agent/context/memory-index.md');
        expect(systemPrompt).not.toContain('完整正文中才会出现的长句');
    });

    it('keeps long-term memory readable through resources without injecting full memory body', async () => {
        const loader = new ForgePiResourceLoader({
            capabilities: { listCapabilities: vi.fn(() => []) } as any,
            skills: {
                listBuiltInSkills: vi.fn(() => []),
                listProjectSkills: vi.fn(async () => [])
            } as any
        });

        const bundle = await loader.buildContextBundle(createContext());
        const systemPrompt = loader.buildSystemPrompt({ systemFragments: [], contextBundle: bundle });

        expect(systemPrompt).not.toContain('完整正文中才会出现的长句');
        expect(bundle.files.find(file => file.path === './.pi/agent/context/project-resources.md')?.content)
            .toContain('项目记忆');
    });

    it('normalizes memory index paths to readable semantic VFS paths', async () => {
        const loader = new ForgePiResourceLoader({
            capabilities: { listCapabilities: vi.fn(() => []) } as any,
            skills: {
                listBuiltInSkills: vi.fn(() => []),
                listProjectSkills: vi.fn(async () => [])
            } as any
        });
        const context = createContext();
        context.forgeMemoryTree = {
            entries: [
                { path: '.\\偏好\\禁忌.md', title: '禁忌', content: '正文', summary: '摘要', updatedAt: 1, source: 'user' },
                { path: '', title: '空路径', content: '正文', summary: '摘要', updatedAt: 2, source: 'system' }
            ],
            lastUpdatedAt: 2
        };

        const bundle = await loader.buildContextBundle(context);
        const memoryIndex = bundle.files.find(file => file.path === './.pi/agent/context/memory-index.md');

        expect(memoryIndex?.content).toContain('./memory/偏好/禁忌.md');
        expect(memoryIndex?.content).toContain('./memory/untitled.md');
        expect(memoryIndex?.content).not.toContain('./memory/.md');
    });
});
