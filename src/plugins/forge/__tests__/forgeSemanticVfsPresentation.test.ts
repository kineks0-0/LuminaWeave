import { describe, expect, it } from 'vitest';
import type { ForgePiContextBundleSummary, ForgePiSessionEntry } from '@shared/ForgePiTypes.js';
import {
    buildForgeProjectVfsPanelTree,
    buildForgeSemanticVfsTree,
    flattenForgeSemanticVfsTree,
    isForgeAgentResourceOverridePath
} from '../project/forgeSemanticVfsPresentation.js';

const contextBundle: ForgePiContextBundleSummary = {
    files: [
        {
            path: './AGENTS.md',
            title: '工作契约',
            content: [
                'Forge project contract',
                '第二行：用于验证 VFS 面板显示完整文件内容。',
                '第三行：不能只显示压缩 preview。'
            ].join('\n')
        },
        {
            path: './threads/目前/messages.md',
            title: '当前协作线程',
            content: 'User: 测试语义 VFS'
        },
        {
            path: './.forge/agent/EXECUTOR.md',
            title: 'Executor',
            content: 'Executor prompt'
        }
    ],
    activeSkills: ['virtual-lorebook-editor'],
    loadedExtensions: ['forge.readFile', 'forge.writeFile']
};

const entry = (
    id: string,
    parentId: string | null,
    kind: ForgePiSessionEntry['kind'],
    payload: ForgePiSessionEntry['payload']
): ForgePiSessionEntry => ({
    id,
    sessionId: 'forge_project__conversation',
    parentId,
    kind,
    title: kind,
    summary: `${kind} summary`,
    createdAt: Number(id.replace(/\D/g, '') || 0),
    payload
});

