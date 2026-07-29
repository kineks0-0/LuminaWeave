import { Type } from '@earendil-works/pi-ai';
import { describe, expect, it, vi } from 'vitest';
import { AgentToolRegistry, type AgentRuntimeTool } from '@/api/core/agent-runtime/tools/AgentToolRegistry.js';
import { AgentRuntimeEventBus } from '@/api/core/agent-runtime/events/AgentRuntimeEventBus.js';

const scope = { sessionId: 'session_1', turnId: 'turn_1' } as const;

describe('AgentToolRegistry', () => {
    it('starts empty and only exposes tools registered by the adapter', () => {
        const registry = new AgentToolRegistry();

        expect(registry.listTools()).toEqual([]);
        expect(registry.getToolSummary()).toEqual([]);
    });

    it('executes a registered tool and rejects unknown tools', async () => {
        const execute = vi.fn(async (_toolCallId: string, args: { query: string }) => ({
            content: [{ type: 'text' as const, text: `found:${args.query}` }],
            details: { query: args.query }
        }));
        const registry = new AgentToolRegistry();
        const tool: AgentRuntimeTool<{ query: string }, { query: string }> = {
            name: 'search',
            description: 'Search mounted context.',
            parameters: Type.Object({ query: Type.String() }),
            execute
        };
        registry.register(tool);

        await expect(registry.execute({
            ...scope,
            toolCallId: 'call_search',
            toolName: 'search',
            args: { query: 'auth' }
        })).resolves.toMatchObject({
            status: 'executed',
            result: { details: { query: 'auth' } }
        });
        await expect(registry.execute({
            ...scope,
            toolCallId: 'call_missing',
            toolName: 'missing',
            args: {}
        })).rejects.toThrow('Agent tool not registered: missing');
    });

    it('pauses approval-gated tools and resumes only after explicit approval', async () => {
        const execute = vi.fn(async (_toolCallId: string, args: { path: string }) => ({
            content: [{ type: 'text' as const, text: `wrote:${args.path}` }],
            details: { path: args.path }
        }));
        const registry = new AgentToolRegistry();
        const tool: AgentRuntimeTool<{ path: string }, { path: string }> = {
            name: 'writeFile',
            description: 'Write a file.',
            parameters: Type.Object({ path: Type.String() }),
            needsApproval: true,
            execute
        };
        registry.register(tool);

        const paused = await registry.execute({
            ...scope,
            toolCallId: 'call_write',
            toolName: 'writeFile',
            args: { path: './card.md' }
        });
        expect(paused).toEqual({
            status: 'approval_required',
            approval: {
                approvalId: 'approval-call_write',
                ...scope,
                toolCallId: 'call_write',
                toolName: 'writeFile',
                args: { path: './card.md' }
            }
        });
        expect(execute).not.toHaveBeenCalled();

        await expect(registry.resolveToolApproval(scope.sessionId, scope.turnId, 'call_write', true, 'ok')).resolves.toMatchObject({
            status: 'approved',
            result: { details: { path: './card.md' } }
        });
        expect(execute).toHaveBeenCalledTimes(1);
    });

    it('denies approval-gated tools without executing them', async () => {
        const execute = vi.fn();
        const registry = new AgentToolRegistry();
        registry.register({
            name: 'deleteFile',
            description: 'Delete a file.',
            parameters: Type.Object({ path: Type.String() }),
            needsApproval: true,
            execute
        });

        await registry.execute({
            ...scope,
            toolCallId: 'call_delete',
            toolName: 'deleteFile',
            args: { path: './card.md' }
        });

        await expect(registry.resolveToolApproval(scope.sessionId, scope.turnId, 'call_delete', false, 'no')).resolves.toEqual({
            status: 'denied',
            approval: {
                approvalId: 'approval-call_delete',
                ...scope,
                toolCallId: 'call_delete',
                toolName: 'deleteFile',
                args: { path: './card.md' }
            },
            message: 'no'
        });
        expect(execute).not.toHaveBeenCalled();
    });

    it('can filter visible tools by adapter-provided phase context without registering defaults', async () => {
        const registry = new AgentToolRegistry({
            visibilityFilter: (tool, context) =>
                context?.phaseId === 'write' || tool.name !== 'writeFile'
        });
        registry.register({
            name: 'readFile',
            description: 'Read files.',
            parameters: Type.Object({ path: Type.String() }),
            execute: vi.fn()
        });
        registry.register({
            name: 'writeFile',
            description: 'Write files.',
            parameters: Type.Object({ path: Type.String() }),
            execute: vi.fn()
        });

        expect(registry.getToolSummary({ phaseId: 'inspect' }).map(tool => tool.name)).toEqual(['readFile']);
        expect(registry.getToolSummary({ phaseId: 'write' }).map(tool => tool.name)).toEqual(['readFile', 'writeFile']);
        await expect(registry.execute({
            ...scope,
            toolCallId: 'call_write',
            toolName: 'writeFile',
            args: { path: './card.md' },
            visibility: { phaseId: 'inspect' }
        })).rejects.toThrow('Agent tool not visible in this phase: writeFile');
    });

    it('emits tool execution events to an optional runtime event bus for manually registered tools', async () => {
        const events = new AgentRuntimeEventBus();
        const registry = new AgentToolRegistry({ events });
        registry.register({
            name: 'search',
            description: 'Search mounted context.',
            parameters: Type.Object({ query: Type.String() }),
            execute: async (_toolCallId, args) => ({
                content: [{ type: 'text', text: `found:${(args as { query: string }).query}` }],
                details: { query: (args as { query: string }).query }
            })
        });

        await expect(registry.execute({
            ...scope,
            toolCallId: 'call_search',
            toolName: 'search',
            args: { query: 'auth' }
        })).resolves.toMatchObject({
            status: 'executed',
            result: { details: { query: 'auth' } }
        });

        expect(events.getEvents({ sessionId: scope.sessionId, turnId: scope.turnId })).toEqual([
            {
                type: 'tool_execution_start',
                ...scope,
                toolCallId: 'call_search',
                toolName: 'search',
                args: { query: 'auth' }
            },
            {
                type: 'tool_execution_update',
                ...scope,
                toolCallId: 'call_search',
                toolName: 'search',
                content: [{ type: 'text', text: 'found:auth' }]
            },
            {
                type: 'tool_execution_end',
                ...scope,
                toolCallId: 'call_search',
                toolName: 'search',
                status: 'completed',
                result: {
                    content: [{ type: 'text', text: 'found:auth' }],
                    details: { query: 'auth' }
                }
            }
        ]);
        expect(events.getSnapshot(scope.sessionId).pendingToolCalls).toEqual([]);
    });

    it('lets extension hooks modify tool args and final results', async () => {
        const registry = new AgentToolRegistry();
        const execute = vi.fn(async (_toolCallId: string, args: { query: string }) => ({
            content: [{ type: 'text' as const, text: `raw:${args.query}` }],
            details: { query: args.query }
        }));
        registry.onBeforeToolCall(async call => ({
            args: {
                ...(call.args as { query: string }),
                query: 'normalized'
            }
        }));
        registry.onAfterToolResult(async result => ({
            ...result.result,
            content: [{ type: 'text', text: 'rewritten result' }],
            details: {
                ...(result.result.details as Record<string, unknown>),
                extension: 'after-hook'
            }
        }));
        registry.register({
            name: 'search',
            description: 'Search mounted context.',
            parameters: Type.Object({ query: Type.String() }),
            execute
        });

        await expect(registry.execute({
            ...scope,
            toolCallId: 'call_search',
            toolName: 'search',
            args: { query: 'raw' }
        })).resolves.toEqual({
            status: 'executed',
            result: {
                content: [{ type: 'text', text: 'rewritten result' }],
                details: { query: 'normalized', extension: 'after-hook' }
            }
        });
        expect(execute).toHaveBeenCalledWith('call_search', { query: 'normalized' });
    });

    it('lets extension hooks block tool calls before approval or execution', async () => {
        const registry = new AgentToolRegistry();
        const execute = vi.fn();
        registry.onBeforeToolCall(async call => {
            const args = call.args as { path: string };
            if (args.path.startsWith('/protected/')) {
                return {
                    block: {
                        message: 'protected path',
                        details: { path: args.path }
                    }
                };
            }
            return undefined;
        });
        registry.register({
            name: 'write',
            description: 'Write files.',
            parameters: Type.Object({ path: Type.String() }),
            needsApproval: true,
            execute
        });

        await expect(registry.execute({
            ...scope,
            toolCallId: 'call_write',
            toolName: 'write',
            args: { path: '/protected/card.md' }
        })).resolves.toEqual({
            status: 'blocked',
            message: 'protected path',
            result: {
                content: [{ type: 'text', text: 'protected path' }],
                details: { path: '/protected/card.md' }
            }
        });
        expect(execute).not.toHaveBeenCalled();
    });
});
