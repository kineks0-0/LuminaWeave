import { JSONPath } from 'jsonpath-plus';
import { parse as parseShellQuote } from 'shell-quote';
import type {
    ResourceDiagnostic,
    VFSCommandDefinition,
    VFSCommandExample,
    VFSCompletionCandidate,
    VFSCompletionResult,
    VFSLocalizedText,
    VFSCommandManualLocale,
    VFSCommandName,
    VFSCommandRequest,
    VFSCommandResult,
    VFSDirEntry,
    VFSSearchResult,
    VFSStat
} from '@shared/resources/index.js';
import type { VirtualFileSystemService } from '../resource/VirtualFileSystemService.js';

const SHELL_DOLLAR_SENTINEL = '\uE000';

const quote = (value: string): string => value.includes(' ') ? `"${value}"` : value;

const formatEntry = (entry: VFSDirEntry): string =>
    [
        entry.type === 'directory' ? 'd' : '-',
        entry.writable ? 'w' : 'r',
        String(entry.size ?? 0).padStart(6, ' '),
        entry.name,
        entry.path
    ].join(' ');

const formatStat = (stat: VFSStat): string => [
    `path: ${stat.path}`,
    `type: ${stat.type}`,
    `readable: ${stat.readable}`,
    `writable: ${stat.writable}`,
    stat.size === undefined ? null : `size: ${stat.size}`,
    stat.ref ? `ref: ${stat.ref.sourceId}/${stat.ref.resourceType}/${stat.ref.resourceId}` : null,
    stat.summary ? `summary: ${stat.summary.name} (${stat.summary.format})` : null
].filter(Boolean).join('\n');

const formatMatch = (match: VFSSearchResult): string =>
    `${match.path}${match.line ? `:${match.line}` : ''}: ${match.preview}`;

const formatJson = (value: unknown): string =>
    JSON.stringify(value === undefined ? null : value, null, 2);

const normalizeTreePath = (path: string): string => {
    const normalized = `/${path || ''}`.replace(/\\/g, '/').replace(/\/+/g, '/');
    return normalized.length > 1 ? normalized.replace(/\/$/, '') : normalized;
};

const basename = (path: string): string => {
    const normalized = normalizeTreePath(path);
    if (normalized === '/') return '/';
    return normalized.slice(normalized.lastIndexOf('/') + 1);
};

const decodeVFSPathForTerminal = (path: string): string =>
    path.split('/').map(segment => {
        try {
            return decodeURIComponent(segment);
        } catch {
            return segment;
        }
    }).join('/');

interface CommandExecutionOptions {
    stdin?: string;
}

interface ExecutableVFSCommandDefinition extends VFSCommandDefinition {
    execute: (args: string[], options: CommandExecutionOptions) => Promise<VFSCommandResult> | VFSCommandResult;
}

interface HelpTextOptions {
    locale?: VFSCommandManualLocale;
}

interface CompletionToken {
    value: string;
    start: number;
    end: number;
    index: number;
}

const isOperatorEntry = (entry: unknown): entry is { op: string; [key: string]: unknown } =>
    typeof entry === 'object' && entry !== null && 'op' in entry;

const unsupportedShellSyntax = (op: string): string => {
    const labels: Record<string, string> = {
        '&&': 'logical AND',
        '||': 'logical OR',
        ';': 'command sequencing',
        '&': 'background jobs',
        '<': 'input redirection',
        '>': 'output redirection',
        '>>': 'append redirection',
        '>&': 'descriptor redirection',
        '|&': 'stderr pipeline',
        '<(': 'process substitution',
        '(': 'subshell',
        ')': 'subshell'
    };
    return `${labels[op] ?? `operator ${op}`} is not supported in the VFS terminal`;
};

const isCommandManualLocale = (value: string | undefined): value is VFSCommandManualLocale =>
    value === 'en-US' || value === 'zh-CN';

const localized = (en: string, zh: string): VFSLocalizedText => ({
    'en-US': en,
    'zh-CN': zh
});

const example = (command: string, output: string, note?: VFSLocalizedText): VFSCommandExample => ({
    command,
    output,
    note
});

