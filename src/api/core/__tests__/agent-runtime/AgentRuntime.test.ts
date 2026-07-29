import { Type } from '@earendil-works/pi-ai';
import { describe, expect, it, vi } from 'vitest';
import {
    AgentRuntime,
    type AgentRuntimeExtension,
    type AgentRuntimeManagedSession,
    type AgentRuntimeToolPlugin
} from '@/api/core/agent-runtime/index.js';

interface TestTurnInput {
    conversationId: string;
    prompt: string;
}

class TestSession implements AgentRuntimeManagedSession<TestTurnInput, string, string, string> {
    constructor(private readonly sessionId: string) {}

    async runTurn(input: TestTurnInput): Promise<string> {
        return `run:${this.sessionId}:${input.prompt}`;
    }

    async previewPrompt(input: TestTurnInput): Promise<string> {
        return `preview:${this.sessionId}:${input.prompt}`;
    }

    async resolveToolApproval(_turnId: string, toolCallId: string, approved: boolean): Promise<string> {
        return `${toolCallId}:${approved ? 'approved' : 'denied'}`;
    }
}

describe('AgentRuntime', () => {
    it('combines tool plugins, scanned resources, loaded extensions, and managed sessions', async () => {
        const scan = vi.fn(async () => ({
            extensionPaths: ['./.pi/extensions/logger.ts'],
            skillPaths: ['./agent/skills/writer/SKILL.md']
        }));
        const loadedExtension: AgentRuntimeExtension = {
            id: 'loaded-extension',
            setup: context => {
                context.resources.onDiscover(() => ({
                    promptPaths: ['./.forge/agent/SYSTEM.md']
                }));
            }
        };
        const load = vi.fn(async () => ({
            extensions: [loadedExtension]
        }));
        const toolPlugin: AgentRuntimeToolPlugin = {
            id: 'test-tools',
            setup: context => {
                context.tools.register({
                    name: 'echo',
                    description: 'Echo a value.',
                    parameters: Type.Object({ value: Type.String() }),
                    execute: async (_toolCallId, args: { value: string }) => ({
                        content: [{ type: 'text', text: args.value }],
                        details: args
                    })
                });
            }
        };
        const runtime = new AgentRuntime<TestTurnInput, string, string, string>({
            id: 'test-runtime',
            tools: [toolPlugin],
            resourceScanner: { scan },
            extensionLoader: { load },
            resolveSessionId: input => input.conversationId,
            createSession: input => new TestSession(input.sessionId)
        });

        await runtime.setup({ reason: 'startup' });

        expect(scan).toHaveBeenCalledWith({
            reason: 'startup',
            runtimeId: 'test-runtime'
        });
        expect(load).toHaveBeenCalledWith({
            runtimeId: 'test-runtime',
            paths: ['./.pi/extensions/logger.ts']
        });
        expect(runtime.tools.getToolSummary().map(tool => tool.name)).toEqual(['echo']);
        await expect(runtime.tools.execute({
            sessionId: 'session-1',
            turnId: 'turn-1',
            toolCallId: 'call_echo',
            toolName: 'echo',
            args: { value: 'ok' }
        })).resolves.toMatchObject({
            status: 'executed',
            result: { content: [{ type: 'text', text: 'ok' }] }
        });
        await expect(runtime.discoverResources({ reason: 'startup' })).resolves.toEqual({
            skillPaths: ['./agent/skills/writer/SKILL.md'],
            promptPaths: ['./.forge/agent/SYSTEM.md']
        });
        await expect(runtime.runTurn({
            conversationId: 'thread-1',
            prompt: 'hello'
        })).resolves.toBe('run:thread-1:hello');
        await expect(runtime.previewPrompt({
            conversationId: 'thread-1',
            prompt: 'hello'
        })).resolves.toBe('preview:thread-1:hello');
    });

    it('does not scan directories or load extension code unless adapters are provided', async () => {
        const runtime = new AgentRuntime<TestTurnInput, string, string, string>({
            id: 'minimal-runtime',
            resolveSessionId: input => input.conversationId,
            createSession: input => new TestSession(input.sessionId)
        });

        await runtime.setup({ reason: 'startup' });

        expect(runtime.tools.getToolSummary()).toEqual([]);
        await expect(runtime.discoverResources({ reason: 'startup' })).resolves.toEqual({});
    });

    it('does not re-register tools when extension setup fails and setup is retried', async () => {
        const setupTool = vi.fn((context: Parameters<AgentRuntimeToolPlugin['setup']>[0]) => {
            context.tools.register({
                name: 'echo',
                description: 'Echo a value.',
                parameters: Type.Object({ value: Type.String() }),
                execute: async (_toolCallId, args: { value: string }) => ({
                    content: [{ type: 'text', text: args.value }],
                    details: args
                })
            });
        });
        const runtime = new AgentRuntime<TestTurnInput, string, string, string>({
            id: 'failing-runtime',
            tools: [{ id: 'test-tools', setup: setupTool }],
            extensions: [{
                id: 'failing-extension',
                setup: () => {
                    throw new Error('extension setup failed');
                }
            }],
            resolveSessionId: input => input.conversationId,
            createSession: input => new TestSession(input.sessionId)
        });

        await expect(runtime.setup({ reason: 'startup' })).rejects.toThrow('extension setup failed');
        await expect(runtime.setup({ reason: 'startup' })).rejects.toThrow('extension setup failed');
        expect(setupTool).toHaveBeenCalledTimes(1);
    });

    it('reloads scanner resources when setup is called with reload', async () => {
        const scan = vi.fn(async (input: { reason: 'startup' | 'reload' }) => ({
            skillPaths: [`./${input.reason}/SKILL.md`]
        }));
        const runtime = new AgentRuntime<TestTurnInput, string, string, string>({
            id: 'reload-runtime',
            resourceScanner: { scan },
            resolveSessionId: input => input.conversationId,
            createSession: input => new TestSession(input.sessionId)
        });

        await runtime.setup({ reason: 'startup' });
        await expect(runtime.discoverResources({ reason: 'startup' })).resolves.toEqual({
            skillPaths: ['./startup/SKILL.md']
        });

        await runtime.setup({ reason: 'reload' });

        expect(scan).toHaveBeenCalledTimes(2);
        await expect(runtime.discoverResources({ reason: 'reload' })).resolves.toEqual({
            skillPaths: ['./reload/SKILL.md']
        });
    });
});
