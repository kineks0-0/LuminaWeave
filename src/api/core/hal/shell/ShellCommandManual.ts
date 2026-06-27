import type { ShellSessionRef } from '@shared/resources/index.js';

export type ShellCommandSource = 'just-bash' | 'lumina';

export interface ShellCommandMetadata {
    name: string;
    source: ShellCommandSource;
    summary: string;
    usage: string;
    examples: [string, string, ...string[]];
    permissions: string;
    notes?: string[];
}

export interface ShellCommandManualInput {
    session: ShellSessionRef;
    cwd: string;
    networkEnabled?: boolean;
    includeAgentTools?: boolean;
}

export interface ShellCommandManual {
    title: string;
    workingDirectory: string;
    overview: string[];
    paths: string[];
    permissions: string[];
    commands: ShellCommandMetadata[];
    notes: string[];
}

const command = (
    input: Omit<ShellCommandMetadata, 'examples'> & { examples: [string, string, ...string[]] }
): ShellCommandMetadata => input;

const BUILTIN_COMMANDS: ShellCommandMetadata[] = [
    command({
        name: 'cat',
        source: 'just-bash',
        summary: 'Read files from Resource Domain mounts or workspaces.',
        usage: 'cat <path>',
        examples: ['cat /library/worldbooks/main', 'cat drafts/card.md'],
        permissions: 'Requires read permission for the resolved path.'
    }),
    command({
        name: 'cp',
        source: 'just-bash',
        summary: 'Copy files between workspace and resource mounts.',
        usage: 'cp <source> <destination>',
        examples: ['cp /sources/local/worldbooks/main.json /workspaces/forge/project-a/main.json', 'cp draft.json /sources/local/worldbooks/draft'],
        permissions: 'Requires read permission on the source and write permission on the destination; resource writes still use Resource Write Policy.'
    }),
    command({
        name: 'mv',
        source: 'just-bash',
        summary: 'Move files inside writable workspaces.',
        usage: 'mv <source> <destination>',
        examples: ['mv drafts/a.md drafts/b.md', 'mv /workspaces/forge/project-a/a.md /workspaces/forge/project-a/archive/a.md'],
        permissions: 'Requires write permission on both source and destination. Resource mount moves are blocked until delete policy exists.'
    }),
    command({
        name: 'rm',
        source: 'just-bash',
        summary: 'Remove files from writable workspaces.',
        usage: 'rm [-r] <path>',
        examples: ['rm drafts/old.md', 'rm -r /workspaces/forge/project-a/tmp'],
        permissions: 'Requires write permission. Resource mount deletion is unsupported in the first Resource-backed FS phase.'
    }),
    command({
        name: 'mkdir',
        source: 'just-bash',
        summary: 'Create directories in writable workspaces.',
        usage: 'mkdir [-p] <path>',
        examples: ['mkdir -p drafts', 'mkdir -p /workspaces/chat/chat-a/notes'],
        permissions: 'Requires write permission for the target workspace path.'
    }),
    command({
        name: 'touch',
        source: 'just-bash',
        summary: 'Create or update empty workspace files.',
        usage: 'touch <path>',
        examples: ['touch drafts/todo.md', 'touch -c /sources/local/worldbooks/main'],
        permissions: 'Workspace creation requires write permission. Resource files cannot be created with empty content; use complete JSON writes.'
    }),
    command({
        name: 'tee',
        source: 'just-bash',
        summary: 'Write stdin to a file, useful with pipes.',
        usage: 'command | tee <path>',
        examples: ['printf \'{"name":"Draft","entries":{}}\' | tee /sources/local/worldbooks/draft', 'cat source.md | tee drafts/source.md'],
        permissions: 'Uses the same write checks as redirection for the target path.'
    }),
    command({
        name: 'ls',
        source: 'just-bash',
        summary: 'List mounted resource and workspace directories.',
        usage: 'ls [-l] [path]',
        examples: ['ls -l /library/characters', 'ls /workspaces/forge/project-a'],
        permissions: 'Requires read permission for the directory.'
    }),
    command({
        name: 'tree',
        source: 'just-bash',
        summary: 'Print a recursive directory tree.',
        usage: 'tree [path]',
        examples: ['tree /library', 'tree /workspaces/forge/project-a'],
        permissions: 'Requires read permission for traversed directories.'
    }),
    command({
        name: 'find',
        source: 'just-bash',
        summary: 'Find paths under mounted directories.',
        usage: 'find <path> [expression]',
        examples: ['find /library/worldbooks -maxdepth 2 -type f', 'find drafts -type f'],
        permissions: 'Requires read permission for traversed directories.'
    }),
    command({
        name: 'grep',
        source: 'just-bash',
        summary: 'Search text in files or piped stdin.',
        usage: 'grep <pattern> [path...]',
        examples: ['grep castle /sources/local/worldbooks/main', 'cat draft.md | grep TODO'],
        permissions: 'Requires read permission for searched files.'
    }),
    command({
        name: 'jq',
        source: 'just-bash',
        summary: 'Query or transform JSON using just-bash jq semantics.',
        usage: 'jq <filter> [path]',
        examples: ['jq .name /sources/local/characters/hero', 'cat data.json | jq .entries'],
        permissions: 'Requires read permission for file input.',
        notes: ['This is just-bash jq-style filtering, not the legacy VFSCommandService JSONPath jq syntax.']
    }),
    command({
        name: 'curl',
        source: 'just-bash',
        summary: 'Fetch network resources when network policy allows it.',
        usage: 'curl <url>',
        examples: ['curl https://api.example.com/v1/models', 'curl -X POST https://api.example.com/v1/search'],
        permissions: 'User terminals require network policy configuration. Agent network-request sessions require network policy and a network grant; curl file input/output uses the mounted workspace filesystem.'
    })
];

