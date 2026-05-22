import { describe, expect, it } from 'vitest';
import { ForgeSemanticVfsMapper } from '@/api/core/forge/agent-app/vfs/ForgeSemanticVfsMapper.js';

const mapper = new ForgeSemanticVfsMapper();

describe('ForgeSemanticVfsMapper', () => {
    it('maps AGENTS.md as a virtual default context file', () => {
        const resolved = mapper.resolveAgentPath({
            path: './AGENTS.md',
            forgeProjectId: 'forge_project_alpha',
            conversationId: 'conversation_alpha',
            threadTitle: '协作线程'
        });

        expect(resolved).toEqual({
            kind: 'virtual',
            inputPath: './AGENTS.md',
            displayPath: './AGENTS.md'
        });
    });

    it('maps ordinary project-relative paths to the current Forge workspace', () => {
        const resolved = mapper.resolveAgentPath({
            path: './lorebook/entry.json',
            forgeProjectId: 'forge_project_alpha',
            conversationId: 'conversation_alpha',
            threadTitle: '协作线程'
        });

        expect(resolved).toEqual({
            kind: 'workspace',
            inputPath: './lorebook/entry.json',
            displayPath: './lorebook/entry.json',
            workspacePath: '/workspaces/forge/forge_project_alpha/lorebook/entry.json'
        });
    });

    it('keeps absolute resource VFS paths as bottom-layer VFS access', () => {
        const resolved = mapper.resolveAgentPath({
            path: '/library/lorebooks/world.json',
            forgeProjectId: 'forge_project_alpha',
            conversationId: 'conversation_alpha',
            threadTitle: '协作线程'
        });

        expect(resolved).toEqual({
            kind: 'resource-vfs',
            inputPath: '/library/lorebooks/world.json',
            displayPath: '/library/lorebooks/world.json',
            resourcePath: '/library/lorebooks/world.json'
        });
    });

    it('maps the current thread alias without exposing conversation ids', () => {
        const resolved = mapper.resolveAgentPath({
            path: './threads/目前/messages.json',
            forgeProjectId: 'forge_project_alpha',
            conversationId: 'conversation_alpha',
            threadTitle: '协作线程'
        });

        expect(resolved).toEqual({
            kind: 'workspace',
            inputPath: './threads/目前/messages.json',
            displayPath: './threads/目前/messages.json',
            workspacePath: '/workspaces/forge/forge_project_alpha/chat/conversation_alpha/messages.json'
        });
    });

    it('maps stable thread labels without exposing ids to the display path', () => {
        const resolved = mapper.resolveAgentPath({
            path: './threads/01协作线程/messages.json',
            forgeProjectId: 'forge_project_alpha',
            conversationId: 'conversation_alpha',
            stableThreads: [{
                label: '01协作线程',
                conversationId: 'conversation_beta'
            }]
        });

        expect(resolved).toEqual({
            kind: 'workspace',
            inputPath: './threads/01协作线程/messages.json',
            displayPath: './threads/01协作线程/messages.json',
            workspacePath: '/workspaces/forge/forge_project_alpha/chat/conversation_beta/messages.json'
        });
    });

    it('renders workspace paths back to semantic project paths', () => {
        expect(mapper.toAgentDisplayPath({
            path: '/workspaces/forge/forge_project_alpha/chat/conversation_alpha/messages.json',
            forgeProjectId: 'forge_project_alpha',
            conversationId: 'conversation_alpha',
            threadTitle: '协作线程'
        })).toBe('./threads/目前/messages.json');

        expect(mapper.toAgentDisplayPath({
            path: '/workspaces/forge/forge_project_alpha/lorebook/entry.json',
            forgeProjectId: 'forge_project_alpha',
            conversationId: 'conversation_alpha',
            threadTitle: '协作线程'
        })).toBe('./lorebook/entry.json');
    });

    it('rewrites relative raw chat paths in shell output to semantic thread aliases', () => {
        const rewritten = mapper.rewriteTextToAgentDisplay({
            text: [
                './chat/conversation_alpha/messages.json',
                'chat/conversation_alpha/thread.json',
                '/workspaces/forge/forge_project_alpha/chat/conversation_alpha/messages.json'
            ].join('\n'),
            forgeProjectId: 'forge_project_alpha',
            conversationId: 'conversation_alpha'
        });

        expect(rewritten).toContain('./threads/目前/messages.json');
        expect(rewritten).toContain('./threads/目前/thread.json');
        expect(rewritten).not.toContain('conversation_alpha');
        expect(rewritten).not.toContain('./chat/');
    });
});
