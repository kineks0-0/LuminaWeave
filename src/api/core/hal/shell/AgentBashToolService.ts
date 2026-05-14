import { tool } from 'ai';
import { z } from 'zod';
import type { BashToolkit, CommandResult, Sandbox } from 'bash-tool';
import type { NetworkConfig } from 'just-bash';
import type { ShellSessionRef } from '@shared/resources/index.js';
import type { VirtualFileSystemService } from '../resource/VirtualFileSystemService.js';
import { BashTerminalRuntime } from './BashTerminalRuntime.js';
import { ShellPermissionService } from './ShellPermissionService.js';
import { createShellCommandManual, type ShellCommandMetadata } from './ShellCommandManual.js';
import { shellNetworkPolicyService } from './ShellNetworkPolicyService.js';
import { forgeWorkspacePath } from './ShellWorkspaceService.js';

export interface AgentBashToolTraceEvent {
    phase: 'before' | 'after';
    command: string;
    result?: CommandResult;
}

export interface AgentBashToolServiceOptions {
    vfs: VirtualFileSystemService;
    permissions: ShellPermissionService;
    network?: NetworkConfig;
    networkAllowList?: string[];
    maxOutputLength?: number;
    experimentalTeeTransform?: boolean;
    onTrace?: (event: AgentBashToolTraceEvent) => void;
}

export interface CreateAgentBashToolsOptions {
    session: ShellSessionRef;
    cwd?: string;
    extraInstructions?: string;
    skills?: AgentSkillDefinition[];
    skillDestination?: string;
}

export interface AgentBashToolPromptOptions extends CreateAgentBashToolsOptions {
    resolvedCwd?: string;
    networkEnabled?: boolean;
}

export interface AgentBashToolManualTool {
    name: 'skill' | 'bash' | 'readFile' | 'writeFile';
    summary: string;
    usage: string;
    examples: string[];
    permissions: string;
}

export interface AgentBashToolManual {
    title: string;
    workingDirectory: string;
    overview: string[];
    paths: string[];
    permissions: string[];
    skills: InstalledAgentSkill[];
    tools: AgentBashToolManualTool[];
    shellCommands: ShellCommandMetadata[];
    notes: string[];
}

export interface AgentSkillFile {
    path: string;
    content: string;
}

export interface AgentSkillDefinition {
    name: string;
    description: string;
    files: AgentSkillFile[];
}

export interface InstalledAgentSkill {
    name: string;
    description: string;
    path: string;
    files: string[];
}

export type AgentBashSkillToolkit = BashToolkit & {
    tools: BashToolkit['tools'] & {
        skill?: unknown;
    };
    skills: InstalledAgentSkill[];
};

const textContent = (content: string | Uint8Array): string =>
    typeof content === 'string' ? content : new TextDecoder().decode(content);

const normalizePath = (path: string): string =>
    `/${path || ''}`.replace(/\\/g, '/').replace(/\/+/g, '/').replace(/\/$/, '') || '/';

const dirname = (path: string): string => {
    const normalized = normalizePath(path);
    if (normalized === '/') return '/';
    const index = normalized.lastIndexOf('/');
    return index <= 0 ? '/' : normalized.slice(0, index);
};

const posixResolve = (cwd: string, path: string): string => {
    if (path.startsWith('/')) return normalizePath(path);
    const segments = `${cwd}/${path}`.split('/');
    const resolved: string[] = [];
    for (const segment of segments) {
        if (!segment || segment === '.') continue;
        if (segment === '..') {
            resolved.pop();
            continue;
        }
        resolved.push(segment);
    }
    return `/${resolved.join('/')}`;
};

const normalizeRelativePath = (path: string): string =>
    path.replace(/\\/g, '/').replace(/^\/+/, '').split('/').filter(Boolean).join('/');

const stripSkillFrontmatter = (content: string): string => {
    if (!content.startsWith('---')) return content.trim();
    const end = content.indexOf('\n---', 3);
    if (end < 0) return content.trim();
    return content.slice(end + 4).trim();
};

