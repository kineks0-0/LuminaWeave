import { InMemoryFs } from 'just-bash';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
    BashTerminalRuntime,
    bashTerminalRuntime,
    createUserTerminalSession,
    shellPermissionService,
    virtualFileSystemService
} from '@/api/core/hal/shell/index.js';

describe('BashTerminalRuntime', () => {
    afterEach(() => {
        vi.unstubAllGlobals();
    });

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

    it('exposes curl for the shared user terminal runtime', async () => {
        const fetchMock = vi.fn(async () => new Response('terminal-network-ok', {
            status: 200,
            statusText: 'OK'
        }));
        vi.stubGlobal('fetch', fetchMock);

        await expect(bashTerminalRuntime.completeLine('cur')).resolves.toMatchObject({
            completed: true,
            replacement: 'curl '
        });
        await expect(bashTerminalRuntime.exec('curl https://api.example.com/resource')).resolves.toMatchObject({
            exitCode: 0,
            stdout: expect.stringContaining('terminal-network-ok')
        });
        expect(fetchMock).toHaveBeenCalledWith('https://api.example.com/resource', expect.objectContaining({
            method: 'GET'
        }));
    });
});