const manualText = {
    'en-US': {
        title: 'Lumina Resource Terminal',
        intro: 'A Resource Domain VFS shell for browsing and controlled editing. It is not a system shell or PTY.',
        capabilitiesTitle: 'Command line capabilities',
        capabilities: [
            'Use VFS paths such as /sources/local/worldbooks/id and /library/characters.',
            'Use JSON payloads with write/edit/tee/json-set for structured resources.',
            'Use a single pipeline operator, for example: cat /path | jq "$.name".'
        ],
        operationsTitle: 'Terminal operations',
        operations: [
            'Enter: run the current line.',
            'Backspace: delete one character.',
            'Up/Down: recall command history.',
            'Tab: complete command names or VFS paths.',
            'Unicode input: type Chinese resource names and paths directly.',
            'Ctrl+C: cancel the current input line.',
            'Ctrl+L or clear: clear the terminal view.'
        ],
        manualTitle: 'Command manual',
        usage: 'Usage',
        example: 'Example',
        output: 'Output'
    },
    'zh-CN': {
        title: 'Lumina 资源终端',
        intro: '这是用于浏览与受控编辑 Resource Domain 的 VFS 虚拟终端，不是真实系统 shell 或 PTY。',
        capabilitiesTitle: '可用命令行能力',
        capabilities: [
            '使用 VFS 路径，例如 /sources/local/worldbooks/id 和 /library/characters。',
            '使用 write/edit/tee/json-set 处理结构化资源的 JSON payload。',
            '使用单向管道符，例如：cat /path | jq "$.name"。'
        ],
        operationsTitle: '终端可用操作',
        operations: [
            'Enter：执行当前输入行。',
            'Backspace：删除一个字符。',
            'Up/Down：召回命令历史。',
            'Tab：补全命令名或 VFS 路径。',
            '中文输入：可直接输入中文资源名和路径。',
            'Ctrl+C：取消当前输入行。',
            'Ctrl+L 或 clear：清空终端视图。'
        ],
        manualTitle: '命令手册',
        usage: '用法',
        example: '示例',
        output: '输出'
    }
} satisfies Record<VFSCommandManualLocale, {
    title: string;
    intro: string;
    capabilitiesTitle: string;
    capabilities: string[];
    operationsTitle: string;
    operations: string[];
    manualTitle: string;
    usage: string;
    example: string;
    output: string;
}>;

export class VFSCommandService {
    private readonly commandList: ExecutableVFSCommandDefinition[];
    private readonly commands: Map<VFSCommandName, ExecutableVFSCommandDefinition>;

    constructor(private readonly vfs: VirtualFileSystemService) {
        this.commandList = this.createCommands();
        this.commands = new Map(this.commandList.map(command => [command.name, command]));
    }

    listCommands(): VFSCommandDefinition[] {
        return this.commandList.map(({ execute: _execute, ...definition }) => ({
            ...definition,
            summary: { ...definition.summary },
            examples: definition.examples.map(example => ({
                ...example,
                note: example.note ? { ...example.note } : undefined
            })) as VFSCommandDefinition['examples']
        }));
    }

    getHelpText(options: HelpTextOptions = {}): string {
        const locale = options.locale ?? 'zh-CN';
        const text = manualText[locale];
        return [
            text.title,
            text.intro,
            '',
            text.capabilitiesTitle,
            ...text.capabilities.map(item => `- ${item}`),
            '',
            text.operationsTitle,
            ...text.operations.map(item => `- ${item}`),
            '',
            text.manualTitle,
            ...this.listCommands().flatMap(command => [
                `${command.name} - ${command.summary[locale]}`,
                `${text.usage}: ${command.usage}`,
                ...command.examples.flatMap(example => [
                    `${text.example}: ${example.command}`,
                    `${text.output}: ${example.output}`,
                    ...(example.note ? [example.note[locale]] : [])
                ]),
                ''
            ])
        ].join('\n').trimEnd();
    }

    async execute(command: VFSCommandName, args: string[] = [], options: CommandExecutionOptions = {}): Promise<VFSCommandResult> {
        const definition = this.commands.get(command);
        if (!definition) {
            return {
                command,
                ok: false,
                text: '',
                error: `Unsupported VFS command: ${command}`
            };
        }

        try {
            return await definition.execute(args, options);
        } catch (error) {
            return {
                command,
                ok: false,
                text: '',
                error: error instanceof Error ? error.message : String(error)
            };
        }
    }

    async executeRequest(request: VFSCommandRequest, options: CommandExecutionOptions = {}): Promise<VFSCommandResult> {
        return this.execute(request.command, request.args, options);
    }