export const createAgentBashToolManual = (options: AgentBashToolPromptOptions): AgentBashToolManual => {
    const workingDirectory = options.resolvedCwd
        ?? options.cwd
        ?? (options.session.kind === 'forge-agent' && options.session.projectId
            ? forgeWorkspacePath(options.session.projectId)
            : options.session.kind === 'chat-agent' && options.session.conversationId
                ? `/workspaces/chat/${encodeURIComponent(options.session.conversationId)}`
                : '/home/user');
    const skillDestination = options.skillDestination ?? 'skills';
    const skills: InstalledAgentSkill[] = (options.skills ?? []).map(skill => ({
        name: skill.name,
        description: skill.description,
        path: posixResolve(workingDirectory, `${skillDestination}/${skill.name}`),
        files: skill.files.map(file => normalizeRelativePath(file.path)).filter(Boolean).sort()
    }));
    const shellManual = createShellCommandManual({
        session: options.session,
        cwd: workingDirectory,
        networkEnabled: options.networkEnabled ?? false
    });

    return {
        title: 'Lumina Resource Domain shell tools',
        workingDirectory,
        overview: shellManual.overview,
        paths: shellManual.paths,
        permissions: shellManual.permissions,
        skills,
        tools: [
            ...(skills.length
                ? [{
                    name: 'skill' as const,
                    summary: 'Load a skill instruction file into Agent context.',
                    usage: 'skill({ skillName: string })',
                    examples: [
                        `skill({ skillName: "${skills[0].name}" })`,
                        'skill({ skillName: "csv" })'
                    ],
                    permissions: 'Reads installed skill instructions from the current workspace.'
                }]
                : []),
            {
                name: 'bash',
                summary: 'Execute bash commands in the Lumina Resource Domain sandbox.',
                usage: 'bash({ command: string })',
                examples: [
                    'bash({ command: "find /library/worldbooks -maxdepth 2 -type f" })',
                    'bash({ command: "cat drafts/card.md | grep heroine" })'
                ],
                permissions: 'Uses shell permissions for every file and network operation.'
            },
            {
                name: 'readFile',
                summary: 'Read one file from the Lumina shell filesystem.',
                usage: 'readFile({ path: string })',
                examples: [
                    'readFile({ path: "/sources/local/characters/alice.json" })',
                    'readFile({ path: "drafts/card.md" })'
                ],
                permissions: 'Requires read permission for the resolved path.'
            },
            {
                name: 'writeFile',
                summary: 'Write one file through the Lumina shell filesystem.',
                usage: 'writeFile({ path: string, content: string })',
                examples: [
                    'writeFile({ path: "drafts/card.md", content: "# Draft" })',
                    'writeFile({ path: "/workspaces/forge/project-a/worldbooks/draft.json", content: "{...}" })'
                ],
                permissions: 'Requires write permission and still respects Resource Write Policy for resource mounts.'
            }
        ],
        shellCommands: shellManual.commands,
        notes: [
            ...shellManual.notes,
            'Do not assume same-name resources from different sources are interchangeable; preserve source paths or ResourceRef details when reporting results.',
            'When a write fails with permission denied, request the narrowest useful grant with lw-permission request.',
            ...(skills.length
                ? [`Installed skills: ${skills.map(skill => `${skill.name} at ${skill.path}`).join(', ')}.`]
                : [])
        ]
    };
};

