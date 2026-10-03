import { describe, expect, it } from 'vitest';
import { Bash, InMemoryFs } from 'just-bash';
import type { AgentEnvResult } from '@/api/core/agent-runtime/env/AgentExecutionEnv.js';
import { createJustBashExecutionEnv } from '@/api/core/agent-runtime/env/JustBashExecutionEnv.js';

const createEnv = (files: Record<string, string> = {}) => {
    const fs = new InMemoryFs(files);
    const bash = new Bash({ fs, cwd: '/work' });
    let next = 0;
    return createJustBashExecutionEnv({ fs, bash, cwd: '/work', createId: () => `id${++next}` });
};

const codeOf = async (pending: Promise<AgentEnvResult<unknown>>): Promise<string> => {
    const result = await pending;
    return result.ok ? 'ok' : result.error.code;
};

describe('JustBashExecutionEnv', () => {
    it('resolves relative paths against cwd and normalizes dot segments', async () => {
        const env = createEnv();
        expect(env.cwd).toBe('/work');
        expect(await env.absolutePath('notes/../a.md')).toEqual({ ok: true, value: '/work/a.md' });
        expect(await env.absolutePath('/abs/./b.md')).toEqual({ ok: true, value: '/abs/b.md' });
    });

    it('writes and reads text and binary files, creating parent directories', async () => {
        const env = createEnv();
        expect((await env.writeFile('deep/dir/a.txt', 'hello')).ok).toBe(true);
        expect(await env.readTextFile('/work/deep/dir/a.txt')).toEqual({ ok: true, value: 'hello' });
        expect((await env.appendFile('deep/dir/a.txt', ' world')).ok).toBe(true);
        expect(await env.readTextFile('deep/dir/a.txt')).toEqual({ ok: true, value: 'hello world' });
        expect((await env.writeFile('/top.dat', new Uint8Array([1, 2, 3]))).ok).toBe(true);
        const binary = await env.readBinaryFile('/top.dat');
        expect(binary.ok && Array.from(binary.value)).toEqual([1, 2, 3]);
    });

    it('maps just-bash errno messages to typed error codes without throwing', async () => {
        const env = createEnv({ '/work/file.txt': 'x', '/work/dir/child.txt': 'y' });
        const missing = await env.readTextFile('missing.txt');
        expect(missing.ok).toBe(false);
        if (!missing.ok) {
            expect(missing.error.code).toBe('not_found');
            expect(missing.error.path).toBe('/work/missing.txt');
        }
        expect(await codeOf(env.readTextFile('dir'))).toBe('is_directory');
        expect(await codeOf(env.listDir('file.txt'))).toBe('not_directory');
        expect(await codeOf(env.remove('dir'))).toBe('not_empty');
        expect(await codeOf(env.createDir('dir', { recursive: false }))).toBe('already_exists');
    });

    it('reports file info and lists directory entries', async () => {
        const env = createEnv({ '/work/a.md': 'abc', '/work/sub/b.md': 'b' });
        const info = await env.fileInfo('a.md');
        expect(info.ok && { name: info.value.name, path: info.value.path, kind: info.value.kind, size: info.value.size })
            .toEqual({ name: 'a.md', path: '/work/a.md', kind: 'file', size: 3 });
        const listing = await env.listDir('.');
        expect(listing.ok && listing.value.map(entry => `${entry.name}:${entry.kind}`).sort())
            .toEqual(['a.md:file', 'sub:directory']);
        expect(await env.exists('a.md')).toEqual({ ok: true, value: true });
        expect(await env.exists('nope.md')).toEqual({ ok: true, value: false });
    });

    it('creates and removes directories and temp directories', async () => {
        const env = createEnv();
        expect((await env.createDir('x/y/z')).ok).toBe(true);
        expect(await env.exists('x/y/z')).toEqual({ ok: true, value: true });
        expect((await env.remove('x', { recursive: true })).ok).toBe(true);
        expect(await env.exists('x')).toEqual({ ok: true, value: false });
        expect(await env.createTempDir('scratch-')).toEqual({ ok: true, value: '/tmp/scratch-id1' });
        expect(await env.exists('/tmp/scratch-id1')).toEqual({ ok: true, value: true });
    });

    it('returns aborted for file operations whose signal is already aborted', async () => {
        const env = createEnv({ '/work/a.md': 'a' });
        const controller = new AbortController();
        controller.abort();
        expect(await codeOf(env.readTextFile('a.md', { abortSignal: controller.signal }))).toBe('aborted');
    });

    it('executes commands with cwd, env and output callbacks', async () => {
        const env = createEnv({ '/work/sub/f.txt': 'x' });
        const stdout: string[] = [];
        const stderr: string[] = [];
        const result = await env.exec('pwd; echo $GREETING; echo oops >&2; exit 3', {
            cwd: 'sub',
            env: { GREETING: 'hi' },
            onStdout: chunk => stdout.push(chunk),
            onStderr: chunk => stderr.push(chunk)
        });
        expect(result).toEqual({ ok: true, value: { stdout: '/work/sub\nhi\n', stderr: 'oops\n', exitCode: 3 } });
        expect(stdout).toEqual(['/work/sub\nhi\n']);
        expect(stderr).toEqual(['oops\n']);
    });

    it('returns aborted without running when the signal is already aborted', async () => {
        const env = createEnv();
        const controller = new AbortController();
        controller.abort();
        expect(await codeOf(env.exec('echo hi', { abortSignal: controller.signal }))).toBe('aborted');
    });

    it('returns aborted when the caller aborts a running command', async () => {
        const env = createEnv();
        const controller = new AbortController();
        setTimeout(() => controller.abort(), 20);
        const started = Date.now();
        expect(await codeOf(env.exec('sleep 2; echo done', { abortSignal: controller.signal }))).toBe('aborted');
        expect(Date.now() - started).toBeLessThan(1000);
    });

    it('returns timeout when the command exceeds timeoutMs', async () => {
        const env = createEnv();
        const started = Date.now();
        expect(await codeOf(env.exec('sleep 2; echo done', { timeoutMs: 20 }))).toBe('timeout');
        expect(Date.now() - started).toBeLessThan(1000);
    });

    it('returns callback_error when an output callback throws', async () => {
        const env = createEnv();
        const result = env.exec('echo hi', {
            onStdout: () => {
                throw new Error('boom');
            }
        });
        expect(await codeOf(result)).toBe('callback_error');
    });

    it('returns an error result instead of throwing when createId throws, and rejects escaping prefixes', async () => {
        const fs = new InMemoryFs();
        const env = createJustBashExecutionEnv({
            fs,
            bash: new Bash({ fs, cwd: '/work' }),
            cwd: '/work',
            createId: () => {
                throw new Error('no id');
            }
        });
        expect(await codeOf(env.createTempDir('x-'))).toBe('unknown');
        const safe = createEnv();
        expect(await codeOf(safe.createTempDir('../x'))).toBe('invalid');
        expect(await codeOf(safe.createTempDir('a/b'))).toBe('invalid');
        expect(await codeOf(safe.createTempDir('a\\b'))).toBe('invalid');
    });

    it('rejects invalid timeoutMs and treats Infinity as no limit', async () => {
        const env = createEnv();
        expect(await codeOf(env.exec('echo hi', { timeoutMs: 0 }))).toBe('invalid');
        expect(await codeOf(env.exec('echo hi', { timeoutMs: -1 }))).toBe('invalid');
        expect(await codeOf(env.exec('echo hi', { timeoutMs: Number.NaN }))).toBe('invalid');
        const result = await env.exec('echo hi', { timeoutMs: Number.POSITIVE_INFINITY });
        expect(result).toEqual({ ok: true, value: { stdout: 'hi\n', stderr: '', exitCode: 0 } });
    });

    it('returns aborted when the caller aborts before the timeout fires, even if bash finishes slowly', async () => {
        const slowBash: Pick<Bash, 'exec'> = {
            exec: (_command, options) => new Promise(resolve => {
                options?.signal?.addEventListener('abort', () => {
                    setTimeout(() => resolve({ stdout: '', stderr: '', exitCode: 124, env: {} }), 50);
                });
            })
        };
        const env = createJustBashExecutionEnv({ fs: new InMemoryFs({}), bash: slowBash, cwd: '/' });
        const controller = new AbortController();
        setTimeout(() => controller.abort(), 10);
        expect(await codeOf(env.exec('anything', { abortSignal: controller.signal, timeoutMs: 20 }))).toBe('aborted');
    });

    it('returns timeout when bash rejects after the timeout abort, keeping the original error as cause', async () => {
        const failure = new Error('execution aborted');
        const rejectingBash: Pick<Bash, 'exec'> = {
            exec: (_command, options) => new Promise((_resolve, reject) => {
                options?.signal?.addEventListener('abort', () => reject(failure));
            })
        };
        const env = createJustBashExecutionEnv({ fs: new InMemoryFs({}), bash: rejectingBash, cwd: '/' });
        const result = await env.exec('anything', { timeoutMs: 20 });
        expect(result.ok).toBe(false);
        if (!result.ok) {
            expect(result.error.code).toBe('timeout');
            expect(result.error.cause).toBe(failure);
        }
    });

    it('returns callback_error when onStderr throws and keeps the original error as cause', async () => {
        const env = createEnv();
        const boom = new Error('stderr boom');
        const result = await env.exec('echo oops >&2', {
            onStderr: () => {
                throw boom;
            }
        });
        expect(result.ok).toBe(false);
        if (!result.ok) {
            expect(result.error.code).toBe('callback_error');
            expect(result.error.cause).toBe(boom);
        }
    });

    it('returns aborted from listDir when the signal is already aborted', async () => {
        const env = createEnv({ '/work/a.md': 'a' });
        const controller = new AbortController();
        controller.abort();
        expect(await codeOf(env.listDir('.', { abortSignal: controller.signal }))).toBe('aborted');
    });

    it('reports not_directory when a parent path component is a file', async () => {
        const env = createEnv();
        expect((await env.writeFile('/work/f.txt', 'x')).ok).toBe(true);
        expect(await codeOf(env.writeFile('f.txt/child', 'y'))).toBe('not_directory');
        expect(await codeOf(env.appendFile('f.txt/child', 'y'))).toBe('not_directory');
    });
});