    parse(input: string): VFSCommandRequest {
        const requests = this.parsePipeline(input);
        if (requests.length !== 1) {
            throw new Error('Pipeline cannot be parsed as a single VFS command');
        }
        return requests[0];
    }

    async executeLine(input: string): Promise<VFSCommandResult> {
        const requests = this.parsePipeline(input);
        let last: VFSCommandResult | null = null;
        for (const request of requests) {
            last = await this.executeRequest(request, {
                stdin: last?.text ?? ''
            });
            if (!last.ok) return last;
        }
        return last ?? {
            command: 'echo',
            ok: true,
            text: ''
        };
    }

    async completeLine(input: string): Promise<VFSCompletionResult> {
        const segmentStart = Math.max(input.lastIndexOf('|') + 1, 0);
        const segment = input.slice(segmentStart);
        const leadingWhitespace = segment.match(/^\s*/)?.[0].length ?? 0;
        const baseOffset = segmentStart + leadingWhitespace;
        const commandSegment = segment.slice(leadingWhitespace);
        const tokens = this.tokenizeCompletionSegment(commandSegment, baseOffset);
        const trailingWhitespace = /\s$/.test(commandSegment);

        if (tokens.length === 0 || (tokens.length === 1 && !trailingWhitespace)) {
            const token = tokens[0] ?? {
                value: '',
                start: baseOffset,
                end: baseOffset,
                index: 0
            };
            return this.completeCommand(token);
        }

        const commandToken = tokens[0];
        const definition = this.commands.get(commandToken.value as VFSCommandName);
        if (!definition) {
            return this.emptyCompletion(input.length);
        }

        const argIndex = trailingWhitespace ? tokens.length - 1 : tokens.length - 2;
        const token = trailingWhitespace
            ? {
                value: '',
                start: input.length,
                end: input.length,
                index: tokens.length
            }
            : tokens[tokens.length - 1];

        if (!this.isPathCompletionPosition(definition.name, argIndex)) {
            return this.emptyCompletion(token.start, token.end);
        }

        return this.completePath(token.value, token.start, token.end);
    }

    private tokenizeCompletionSegment(segment: string, offset: number): CompletionToken[] {
        const tokens: CompletionToken[] = [];
        let quote: '"' | '\'' | null = null;
        let escaping = false;
        let tokenStart: number | null = null;
        let value = '';

        const pushToken = (end: number) => {
            if (tokenStart === null) return;
            tokens.push({
                value,
                start: offset + tokenStart,
                end: offset + end,
                index: tokens.length
            });
            tokenStart = null;
            value = '';
        };

        for (let index = 0; index < segment.length; index += 1) {
            const char = segment[index];
            if (escaping) {
                if (tokenStart === null) tokenStart = index - 1;
                value += char;
                escaping = false;
                continue;
            }
            if (char === '\\') {
                if (tokenStart === null) tokenStart = index;
                escaping = true;
                continue;
            }
            if (quote) {
                if (char === quote) {
                    quote = null;
                } else {
                    value += char;
                }
                continue;
            }
            if (char === '"' || char === '\'') {
                if (tokenStart === null) tokenStart = index;
                quote = char;
                continue;
            }
            if (/\s/.test(char)) {
                pushToken(index);
                continue;
            }
            if (tokenStart === null) tokenStart = index;
            value += char;
        }

        pushToken(segment.length);
        return tokens;
    }

    private completeCommand(token: CompletionToken): VFSCompletionResult {
        const candidates = this.commandList
            .filter(command => command.name.startsWith(token.value))
            .map(command => ({
                value: command.name,
                display: command.name,
                type: 'command' as const
            }));
        return this.completionFromCandidates(token.value, token.start, token.end, candidates, true);
    }

    private async completePath(fragment: string, start: number, end: number): Promise<VFSCompletionResult> {
        const { parentPath, prefix } = this.pathCompletionScope(fragment);
        let entries: VFSDirEntry[];
        try {
            entries = await this.vfs.listDir(parentPath);
        } catch {
            return this.emptyCompletion(start, end);
        }

        const candidates = entries
            .map(entry => this.pathCandidate(parentPath, entry))
            .filter(candidate => candidate.value.startsWith(fragment) || this.lastPathSegment(candidate.value).startsWith(prefix));
        return this.completionFromCandidates(fragment, start, end, candidates, false);
    }