describe('forgeSemanticVfsPresentation', () => {
    it('can build the panel tree from actual project VFS files without synthetic agent files', () => {
        const rows = flattenForgeSemanticVfsTree(buildForgeSemanticVfsTree({
            contextBundle,
            sessionEntries: [],
            activeNodeId: null,
            includeAgentVirtualFiles: false,
            projectFiles: [
                {
                    path: './lorebook/entries/',
                    kind: 'directory',
                    content: null
                },
                {
                    path: './project.json',
                    kind: 'file',
                    content: '{"title":"实际项目"}'
                },
                {
                    path: './lorebook/entries/city.json',
                    kind: 'file',
                    content: '{"id":"city"}'
                }
            ]
        }));

        expect(rows.map(row => row.path)).toEqual(expect.arrayContaining([
            './',
            './project.json',
            './lorebook/entries/city.json'
        ]));
        expect(rows.map(row => row.path)).not.toContain('./.forge/agent/PLANNER.md');
        expect(rows.map(row => row.path)).not.toContain('./threads/目前/messages.md');
        expect(rows.find(row => row.path === './project.json')).toEqual(expect.objectContaining({
            source: 'workspace',
            kind: 'file',
            writePolicy: 'direct-write',
            content: '{"title":"实际项目"}'
        }));
        expect(rows.find(row => row.path === './lorebook/entries/')).toEqual(expect.objectContaining({
            source: 'workspace',
            kind: 'directory',
            writePolicy: 'direct-write',
            content: expect.stringContaining('./lorebook/entries/city.json')
        }));
    });

    it('shows empty project VFS directories as browsable nodes', () => {
        const rows = flattenForgeSemanticVfsTree(buildForgeSemanticVfsTree({
            contextBundle,
            sessionEntries: [],
            activeNodeId: null,
            includeAgentVirtualFiles: false,
            projectFiles: [
                {
                    path: './lorebook/entries/',
                    kind: 'directory',
                    content: null
                }
            ]
        }));

        expect(rows.find(row => row.path === './lorebook/entries/')).toEqual(expect.objectContaining({
            kind: 'directory',
            content: '空目录'
        }));
    });

    it('can add current session projection to the project VFS panel without default agent files', () => {
        const rows = flattenForgeSemanticVfsTree(buildForgeProjectVfsPanelTree({
            sessionEntries: [
                entry('n1', null, 'metadata', {}),
                entry('n2', 'n1', 'user', { role: 'user', text: '请更新检查清单' })
            ],
            activeNodeId: 'n2',
            projectFiles: [
                {
                    path: './project.json',
                    kind: 'file',
                    content: '{"title":"实际项目"}'
                },
                {
                    path: './memory/AUTO/Checklist.md',
                    kind: 'file',
                    content: '- [ ] 已更新'
                }
            ]
        }));

        expect(rows.map(row => row.path)).toEqual(expect.arrayContaining([
            './project.json',
            './threads/目前/nodes/n2.md',
            './memory/AUTO/Checklist.md'
        ]));
        expect(rows.map(row => row.path)).not.toContain('./.forge/agent/PLANNER.md');
        expect(rows.find(row => row.path === './threads/目前/nodes/n2.md')).toEqual(expect.objectContaining({
            source: 'session',
            writePolicy: 'read-only',
            label: 'User',
            content: '请更新检查清单'
        }));
        expect(rows.find(row => row.path === './memory/AUTO/Checklist.md')).toEqual(expect.objectContaining({
            source: 'workspace',
            writePolicy: 'direct-write',
            content: '- [ ] 已更新'
        }));
    });

    it('builds a stable semantic VFS tree with default prompts, skills and thread alias', () => {
        const tree = buildForgeSemanticVfsTree({
            contextBundle,
            sessionEntries: [],
            activeNodeId: null
        });

        const rows = flattenForgeSemanticVfsTree(tree);
        expect(rows.map(row => row.path)).toEqual(expect.arrayContaining([
            './',
            './AGENTS.md',
            './.forge/agent/SYSTEM.md',
            './.forge/agent/EXECUTOR.md',
            './.forge/agent/UI_DSL.md',
            './.forge/agent/REASONING.md',
            './agent/skills/virtual-lorebook-editor/SKILL.md',
            './threads/目前/messages.md',
            '/library/',
            '/sources/'
        ]));
        expect(rows.map(row => row.path)).not.toContain('./.forge/agent/PLANNER.md');
        expect(rows.map(row => row.path)).not.toContain('./.forge/agent/CONVERSATION.md');
        expect(rows.map(row => row.path)).not.toContain('./.forge/agent/ANALYST.md');
        expect(rows.find(row => row.path === './threads/目前/messages.md')).toEqual(expect.objectContaining({
            source: 'context',
            writePolicy: 'read-only',
            preview: 'User: 测试语义 VFS',
            content: 'User: 测试语义 VFS'
        }));
        expect(rows.find(row => row.path === './AGENTS.md')).toEqual(expect.objectContaining({
            content: [
                'Forge project contract',
                '第二行：用于验证 VFS 面板显示完整文件内容。',
                '第三行：不能只显示压缩 preview。'
            ].join('\n')
        }));
    });

    it('projects session history and project files into user-facing semantic paths', () => {
        const rows = flattenForgeSemanticVfsTree(buildForgeSemanticVfsTree({
            contextBundle,
            sessionEntries: [
                entry('n1', null, 'metadata', {}),
                entry('n2', 'n1', 'user', { role: 'user', text: '第一轮' })
            ],
            activeNodeId: 'n2',
            projectFiles: [{
                path: './card.md',
                kind: 'file',
                content: '# Card'
            }]
        }));

        expect(rows.find(row => row.path === './threads/目前/nodes/n2.md')).toEqual(expect.objectContaining({
            source: 'session',
            writePolicy: 'read-only',
            label: 'User',
            content: '第一轮'
        }));
        expect(rows.find(row => row.path === './card.md')).toEqual(expect.objectContaining({
            source: 'workspace',
            writePolicy: 'direct-write',
            label: 'card.md'
        }));
    });

    it('recognizes only managed Forge agent resources as project override paths', () => {
        expect(isForgeAgentResourceOverridePath('./AGENTS.md')).toBe(true);
        expect(isForgeAgentResourceOverridePath('./.forge/agent/SYSTEM.md')).toBe(true);
        expect(isForgeAgentResourceOverridePath('./.forge/agent/EXECUTOR.md')).toBe(true);
        expect(isForgeAgentResourceOverridePath('./agent/skills/reference-needs-capture/SKILL.md')).toBe(true);

        expect(isForgeAgentResourceOverridePath('./.forge/agent/CONVERSATION.md')).toBe(false);
        expect(isForgeAgentResourceOverridePath('./.forge/agent/UI_DSL.md')).toBe(false);
        expect(isForgeAgentResourceOverridePath('./.forge/agent/REASONING.md')).toBe(false);
        expect(isForgeAgentResourceOverridePath('./memory/用户偏好.md')).toBe(false);
        expect(isForgeAgentResourceOverridePath('./agent/skills/../escape/SKILL.md')).toBe(false);
    });
});
