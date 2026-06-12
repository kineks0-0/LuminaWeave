import { Type } from '@earendil-works/pi-ai';
import type {
    AgentRuntimeTool,
    AgentRuntimeToolResult,
    AgentToolRegistry
} from '../tools/AgentToolRegistry.js';

export type AgentWorkspaceToolName = 'read' | 'write' | 'edit' | 'delete' | 'bash' | 'grep' | 'find' | 'ls' | 'search';

export interface AgentWorkspaceFileSystem {
    readFile(path: string): Promise<string>;
    writeFile(path: string, content: string): Promise<void>;
    deleteFile(path: string): Promise<void>;
    exists(path: string): Promise<boolean>;
    listFiles(): string[] | Promise<string[]>;
}

export interface AgentWorkspaceToolsOptions {
    fs: AgentWorkspaceFileSystem;
    tools: AgentWorkspaceToolName[];
    audit?: (event: AgentWorkspaceAuditEvent) => Promise<unknown> | unknown;
    bash?: AgentWorkspaceBashExecutor;
}

interface ReadToolArgs {
    path: string;
}

interface WriteToolArgs {
    path: string;
    content: string;
}

interface DeleteToolArgs {
    path: string;
}

interface LsToolArgs {
    path?: string;
}

interface FindToolArgs {
    query: string;
}

interface GrepToolArgs {
    pattern: string;
    path?: string;
}

interface SearchToolArgs {
    query: string;
    limit?: number;
}

interface BashToolArgs {
    command: string;
    cwd?: string;
}

interface EditToolArgs {
    path: string;
    edits: Array<{
        oldText: string;
        newText: string;
    }>;
}

interface EditToolDetails {
    path: string;
    patch: string;
    audit?: unknown;
}

export interface AgentWorkspaceAuditEvent {
    kind: 'write' | 'edit' | 'delete';
    path: string;
    content?: string;
    beforeContent?: string;
    afterContent?: string;
    edits?: EditToolArgs['edits'];
}

export interface AgentWorkspaceBashOutputEvent {
    type: 'stdout' | 'stderr';
    text: string;
}

export interface AgentWorkspaceBashInput {
    command: string;
    cwd?: string;
    onOutput: (event: AgentWorkspaceBashOutputEvent) => void;
}

export interface AgentWorkspaceBashResult {
    stdout: string;
    stderr: string;
    exitCode: number;
    details?: unknown;
}

export type AgentWorkspaceBashExecutor = (input: AgentWorkspaceBashInput) => Promise<AgentWorkspaceBashResult>;

export const createInMemoryWorkspaceFileSystem = (): AgentWorkspaceFileSystem => {
    const files = new Map<string, string>();
    return {
        readFile: async path => {
            const normalized = normalizeWorkspacePath(path);
            const content = files.get(normalized);
            if (content === undefined) {
                throw new Error(`Workspace file not found: ${path}`);
            }
            return content;
        },
        writeFile: async (path, content) => {
            files.set(normalizeWorkspacePath(path), content);
        },
        deleteFile: async path => {
            files.delete(normalizeWorkspacePath(path));
        },
        exists: async path => files.has(normalizeWorkspacePath(path)),
        listFiles: () => Array.from(files.keys()).sort()
    };
};

export const createAgentWorkspaceTools = (options: AgentWorkspaceToolsOptions): { register: (registry: AgentToolRegistry) => AgentToolRegistry } => ({
    register: registry => {
        const queue = new WorkspaceMutationQueue();
        for (const toolName of options.tools) {
            registry.register(createWorkspaceTool(toolName, options, queue));
        }
        return registry;
    }
});

const createWorkspaceTool = (
    toolName: AgentWorkspaceToolName,
    options: AgentWorkspaceToolsOptions,
    queue: WorkspaceMutationQueue
): AgentRuntimeTool<unknown, unknown> => {
    switch (toolName) {
        case 'read':
            return createReadTool(options.fs);
        case 'write':
            return createWriteTool(options, queue);
        case 'edit':
            return createEditTool(options, queue);
        case 'delete':
            return createDeleteTool(options, queue);
        case 'bash':
            return createBashTool(options.bash);
        case 'grep':
            return createGrepTool(options.fs);
        case 'find':
            return createFindTool(options.fs);
        case 'ls':
            return createLsTool(options.fs);
        case 'search':
            return createSearchTool(options.fs);
    }
};