export const renderAgentBashToolPrompt = (manual: AgentBashToolManual, extraInstructions?: string): string => [
    manual.title,
    '',
    `WORKING DIRECTORY: ${manual.workingDirectory}`,
    '',
    ...manual.overview,
    '',
    'Important paths:',
    ...manual.paths.map(line => `- ${line}`),
    '',
    'Permissions:',
    ...manual.permissions.map(line => `- ${line}`),
    '',
    ...(manual.skills.length
        ? [
            'Available skills:',
            ...manual.skills.flatMap(skill => [
                `- skill(${JSON.stringify(skill.name)}) - ${skill.description}`,
                `  Path: ${skill.path}`,
                `  Files: ${skill.files.join(', ') || '(none)'}`
            ]),
            ''
        ]
        : []),
    'Tools:',
    ...manual.tools.flatMap(toolManual => [
        `${toolManual.name} - ${toolManual.summary}`,
        `Usage: ${toolManual.usage}`,
        `Example: ${toolManual.examples[0]}`,
        `Example: ${toolManual.examples[1]}`,
        `Permissions: ${toolManual.permissions}`
    ]),
    '',
    'Supported shell command reference:',
    ...manual.shellCommands.flatMap(commandInfo => [
        `${commandInfo.name} (${commandInfo.source}) - ${commandInfo.summary}`,
        `Usage: ${commandInfo.usage}`,
        `Example: ${commandInfo.examples[0]}`,
        `Permissions: ${commandInfo.permissions}`,
        ...(commandInfo.notes ?? []).map(note => `Note: ${note}`)
    ]),
    '',
    'Notes:',
    ...manual.notes.map(line => `- ${line}`),
    ...(extraInstructions ? ['', extraInstructions] : [])
].join('\n');

class LuminaBashToolSandbox implements Sandbox {
    constructor(private readonly runtime: BashTerminalRuntime) {}

    async executeCommand(command: string): Promise<CommandResult> {
        return this.runtime.exec(command);
    }

    async readFile(path: string): Promise<string> {
        const absolutePath = this.runtime.bash.fs.resolvePath(this.runtime.getCwd(), path);
        return this.runtime.bash.fs.readFile(absolutePath);
    }

    async writeFiles(files: Array<{ path: string; content: string | Buffer }>): Promise<void> {
        for (const file of files) {
            const absolutePath = this.runtime.bash.fs.resolvePath(this.runtime.getCwd(), file.path);
            const parent = dirname(absolutePath);
            if (parent !== '/') {
                const parentExists = await this.runtime.bash.fs.exists(parent);
                if (!parentExists) {
                    await this.runtime.bash.fs.mkdir(parent, { recursive: true });
                }
            }
            await this.runtime.bash.fs.writeFile(absolutePath, textContent(file.content));
        }
    }
}

export class AgentBashToolService {
    constructor(private readonly options: AgentBashToolServiceOptions) {}

    getToolManual(input: AgentBashToolPromptOptions): AgentBashToolManual {
        return createAgentBashToolManual({
            ...input,
            networkEnabled: input.networkEnabled ?? shellNetworkPolicyService.isConfigured(shellNetworkPolicyService.createNetworkConfig(this.options))
        });
    }

    getToolPrompt(input: AgentBashToolPromptOptions): string {
        return renderAgentBashToolPrompt(this.getToolManual(input), input.extraInstructions);
    }

    async createAgentBashTools(input: CreateAgentBashToolsOptions): Promise<AgentBashSkillToolkit> {
        const runtime = new BashTerminalRuntime({
            session: input.session,
            vfs: this.options.vfs,
            permissions: this.options.permissions,
            network: this.options.network,
            networkAllowList: this.options.networkAllowList,
            cwd: input.cwd
        });
        const sandbox = new LuminaBashToolSandbox(runtime);
        const cwd = runtime.getCwd();
        const skills = await this.installSkills(sandbox, cwd, input.skillDestination ?? 'skills', input.skills ?? []);
        const toolPrompt = this.getToolPrompt({
            ...input,
            resolvedCwd: cwd
        });
        const bash = tool({
            description: [
                'Execute bash commands in the Lumina Resource Domain sandbox.',
                '',
                toolPrompt
            ].join('\n'),
            inputSchema: z.object({
                command: z.string().describe('The bash command to execute')
            }),
            execute: async ({ command }) => {
                this.options.onTrace?.({ phase: 'before', command });
                const result = this.truncateResult(await sandbox.executeCommand(`cd "${cwd}" && ${command}`));
                this.options.onTrace?.({ phase: 'after', command, result });
                return result;
            }
        });
        const readFile = tool({
            description: 'Read the contents of a file from the Lumina Resource Domain sandbox.',
            inputSchema: z.object({
                path: z.string().describe('The path to the file to read')
            }),
            execute: async ({ path }) => ({
                content: await sandbox.readFile(posixResolve(cwd, path))
            })
        });
        const writeFile = tool({
            description: 'Write content to a file in the Lumina Resource Domain sandbox. Creates parent directories when allowed.',
            inputSchema: z.object({
                path: z.string().describe('The path where the file should be written'),
                content: z.string().describe('The content to write to the file')
            }),
            execute: async ({ path, content }) => {
                await sandbox.writeFiles([{ path: posixResolve(cwd, path), content }]);
                return { success: true };
            }
        });
        const skillTool = skills.length > 0
            ? this.createSkillTool(sandbox, skills)
            : undefined;

        return {
            bash,
            tools: {
                ...(skillTool ? { skill: skillTool } : {}),
                bash,
                readFile,
                writeFile
            },
            sandbox,
            skills
        } as AgentBashSkillToolkit;
    }