    private pathCompletionScope(fragment: string): { parentPath: string; prefix: string } {
        if (!fragment || !fragment.startsWith('/')) {
            return { parentPath: '/', prefix: fragment };
        }
        if (fragment.endsWith('/')) {
            return { parentPath: fragment === '/' ? '/' : fragment.replace(/\/$/, ''), prefix: '' };
        }
        const slashIndex = fragment.lastIndexOf('/');
        if (slashIndex <= 0) {
            return { parentPath: '/', prefix: fragment.slice(1) };
        }
        return {
            parentPath: fragment.slice(0, slashIndex),
            prefix: fragment.slice(slashIndex + 1)
        };
    }

    private pathCandidate(parentPath: string, entry: VFSDirEntry): VFSCompletionCandidate {
        const value = this.pathCompletionValue(parentPath, entry);
        const completedValue = entry.type === 'directory' ? `${value}/` : value;
        return {
            value: completedValue,
            display: completedValue,
            type: 'path',
            isDirectory: entry.type === 'directory'
        };
    }

    private pathCompletionValue(parentPath: string, entry: VFSDirEntry): string {
        if (entry.type === 'directory') return decodeVFSPathForTerminal(entry.path);
        if (parentPath.startsWith('/library/') && entry.ref) {
            return `${parentPath}/${entry.ref.resourceId}`;
        }
        return decodeVFSPathForTerminal(entry.path);
    }

    private lastPathSegment(path: string): string {
        const trimmed = path.endsWith('/') && path.length > 1 ? path.slice(0, -1) : path;
        return trimmed.slice(trimmed.lastIndexOf('/') + 1);
    }

    private completionFromCandidates(
        fragment: string,
        start: number,
        end: number,
        candidates: VFSCompletionCandidate[],
        appendSpaceForSingle: boolean
    ): VFSCompletionResult {
        if (candidates.length === 0) {
            return this.emptyCompletion(start, end);
        }

        const values = candidates.map(candidate => candidate.value);
        const commonPrefix = this.commonPrefix(values);
        const single = candidates.length === 1 ? candidates[0] : null;
        const replacement = single
            ? `${single.value}${appendSpaceForSingle || single.type === 'path' && !single.isDirectory ? ' ' : ''}`
            : commonPrefix.length > fragment.length ? commonPrefix : fragment;

        return {
            replacement,
            replacementStart: start,
            replacementEnd: end,
            candidates,
            completed: replacement !== fragment
        };
    }

    private commonPrefix(values: string[]): string {
        if (values.length === 0) return '';
        let prefix = values[0];
        for (const value of values.slice(1)) {
            while (!value.startsWith(prefix) && prefix.length > 0) {
                prefix = prefix.slice(0, -1);
            }
        }
        return prefix;
    }

    private emptyCompletion(start: number, end = start): VFSCompletionResult {
        return {
            replacement: '',
            replacementStart: start,
            replacementEnd: end,
            candidates: [],
            completed: false
        };
    }

    private isPathCompletionPosition(command: VFSCommandName, argIndex: number): boolean {
        const pathArgIndexes: Partial<Record<VFSCommandName, number[]>> = {
            ls: [0],
            cat: [0],
            grep: [1],
            find: [0],
            tree: [0],
            stat: [0],
            write: [0],
            edit: [0],
            tee: [0],
            jq: [1],
            'json-set': [0]
        };
        return pathArgIndexes[command]?.includes(argIndex) ?? false;
    }