const createReadTool = (fs: AgentWorkspaceFileSystem): AgentRuntimeTool<unknown, { path: string }> => ({
    name: 'read',
    description: 'Read a workspace file.',
    parameters: Type.Object({
        path: Type.String()
    }),
    execute: async (_toolCallId, args) => {
        assertPathArg(args);
        const content = await fs.readFile(args.path);
        return textResult(content, { path: args.path });
    }
});

const createWriteTool = (
    options: AgentWorkspaceToolsOptions,
    queue: WorkspaceMutationQueue
): AgentRuntimeTool<unknown, { path: string; audit?: unknown }> => ({
    name: 'write',
    description: 'Write a workspace file.',
    parameters: Type.Object({
        path: Type.String(),
        content: Type.String()
    }),
    execute: async (_toolCallId, args) => {
        assertWriteArgs(args);
        return queue.run(args.path, async () => {
            await options.fs.writeFile(args.path, args.content);
            const audit = await options.audit?.({
                kind: 'write',
                path: args.path,
                content: args.content,
                afterContent: args.content
            });
            return textResult(`Wrote ${args.path}.`, withOptionalAudit({ path: args.path }, audit));
        });
    }
});

const createEditTool = (
    options: AgentWorkspaceToolsOptions,
    queue: WorkspaceMutationQueue
): AgentRuntimeTool<unknown, EditToolDetails> => ({
    name: 'edit',
    description: 'Edit a workspace file with exact text replacements.',
    parameters: Type.Object({
        path: Type.String(),
        edits: Type.Array(Type.Object({
            oldText: Type.String(),
            newText: Type.String()
        }))
    }),
    execute: async (_toolCallId, args) => {
        assertEditArgs(args);
        return queue.run(args.path, async () => {
            const original = await options.fs.readFile(args.path);
            const edited = applyExactEdits(args.path, original, args.edits);
            const patch = createPatch(args.path, args.edits);
            await options.fs.writeFile(args.path, edited);
            const audit = await options.audit?.({
                kind: 'edit',
                path: args.path,
                beforeContent: original,
                afterContent: edited,
                edits: args.edits
            });
            return textResult(
                `Edited ${args.path} with ${args.edits.length} ${args.edits.length === 1 ? 'replacement' : 'replacements'}.`,
                withOptionalAudit({ path: args.path, patch }, audit)
            );
        });
    }
});

const createDeleteTool = (
    options: AgentWorkspaceToolsOptions,
    queue: WorkspaceMutationQueue
): AgentRuntimeTool<unknown, { path: string; audit?: unknown }> => ({
    name: 'delete',
    description: 'Delete a workspace file.',
    parameters: Type.Object({
        path: Type.String()
    }),
    execute: async (_toolCallId, args) => {
        assertPathArg(args);
        return queue.run(args.path, async () => {
            const beforeContent = await options.fs.exists(args.path) ? await options.fs.readFile(args.path) : undefined;
            await options.fs.deleteFile(args.path);
            const audit = await options.audit?.({
                kind: 'delete',
                path: args.path,
                beforeContent
            });
            return textResult(`Deleted ${args.path}.`, withOptionalAudit({ path: args.path }, audit));
        });
    }
});

const createLsTool = (fs: AgentWorkspaceFileSystem): AgentRuntimeTool<unknown, { path: string; matches: string[] }> => ({
    name: 'ls',
    description: 'List workspace files under a path.',
    parameters: Type.Object({
        path: Type.Optional(Type.String())
    }),
    execute: async (_toolCallId, args) => {
        const path = readOptionalStringArg(args, 'path') ?? './';
        const matches = await listFilesUnderPath(fs, path);
        return textResult(matches.join('\n'), { path, matches });
    }
});

const createFindTool = (fs: AgentWorkspaceFileSystem): AgentRuntimeTool<unknown, { query: string; matches: string[] }> => ({
    name: 'find',
    description: 'Find workspace files by path substring.',
    parameters: Type.Object({
        query: Type.String()
    }),
    execute: async (_toolCallId, args) => {
        const query = readRequiredStringArg(args, 'query');
        const matches = (await listWorkspaceFiles(fs))
            .map(displayWorkspacePath)
            .filter(path => path.toLocaleLowerCase().includes(query.toLocaleLowerCase()));
        return textResult(matches.join('\n'), { query, matches });
    }
});