const LUMINA_COMMANDS: ShellCommandMetadata[] = [
    command({
        name: 'lw-permission',
        source: 'lumina',
        summary: 'Inspect, request, or revoke Lumina shell grants.',
        usage: 'lw-permission <status|list|request|revoke> ...',
        examples: [
            'lw-permission status',
            'lw-permission request write /sources/local/worldbooks/main --reason "Update local draft"',
            'lw-permission request network https://api.example.com/ --reason "Fetch reference data"'
        ],
        permissions: 'Requests create pending grants; approval is still handled by the host/user layer.'
    }),
    command({
        name: 'lw-help',
        source: 'lumina',
        summary: 'Show Lumina shell paths, permissions, and supported command guidance.',
        usage: 'lw-help',
        examples: ['lw-help', 'lw-help | grep Resource'],
        permissions: 'Read-only command metadata.'
    })
];

export const getShellCommandMetadata = (options: { networkEnabled?: boolean } = {}): ShellCommandMetadata[] => [
    ...BUILTIN_COMMANDS.filter(item => options.networkEnabled || item.name !== 'curl'),
    ...LUMINA_COMMANDS
];

export const createShellCommandManual = (input: ShellCommandManualInput): ShellCommandManual => ({
    title: 'Lumina Resource Domain shell',
    workingDirectory: input.cwd,
    overview: [
        'This shell is backed by just-bash and Lumina Resource Domain mounts, not the host operating system.',
        'Use bash commands for pipelines, globbing, redirection, grep, jq, find, tree, and workspace file operations.',
        'Resource writes must be complete JSON payloads and always pass through ResourceService and Resource Write Policy.'
    ],
    paths: [
        '/sources: explicit Resource Source mounts such as ST and Lumina local resources.',
        '/library: aggregate browse views; same-name resources keep their source identity in the displayed name.',
        '/workspaces/forge/<projectId>: writable Forge project workspace for Forge agents.',
        '/workspaces/chat/<conversationId>: writable chat workspace for chat agents.',
        '/home/user and /tmp: shell-local scratch paths when available.'
    ],
    permissions: [
        'User terminal sessions can write workspace paths and local resources, while external resources still require write policy.',
        'Forge agents may write /workspaces/forge/<projectId>/... by default.',
        'Chat agents may write /workspaces/chat/<conversationId>/... by default.',
        'Agent writes outside their workspace require lw-permission request.',
        'Network access through curl requires configured network policy; Agent network-request sessions additionally require a network grant, while curl file input/output stays inside the mounted workspace filesystem.'
    ],
    commands: getShellCommandMetadata({ networkEnabled: input.networkEnabled }),
    notes: [
        `Current session: ${input.session.kind} (${input.session.shellSessionId})`,
        `Current working directory: ${input.cwd}`,
        'Append redirection (>>) is supported for workspace files; resource files require complete JSON replacement.',
        'ST and subscription resources cannot be silently modified by shell grants.'
    ]
});

export const renderShellCommandManual = (manual: ShellCommandManual): string => [
    manual.title,
    '',
    `Working directory: ${manual.workingDirectory}`,
    '',
    ...manual.overview,
    '',
    'Paths:',
    ...manual.paths.map(line => `- ${line}`),
    '',
    'Permissions:',
    ...manual.permissions.map(line => `- ${line}`),
    '',
    'Commands:',
    ...manual.commands.flatMap(commandInfo => [
        `${commandInfo.name} (${commandInfo.source}) - ${commandInfo.summary}`,
        `Usage: ${commandInfo.usage}`,
        `Example: ${commandInfo.examples[0]}`,
        `Example: ${commandInfo.examples[1]}`,
        `Permissions: ${commandInfo.permissions}`,
        ...(commandInfo.notes ?? []).map(note => `Note: ${note}`),
        ''
    ]),
    'Notes:',
    ...manual.notes.map(line => `- ${line}`)
].join('\n').trimEnd();