    private async installSkills(
        sandbox: Sandbox,
        cwd: string,
        destination: string,
        skills: AgentSkillDefinition[]
    ): Promise<InstalledAgentSkill[]> {
        const installed: InstalledAgentSkill[] = [];
        for (const skill of skills) {
            if (!/^[a-z0-9][a-z0-9-]*$/.test(skill.name)) {
                throw new Error(`Invalid skill name: ${skill.name}`);
            }
            const uniqueFiles = new Map<string, string>();
            for (const file of skill.files) {
                const relativePath = normalizeRelativePath(file.path);
                if (!relativePath) continue;
                uniqueFiles.set(relativePath, file.content);
            }
            if (!uniqueFiles.has('SKILL.md')) {
                throw new Error(`Skill "${skill.name}" must include SKILL.md`);
            }
            const root = posixResolve(cwd, `${destination}/${skill.name}`);
            await sandbox.writeFiles(Array.from(uniqueFiles.entries()).map(([path, content]) => ({
                path: `${root}/${path}`,
                content
            })));
            installed.push({
                name: skill.name,
                description: skill.description,
                path: root,
                files: Array.from(uniqueFiles.keys()).sort()
            });
        }
        return installed;
    }

    private createSkillTool(sandbox: Sandbox, skills: InstalledAgentSkill[]): unknown {
        const skillMap = new Map(skills.map(skill => [skill.name, skill]));
        return tool({
            description: [
                'Load a skill instruction file to learn how to use it.',
                'You can load multiple skills. Treat returned instructions as authoritative for that skill.',
                '',
                'Available skills:',
                ...skills.map(skill => `- skill(${JSON.stringify(skill.name)}): ${skill.description}`),
                '',
                'After loading a skill, use bash/readFile/writeFile to run scripts or inspect files from the skill path.'
            ].join('\n'),
            inputSchema: z.object({
                skillName: z.string().describe('The name of the skill to load')
            }),
            execute: async ({ skillName }) => {
                const skill = skillMap.get(skillName);
                if (!skill) {
                    return {
                        success: false,
                        error: `Skill "${skillName}" not found. Available skills: ${skills.map(item => item.name).join(', ') || 'none'}`
                    };
                }
                const content = await sandbox.readFile(`${skill.path}/SKILL.md`);
                return {
                    success: true,
                    skill: {
                        name: skill.name,
                        description: skill.description,
                        path: skill.path
                    },
                    instructions: stripSkillFrontmatter(content),
                    files: skill.files.filter(file => file !== 'SKILL.md')
                };
            }
        });
    }

    private truncateResult(result: CommandResult): CommandResult {
        const maxLength = this.options.maxOutputLength ?? 30000;
        const truncate = (value: string, label: 'stdout' | 'stderr'): string => {
            if (value.length <= maxLength) return value;
            return `${value.slice(0, maxLength)}\n\n[${label} truncated: ${value.length - maxLength} characters removed]`;
        };
        return {
            ...result,
            stdout: truncate(result.stdout, 'stdout'),
            stderr: truncate(result.stderr, 'stderr')
        };
    }
}