const createGrepTool = (fs: AgentWorkspaceFileSystem): AgentRuntimeTool<unknown, { pattern: string; matches: string[] }> => ({
    name: 'grep',
    description: 'Search workspace file contents by exact text pattern.',
    parameters: Type.Object({
        pattern: Type.String(),
        path: Type.Optional(Type.String())
    }),
    execute: async (_toolCallId, args) => {
        const pattern = readRequiredStringArg(args, 'pattern');
        const path = readOptionalStringArg(args, 'path') ?? './';
        const matches: string[] = [];
        for (const filePath of await listFilesUnderPath(fs, path)) {
            const content = await fs.readFile(filePath);
            content.split(/\r?\n/).forEach((line, index) => {
                if (line.includes(pattern)) {
                    matches.push(`${filePath}:${index + 1}:${line}`);
                }
            });
        }
        return textResult(matches.join('\n'), { pattern, matches });
    }
});

const createSearchTool = (fs: AgentWorkspaceFileSystem): AgentRuntimeTool<unknown, { query: string; matches: Array<{ path: string; score: number; snippet: string }> }> => ({
    name: 'search',
    description: 'Search workspace files by path and content.',
    parameters: Type.Object({
        query: Type.String(),
        limit: Type.Optional(Type.Number())
    }),
    execute: async (_toolCallId, args) => {
        const query = readRequiredStringArg(args, 'query');
        const limit = readOptionalNumberArg(args, 'limit') ?? 20;
        const matches = (await Promise.all((await listWorkspaceFiles(fs)).map(async path => {
            const displayPath = displayWorkspacePath(path);
            const content = await fs.readFile(displayPath);
            return scoreSearchMatch(displayPath, content, query);
        })))
            .filter((match): match is { path: string; score: number; snippet: string } => match !== null)
            .sort((left, right) => right.score - left.score || left.path.localeCompare(right.path))
            .slice(0, limit);
        return textResult(matches.map(match => `[${match.score}] ${match.path} ${match.snippet}`).join('\n'), { query, matches });
    }
});

const createBashTool = (bash: AgentWorkspaceBashExecutor | undefined): AgentRuntimeTool<unknown, {
    command?: string;
    cwd?: string;
    exitCode?: number;
    stdout?: string;
    stderr?: string;
    outputEvents?: AgentWorkspaceBashOutputEvent[];
    adapter?: unknown;
    reason?: string;
}> => ({
    name: 'bash',
    description: 'Run a workspace shell command through an adapter-provided bash implementation.',
    parameters: Type.Object({
        command: Type.String(),
        cwd: Type.Optional(Type.String())
    }),
    execute: async (_toolCallId, args) => {
        if (!bash) {
            throw new Error('Agent workspace bash requires an adapter-provided implementation.');
        }
        assertBashArgs(args);
        const outputEvents: AgentWorkspaceBashOutputEvent[] = [];
        const result = await bash({
            command: args.command,
            cwd: args.cwd,
            onOutput: event => {
                outputEvents.push({ ...event });
            }
        });
        return textResult(`${result.stdout}${result.stderr}`, {
            command: args.command,
            cwd: args.cwd,
            exitCode: result.exitCode,
            stdout: result.stdout,
            stderr: result.stderr,
            outputEvents,
            adapter: result.details
        });
    }
});

class WorkspaceMutationQueue {
    private readonly queues = new Map<string, Promise<void>>();

    async run<TResult>(path: string, operation: () => Promise<TResult>): Promise<TResult> {
        const normalized = normalizeWorkspacePath(path);
        const previous = this.queues.get(normalized) ?? Promise.resolve();
        let settleCurrent = async (): Promise<void> => undefined;
        const current = previous
            .catch(() => undefined)
            .then(operation)
            .finally(() => settleCurrent());
        const queueEntry = current.then(
            () => undefined,
            () => undefined
        );
        settleCurrent = async () => {
            if (this.queues.get(normalized) === queueEntry) {
                this.queues.delete(normalized);
            }
        };
        this.queues.set(normalized, queueEntry);
        return current;
    }
}

const applyExactEdits = (
    path: string,
    original: string,
    edits: EditToolArgs['edits']
): string => {
    let edited = original;
    for (const edit of edits) {
        const count = countOccurrences(edited, edit.oldText);
        if (count !== 1) {
            throw new Error(`Edit oldText must match exactly once in ${path}: ${edit.oldText}`);
        }
        edited = edited.replace(edit.oldText, edit.newText);
    }
    return edited;
};