    private createCommands(): ExecutableVFSCommandDefinition[] {
        return [
            {
                name: 'ls',
                summary: localized('List resources or virtual directories.', '列出资源或虚拟目录。'),
                usage: 'ls [path]',
                examples: [
                    example('ls /library/worldbooks', 'dr      0 Command Book [local] /sources/local/worldbooks/book-id'),
                    example('ls /sources/local/characters', '-w    128 Hero /sources/local/characters/hero')
                ],
                execute: (args) => this.ls(args[0] ?? '/')
            },
            {
                name: 'cat',
                summary: localized('Read a resource file as JSON text.', '以 JSON 文本读取资源文件。'),
                usage: 'cat <path>',
                examples: [
                    example('cat /sources/local/worldbooks/main', '{\n  "name": "Main",\n  "entries": {}\n}'),
                    example('cat /library/characters/hero', '{\n  "name": "Hero"\n}')
                ],
                execute: (args) => this.cat(this.requireArg('cat', args, 0, 'path'))
            },
            {
                name: 'grep',
                summary: localized('Search text in VFS resources or piped stdin.', '在 VFS 资源或管道输入中搜索文本。'),
                usage: 'grep <pattern> [path]',
                examples: [
                    example('grep castle /library/worldbooks', '/sources/local/worldbooks/main:12: "content": "castle gate"'),
                    example('cat /sources/local/worldbooks/main | grep castle', '8:     "content": "castle gate"')
                ],
                execute: (args, options) => this.grepTextOrVFS(
                    this.requireArg('grep', args, 0, 'pattern'),
                    args[1],
                    options.stdin
                )
            },
            {
                name: 'find',
                summary: localized('Find resource paths under a VFS path.', '查找某个 VFS 路径下的资源路径。'),
                usage: 'find [path]',
                examples: [
                    example('find /library/characters', '"/sources/local/characters/hero"'),
                    example('find /sources/local/worldbooks', '"/sources/local/worldbooks/main"')
                ],
                execute: (args) => this.find(args[0] ?? '/')
            },
            {
                name: 'tree',
                summary: localized('Print a recursive VFS directory tree.', '递归列出 VFS 目录树。'),
                usage: 'tree [path] [--info]',
                examples: [
                    example('tree /library', '/library\n├── characters\n├── worldbooks\n└── presets'),
                    example('tree /sources/local/worldbooks --info', '/sources/local/worldbooks\n└── main - Main worldbook, 3 entries, st-worldbook')
                ],
                execute: (args) => this.tree(args)
            },
            {
                name: 'stat',
                summary: localized('Show VFS metadata for a path.', '显示某个路径的 VFS 元数据。'),
                usage: 'stat <path>',
                examples: [
                    example('stat /library/worldbooks', 'path: /library/worldbooks\ntype: directory\nreadable: true\nwritable: false'),
                    example('stat /sources/local/characters/hero', 'ref: local/character/hero\nsummary: Hero (st-character)')
                ],
                execute: (args) => this.stat(this.requireArg('stat', args, 0, 'path'))
            },
            {
                name: 'echo',
                summary: localized('Print arguments to stdout.', '将参数输出到 stdout。'),
                usage: 'echo <text>',
                examples: [
                    example('echo hello', 'hello'),
                    example('echo \'{"name":"Draft"}\' | write /sources/local/presets/draft', 'saved: /sources/local/presets/draft')
                ],
                execute: (args) => this.echo(args)
            },
            {
                name: 'write',
                summary: localized('Write a full JSON payload to a resource path through write policy.', '通过写入策略将完整 JSON payload 写入资源路径。'),
                usage: 'write <path> <json>',
                examples: [
                    example('write /sources/local/presets/draft \'{"name":"Draft"}\'', 'saved: /sources/local/presets/draft'),
                    example('echo \'{"name":"Draft"}\' | write /sources/local/presets/draft', 'saved: /sources/local/presets/draft')
                ],
                execute: (args, options) => this.write(
                    'write',
                    this.requireArg('write', args, 0, 'path'),
                    args.slice(1).join(' ') || options.stdin
                )
            },
            {
                name: 'edit',
                summary: localized('Replace a resource with a full JSON payload through write policy.', '通过写入策略用完整 JSON payload 替换资源。'),
                usage: 'edit <path> <json>',
                examples: [
                    example('edit /sources/local/worldbooks/main \'{"name":"Main","entries":{}}\'', 'saved: /sources/local/worldbooks/main'),
                    example('cat /sources/local/worldbooks/main | edit /sources/local/worldbooks/copy', 'saved: /sources/local/worldbooks/copy')
                ],
                execute: (args, options) => this.write(
                    'edit',
                    this.requireArg('edit', args, 0, 'path'),
                    args.slice(1).join(' ') || options.stdin
                )
            },
            {
                name: 'tee',
                summary: localized('Write piped JSON stdin to a path and echo stdin back.', '将管道输入的 JSON 写入路径，并回显 stdin。'),
                usage: 'tee <path>',
                examples: [
                    example('echo \'{"name":"Draft"}\' | tee /sources/local/presets/draft', '{ "name": "Draft" }'),
                    example('cat /sources/local/presets/source | tee /sources/local/presets/copy', '{\n  "name": "Source"\n}')
                ],
                execute: (args, options) => this.tee(
                    this.requireArg('tee', args, 0, 'path'),
                    options.stdin
                )
            },
            {
                name: 'jq',
                summary: localized('Query JSON from a VFS file or piped stdin using JSONPath.', '使用 JSONPath 查询 VFS 文件或管道输入中的 JSON。'),
                usage: 'jq <jsonpath> [path]',
                examples: [
                    example('jq "$.name" /sources/local/characters/hero', '"Hero"'),
                    example('cat /sources/local/worldbooks/main | jq "$.entries.*.content"', '[\n  "Castle lore"\n]')
                ],
                execute: (args, options) => this.jq(
                    this.requireArg('jq', args, 0, 'jsonpath'),
                    args[1],
                    options.stdin
                )
            },
            {
                name: 'json-set',
                summary: localized('Set one JSONPath location in a JSON resource through write policy.', '通过写入策略设置 JSON 资源中的单个 JSONPath 位置。'),
                usage: 'json-set <path> <jsonpath> <json-value>',
                examples: [
                    example('json-set /sources/local/characters/hero "$.status" awake', 'saved: /sources/local/characters/hero'),
                    example('json-set /sources/local/worldbooks/main "$.entries.a.content" \'"Updated lore."\'', 'saved: /sources/local/worldbooks/main')
                ],
                execute: (args) => this.jsonSet(
                    this.requireArg('json-set', args, 0, 'path'),
                    this.requireArg('json-set', args, 1, 'jsonpath'),
                    this.requireArg('json-set', args, 2, 'json-value')
                )
            },
            {
                name: 'help',
                summary: localized('Show the virtual terminal guide and command manual.', '显示虚拟终端说明和命令手册。'),
                usage: 'help [zh-CN|en-US]',
                examples: [
                    example('help', 'Lumina 资源终端\n...'),
                    example('help en-US', 'Lumina Resource Terminal\n...')
                ],
                execute: (args) => ({
                    command: 'help',
                    ok: true,
                    text: this.getHelpText({ locale: isCommandManualLocale(args[0]) ? args[0] : 'zh-CN' })
                })
            },
            {
                name: 'clear',
                summary: localized('Clear the terminal view in supported terminal UIs.', '在支持的终端 UI 中清空终端视图。'),
                usage: 'clear',
                examples: [
                    example('clear', ''),
                    example('Ctrl+L', '')
                ],
                execute: () => ({
                    command: 'clear',
                    ok: true,
                    text: ''
                })
            }
        ];
    }

