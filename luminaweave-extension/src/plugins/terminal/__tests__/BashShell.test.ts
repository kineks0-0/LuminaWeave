import { describe, expect, it, vi } from 'vitest';
import type { ShellExecResult, VFSCompletionResult } from '@shared/resources/index.js';
import type { BashTerminalRuntime } from '../../../api/core/hal/shell/BashTerminalRuntime.js';
import { BashShell } from '../BashShell.js';

interface FakeRuntimeOptions {
  cwd?: string;
  exec?: (command: string, stdin?: string) => Promise<ShellExecResult>;
  completeLine?: (input: string) => Promise<VFSCompletionResult>;
}

const ok = (stdout = ''): ShellExecResult => ({
  stdout,
  stderr: '',
  exitCode: 0
});

const completion = (input: Partial<VFSCompletionResult>): VFSCompletionResult => ({
  replacement: '',
  replacementStart: 0,
  replacementEnd: 0,
  candidates: [],
  completed: false,
  ...input
});

const createRuntime = (options: FakeRuntimeOptions = {}): BashTerminalRuntime => ({
  getCwd: () => options.cwd ?? '/home/user',
  exec: options.exec ?? vi.fn(async command => ok(`ran:${command}\n`)),
  completeLine: options.completeLine ?? vi.fn(async () => completion({}))
}) as unknown as BashTerminalRuntime;

const createShell = (runtime = createRuntime()) => {
  const chunks: string[] = [];
  const errors: string[] = [];
  const shell = new BashShell({
    runtime,
    greeting: [],
    prompt: () => '$ ',
    onError: message => errors.push(message)
  });
  shell.attach(chunk => chunks.push(chunk));
  return {
    shell,
    chunks,
    errors,
    output: () => chunks.join('')
  };
};

describe('BashShell', () => {
  it('moves the cursor with left and right arrow keys before inserting text', async () => {
    const { shell, output } = createShell();

    await shell.handleInput('abc');
    await shell.handleInput('\x1b[D');
    await shell.handleInput('\x1b[D');
    await shell.handleInput('\x1b[C');
    await shell.handleInput('X');

    expect(output()).toContain('\x1b[1D');
    expect(output()).toContain('\x1b[1C');
    expect(output()).toContain('$ abXc');
  });

  it('recalls command history with up and down arrow keys', async () => {
    const exec = vi.fn(async command => ok(`ran:${command}\n`));
    const { shell, output } = createShell(createRuntime({ exec }));

    await shell.handleInput('first');
    await shell.handleInput('\r');
    await shell.handleInput('second');
    await shell.handleInput('\r');
    await shell.handleInput('\x1b[A');
    await shell.handleInput('\x1b[A');
    await shell.handleInput('\x1b[B');
    await shell.handleInput('\x1b[B');

    expect(exec).toHaveBeenNthCalledWith(1, 'first');
    expect(exec).toHaveBeenNthCalledWith(2, 'second');
    expect(output()).toContain('$ second');
    expect(output()).toContain('$ first');
    expect(output().endsWith('\r\x1b[2K$ ')).toBe(true);
  });

  it('inserts Chinese text and bracketed paste payloads as text input', async () => {
    const { shell, output } = createShell();

    await shell.handleInput('你好');
    await shell.handleInput('\x1b[200~，世界\x1b[201~');

    expect(output()).toContain('$ 你好，世界');
  });

  it('prints tab completion candidates and restores the current input line', async () => {
    const completeLine = vi.fn(async () => completion({
      candidates: [
        { value: 'cat', display: 'cat', type: 'command' },
        { value: 'clear', display: 'clear', type: 'command' },
        { value: 'cd', display: 'cd', type: 'command' }
      ]
    }));
    const { shell, output } = createShell(createRuntime({ completeLine }));

    await shell.handleInput('c');
    await shell.handleInput('\t');

    expect(completeLine).toHaveBeenCalledWith('c');
    expect(output()).toContain('cat  clear  cd');
    expect(output()).toContain('\r\n$ c');
  });

  it('applies a completed tab replacement at the requested range', async () => {
    const completeLine = vi.fn(async () => completion({
      replacement: 'cat ',
      replacementStart: 0,
      replacementEnd: 1,
      completed: true,
      candidates: [{ value: 'cat', display: 'cat', type: 'command' }]
    }));
    const { shell, output } = createShell(createRuntime({ completeLine }));

    await shell.handleInput('c');
    await shell.handleInput('\t');

    expect(output()).toContain('$ cat ');
  });

  it('clears the viewport and resets the editable input buffer', async () => {
    const { shell, output } = createShell();

    await shell.handleInput('abc');
    shell.clear();
    await shell.handleInput('d');

    expect(output()).toContain('\x1b[2J\x1b[3J\x1b[H');
    expect(output()).toContain('$ d');
  });
});
