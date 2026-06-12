import { describe, expect, it } from 'vitest';
import { AxFs, createMemoryVfs } from '@open-fs/just-bash';
import { Bash, InMemoryFs, MountableFs, type CustomCommand } from 'just-bash';
import {
    createAgentWorkspaceTools,
    createInMemoryWorkspaceFileSystem
} from '@/api/core/agent-runtime/workspace-tools/AgentWorkspaceTools.js';
import {
    createJustBashWorkspaceBashExecutor,
    createJustBashWorkspaceFileSystem
} from '@/api/core/agent-runtime/workspace-tools/JustBashWorkspaceAdapter.js';
import { AgentToolRegistry } from '@/api/core/agent-runtime/tools/AgentToolRegistry.js';
import { createAuditedOpenFsMount, createOpenFsBashCommandSet } from '@/api/core/agent-runtime/openfs/OpenFsAgentMount.js';

describe('AgentWorkspaceTools', () => {
    it('registers pi-style short named read, write, edit, and delete tools only when requested', async () => {
        const fs = createInMemoryWorkspaceFileSystem();
        const registry = new AgentToolRegistry();
        createAgentWorkspaceTools({ fs, tools: ['read', 'write', 'edit', 'delete'] }).register(registry);

        expect(registry.getToolSummary().map(tool => tool.name)).toEqual(['read', 'write', 'edit', 'delete']);

        await registry.execute({
            toolCallId: 'call_write',
            toolName: 'write',
            args: { path: './notes.md', content: 'alpha beta' }
        });
        await expect(registry.execute({
            toolCallId: 'call_read',
            toolName: 'read',
            args: { path: './notes.md' }
        })).resolves.toMatchObject({
            status: 'executed',
            result: { content: [{ type: 'text', text: 'alpha beta' }] }
        });
        await registry.execute({
            toolCallId: 'call_delete',
            toolName: 'delete',
            args: { path: './notes.md' }
        });
        await expect(fs.exists('./notes.md')).resolves.toBe(false);
    });

    it('edits a file with exact unique text replacements and returns a patch', async () => {
        const fs = createInMemoryWorkspaceFileSystem();
        await fs.writeFile('./card.md', 'name: Alice\nrole: scout\n');
        const registry = new AgentToolRegistry();
        createAgentWorkspaceTools({ fs, tools: ['edit'] }).register(registry);

        await expect(registry.execute({
            toolCallId: 'call_edit',
            toolName: 'edit',
            args: {
                path: './card.md',
                edits: [{ oldText: 'role: scout', newText: 'role: archivist' }]
            }
        })).resolves.toMatchObject({
            status: 'executed',
            result: {
                content: [{ type: 'text', text: 'Edited ./card.md with 1 replacement.' }],
                details: {
                    patch: expect.stringContaining('-role: scout')
                }
            }
        });
        await expect(fs.readFile('./card.md')).resolves.toBe('name: Alice\nrole: archivist\n');
    });

    it('rejects ambiguous edits without writing partial changes', async () => {
        const fs = createInMemoryWorkspaceFileSystem();
        await fs.writeFile('./card.md', 'tag\nfirst\ntag\n');
        const registry = new AgentToolRegistry();
        createAgentWorkspaceTools({ fs, tools: ['edit'] }).register(registry);

        await expect(registry.execute({
            toolCallId: 'call_edit',
            toolName: 'edit',
            args: {
                path: './card.md',
                edits: [
                    { oldText: 'tag', newText: 'changed' },
                    { oldText: 'first', newText: 'second' }
                ]
            }
        })).rejects.toThrow('Edit oldText must match exactly once in ./card.md: tag');
        await expect(fs.readFile('./card.md')).resolves.toBe('tag\nfirst\ntag\n');
    });

    it('registers read-only ls, find, grep, and search tools when explicitly requested', async () => {
        const fs = createInMemoryWorkspaceFileSystem();
        await fs.writeFile('./docs/alpha.md', 'Authentication guide\nUse passkeys.\n');
        await fs.writeFile('./docs/beta.txt', 'Unrelated note\n');
        await fs.writeFile('./src/auth.ts', 'export const auth = true;\n');
        const registry = new AgentToolRegistry();
        createAgentWorkspaceTools({ fs, tools: ['ls', 'find', 'grep', 'search'] }).register(registry);

        expect(registry.getToolSummary().map(tool => tool.name)).toEqual(['ls', 'find', 'grep', 'search']);
        await expect(registry.execute({
            toolCallId: 'call_ls',
            toolName: 'ls',
            args: { path: './docs' }
        })).resolves.toMatchObject({
            status: 'executed',
            result: { content: [{ type: 'text', text: './docs/alpha.md\n./docs/beta.txt' }] }
        });
        await expect(registry.execute({
            toolCallId: 'call_find',
            toolName: 'find',
            args: { query: 'auth' }
        })).resolves.toMatchObject({
            status: 'executed',
            result: { content: [{ type: 'text', text: './src/auth.ts' }] }
        });
        await expect(registry.execute({
            toolCallId: 'call_grep',
            toolName: 'grep',
            args: { pattern: 'passkeys', path: './docs' }
        })).resolves.toMatchObject({
            status: 'executed',
            result: { content: [{ type: 'text', text: './docs/alpha.md:2:Use passkeys.' }] }
        });
        await expect(registry.execute({
            toolCallId: 'call_search',
            toolName: 'search',
            args: { query: 'authentication', limit: 1 }
        })).resolves.toMatchObject({
            status: 'executed',
            result: {
                details: {
                    matches: [{
                        path: './docs/alpha.md',
                        score: 2,
                        snippet: 'Authentication guide'
                    }]
                }
            }
        });
    });

    it('attaches adapter audit payloads to write, edit, and delete tool results', async () => {
        const fs = createInMemoryWorkspaceFileSystem();
        await fs.writeFile('./card.md', 'role: scout\n');
        const registry = new AgentToolRegistry();
        createAgentWorkspaceTools({
            fs,
            tools: ['write', 'edit', 'delete'],
            audit: async event => ({
                auditId: `${event.kind}:${event.path}`,
                changeCount: event.kind === 'edit' ? event.edits?.length ?? 0 : 1
            })
        }).register(registry);

        await expect(registry.execute({
            toolCallId: 'call_write',
            toolName: 'write',
            args: { path: './notes.md', content: 'hello' }
        })).resolves.toMatchObject({
            status: 'executed',
            result: { details: { path: './notes.md', audit: { auditId: 'write:./notes.md', changeCount: 1 } } }
        });
        await expect(registry.execute({
            toolCallId: 'call_edit',
            toolName: 'edit',
            args: {
                path: './card.md',
                edits: [{ oldText: 'role: scout', newText: 'role: archivist' }]
            }
        })).resolves.toMatchObject({
            status: 'executed',
            result: { details: { path: './card.md', audit: { auditId: 'edit:./card.md', changeCount: 1 } } }
        });
        await expect(registry.execute({
            toolCallId: 'call_delete',
            toolName: 'delete',
            args: { path: './notes.md' }
        })).resolves.toMatchObject({
            status: 'executed',
            result: { details: { path: './notes.md', audit: { auditId: 'delete:./notes.md', changeCount: 1 } } }
        });
    });

    it('uses an adapter-provided bash implementation and records partial output', async () => {
        const fs = createInMemoryWorkspaceFileSystem();
        const registry = new AgentToolRegistry();
        createAgentWorkspaceTools({
            fs,
            tools: ['bash'],
            bash: async input => {
                input.onOutput({ type: 'stdout', text: 'first line\n' });
                input.onOutput({ type: 'stderr', text: 'warning\n' });
                return {
                    stdout: 'first line\n',
                    stderr: 'warning\n',
                    exitCode: 0,
                    details: { cwd: input.cwd ?? './' }
                };
            }
        }).register(registry);

        await expect(registry.execute({
            toolCallId: 'call_bash',
            toolName: 'bash',
            args: { command: 'echo first line', cwd: './' }
        })).resolves.toEqual({
            status: 'executed',
            result: {
                content: [{ type: 'text', text: 'first line\nwarning\n' }],
                details: {
                    command: 'echo first line',
                    cwd: './',
                    exitCode: 0,
                    stdout: 'first line\n',
                    stderr: 'warning\n',
                    outputEvents: [
                        { type: 'stdout', text: 'first line\n' },
                        { type: 'stderr', text: 'warning\n' }
                    ],
                    adapter: { cwd: './' }
                }
            }
        });
    });

    it('combines OpenFS mounts, just-bash execution, workspace tools, and phase visibility for a non-Forge adapter', async () => {
        const vfs = createMemoryVfs();
        await vfs.write('/docs/alpha.md', 'Authentication guide\nUse passkeys.\n');
        await vfs.write('/docs/beta.txt', 'Temporary note\n');
        vfs.search = async () => [{
            score: 0.91,
            source: '/docs/alpha.md',
            snippet: 'Authentication guide'
        }];
        const openFs = new AxFs();
        openFs.setVfs(vfs);
        await openFs.init();
        const openFsAuditEvents: string[] = [];
        const auditedOpenFs = createAuditedOpenFsMount({
            filesystem: openFs,
            mount: {
                id: 'openfs-memory',
                mountPoint: '/data',
                writable: true
            },
            phase: {
                id: 'write',
                canWrite: true
            },
            audit: event => {
                openFsAuditEvents.push(`${event.stage}:${event.kind}:${event.path}`);
            }
        });
        const mountedFs = new MountableFs({
            base: new InMemoryFs(),
            mounts: [{ mountPoint: '/data', filesystem: auditedOpenFs }]
        });
        const bash = new Bash({
            fs: mountedFs,
            customCommands: createOpenFsBashCommandSet({
                vfs,
                mountPoint: '/data'
            }) as unknown as CustomCommand[]
        });
        const workspaceFs = createJustBashWorkspaceFileSystem({
            fs: mountedFs,
            root: '/data'
        });
        const registry = new AgentToolRegistry({
            visibilityFilter: (tool, context) =>
                context?.phaseId === 'write' || !['write', 'edit', 'delete', 'bash'].includes(tool.name)
        });
        createAgentWorkspaceTools({
            fs: workspaceFs,
            tools: ['read', 'write', 'edit', 'delete', 'bash', 'grep', 'find', 'ls', 'search'],
            audit: event => ({
                auditId: `${event.kind}:${event.path}`
            }),
            bash: createJustBashWorkspaceBashExecutor({ bash })
        }).register(registry);

        expect(registry.getToolSummary({ phaseId: 'inspect' }).map(tool => tool.name)).toEqual([
            'read',
            'grep',
            'find',
            'ls',
            'search'
        ]);
        expect(registry.getToolSummary({ phaseId: 'write' }).map(tool => tool.name)).toEqual([
            'read',
            'write',
            'edit',
            'delete',
            'bash',
            'grep',
            'find',
            'ls',
            'search'
        ]);
        await expect(registry.execute({
            toolCallId: 'call_read',
            toolName: 'read',
            args: { path: './docs/alpha.md' },
            visibility: { phaseId: 'inspect' }
        })).resolves.toMatchObject({
            status: 'executed',
            result: { content: [{ type: 'text', text: 'Authentication guide\nUse passkeys.\n' }] }
        });
        await expect(registry.execute({
            toolCallId: 'call_ls',
            toolName: 'ls',
            args: { path: './docs' },
            visibility: { phaseId: 'inspect' }
        })).resolves.toMatchObject({
            status: 'executed',
            result: { content: [{ type: 'text', text: './docs/alpha.md\n./docs/beta.txt' }] }
        });
        await expect(registry.execute({
            toolCallId: 'call_grep',
            toolName: 'grep',
            args: { pattern: 'passkeys', path: './docs' },
            visibility: { phaseId: 'inspect' }
        })).resolves.toMatchObject({
            status: 'executed',
            result: { content: [{ type: 'text', text: './docs/alpha.md:2:Use passkeys.' }] }
        });
        await expect(registry.execute({
            toolCallId: 'call_write',
            toolName: 'write',
            args: { path: './notes/result.md', content: 'status: draft\n' },
            visibility: { phaseId: 'write' }
        })).resolves.toMatchObject({
            status: 'executed',
            result: { details: { audit: { auditId: 'write:./notes/result.md' } } }
        });
        await registry.execute({
            toolCallId: 'call_edit',
            toolName: 'edit',
            args: {
                path: './notes/result.md',
                edits: [{ oldText: 'draft', newText: 'ready' }]
            },
            visibility: { phaseId: 'write' }
        });
        await registry.execute({
            toolCallId: 'call_delete',
            toolName: 'delete',
            args: { path: './docs/beta.txt' },
            visibility: { phaseId: 'write' }
        });
        await expect(registry.execute({
            toolCallId: 'call_bash',
            toolName: 'bash',
            args: { command: 'cat /data/docs/alpha.md && search -n 1 authentication', cwd: '/' },
            visibility: { phaseId: 'write' }
        })).resolves.toMatchObject({
            status: 'executed',
            result: {
                content: [{ type: 'text', text: 'Authentication guide\nUse passkeys.\n[0.9100] /docs/alpha.md  Authentication guide\n' }],
                details: {
                    outputEvents: [{
                        type: 'stdout',
                        text: 'Authentication guide\nUse passkeys.\n[0.9100] /docs/alpha.md  Authentication guide\n'
                    }]
                }
            }
        });
        await expect(registry.execute({
            toolCallId: 'call_bash_blocked',
            toolName: 'bash',
            args: { command: 'cat /data/docs/alpha.md' },
            visibility: { phaseId: 'inspect' }
        })).rejects.toThrow('Agent tool not visible in this phase: bash');
        await expect(workspaceFs.readFile('./notes/result.md')).resolves.toBe('status: ready\n');
        await expect(workspaceFs.exists('./docs/beta.txt')).resolves.toBe(false);
        expect(openFsAuditEvents).toContain('commit:write:/notes/result.md');
        expect(openFsAuditEvents).toContain('commit:delete:/docs/beta.txt');
    });
});
