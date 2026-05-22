import type { ResourceDiagnostic, ShellExecResult, VFSCompletionResult } from '@shared/resources/index.js';
import type { BashTerminalRuntime } from '../../api/core/hal/shell/BashTerminalRuntime.js';

export interface LuminaBashShellOptions {
  runtime: BashTerminalRuntime;
  greeting?: string | string[];
  prompt?: (cwd: string) => string;
  onError?: (message: string) => void;
}

const displayCwd = (cwd: string): string => cwd.replace(/^\/home\/user/, '~') || '/';

const defaultPrompt = (cwd: string): string =>
  `\x1b[1;32muser@lumina\x1b[0m:\x1b[1;34m${displayCwd(cwd)}\x1b[0m$ `;

const formatError = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);

const terminalText = (text: string): string => text.replace(/\n/g, '\r\n');

const lineChars = (value: string): string[] => Array.from(value);

export class BashShell {
  private write: ((data: string) => void) | null = null;
  private line = '';
  private cursor = 0;
  private buffer = '';
  private readonly history: string[] = [];
  private historyPos = -1;
  private busy = false;
  private readonly runtime: BashTerminalRuntime;
  private readonly greeting: string[];
  private readonly prompt: (cwd: string) => string;
  private readonly onError?: (message: string) => void;

  constructor(options: LuminaBashShellOptions) {
    this.runtime = options.runtime;
    this.prompt = options.prompt ?? defaultPrompt;
    this.onError = options.onError;
    if (options.greeting === undefined) {
      this.greeting = [];
    } else if (typeof options.greeting === 'string') {
      this.greeting = [options.greeting];
    } else {
      this.greeting = options.greeting;
    }
  }

  get cwd(): string {
    return this.runtime.getCwd();
  }

  attach(write: (data: string) => void): void {
    this.write = write;
    if (this.greeting.length > 0) {
      write(`${this.greeting.join('\r\n')}\r\n`);
    }
    this.printPrompt();
  }

  clear(): void {
    this.write?.('\x1b[2J\x1b[3J\x1b[H');
    this.line = '';
    this.cursor = 0;
    this.buffer = '';
    this.printPrompt();
  }

  async handleInput(data: string): Promise<void> {
    if (!this.write || this.busy) return;

    if (data.startsWith('\x1b[200~') && data.endsWith('\x1b[201~')) {
      await this.handleInput(data.slice('\x1b[200~'.length, -'\x1b[201~'.length).replace(/\x1b/g, ''));
      return;
    }

    if (data === '\t') {
      await this.tabComplete();
      return;
    }
    if (data === '\r' || data === '\n') {
      await this.submitLine();
      return;
    }
    if (data === '\x7f' || data === '\b') {
      this.deleteBeforeCursor();
      return;
    }
    if (data === '\x1b[A') {
      this.recallHistory('previous');
      return;
    }
    if (data === '\x1b[B') {
      this.recallHistory('next');
      return;
    }
    if (data === '\x1b[D') {
      this.moveCursor(-1);
      return;
    }
    if (data === '\x1b[C') {
      this.moveCursor(1);
      return;
    }
    if (data === '\x1b[H' || data === '\x1bOH' || data === '\x01') {
      this.moveCursorTo(0);
      return;
    }
    if (data === '\x1b[F' || data === '\x1bOF' || data === '\x05') {
      this.moveCursorTo(lineChars(this.line).length);
      return;
    }
    if (data === '\x15') {
      this.clearInputLine();
      return;
    }
    if (data === '\x03') {
      this.line = '';
      this.cursor = 0;
      this.buffer = '';
      this.write('^C\r\n');
      this.printPrompt();
      return;
    }
    if (data === '\x0c') {
      this.write('\x1b[2J\x1b[3J\x1b[H');
      this.printPrompt();
      this.write(this.line);
      this.restoreCursorAfterRedraw();
      return;
    }
    if (data.length === 1 && this.isTextInputChar(data)) {
      this.insertText(data);
      return;
    }
    if (data.length > 1) {
      for (const char of data) {
        await this.handleInput(char);
      }
    }
  }

  private async submitLine(): Promise<void> {
    if (!this.write) return;

    const currentLine = this.line;
    this.line = '';
    this.cursor = 0;
    this.write('\r\n');

    if (currentLine.endsWith('\\')) {
      this.buffer += `${currentLine}\n`;
      this.write('> ');
      return;
    }

    const command = `${this.buffer}${currentLine}`;
    this.buffer = '';
    if (!command.trim()) {
      this.printPrompt();
      return;
    }

    this.history.push(command);
    this.historyPos = -1;
    this.busy = true;

    try {
      const result = await this.runtime.exec(command);
      this.printResult(result);
      if (result.exitCode !== 0) {
        this.onError?.(result.stderr || `Command exited with ${result.exitCode}`);
      }
    } catch (error) {
      const message = formatError(error);
      this.onError?.(message);
      this.write(`\x1b[31m${terminalText(message)}\x1b[0m\r\n`);
    } finally {
      this.busy = false;
      this.printPrompt();
    }
  }