const createPatch = (path: string, edits: EditToolArgs['edits']): string => [
    `--- ${path}`,
    `+++ ${path}`,
    ...edits.flatMap(edit => [
        `-${edit.oldText}`,
        `+${edit.newText}`
    ])
].join('\n');

const countOccurrences = (content: string, search: string): number => {
    if (!search) return 0;
    let count = 0;
    let index = content.indexOf(search);
    while (index !== -1) {
        count += 1;
        index = content.indexOf(search, index + search.length);
    }
    return count;
};

function assertPathArg(args: unknown): asserts args is { path: string } & Record<string, unknown> {
    if (!isRecord(args) || typeof args.path !== 'string' || args.path.length === 0) {
        throw new Error('Workspace tool requires path.');
    }
}

function assertWriteArgs(args: unknown): asserts args is WriteToolArgs {
    assertPathArg(args);
    if (typeof args.content !== 'string') {
        throw new Error('write requires content.');
    }
}

function assertEditArgs(args: unknown): asserts args is EditToolArgs {
    assertPathArg(args);
    if (!Array.isArray(args.edits) || args.edits.length === 0) {
        throw new Error('edit requires at least one replacement.');
    }
    for (const edit of args.edits) {
        if (typeof edit.oldText !== 'string' || typeof edit.newText !== 'string') {
            throw new Error('edit replacements require oldText and newText.');
        }
    }
}

function assertBashArgs(args: unknown): asserts args is BashToolArgs {
    if (!isRecord(args) || typeof args.command !== 'string' || args.command.length === 0) {
        throw new Error('bash requires command.');
    }
    if (args.cwd !== undefined && typeof args.cwd !== 'string') {
        throw new Error('bash cwd must be a string.');
    }
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null;
}

const readRequiredStringArg = (args: unknown, key: string): string => {
    if (!isRecord(args) || typeof args[key] !== 'string' || args[key].length === 0) {
        throw new Error(`Workspace tool requires ${key}.`);
    }
    return args[key];
};

const readOptionalStringArg = (args: unknown, key: string): string | undefined => {
    if (!isRecord(args) || args[key] === undefined) return undefined;
    if (typeof args[key] !== 'string') {
        throw new Error(`Workspace tool ${key} must be a string.`);
    }
    return args[key];
};

const readOptionalNumberArg = (args: unknown, key: string): number | undefined => {
    if (!isRecord(args) || args[key] === undefined) return undefined;
    if (typeof args[key] !== 'number' || !Number.isFinite(args[key])) {
        throw new Error(`Workspace tool ${key} must be a number.`);
    }
    return args[key];
};

const textResult = <TDetails>(text: string, details: TDetails): AgentRuntimeToolResult<TDetails> => ({
    content: [{ type: 'text', text }],
    details
});

const withOptionalAudit = <TDetails extends Record<string, unknown>>(details: TDetails, audit: unknown): TDetails & { audit?: unknown } =>
    audit === undefined ? details : { ...details, audit };

const listWorkspaceFiles = async (fs: AgentWorkspaceFileSystem): Promise<string[]> =>
    await fs.listFiles();

const listFilesUnderPath = async (fs: AgentWorkspaceFileSystem, path: string): Promise<string[]> => {
    const normalizedPath = normalizeWorkspacePath(path);
    const prefix = normalizedPath ? `${normalizedPath.replace(/\/$/, '')}/` : '';
    return (await listWorkspaceFiles(fs))
        .filter(file => {
            const normalizedFile = normalizeWorkspacePath(file);
            return !prefix || normalizedFile.startsWith(prefix);
        })
        .map(displayWorkspacePath)
        .sort();
};

const displayWorkspacePath = (path: string): string => {
    const normalized = normalizeWorkspacePath(path);
    return normalized ? `./${normalized}` : './';
};

const scoreSearchMatch = (
    path: string,
    content: string,
    query: string
): { path: string; score: number; snippet: string } | null => {
    const normalizedQuery = query.toLocaleLowerCase();
    const pathMatches = path.toLocaleLowerCase().includes(normalizedQuery);
    const line = content.split(/\r?\n/).find(value => value.toLocaleLowerCase().includes(normalizedQuery));
    if (!pathMatches && !line) return null;
    return {
        path,
        score: line ? 2 : 1,
        snippet: line ?? path
    };
};

const normalizeWorkspacePath = (path: string): string =>
    path
        .replace(/\\/g, '/')
        .replace(/\/+/g, '/')
        .replace(/^\.\//, '');
