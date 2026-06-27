import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
    buildForgeProjectCenterMenu,
    buildForgeProjectCenterRows
} from '../project/forgeProjectCenterPresentation.js';
import type { ForgeWorkspaceSessionRef } from '../../../types/SessionTypes.js';

const readForgeSessionBrowserSource = (): string =>
    readFileSync(new URL('../project/ForgeSessionBrowser.vue', import.meta.url), 'utf-8');

const extractScopedStyle = (source: string): string => {
    const match = source.match(/<style scoped>([\s\S]*?)<\/style>/);
    if (!match?.[1]) {
        throw new Error('ForgeSessionBrowser.vue scoped style block not found');
    }
    return match[1];
};

const extractRule = (style: string, selectorPattern: RegExp, ruleName: string): string => {
    const match = style.match(selectorPattern);
    if (!match?.[1]) {
        throw new Error(`${ruleName} rule not found`);
    }
    return match[1];
};

const session = (input: Partial<ForgeWorkspaceSessionRef> & {
    id: string;
    title: string;
    updatedAt: number;
}): ForgeWorkspaceSessionRef => ({
    createdAt: input.createdAt ?? input.updatedAt,
    messageCount: input.messageCount ?? 0,
    selectedChatSessionId: null,
    ...input
});

describe('forgeProjectCenterPresentation', () => {
    it('builds a Codex-style tree with only the selected Forge project expanded', () => {
        const rows = buildForgeProjectCenterRows({
            projects: [
                session({
                    id: 'forge_thread_b1',
                    forgeProjectId: 'forge_project_b',
                    projectTitle: 'Project B',
                    title: 'Thread B1',
                    updatedAt: 30
                }),
                session({
                    id: 'forge_thread_a1',
                    forgeProjectId: 'forge_project_a',
                    projectTitle: 'Project A',
                    title: 'Thread A1',
                    updatedAt: 20
                })
            ],
            getThreads: (projectId) => projectId === 'forge_project_a'
                ? [
                    session({
                        id: 'forge_thread_a2',
                        forgeProjectId: 'forge_project_a',
                        projectTitle: 'Project A',
                        title: 'Thread A2',
                        updatedAt: 25,
                        messageCount: 4
                    }),
                    session({
                        id: 'forge_thread_a1',
                        forgeProjectId: 'forge_project_a',
                        projectTitle: 'Project A',
                        title: 'Thread A1',
                        updatedAt: 20,
                        messageCount: 2
                    })
                ]
                : [
                    session({
                        id: 'forge_thread_b1',
                        forgeProjectId: 'forge_project_b',
                        projectTitle: 'Project B',
                        title: 'Thread B1',
                        updatedAt: 30
                    })
                ],
            selectedProjectId: 'forge_project_a',
            activeThreadId: 'forge_thread_a1',
            now: 7 * 24 * 60 * 60 * 1000
        });

        expect(rows.map(row => `${row.kind}:${row.id}`)).toEqual([
            'project:forge_project_b',
            'project:forge_project_a'
        ]);
        expect(rows.find(row => row.id === 'forge_project_a')?.threads.map(row => `${row.kind}:${row.id}`)).toEqual([
            'thread:forge_thread_a2',
            'thread:forge_thread_a1'
        ]);
        expect(rows.find(row => row.id === 'forge_project_a')).toEqual(expect.objectContaining({
            title: 'Project A',
            expanded: true,
            selected: true,
            timeLabel: '1周'
        }));
        expect(rows.find(row => row.id === 'forge_project_a')?.threads.find(row => row.id === 'forge_thread_a1')).toEqual(expect.objectContaining({
            title: 'Thread A1',
            selected: true,
            metaLabel: '2 nodes'
        }));
    });

    it('marks unavailable Codex menu capabilities as disabled without binding active actions', () => {
        expect(buildForgeProjectCenterMenu('project')).toEqual([
            expect.objectContaining({ id: 'create-thread', label: '新建对话', disabled: false }),
            expect.objectContaining({ id: 'pin-project', label: '置顶项目', disabled: true }),
            expect.objectContaining({ id: 'open-resource-manager', label: '在资源管理器中打开', disabled: true }),
            expect.objectContaining({ id: 'create-permanent-worktree', label: '创建永久工作树', disabled: true }),
            expect.objectContaining({ id: 'rename-project', label: '重命名项目', disabled: false }),
            expect.objectContaining({ id: 'archive-conversation', label: '归档对话', disabled: true }),
            expect.objectContaining({ id: 'remove-project', label: '移除', disabled: false })
        ]);
        expect(buildForgeProjectCenterMenu('thread')).toEqual([
            expect.objectContaining({ id: 'open-thread', label: '打开对话', disabled: false }),
            expect.objectContaining({ id: 'rename-thread', label: '重命名对话', disabled: false }),
            expect.objectContaining({ id: 'archive-conversation', label: '归档对话', disabled: true }),
            expect.objectContaining({ id: 'remove-thread', label: '移除', disabled: false })
        ]);
    });

    it('keeps project menus outside tree overflow clipping', () => {
        const style = extractScopedStyle(readForgeSessionBrowserSource());
        const treeRule = extractRule(style, /\.project-tree\s*\{([\s\S]*?)\n\}/, '.project-tree');

        expect(treeRule).toContain('overflow: visible');
        expect(treeRule).not.toContain('overflow: auto');
    });
});
