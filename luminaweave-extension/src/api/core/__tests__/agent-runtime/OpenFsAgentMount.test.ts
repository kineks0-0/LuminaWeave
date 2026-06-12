import { InMemoryFs, MountableFs } from 'just-bash';
import { createMemoryVfs } from '@open-fs/just-bash';
import { describe, expect, it, vi } from 'vitest';
import { createAuditedOpenFsMount, createOpenFsBashCommandSet } from '@/api/core/agent-runtime/openfs/OpenFsAgentMount.js';

describe('OpenFsAgentMount', () => {
    it('wraps read and write operations with policy, approval, audit, and trace hooks', async () => {
        const events: string[] = [];
        const inner = new InMemoryFs({ '/note.md': 'before' });
        const fs = createAuditedOpenFsMount({
            filesystem: inner,
            mount: {
                id: 'knowledge',
                mountPoint: '/data',
                writable: true
            },
            phase: {
                id: 'write',
                canWrite: true
            },
            approval: vi.fn(async operation => {
                events.push(`approval:${operation.kind}:${operation.path}`);
                return { approved: true };
            }),
            audit: vi.fn(async operation => {
                events.push(`audit:${operation.stage}:${operation.kind}:${operation.path}`);
            }),
            trace: vi.fn(event => {
                events.push(`trace:${event.type}:${event.operation.kind}:${event.operation.path}`);
            })
        });

        await expect(fs.readFile('/note.md')).resolves.toBe('before');
        await fs.writeFile('/note.md', 'after');
        await fs.appendFile('/note.md', '\nmore');
        await fs.rm('/note.md');

        expect(events).toEqual([
            'trace:preflight:read:/note.md',
            'audit:preflight:read:/note.md',
            'trace:result:read:/note.md',
            'audit:result:read:/note.md',
            'trace:preflight:write:/note.md',
            'audit:preflight:write:/note.md',
            'approval:write:/note.md',
            'trace:commit:write:/note.md',
            'audit:commit:write:/note.md',
            'trace:result:write:/note.md',
            'audit:result:write:/note.md',
            'trace:preflight:append:/note.md',
            'audit:preflight:append:/note.md',
            'approval:append:/note.md',
            'trace:commit:append:/note.md',
            'audit:commit:append:/note.md',
            'trace:result:append:/note.md',
            'audit:result:append:/note.md',
            'trace:preflight:delete:/note.md',
            'audit:preflight:delete:/note.md',
            'approval:delete:/note.md',
            'trace:commit:delete:/note.md',
            'audit:commit:delete:/note.md',
            'trace:result:delete:/note.md',
            'audit:result:delete:/note.md'
        ]);
    });

    it('blocks writes during read-only phases before mutating the mounted filesystem', async () => {
        const inner = new InMemoryFs({ '/note.md': 'before' });
        const fs = createAuditedOpenFsMount({
            filesystem: inner,
            mount: {
                id: 'knowledge',
                mountPoint: '/data',
                writable: true
            },
            phase: {
                id: 'inspect',
                canWrite: false
            }
        });

        await expect(fs.writeFile('/note.md', 'after')).rejects.toThrow('Agent phase inspect cannot write to /data.');
        await expect(inner.readFile('/note.md')).resolves.toBe('before');
    });

    it('audits copy and move operations as write commits', async () => {
        const events: string[] = [];
        const inner = new InMemoryFs({ '/source.md': 'before' });
        const fs = createAuditedOpenFsMount({
            filesystem: inner,
            mount: {
                id: 'scratch',
                mountPoint: '/data',
                writable: true
            },
            phase: {
                id: 'write',
                canWrite: true
            },
            audit: vi.fn(operation => {
                events.push(`${operation.stage}:${operation.kind}:${operation.path}`);
            })
        });

        await fs.cp('/source.md', '/copy.md');
        await fs.mv('/copy.md', '/moved.md');

        await expect(inner.readFile('/moved.md')).resolves.toBe('before');
        expect(events).toEqual([
            'preflight:copy:/copy.md',
            'commit:copy:/copy.md',
            'result:copy:/copy.md',
            'preflight:move:/moved.md',
            'commit:move:/moved.md',
            'result:move:/moved.md'
        ]);
    });

    it('can be mounted into just-bash MountableFs without creating a bash tool', async () => {
        const fs = createAuditedOpenFsMount({
            filesystem: new InMemoryFs({ '/note.md': 'mounted content' }),
            mount: {
                id: 'knowledge',
                mountPoint: '/data',
                writable: false
            },
            phase: {
                id: 'inspect',
                canWrite: false
            }
        });
        const mountable = new MountableFs({
            base: new InMemoryFs(),
            mounts: [{ mountPoint: '/data', filesystem: fs }]
        });

        await expect(mountable.readFile('/data/note.md')).resolves.toBe('mounted content');
        expect(createOpenFsBashCommandSet({ vfs: {} as never, mountPoint: '/data' }).map(command => command.name)).toEqual(['axgrep', 'search']);
    });

    it('executes OpenFS grep and search custom commands against the provided VFS', async () => {
        const vfs = createMemoryVfs();
        await vfs.write('/data/note.md', 'authentication best practices');
        vfs.search = vi.fn(async () => [{
            score: 0.91,
            source: '/data/note.md',
            snippet: 'authentication best practices'
        }]);
        const commands = createOpenFsBashCommandSet({ vfs, mountPoint: '/data' });
        const grep = commands.find(command => command.name === 'axgrep');
        const search = commands.find(command => command.name === 'search');

        await expect(grep?.execute(['-n', 'authentication', '/data'], {})).resolves.toMatchObject({
            stdout: '/data/note.md:1:authentication best practices\n',
            stderr: '',
            exitCode: 0
        });
        await expect(search?.execute(['-n', '1', 'auth'], {})).resolves.toMatchObject({
            stdout: '[0.9100] /data/note.md  authentication best practices\n',
            stderr: '',
            exitCode: 0
        });
        expect(vfs.search).toHaveBeenCalledWith('auth', 1);
    });
});
