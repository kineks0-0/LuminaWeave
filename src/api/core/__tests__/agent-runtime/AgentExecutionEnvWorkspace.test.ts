import { describe, expect, it } from 'vitest';
import { Bash, InMemoryFs } from 'just-bash';
import { AgentEnvError } from '@/api/core/agent-runtime/env/AgentExecutionEnv.js';
import {
    createEnvWorkspaceBashExecutor,
    createEnvWorkspaceFileSystem
} from '@/api/core/agent-runtime/env/AgentExecutionEnvWorkspace.js';
import { createJustBashExecutionEnv } from '@/api/core/agent-runtime/env/JustBashExecutionEnv.js';

const createEnv = (files: Record<string, string> = {}) => {
    const fs = new InMemoryFs(files);
    return createJustBashExecutionEnv({ fs, bash: new Bash({ fs, cwd: '/' }), cwd: '/' });
};

describe('AgentExecutionEnvWorkspace', () => {
    it('reads, writes, lists and deletes files relative to the workspace root', async () => {
        const workspace = createEnvWorkspaceFileSystem(createEnv({ '/outside.md': 'no' }), '/workspace');
        expect(await workspace.listFiles()).toEqual([]);
        await workspace.writeFile('./notes/a.md', 'alpha');
        await workspace.writeFile('b.md', 'beta');
        expect(await workspace.readFile('notes/a.md')).toBe('alpha');
        expect(await workspace.listFiles()).toEqual(['b.md', 'notes/a.md']);
        expect(await workspace.exists('b.md')).toBe(true);
        await workspace.deleteFile('b.md');
        expect(await workspace.exists('b.md')).toBe(false);
        await workspace.deleteFile('never-existed.md');
    });

    it('throws typed errors for missing files and paths escaping the root', async () => {
        const workspace = createEnvWorkspaceFileSystem(createEnv({ '/secret.md': 's' }), '/workspace');
        await expect(workspace.readFile('missing.md')).rejects.toMatchObject({ code: 'not_found' });
        await expect(workspace.readFile('../secret.md')).rejects.toBeInstanceOf(AgentEnvError);
        await expect(workspace.readFile('../secret.md')).rejects.toMatchObject({ code: 'permission_denied' });
    });

    it('runs bash through the environment and forwards output events', async () => {
        const events: string[] = [];
        const execute = createEnvWorkspaceBashExecutor(createEnv());
        const result = await execute({
            command: 'echo hi; echo err >&2; exit 2',
            onOutput: event => events.push(`${event.type}:${event.text}`)
        });
        expect(result).toEqual({ stdout: 'hi\n', stderr: 'err\n', exitCode: 2 });
        expect(events).toEqual(['stdout:hi\n', 'stderr:err\n']);
    });

    it('rejects sibling-prefix and backslash escapes, and works with a root of /', async () => {
        const env = createEnv({ '/workspace2/x': 'x', '/a.md': 'root file' });
        const workspace = createEnvWorkspaceFileSystem(env, '/workspace');
        await expect(workspace.readFile('../workspace2/x')).rejects.toMatchObject({ code: 'permission_denied' });
        await expect(workspace.readFile('..\\secret.md')).rejects.toMatchObject({ code: 'permission_denied' });
        const rootWorkspace = createEnvWorkspaceFileSystem(env, '/');
        expect(await rootWorkspace.readFile('a.md')).toBe('root file');
    });
});