    private parsePipeline(input: string): VFSCommandRequest[] {
        const protectedInput = input.replace(/\$/g, SHELL_DOLLAR_SENTINEL);
        const entries = parseShellQuote(protectedInput) as unknown[];
        const requests: VFSCommandRequest[] = [];
        let current: string[] = [];

        for (const entry of entries) {
            if (typeof entry === 'string') {
                current.push(entry.replaceAll(SHELL_DOLLAR_SENTINEL, '$'));
                continue;
            }

            if (isOperatorEntry(entry)) {
                if (entry.op === '|') {
                    if (current.length === 0) throw new Error('Empty command in pipeline');
                    requests.push(this.createRequest(current));
                    current = [];
                    continue;
                }

                throw new Error(unsupportedShellSyntax(entry.op));
            }

            if (typeof entry === 'object' && entry !== null && 'comment' in entry) {
                throw new Error('Shell comments are not supported in the VFS terminal');
            }

            throw new Error('Unsupported shell token in VFS command');
        }

        if (current.length > 0) requests.push(this.createRequest(current));
        if (requests.length === 0) throw new Error('Empty VFS command');
        return requests;
    }

    private createRequest(tokens: string[]): VFSCommandRequest {
        const command = tokens[0] as VFSCommandName;
        if (!this.commands.has(command)) {
            throw new Error(`Unsupported VFS command: ${tokens[0]}`);
        }
        return {
            command,
            args: tokens.slice(1)
        };
    }

    private async ls(path: string): Promise<VFSCommandResult> {
        const entries = await this.vfs.listDir(path);
        return {
            command: 'ls',
            ok: true,
            entries,
            text: entries.map(formatEntry).join('\n')
        };
    }

    private async cat(path: string): Promise<VFSCommandResult> {
        const text = await this.vfs.readFile(path);
        return {
            command: 'cat',
            ok: true,
            text
        };
    }

    private async grepTextOrVFS(pattern: string, path: string | undefined, stdin: string | undefined): Promise<VFSCommandResult> {
        if (!path && stdin !== undefined) {
            const matches = stdin
                .split('\n')
                .map((line, index) => ({ line, index }))
                .filter(item => item.line.toLowerCase().includes(pattern.toLowerCase()))
                .map(item => `${item.index + 1}: ${item.line}`);
            return {
                command: 'grep',
                ok: true,
                text: matches.join('\n')
            };
        }
        return this.grep(pattern, path ?? '/');
    }

