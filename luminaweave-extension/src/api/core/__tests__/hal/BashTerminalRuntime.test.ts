import { InMemoryFs } from 'just-bash';
import { describe, expect, it } from 'vitest';
import {
    BashTerminalRuntime,
    createUserTerminalSession,
    shellPermissionService,
    virtualFileSystemService
} from '@/api/core/hal/shell/index.js';

describe('BashTerminalRuntime', () => {
    it('mounts caller-provided extra filesystems without changing default mounts', async () => {
        const mounted = new InMemoryFs({
            '/hello.txt': 'hello from extra mount'
        });
        const runtime = new BashTerminalRuntime({
            session: createUserTerminalSession(),
            vfs: virtualFileSystemService,
            permissions: shellPermissionService,
            cwd: '/forge',
            extraMounts: [{
                path: '/forge',
                fs: mounted
            }]
        });

        const mountedResult = await runtime.exec('cat ./hello.txt');
        const workspaceResult = await runtime.exec('ls /workspaces');

        expect(mountedResult).toMatchObject({
            stdout: 'hello from extra mount',
            stderr: '',
            exitCode: 0
        });
        expect(workspaceResult.exitCode).toBe(0);
    });
});
