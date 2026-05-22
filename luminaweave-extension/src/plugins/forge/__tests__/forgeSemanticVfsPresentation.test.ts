import { describe, expect, it } from 'vitest';
import type { ForgePiContextBundleSummary, ForgePiSessionEntry } from '@shared/ForgePiTypes.js';
import {
    buildForgeSemanticVfsTree,
    flattenForgeSemanticVfsTree
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
            path: './.forge/agent/PLANNER.md',
            title: 'Planner',
            content: 'Planner prompt'
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
            './.forge/agent/UI_DSL.md',
            './.forge/agent/REASONING.md',
            './.forge/agent/PLANNER.md',
            './.forge/agent/CONVERSATION.md',
            './.forge/agent/ANALYST.md',
            './.forge/agent/EXECUTOR.md',
            './agent/skills/virtual-lorebook-editor/SKILL.md',
            './threads/目前/messages.md',
            '/library/',
            '/sources/'
        ]));
        expect(rows.map(row => row.path)).not.toContain('./.forge/PLANNER.md');
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

    it('projects session history and workspace patches into user-facing semantic paths', () => {
        const rows = flattenForgeSemanticVfsTree(buildForgeSemanticVfsTree({
            contextBundle,
            sessionEntries: [
                entry('n1', null, 'metadata', {}),
                entry('n2', 'n1', 'user', { role: 'user', text: '第一轮' }),
                entry('n3', 'n2', 'workspace_patch', {
                    nodeId: 'n3',
                    changes: [{
                        path: './card.md',
                        kind: 'update',
                        beforeHash: 'before',
                        afterHash: 'after',
                        beforeContentRef: 'inline:old',
                        afterContentRef: 'inline:new'
                    }]
                })
            ],
            activeNodeId: 'n3'
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
});
