import { describe, expect, it, vi } from 'vitest';
import type { ShellExecResult, ShellSessionRef, VFSCompletionResult } from '@shared/resources/index.js';
import { ShellSessionRuntime, type ShellRuntimeDriver } from '@/api/core/hal/shell/ShellSessionRuntime.js';

const session: ShellSessionRef = {
    shellSessionId: 'forge-agent:test-project',
    kind: 'forge-agent',
    ownerType: 'agent',
    ownerId: 'forge-planner',
    projectId: 'test-project'
};

const completionResult: VFSCompletionResult = {
    replacement: 'cat ',
    replacementStart: 0,
    replacementEnd: 1,
    candidates: [{ value: 'cat', display: 'cat', type: 'command' }],
    completed: true
};

const createDriver = (): ShellRuntimeDriver => {
    let cwd = '/workspaces/forge/test-project';
    const env = {
        PWD: cwd,
        SHELL: '/bin/bash'
    };

    return {
        getSession: () => ({ ...session }),
        getCwd: () => cwd,
        getEnv: () => ({ ...env, PWD: cwd }),
        exec: vi.fn(async (commandLine: string): Promise<ShellExecResult> => {
            if (commandLine === 'cd drafts') {
                cwd = '/workspaces/forge/test-project/drafts';
            }
            return { stdout: `${commandLine}\n`, stderr: '', exitCode: 0 };
        }),
        completeLine: vi.fn(async () => completionResult)
    };
};

describe('ShellSessionRuntime', () => {
    it('tracks viewport, command execution and completion trace without owning shell logic', async () => {
        const driver = createDriver();
        const runtime = new ShellSessionRuntime({ runtime: driver });

        runtime.resize(120, 36);
        const execResult = await runtime.exec('cd drafts');
        const completeResult = await runtime.completeLine('c');

        expect(execResult.stdout).toBe('cd drafts\n');
        expect(completeResult).toBe(completionResult);
        expect(driver.exec).toHaveBeenCalledWith('cd drafts', undefined);
        expect(driver.completeLine).toHaveBeenCalledWith('c');

        expect(runtime.getSnapshot()).toMatchObject({
            session,
            cwd: '/workspaces/forge/test-project/drafts',
            viewport: { cols: 120, rows: 36 },
            trace: [
                { kind: 'resize', cols: 120, rows: 36 },
                { kind: 'exec', commandLine: 'cd drafts', exitCode: 0 },
                { kind: 'complete', input: 'c' }
            ]
        });
    });

    it('caps trace entries for long-lived agent sessions', async () => {
        const runtime = new ShellSessionRuntime({
            runtime: createDriver(),
            maxTraceEntries: 2
        });

        runtime.resize(80, 24);
        await runtime.exec('echo one');
        await runtime.completeLine('c');

        expect(runtime.getSnapshot().trace.map((entry: any) => entry.kind)).toEqual(['exec', 'complete']);
    });
});
