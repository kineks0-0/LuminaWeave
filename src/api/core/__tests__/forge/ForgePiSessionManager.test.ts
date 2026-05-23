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

    it('replays only provider-safe reasoning artifacts instead of raw thinking', () => {
        const manager = createManager();
        manager.ensureMetadata();
        manager.append('assistant', 'Assistant', '可见结论', {
            agentMessage: {
                role: 'assistant',
                content: [
                    { type: 'thinking', thinking: 'provider signed reasoning', thinkingSignature: 'sig-ok' },
                    { type: 'thinking', thinking: 'raw private chain of thought' },
                    { type: 'text', text: '可见结论' },
                    {
                        type: 'toolCall',
                        id: 'call_read',
                        name: 'readFile',
                        arguments: { path: './AGENTS.md' },
                        thoughtSignature: 'tool-sig'
                    }
                ],
                api: 'anthropic-messages',
                provider: 'anthropic',
                model: 'claude-sonnet-4-5',
                usage: {
                    input: 0,
                    output: 0,
                    cacheRead: 0,
                    cacheWrite: 0,
                    totalTokens: 0,
                    cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 }
                },
                stopReason: 'toolUse',
                timestamp: 1010
            },
            text: '可见结论'
        } as any);

        const sameProviderReplay = manager.getBranchMessages({
            providerId: 'anthropic',
            modelId: 'claude-sonnet-4-5'
        });
        const crossProviderReplay = manager.getBranchMessages({
            providerId: 'openai',
            modelId: 'gpt-5'
        });

        expect(sameProviderReplay[0]).toMatchObject({
            role: 'assistant',
            content: [
                { type: 'thinking', thinkingSignature: 'sig-ok' },
                { type: 'text', text: '可见结论' },
                { type: 'toolCall', id: 'call_read', thoughtSignature: 'tool-sig' }
            ]
        });
        expect(JSON.stringify(sameProviderReplay)).not.toContain('raw private chain of thought');
        expect(crossProviderReplay[0]).toMatchObject({
            role: 'assistant',
            content: [
                { type: 'text', text: '可见结论' },
                { type: 'toolCall', id: 'call_read', thoughtSignature: 'tool-sig' }
            ]
        });
        expect(JSON.stringify(crossProviderReplay)).not.toContain('provider signed reasoning');
    });

    it('trims branch messages while preserving assistant tool calls with their tool results', () => {
        const manager = createManager();
        manager.ensureMetadata();
        manager.append('user', 'User', '旧请求', {
            agentMessage: { role: 'user', content: '旧请求', timestamp: 1 }
        } as any);
        manager.append('assistant', 'Assistant', '需要读文件', {
            agentMessage: {
                role: 'assistant',
                content: [{
                    type: 'toolCall',
                    id: 'call_read',
                    name: 'readFile',
                    arguments: { path: './AGENTS.md' }
                }],
                api: 'openai-completions',
                provider: 'openai',
                model: 'gpt-5',
                usage: {
                    input: 0,
                    output: 0,
                    cacheRead: 0,
                    cacheWrite: 0,
                    totalTokens: 0,
                    cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 }
                },
                stopReason: 'toolUse',
                timestamp: 2
            }
        } as any);
        manager.append('tool_result', 'Tool result · readFile', '结果', {
            agentMessage: {
                role: 'toolResult',
                toolCallId: 'call_read',
                toolName: 'readFile',
                content: [{ type: 'text', text: 'AGENTS' }],
                isError: false,
                timestamp: 3
            }
        } as any);
        manager.append('user', 'User', '继续', {
            agentMessage: { role: 'user', content: '继续', timestamp: 4 }
        } as any);

        const messages = manager.getBranchMessages({
            providerId: 'openai',
            modelId: 'gpt-5',
            maxMessages: 2
        });

        expect(messages.map(message => message.role)).toEqual(['assistant', 'toolResult', 'user']);
        expect(messages[0]).toMatchObject({
            role: 'assistant',
            content: [expect.objectContaining({ type: 'toolCall', id: 'call_read' })]
        });
        expect(messages[1]).toMatchObject({
            role: 'toolResult',
            toolCallId: 'call_read'
        });
    });
});
