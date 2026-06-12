import { describe, expect, it } from 'vitest';

import {
    buildForgePiRuntimePresentation,
    buildForgePiSkillComparison
} from '../inspector/forgePiRuntimePresentation.js';

describe('forgePiRuntimePresentation', () => {
    it('summarizes pi context files, active node, tree rows, skills, and extensions', () => {
        const presentation = buildForgePiRuntimePresentation({
            contextBundleSummary: {
                files: [
                    { path: 'context/project.md', title: '项目概况', content: '# Forge Alpha\n长内容'.repeat(20) },
                    { path: 'context/review-gate.md', title: 'Review Gate', content: '写入必须审阅。' }
                ],
                activeSkills: ['虚拟世界书编辑'],
                loadedExtensions: ['@luminaweave/forge-browser-adapters']
            },
            tree: [
                {
                    id: 'node_1',
                    sessionId: 'session_1',
                    parentId: null,
                    kind: 'metadata',
                    title: 'Session',
                    summary: 'root',
                    createdAt: 100,
                    payload: {},
                    children: []
                },
                {
                    id: 'node_2',
                    sessionId: 'session_1',
                    parentId: 'node_1',
                    kind: 'tool_result',
                    title: 'Tool result',
                    summary: 'staged',
                    createdAt: 120,
                    payload: {},
                    children: []
                }
            ],
            activeNodeId: 'node_2',
            loadedSkills: ['虚拟世界书编辑'],
            loadedExtensions: ['@luminaweave/forge-browser-adapters'],
            agentRuntimeSnapshot: {
                isStreaming: true,
                pendingToolCalls: [{
                    toolCallId: 'call_read',
                    toolName: 'read',
                    args: { path: './agent/skills/card/SKILL.md' },
                    status: 'running',
                    updates: []
                }],
                messages: [{
                    id: 'req_1',
                    role: 'assistant',
                    blocks: [
                        { type: 'text', text: '已读取技能。' },
                        { type: 'thinking', text: '整理文件变更。' }
                    ],
                    status: 'streaming'
                }],
                activeTools: [
                    { name: 'read', description: '读取文件', needsApproval: false },
                    { name: 'edit', description: '编辑文件', needsApproval: true }
                ],
                queue: {
                    queuedTurns: 1,
                    activeTurnId: 'req_1'
                }
            }
        });

        expect(presentation.hasState).toBe(true);
        expect(presentation.contextFiles).toEqual([
            expect.objectContaining({ path: 'context/project.md', title: '项目概况' }),
            expect.objectContaining({ path: 'context/review-gate.md', title: 'Review Gate', preview: '写入必须审阅。' })
        ]);
        expect(presentation.contextFiles[0].preview.length).toBeLessThanOrEqual(163);
        expect(presentation.activeNode).toEqual(expect.objectContaining({
            id: 'node_2',
            kind: 'tool_result'
        }));
        expect(presentation.treeRows).toEqual([
            expect.objectContaining({ id: 'node_1', depth: 0 }),
            expect.objectContaining({ id: 'node_2', depth: 1, active: true })
        ]);
        expect(presentation.skills).toEqual(['虚拟世界书编辑']);
        expect(presentation.extensions).toEqual(['@luminaweave/forge-browser-adapters']);
        expect(presentation.runtime).toEqual(expect.objectContaining({
            isStreaming: true,
            messageCount: 1,
            pendingToolCount: 1,
            activeToolCount: 2,
            queueLabel: '1 queued · active req_1'
        }));
        expect(presentation.runtime?.messages).toEqual([expect.objectContaining({
            id: 'req_1',
            role: 'assistant',
            preview: '已读取技能。 整理文件变更。'
        })]);
        expect(presentation.runtime?.pendingToolCalls).toEqual([expect.objectContaining({
            toolCallId: 'call_read',
            toolName: 'read',
            argsPreview: '{ "path": "./agent/skills/card/SKILL.md" }'
        })]);
    });

    it('compares Graph suggested skills with pi loaded skills', () => {
        const comparison = buildForgePiSkillComparison(
            ['虚拟世界书编辑', '反套路审阅'],
            ['虚拟世界书编辑', '角色骨架']
        );

        expect(comparison.shared).toEqual(['虚拟世界书编辑']);
        expect(comparison.graphOnly).toEqual(['反套路审阅']);
        expect(comparison.piOnly).toEqual(['角色骨架']);
    });
});
