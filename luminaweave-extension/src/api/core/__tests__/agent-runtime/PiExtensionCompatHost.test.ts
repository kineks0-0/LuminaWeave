import { Type } from '@earendil-works/pi-ai';
import { describe, expect, it, vi } from 'vitest';
import { AgentRuntimeExtensionRunner } from '@/api/core/agent-runtime/extensions/AgentRuntimeExtensionRunner.js';
import { PiExtensionCompatHost } from '@/api/core/agent-runtime/extensions/pi/PiExtensionCompatHost.js';
import { AgentToolRegistry } from '@/api/core/agent-runtime/tools/AgentToolRegistry.js';

describe('PiExtensionCompatHost', () => {
    it('runs pi extension factories through the native tool and extension hooks', async () => {
        const providerRegistry = {
            registerProvider: vi.fn()
        };
        const compat = new PiExtensionCompatHost({
            cwd: 'D:/repo',
            providerRegistry
        });
        const extension = compat.fromFactory('inline-pi-extension', pi => {
            pi.registerTool({
                name: 'echo',
                label: 'Echo',
                description: 'Echo a value.',
                parameters: Type.Object({ value: Type.String() }),
                execute: async (_toolCallId, args: { value: string }) => ({
                    content: [{ type: 'text', text: `raw:${args.value}` }],
                    details: { value: args.value }
                })
            });
            pi.on('tool_call', event => {
                if (event.toolName !== 'echo') return undefined;
                return {
                    args: { value: 'normalized' }
                };
            });
            pi.on('tool_result', event => {
                if (event.toolName !== 'echo') return undefined;
                return {
                    content: [{ type: 'text', text: 'rewritten' }],
                    details: {
                        ...(event.details as Record<string, unknown>),
                        source: 'pi'
                    }
                };
            });
            pi.on('resources_discover', event => ({
                skillPaths: [`${event.cwd}/agent/skills/writer/SKILL.md`]
            }));
            pi.on('before_agent_start', event => ({
                message: {
                    customType: 'pi-hidden',
                    content: 'context',
                    display: false
                },
                systemPrompt: `${event.systemPrompt}\npi`
            }));
            pi.registerProvider('proxy', {
                baseUrl: 'https://proxy.example.test',
                api: 'openai-responses',
                models: []
            });
        });
        const tools = new AgentToolRegistry();
        const runner = new AgentRuntimeExtensionRunner({ tools, extensions: [extension] });

        await runner.setup();

        expect(providerRegistry.registerProvider).toHaveBeenCalledWith('proxy', {
            baseUrl: 'https://proxy.example.test',
            api: 'openai-responses',
            models: []
        });
        await expect(tools.execute({
            sessionId: 'session-1',
            turnId: 'turn-1',
            toolCallId: 'call_echo',
            toolName: 'echo',
            args: { value: 'raw' }
        })).resolves.toEqual({
            status: 'executed',
            result: {
                content: [{ type: 'text', text: 'rewritten' }],
                details: { value: 'normalized', source: 'pi' }
            }
        });
        await expect(runner.discoverResources({ reason: 'startup' })).resolves.toEqual({
            skillPaths: ['D:/repo/agent/skills/writer/SKILL.md']
        });
        await expect(runner.emitBeforeAgentStart({
            prompt: 'hello',
            systemPrompt: 'base'
        })).resolves.toEqual({
            messages: [{
                customType: 'pi-hidden',
                content: 'context',
                display: false
            }],
            systemPrompt: 'base\npi'
        });
    });

    it('blocks pi tool calls before native approval or execution', async () => {
        const compat = new PiExtensionCompatHost({ cwd: 'D:/repo' });
        const execute = vi.fn();
        const extension = compat.fromFactory('blocking-pi-extension', pi => {
            pi.registerTool({
                name: 'write',
                description: 'Write a file.',
                parameters: Type.Object({ path: Type.String() }),
                needsApproval: true,
                execute
            });
            pi.on('tool_call', event => {
                const args = event.args as { path: string };
                if (!args.path.startsWith('/protected/')) return undefined;
                return {
                    block: true,
                    reason: 'protected path'
                };
            });
        });
        const tools = new AgentToolRegistry();
        const runner = new AgentRuntimeExtensionRunner({ tools, extensions: [extension] });

        await runner.setup();

        await expect(tools.execute({
            sessionId: 'session-1',
            turnId: 'turn-1',
            toolCallId: 'call_write',
            toolName: 'write',
            args: { path: '/protected/card.md' }
        })).resolves.toEqual({
            status: 'blocked',
            message: 'protected path',
            result: {
                content: [{ type: 'text', text: 'protected path' }],
                details: { reason: 'protected path' }
            }
        });
        expect(execute).not.toHaveBeenCalled();
    });

    it('lets pi tool_call handlers mutate event.input in place like pi extensions', async () => {
        const compat = new PiExtensionCompatHost({ cwd: 'D:/repo' });
        const extension = compat.fromFactory('mutating-pi-extension', pi => {
            pi.registerTool({
                name: 'echo',
                description: 'Echo a value.',
                parameters: Type.Object({ value: Type.String() }),
                execute: async (_toolCallId, args: { value: string }) => ({
                    content: [{ type: 'text', text: args.value }],
                    details: args
                })
            });
            pi.on('tool_call', event => {
                const mutableEvent = event as unknown as { input: { value: string } };
                mutableEvent.input.value = 'normalized';
            });
        });
        const tools = new AgentToolRegistry();
        const runner = new AgentRuntimeExtensionRunner({ tools, extensions: [extension] });

        await runner.setup();

        await expect(tools.execute({
            sessionId: 'session-1',
            turnId: 'turn-1',
            toolCallId: 'call_echo',
            toolName: 'echo',
            args: { value: 'raw' }
        })).resolves.toEqual({
            status: 'executed',
            result: {
                content: [{ type: 'text', text: 'normalized' }],
                details: { value: 'normalized' }
            }
        });
    });

    it('keeps later pi extensions available when one factory throws during setup', async () => {
        const diagnostics: Array<{ message: string; path?: string }> = [];
        const compat = new PiExtensionCompatHost({
            cwd: 'D:/repo',
            onDiagnostic: diagnostic => diagnostics.push(diagnostic)
        });
        const failing = compat.fromFactory('broken-extension', () => {
            throw new Error('factory failed');
        });
        const working = compat.fromFactory('working-extension', pi => {
            pi.registerTool({
                name: 'echo',
                description: 'Echo a value.',
                parameters: Type.Object({ value: Type.String() }),
                execute: async (_toolCallId, args: { value: string }) => ({
                    content: [{ type: 'text', text: args.value }],
                    details: args
                })
            });
        });
        const tools = new AgentToolRegistry();
        const runner = new AgentRuntimeExtensionRunner({
            tools,
            extensions: [failing, working]
        });

        await runner.setup();

        expect(diagnostics).toEqual([{
            type: 'error',
            path: 'broken-extension',
            message: 'factory failed'
        }]);
        expect(tools.getToolSummary().map(tool => tool.name)).toEqual(['echo']);
    });
});
