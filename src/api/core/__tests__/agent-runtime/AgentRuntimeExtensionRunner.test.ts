import { Type } from '@earendil-works/pi-ai';
import { describe, expect, it, vi } from 'vitest';
import {
    AgentRuntimeExtensionRunner,
    type AgentRuntimeExtension
} from '@/api/core/agent-runtime/extensions/AgentRuntimeExtensionRunner.js';
import { AgentToolRegistry } from '@/api/core/agent-runtime/tools/AgentToolRegistry.js';

describe('AgentRuntimeExtensionRunner', () => {
    it('loads code-configured extensions and registers tools through the shared registry', async () => {
        const tools = new AgentToolRegistry();
        const extension: AgentRuntimeExtension = {
            id: 'test-extension',
            setup: context => {
                context.tools.register({
                    name: 'inspect',
                    description: 'Inspect context.',
                    parameters: Type.Object({ query: Type.String() }),
                    execute: async (_toolCallId, args: { query: string }) => ({
                        content: [{ type: 'text', text: `inspected:${args.query}` }],
                        details: args
                    })
                });
            }
        };

        const runner = new AgentRuntimeExtensionRunner({ tools, extensions: [extension] });
        await runner.setup();

        expect(tools.getToolSummary().map(tool => tool.name)).toEqual(['inspect']);
        await expect(tools.execute({
            sessionId: 'session-1',
            turnId: 'turn-1',
            toolCallId: 'call_inspect',
            toolName: 'inspect',
            args: { query: 'skill' }
        })).resolves.toMatchObject({
            status: 'executed',
            result: { content: [{ type: 'text', text: 'inspected:skill' }] }
        });
    });

    it('chains before-agent-start hooks and resource discovery without scanning directories', async () => {
        const first: AgentRuntimeExtension = {
            id: 'first',
            setup: context => {
                context.events.onBeforeAgentStart(async event => ({
                    messages: [
                        {
                            customType: 'hidden-skill-index',
                            content: `skills:\n- writer: ./agent/skills/writer/SKILL.md`,
                            display: false
                        }
                    ],
                    systemPrompt: `${event.systemPrompt}\nfirst`
                }));
                context.resources.onDiscover(async () => ({
                    skillPaths: ['./agent/skills/writer/SKILL.md'],
                    promptPaths: ['./.forge/agent/SYSTEM.md']
                }));
            }
        };
        const second: AgentRuntimeExtension = {
            id: 'second',
            setup: context => {
                context.events.onBeforeAgentStart(async event => ({
                    systemPrompt: `${event.systemPrompt}\nsecond`
                }));
            }
        };

        const runner = new AgentRuntimeExtensionRunner({
            tools: new AgentToolRegistry(),
            extensions: [first, second]
        });
        await runner.setup();

        await expect(runner.emitBeforeAgentStart({
            prompt: 'hello',
            systemPrompt: 'base'
        })).resolves.toEqual({
            messages: [
                {
                    customType: 'hidden-skill-index',
                    content: `skills:\n- writer: ./agent/skills/writer/SKILL.md`,
                    display: false
                }
            ],
            systemPrompt: 'base\nfirst\nsecond'
        });
        await expect(runner.discoverResources({ reason: 'startup' })).resolves.toEqual({
            skillPaths: ['./agent/skills/writer/SKILL.md'],
            promptPaths: ['./.forge/agent/SYSTEM.md']
        });
    });

    it('does not run stale extension contexts after invalidation', async () => {
        const handler = vi.fn();
        const extension: AgentRuntimeExtension = {
            id: 'stale-check',
            setup: context => {
                context.events.onAgentEnd(handler);
            }
        };
        const runner = new AgentRuntimeExtensionRunner({
            tools: new AgentToolRegistry(),
            extensions: [extension]
        });
        await runner.setup();

        runner.invalidate('extension runtime replaced');

        await expect(runner.emitAgentEnd({ messages: [] })).rejects.toThrow('extension runtime replaced');
        expect(handler).not.toHaveBeenCalled();
    });

    it('collects extension workflow projection and continuation requests', async () => {
        const extension: AgentRuntimeExtension = {
            id: 'plan-mode',
            setup: context => {
                context.workflow.appendCustomMessage({
                    customType: 'plan-progress',
                    content: { done: 1, total: 3 },
                    display: true,
                    persist: true
                });
                context.workflow.setStatus({
                    id: 'plan-mode',
                    label: 'Plan mode',
                    state: 'running',
                    details: { remaining: 2 }
                });
                context.workflow.setWidget({
                    id: 'todo-list',
                    title: 'Todo',
                    content: [{ id: 'step-1', text: 'Read files', done: true }]
                });
                context.workflow.requestContinuation({
                    id: 'continue-plan',
                    reason: 'remaining-steps',
                    prompt: 'Continue with step 2'
                });
            }
        };
        const runner = new AgentRuntimeExtensionRunner({
            tools: new AgentToolRegistry(),
            extensions: [extension],
            resolvedExtensionPaths: [{
                extensionId: 'plan-mode',
                path: './.forge/agent/extensions/plan-mode.ts',
                source: 'code-config'
            }]
        });
        await runner.setup();

        expect(runner.getWorkflowProjection()).toEqual({
            customMessages: [{
                customType: 'plan-progress',
                content: { done: 1, total: 3 },
                display: true,
                persist: true
            }],
            statuses: [{
                id: 'plan-mode',
                label: 'Plan mode',
                state: 'running',
                details: { remaining: 2 }
            }],
            widgets: [{
                id: 'todo-list',
                title: 'Todo',
                content: [{ id: 'step-1', text: 'Read files', done: true }]
            }]
        });
        expect(runner.drainContinuationRequests()).toEqual([{
            id: 'continue-plan',
            reason: 'remaining-steps',
            prompt: 'Continue with step 2'
        }]);
        expect(runner.drainContinuationRequests()).toEqual([]);
        expect(runner.getResolvedExtensionPaths()).toEqual([{
            extensionId: 'plan-mode',
            path: './.forge/agent/extensions/plan-mode.ts',
            source: 'code-config'
        }]);
    });
});