    private async grep(pattern: string, path: string): Promise<VFSCommandResult> {
        const matches = await this.vfs.search({
            path,
            content: pattern
        });
        return {
            command: 'grep',
            ok: true,
            matches,
            text: matches.map(formatMatch).join('\n')
        };
    }

    private async find(path: string): Promise<VFSCommandResult> {
        const resolved = this.vfs.resolvePath(path);
        const matches = await this.vfs.search({
            path,
            resourceType: resolved.resourceType,
            sourceId: resolved.sourceId
        });
        return {
            command: 'find',
            ok: true,
            matches,
            text: matches.map(match => quote(match.path)).join('\n')
        };
    }

    private async tree(args: string[]): Promise<VFSCommandResult> {
        const includeInfo = args.includes('--info');
        const path = args.find(arg => arg !== '--info') ?? '/';
        const stat = await this.vfs.stat(path);
        const lines = [
            includeInfo ? `${normalizeTreePath(path)}${this.describeStat(stat)}` : normalizeTreePath(path)
        ];

        if (stat.type === 'directory') {
            const entries = await this.vfs.listDir(path);
            await this.appendTreeLines(path, entries, '', includeInfo, lines);
        }

        return {
            command: 'tree',
            ok: true,
            text: lines.join('\n')
        };
    }

    private async appendTreeLines(
        parentPath: string,
        entries: VFSDirEntry[],
        prefix: string,
        includeInfo: boolean,
        lines: string[]
    ): Promise<void> {
        const sorted = [...entries].sort((left, right) => {
            if (left.type !== right.type) return left.type === 'directory' ? -1 : 1;
            return left.name.localeCompare(right.name);
        });

        for (const [index, entry] of sorted.entries()) {
            const isLast = index === sorted.length - 1;
            const branch = isLast ? '└── ' : '├── ';
            const childPrefix = `${prefix}${isLast ? '    ' : '│   '}`;
            const label = this.treeEntryLabel(parentPath, entry);
            lines.push(`${prefix}${branch}${label}${includeInfo ? this.describeEntry(entry) : ''}`);
            if (entry.type === 'directory') {
                try {
                    const children = await this.vfs.listDir(entry.path);
                    await this.appendTreeLines(entry.path, children, childPrefix, includeInfo, lines);
                } catch {
                    lines.push(`${childPrefix}└── <unavailable>`);
                }
            }
        }
    }

    private treeEntryLabel(parentPath: string, entry: VFSDirEntry): string {
        if (parentPath.startsWith('/library/') && entry.ref) return entry.ref.resourceId;
        return entry.type === 'directory' ? basename(entry.path) : basename(entry.path);
    }

    private describeEntry(entry: VFSDirEntry): string {
        if (entry.type === 'directory') return ' - directory';
        return this.describeStat(entry);
    }

    private describeStat(stat: VFSStat): string {
        if (stat.type === 'directory') return ' - directory';
        const parts = [
            stat.summary?.description || stat.summary?.name,
            stat.summary?.entryCount === undefined ? null : `${stat.summary.entryCount} entries`,
            stat.summary?.format,
            stat.ref ? `${stat.ref.sourceId}/${stat.ref.resourceType}/${stat.ref.resourceId}` : null,
            stat.size === undefined ? null : `${stat.size} bytes`
        ].filter((part): part is string => Boolean(part));
        return parts.length ? ` - ${parts.join(', ')}` : '';
    }

    private async stat(path: string): Promise<VFSCommandResult> {
        const stat = await this.vfs.stat(path);
        return {
            command: 'stat',
            ok: true,
            stat,
            text: formatStat(stat)
        };
    }

    private echo(args: string[]): VFSCommandResult {
        return {
            command: 'echo',
            ok: true,
            text: args.join(' ')
        };
    }

    private async jq(jsonPath: string, path: string | undefined, stdin: string | undefined): Promise<VFSCommandResult> {
        const raw = path ? await this.vfs.readFile(path) : stdin;
        if (raw === undefined) {
            throw new Error('jq requires a VFS path or piped JSON stdin');
        }
        const json = this.parseJsonPayload(raw, 'jq input');
        const result = JSONPath({
            path: jsonPath,
            json: json as null | boolean | number | string | object | unknown[],
            wrap: false,
            eval: false
        });
        return {
            command: 'jq',
            ok: true,
            text: formatJson(result)
        };
    }

