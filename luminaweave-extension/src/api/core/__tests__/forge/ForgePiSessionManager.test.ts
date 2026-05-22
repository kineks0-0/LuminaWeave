import { describe, expect, it } from 'vitest';
import { ForgePiSessionManager } from '@/api/core/forge/agent-app/session/ForgePiSessionManager.js';

const createManager = () => new ForgePiSessionManager({
    sessionId: 'forge_project__conversation',
    forgeProjectId: 'forge_project',
    conversationId: 'conversation',
    workspaceTitle: 'Forge Project'
}, {
    now: (() => {
        let time = 1000;
        return () => time += 10;
    })(),
    createNodeId: (() => {
        let index = 0;
        return () => `node_${++index}`;
    })()
});

describe('ForgePiSessionManager', () => {
    it('persists flat entries and rebuilds a tree from id / parentId', () => {
        const manager = createManager();

        manager.ensureMetadata();
        manager.append('user', 'User', '第一轮', { role: 'user', text: '第一轮' });
        manager.append('assistant', 'Assistant', '回复 A', { role: 'assistant', text: '回复 A' });
        manager.checkout('node_1');
        manager.append('user', 'User', '分支请求', { role: 'user', text: '分支请求' });

        expect(manager.getEntries().map(entry => ({
            id: entry.id,
            parentId: entry.parentId,
            kind: entry.kind
        }))).toEqual([
            { id: 'node_1', parentId: null, kind: 'metadata' },
            { id: 'node_2', parentId: 'node_1', kind: 'user' },
            { id: 'node_3', parentId: 'node_2', kind: 'assistant' },
            { id: 'node_4', parentId: 'node_1', kind: 'user' }
        ]);
        expect(manager.getTree()).toEqual([
            expect.objectContaining({
                id: 'node_1',
                children: [
                    expect.objectContaining({ id: 'node_2', children: [expect.objectContaining({ id: 'node_3' })] }),
                    expect.objectContaining({ id: 'node_4' })
                ]
            })
        ]);
    });

    it('branches from a user node by checking out its parent and returning editable input', () => {
        const manager = createManager();

        manager.ensureMetadata();
        manager.append('user', 'User', '原请求', { role: 'user', text: '原请求' });
        manager.append('assistant', 'Assistant', '原回复', { role: 'assistant', text: '原回复' });

        const result = manager.createBranchFromUserNode('node_2');

        expect(result).toEqual({
            activeNodeId: 'node_1',
            input: '原请求',
            userNodeId: 'node_2'
        });
        expect(manager.getActiveNodeId()).toBe('node_1');
    });

    it('hydrates from persisted entries without mutating the entry list', () => {
        const manager = createManager();
        manager.ensureMetadata();
        manager.append('context_bundle', 'Context bundle', '1 file', {
            contextBundle: {
                files: [{ path: 'context/project.md', title: '项目', content: '内容' }],
                activeSkills: ['中文技能'],
                loadedExtensions: ['@luminaweave/forge']
            }
        });

        const restored = new ForgePiSessionManager({
            sessionId: 'forge_project__conversation',
            forgeProjectId: 'forge_project',
            conversationId: 'conversation',
            workspaceTitle: 'Forge Project'
        }, {
            initialState: manager.toPersistedState()
        });

        expect(restored.getSnapshot().entries).toHaveLength(2);
        expect(restored.getSnapshot().contextBundleSummary?.activeSkills).toEqual(['中文技能']);
        expect(restored.getActiveNodeId()).toBe('node_2');
    });
});