  private async tabComplete(): Promise<void> {
    if (!this.write) return;

    try {
      const completion = await this.runtime.completeLine(this.line);
      if (completion.completed) {
        this.applyCompletion(completion);
        return;
      }
      if (completion.candidates.length === 0) return;

      this.write('\r\n');
      this.write(`${completion.candidates.map(candidate => candidate.display).join('  ')}\r\n`);
      this.printPrompt();
      this.write(this.line);
      this.restoreCursorAfterRedraw();
    } catch (error) {
      this.onError?.(`Completion failed: ${formatError(error)}`);
    }
  }

  private applyCompletion(completion: VFSCompletionResult): void {
    const nextLine = [
      this.line.slice(0, completion.replacementStart),
      completion.replacement,
      this.line.slice(completion.replacementEnd)
    ].join('');
    this.line = nextLine;
    this.cursor = lineChars(`${this.line.slice(0, completion.replacementStart)}${completion.replacement}`).length;
    this.redrawLine();
  }

  private printResult(result: ShellExecResult): void {
    if (!this.write) return;

    if (result.stdout) {
      this.write(terminalText(result.stdout));
      if (!result.stdout.endsWith('\n')) this.write('\r\n');
    }
    if (result.stderr) {
      this.write(`\x1b[31m${terminalText(result.stderr)}\x1b[0m`);
      if (!result.stderr.endsWith('\n')) this.write('\r\n');
    }
    this.printDiagnostics(result.diagnostics);
    if (result.exitCode !== 0 && !result.stderr) {
      this.write(`error: command exited with ${result.exitCode}\r\n`);
    }
  }

  private printDiagnostics(diagnostics: ResourceDiagnostic[] | undefined): void {
    if (!diagnostics?.length || !this.write) return;
    for (const diagnostic of diagnostics) {
      this.write(`[${diagnostic.level}] ${diagnostic.code}: ${diagnostic.message}\r\n`);
    }
  }

  private recallHistory(direction: 'previous' | 'next'): void {
    if (!this.write || this.history.length === 0) return;

    if (direction === 'previous') {
      if (this.historyPos < 0) this.historyPos = this.history.length;
      if (this.historyPos > 0) this.historyPos -= 1;
    } else {
      if (this.historyPos < 0) return;
      this.historyPos += 1;
      if (this.historyPos >= this.history.length) {
        this.historyPos = -1;
        this.setInputLine('');
        return;
      }
    }

    this.setInputLine(this.history[this.historyPos] ?? '');
  }

  private setInputLine(nextLine: string): void {
    this.line = nextLine;
    this.cursor = lineChars(nextLine).length;
    this.redrawLine();
  }

  private insertText(text: string): void {
    const chars = lineChars(this.line);
    chars.splice(this.cursor, 0, ...lineChars(text));
    this.line = chars.join('');
    this.cursor += lineChars(text).length;
    this.redrawLine();
  }

  private deleteBeforeCursor(): void {
    if (this.cursor <= 0) return;
    const chars = lineChars(this.line);
    chars.splice(this.cursor - 1, 1);
    this.cursor -= 1;
    this.line = chars.join('');
    this.redrawLine();
  }

  private clearInputLine(): void {
    if (!this.line) return;
    this.line = '';
    this.cursor = 0;
    this.redrawLine();
  }

  private moveCursor(delta: number): void {
    const next = Math.max(0, Math.min(lineChars(this.line).length, this.cursor + delta));
    this.moveCursorTo(next);
  }

  private moveCursorTo(nextCursor: number): void {
    if (!this.write) return;
    const distance = nextCursor - this.cursor;
    this.cursor = nextCursor;
    if (distance > 0) {
      this.write(`\x1b[${distance}C`);
    } else if (distance < 0) {
      this.write(`\x1b[${Math.abs(distance)}D`);
    }
  }

  private redrawLine(): void {
    if (!this.write) return;
    this.write(`\r\x1b[2K${this.currentPrompt()}${this.line}`);
    this.restoreCursorAfterRedraw();
  }

  private restoreCursorAfterRedraw(): void {
    if (!this.write) return;
    const tailLength = lineChars(this.line).length - this.cursor;
    if (tailLength > 0) {
      this.write(`\x1b[${tailLength}D`);
    }
  }

  private printPrompt(): void {
    this.write?.(this.currentPrompt());
  }

  private currentPrompt(): string {
    return this.prompt(this.cwd);
  }

  private isTextInputChar(char: string): boolean {
    const codePoint = char.codePointAt(0);
    return codePoint !== undefined
      && codePoint >= 0x20
      && codePoint !== 0x7f
      && !(codePoint >= 0x80 && codePoint <= 0x9f);
  }
}