    private async jsonSet(path: string, jsonPath: string, rawValue: string): Promise<VFSCommandResult> {
        const json = this.parseJsonPayload(await this.vfs.readFile(path), 'json-set input');
        const next = this.cloneJson(json);
        const value = this.parseJsonValue(rawValue);
        this.setJsonPathValue(next, jsonPath, value);
        return this.saveJsonPayload('json-set', path, next);
    }

    private async write(command: 'write' | 'edit', path: string, rawPayload: string | undefined): Promise<VFSCommandResult> {
        if (!rawPayload?.trim()) {
            throw new Error(`${command} requires JSON payload or piped stdin`);
        }
        return this.saveJsonPayload(command, path, this.parseJsonPayload(rawPayload, `${command} payload`));
    }

    private async saveJsonPayload(command: VFSCommandName, path: string, payload: unknown): Promise<VFSCommandResult> {
        const result = await this.vfs.writeFile(path, payload, { policy: 'ask' });
        const diagnostics = result.diagnostics ?? [];
        if (result.status !== 'saved' && result.status !== 'forked') {
            return {
                command,
                ok: false,
                text: diagnostics.map(diagnostic => diagnostic.message).join('\n'),
                diagnostics,
                error: `Resource write ${result.status}: ${path}`
            };
        }
        return {
            command,
            ok: true,
            text: `${result.status}: ${result.document?.ref.path ?? path}`,
            diagnostics
        };
    }

    private async tee(path: string, stdin: string | undefined): Promise<VFSCommandResult> {
        if (stdin === undefined) {
            throw new Error('tee requires piped stdin');
        }
        const writeResult = await this.write('write', path, stdin);
        return {
            ...writeResult,
            command: 'tee',
            text: writeResult.ok ? stdin : writeResult.text
        };
    }

    private requireArg(command: VFSCommandName, args: string[], index: number, name: string): string {
        const value = args[index];
        if (!value) {
            throw new Error(`${command} requires ${name}`);
        }
        return value;
    }

    private parseJsonPayload(value: string, label: string): unknown {
        try {
            return JSON.parse(value);
        } catch (error) {
            throw new Error(`${label} must be valid JSON: ${error instanceof Error ? error.message : String(error)}`);
        }
    }

    private parseJsonValue(value: string): unknown {
        try {
            return JSON.parse(value);
        } catch {
            return value;
        }
    }

    private cloneJson(value: unknown): unknown {
        return JSON.parse(JSON.stringify(value));
    }

    private setJsonPathValue(json: unknown, path: string, value: unknown): void {
        if (!path.startsWith('$')) {
            throw new Error('json-set path must start with $');
        }
        if (/[\*\?\@\:\,\(\)\^\~]/.test(path)) {
            throw new Error('json-set only supports a single deterministic JSONPath without wildcard, filter, slice, or script syntax');
        }

        const segments = JSONPath.toPathArray(path).slice(1);
        if (segments.length === 0) {
            throw new Error('json-set cannot replace the JSON document root');
        }

        const parentSegments = segments.slice(0, -1);
        const leaf = segments[segments.length - 1];
        let cursor: unknown = json;
        for (const segment of parentSegments) {
            cursor = this.readJsonChild(cursor, segment);
            if (cursor === undefined) {
                throw new Error(`json-set parent path does not exist: ${path}`);
            }
        }

        if (Array.isArray(cursor)) {
            if (!/^\d+$/.test(leaf)) {
                throw new Error('json-set array targets require a numeric index');
            }
            const index = Number(leaf);
            if (index < 0 || index >= cursor.length) {
                throw new Error(`json-set array index out of range: ${leaf}`);
            }
            cursor[index] = value;
            return;
        }

        if (cursor !== null && typeof cursor === 'object') {
            (cursor as Record<string, unknown>)[leaf] = value;
            return;
        }

        throw new Error('json-set parent target must be an object or array');
    }

    private readJsonChild(value: unknown, segment: string): unknown {
        if (Array.isArray(value)) {
            if (!/^\d+$/.test(segment)) return undefined;
            return value[Number(segment)];
        }
        if (value !== null && typeof value === 'object') {
            return (value as Record<string, unknown>)[segment];
        }
        return undefined;
    }
}
