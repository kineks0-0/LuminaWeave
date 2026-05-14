import type { ShellExecResult, ShellSessionRef, VFSCompletionResult } from '@shared/resources/index.js';
import type { BashTerminalRuntime } from './BashTerminalRuntime.js';

export interface ShellViewportSize {
    cols: number;
    rows: number;
}

export type ShellSessionRuntimeTraceKind = 'exec' | 'complete' | 'resize';

export interface ShellSessionRuntimeTraceEntry {
    id: string;
    kind: ShellSessionRuntimeTraceKind;
    at: number;
    cwd: string;
    commandLine?: string;
    input?: string;
    exitCode?: number;
    cols?: number;
    rows?: number;
}

export interface ShellRuntimeDriver {
    getSession(): ShellSessionRef;
    getCwd(): string;
    getEnv(): Record<string, string>;
    exec(commandLine: string, stdin?: string): Promise<ShellExecResult>;
    completeLine(input: string): Promise<VFSCompletionResult>;
}

export interface ShellSessionRuntimeSnapshot {
    session: ShellSessionRef;
    cwd: string;
    env: Record<string, string>;
    viewport: ShellViewportSize | null;
    trace: ShellSessionRuntimeTraceEntry[];
}

export interface ShellSessionRuntimeOptions {
    runtime: ShellRuntimeDriver;
    maxTraceEntries?: number;
}

export class ShellSessionRuntime {
    private viewport: ShellViewportSize | null = null;
    private trace: ShellSessionRuntimeTraceEntry[] = [];
    private sequence = 0;

    constructor(private readonly options: ShellSessionRuntimeOptions) {}

    getSession(): ShellSessionRef {
        return this.options.runtime.getSession();
    }

    getDriver(): ShellRuntimeDriver {
        return this.options.runtime;
    }

    resize(cols: number, rows: number): void {
        this.viewport = { cols, rows };
        this.recordTrace({ kind: 'resize', cols, rows });
    }

    async exec(commandLine: string, stdin?: string): Promise<ShellExecResult> {
        const result = await this.options.runtime.exec(commandLine, stdin);
        this.recordTrace({ kind: 'exec', commandLine, exitCode: result.exitCode });
        return result;
    }

    async completeLine(input: string): Promise<VFSCompletionResult> {
        const result = await this.options.runtime.completeLine(input);
        this.recordTrace({ kind: 'complete', input });
        return result;
    }

    getSnapshot(): ShellSessionRuntimeSnapshot {
        return {
            session: this.getSession(),
            cwd: this.options.runtime.getCwd(),
            env: this.options.runtime.getEnv(),
            viewport: this.viewport ? { ...this.viewport } : null,
            trace: this.trace.map(entry => ({ ...entry }))
        };
    }

    private recordTrace(entry: Omit<ShellSessionRuntimeTraceEntry, 'id' | 'at' | 'cwd'>): void {
        this.sequence += 1;
        this.trace.push({
            id: `${this.getSession().shellSessionId}:${this.sequence}`,
            at: Date.now(),
            cwd: this.options.runtime.getCwd(),
            ...entry
        });

        const maxTraceEntries = this.options.maxTraceEntries ?? 200;
        if (this.trace.length > maxTraceEntries) {
            this.trace = this.trace.slice(this.trace.length - maxTraceEntries);
        }
    }
}

export const createShellSessionRuntime = (
    runtime: BashTerminalRuntime,
    options: Omit<ShellSessionRuntimeOptions, 'runtime'> = {}
): ShellSessionRuntime => new ShellSessionRuntime({ ...options, runtime });
