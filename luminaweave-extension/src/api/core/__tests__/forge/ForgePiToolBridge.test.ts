import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ForgePiToolBridge } from '@/api/core/forge/agent-app/tools/ForgePiToolBridge.js';
import { ForgeWorkspaceSearchShell } from '@/api/core/forge/shell/ForgeWorkspaceSearchShell.js';
import type { ForgeCapabilityRegistry } from '@/api/core/forge/skills/ForgeCapabilityRegistry.js';
import type { ForgeSkillLoadResult, ForgeSkillRegistry } from '@/api/core/forge/skills/ForgeSkillRegistry.js';
import type { ForgeRuntimeEffect } from '@/types/ForgeRuntimeTypes.js';
import type { ForgeRuntimeContext } from '@/types/ForgeRuntimeTypes.js';
import type { ForgeDraftTree, ForgeStructuredState } from '@/types/ForgeStructuredTypes.js';
import { initMockHAL } from '@/api/core/__tests__/support/halMock.js';
import { ShellPermissionService } from '@/api/core/hal/shell/ShellPermissionService.js';
import { ShellWorkspaceService } from '@/api/core/hal/shell/ShellWorkspaceService.js';
import { virtualFileSystemService } from '@/api/core/hal/shell/index.js';
import type {
    AgentResearchFetchInput,
    AgentResearchProvider,
    AgentResearchResult,
    AgentResearchSearchInput
} from '@/api/core/agent-runtime/research/index.js';

const { store } = vi.hoisted(() => ({
    store: new Map<string, unknown>()
}));

const createContext = (): ForgeRuntimeContext => ({
    workspaceSessionId: 'forge_project_alpha',
    sessionChatId: 'conversation_alpha',
    workspaceTitle: 'Forge Alpha',
    selectedPresetId: 'forge-main',
    selectedChatSessionId: null,
    selectedChatSnapshotId: null,
    detailMode: 'quick',
    collectionMode: 'conversation',
    entryMode: null,
    activeLayer: 'concept',
    completedLayers: [],
    workflowSnapshot: null,
    publishState: 'drafting',
    activeLeafId: 'leaf_1',
    worldlineNodes: [],
    messages: [],
    timelineItems: [],
    structuredState: {} as ForgeStructuredState,
    draftTree: { nodes: [], lastUpdatedAt: 1 } as ForgeDraftTree,
    forgeMemoryTree: { entries: [], lastUpdatedAt: 1 },
    stagingEntries: [],
    commitReadyEntries: [],
    virtualLorebookEntries: [],
    latestUserInput: 'hello',
    latestUserCommand: { type: 'send_user_input', input: 'hello' }
});

const createEmptySkills = (): Pick<ForgeSkillRegistry, 'listProjectSkills' | 'listBuiltInSkills' | 'loadSkill'> => ({
    listProjectSkills: vi.fn(async () => []),
    listBuiltInSkills: vi.fn(() => []),
    loadSkill: vi.fn()
});

const createEmptyCapabilities = (): Pick<ForgeCapabilityRegistry, 'search' | 'load' | 'listCapabilities'> => ({
    search: vi.fn(() => []),
    load: vi.fn(),
    listCapabilities: vi.fn(() => [])
});

describe('ForgePiToolBridge', () => {
    beforeEach(() => {
        store.clear();
        initMockHAL({
            runtime: {
                extensionStore: {
                    listKeys: vi.fn(async () => Array.from(store.keys())),
                    getJson: vi.fn(async ({ key }: { key: string }) => store.get(key) ?? null),
                    setJson: vi.fn(async ({ key, value }: { key: string; value: unknown }) => {
                        store.set(key, value);
                    }),
                    updateJson: vi.fn(async ({ key, value }: { key: string; value: unknown }) => {
                        store.set(key, value);
                    }),
                    deleteJson: vi.fn(async ({ key }: { key: string }) => {
                        store.delete(key);
                    }),
                    setBlob: vi.fn(),
                    getBlob: vi.fn()
                }
            }
        });
    });

    afterEach(() => {
        vi.unstubAllGlobals();
    });

    it('exposes short direct workspace tools without Review Gate metadata', () => {
        const bridge = new ForgePiToolBridge({
            skills: createEmptySkills(),
            capabilities: createEmptyCapabilities(),
            getTavilyApiKey: () => ''
        });

        const tools = bridge.getTools(createContext());

        expect(tools.map(tool => tool.name)).toEqual([
            'capabilitySearch',
            'capabilityLoad',
            'skillList',
            'skillLoad',
            'bash',
            'read',
            'write',
            'edit',
            'delete'
        ]);
        expect(tools.map(tool => tool.name)).not.toContain('webResearch');
        expect(tools.map(tool => tool.name)).not.toEqual(expect.arrayContaining([
            'readFile',
            'writeFile',
            'editFile',
            'deleteFile'
        ]));
        expect(tools.find(tool => tool.name === 'write')?.needsApproval).toBeUndefined();
        expect(tools.find(tool => tool.name === 'edit')?.needsApproval).toBeUndefined();
        expect(tools.find(tool => tool.name === 'delete')?.needsApproval).toBeUndefined();
    });

    it('adapts Forge tools to the Agent Runtime SDK tool registry without adding defaults', () => {
        const bridge = new ForgePiToolBridge({
            skills: createEmptySkills(),
            capabilities: createEmptyCapabilities(),
            getTavilyApiKey: () => ''
        });

        const registry = bridge.createToolRegistry(createContext());

        expect(registry.getToolSummary().map(tool => tool.name)).toEqual([
            'capabilitySearch',
            'capabilityLoad',
            'skillList',
            'skillLoad',
            'bash',
            'read',
            'write',
            'edit',
            'delete'
        ]);
    });

    it('exposes webResearch only when a Tavily API key is configured', async () => {
        const research: AgentResearchProvider = {
            name: 'tavily',
            search: vi.fn(async (input: AgentResearchSearchInput): Promise<AgentResearchResult> => ({
                mode: 'search',
                provider: 'tavily',
                requestId: 'req_forge_search',
                responseTime: 1,
                sources: [{
                    title: 'Forge research',
                    url: 'https://example.test/forge',
                    content: 'Forge result'
                }],
                markdown: `# Forge result\n\n${input.query}`
            })),
            fetch: vi.fn(async (input: AgentResearchFetchInput): Promise<AgentResearchResult> => ({
                mode: 'fetch',
                provider: 'tavily',
                requestId: 'req_forge_fetch',
                responseTime: 1,
                sources: [],
                markdown: input.urls.join('\n')
            }))
        };
        const withoutKey = new ForgePiToolBridge({
            skills: createEmptySkills(),
            capabilities: createEmptyCapabilities(),
            research,
            getTavilyApiKey: () => '   '
        });
        const withKey = new ForgePiToolBridge({
            skills: createEmptySkills(),
            capabilities: createEmptyCapabilities(),
            research,
            getTavilyApiKey: () => 'tvly-test'
        });

        expect(withoutKey.getTools(createContext()).map(tool => tool.name)).not.toContain('webResearch');

        const webResearch = withKey.getTools(createContext()).find(tool => tool.name === 'webResearch');
        const result = await webResearch?.execute('call_web', {
            mode: 'search',
            query: 'forge web research',
            searchDepth: 'advanced'
        });

        expect(webResearch).toBeDefined();
        expect(research.search).toHaveBeenCalledWith({
            mode: 'search',
            query: 'forge web research',
            maxResults: 5,
            searchDepth: 'advanced',
            timeRange: undefined
        });
        expect(result).toMatchObject({
            content: [{ type: 'text', text: expect.stringContaining('Forge result') }],
            details: {
                mode: 'search',
                provider: 'tavily',
                requestId: 'req_forge_search'
            }
        });
        expect(result?.details).toMatchObject({
            provider: 'tavily'
        });
    });

    it('applies write directly to the Forge project workspace and returns a workspace write summary', async () => {
        const workspaces = new ShellWorkspaceService();
        const bridge = new ForgePiToolBridge({
            skills: createEmptySkills(),
            capabilities: createEmptyCapabilities(),
            workspaces
        });
        const write = bridge.getTools(createContext()).find(tool => tool.name === 'write');

        const result = await write?.execute('call_write', {
            path: './card.md',
            content: '# Card\n\nUpdated.'
        });
        const fs = await workspaces.getFileSystem({
            projectId: 'forge_project_alpha',
            conversationId: 'conversation_alpha'
        });
        const persisted = await fs.readFile('/forge/forge_project_alpha/card.md');

        expect(String(persisted)).toBe('# Card\n\nUpdated.');
        expect(result?.details).toMatchObject({
            path: './card.md',
            applied: true,
            command: 'write ./card.md',
            workspaceWriteSummary: {
                sourceToolCallId: 'call_write',
                writeCount: 1,
                changedFiles: [expect.objectContaining({
                    path: './card.md',
                    kind: 'create'
                })],
                errors: []
            }
        });
        expect(result?.details).toEqual(expect.objectContaining({
            workspaceWriteSummary: expect.any(Object)
        }));
    });

    it('resolves pending approvals recorded with historical direct write tool names', async () => {
        const workspaces = new ShellWorkspaceService();
        const context = createContext();
        const bridge = new ForgePiToolBridge({
            skills: createEmptySkills(),
            capabilities: createEmptyCapabilities(),
            workspaces
        });

        expect(bridge.getTools(context).map(tool => tool.name)).not.toContain('writeFile');

        bridge.registerPendingApproval({
            requestId: 'req_history',
            toolCallId: 'call_history_write',
            toolName: 'writeFile',
            args: {
                path: './history.md',
                content: 'from historical approval'
            },
            context,
            source: 'conversation'
        });

        const result = await bridge.resolveToolApproval('call_history_write', true);
        const fs = await workspaces.getFileSystem({
            projectId: 'forge_project_alpha',
            conversationId: 'conversation_alpha'
        });
        const persisted = await fs.readFile('/forge/forge_project_alpha/history.md');

        expect(String(persisted)).toBe('from historical approval');
        expect(result.resolved).toBe(true);
        expect(result.events).toEqual(expect.arrayContaining([
            expect.objectContaining({
                type: 'tool_result',
                toolCallId: 'call_history_write',
                toolName: 'writeFile',
                result: expect.objectContaining({
                    applied: true,
                    command: 'write ./history.md'
                })
            })
        ]));
        expect(result.toolResultMessage).toMatchObject({
            toolCallId: 'call_history_write',
            toolName: 'writeFile',
            isError: false,
            details: expect.objectContaining({
                applied: true,
                command: 'write ./history.md'
            })
        });
    });

    it('creates a Composer network approval request before executing bash without a grant', async () => {
        const permissions = new ShellPermissionService();
        const shell = new ForgeWorkspaceSearchShell(virtualFileSystemService, permissions);
        const context = createContext();
        const bridge = new ForgePiToolBridge({
            skills: createEmptySkills(),
            capabilities: createEmptyCapabilities(),
            shell,
            permissions
        } as ConstructorParameters<typeof ForgePiToolBridge>[0] & { permissions: ShellPermissionService });

        const approval = bridge.requestToolApproval({
            requestId: 'req_network',
            toolCallId: 'call_network',
            toolName: 'bash',
            args: {
                command: 'curl -o fetched.txt https://api.example.com/resource',
                accessMode: 'network-request'
            },
            context,
            source: 'conversation'
        });

        expect(approval).toEqual(expect.objectContaining({
            approvalKind: 'network',
            displaySurface: 'composer',
            toolCallId: 'call_network',
            toolName: 'bash',
            shellPermissionRequestId: expect.any(String),
            urlPrefix: 'https://api.example.com/',
            localFileIo: true
        }));
        expect(permissions.listRequests()).toEqual([expect.objectContaining({
            requestId: approval?.shellPermissionRequestId,
            operation: 'network',
            scope: { urlPrefix: 'https://api.example.com/' },
            status: 'pending'
        })]);

        const rejected = await bridge.resolveToolApproval('call_network', false, '不允许联网');

        expect(rejected.resolved).toBe(true);
        expect(rejected.events).toEqual([expect.objectContaining({
            type: 'tool_approval_resolved',
            toolCallId: 'call_network',
            toolName: 'bash',
            approved: false,
            approvalKind: 'network',
            displaySurface: 'composer',
            shellPermissionRequestId: approval?.shellPermissionRequestId
        })]);
        expect(permissions.listRequests()[0]).toEqual(expect.objectContaining({
            status: 'rejected',
            decisionReason: '不允许联网'
        }));
    });

    it('executes the original curl command after Composer network approval', async () => {
        const fetchMock = vi.fn(async () => new Response('approved download', {
            status: 200,
            statusText: 'OK'
        }));
        vi.stubGlobal('fetch', fetchMock);
        const permissions = new ShellPermissionService();
        const workspaces = new ShellWorkspaceService();
        const shell = new ForgeWorkspaceSearchShell(virtualFileSystemService, permissions);
        const context = createContext();
        const bridge = new ForgePiToolBridge({
            skills: createEmptySkills(),
            capabilities: createEmptyCapabilities(),
            shell,
            permissions,
            workspaces
        } as ConstructorParameters<typeof ForgePiToolBridge>[0] & { permissions: ShellPermissionService });
        const approval = bridge.requestToolApproval({
            requestId: 'req_network_write',
            toolCallId: 'call_network_write',
            toolName: 'bash',
            args: {
                command: 'curl -o fetched.txt https://api.example.com/resource',
                accessMode: 'network-request'
            },
            context,
            source: 'conversation'
        });
        expect(approval).toEqual(expect.objectContaining({
            approvalKind: 'network',
            displaySurface: 'composer'
        }));

        const approved = await bridge.resolveToolApproval('call_network_write', true, '允许下载参考', {
            grantMode: 'single_use'
        });
        const fs = await workspaces.getFileSystem({
            projectId: 'forge_project_alpha',
            conversationId: 'conversation_alpha'
        });

        expect(approved.resolved).toBe(true);
        expect(fetchMock).toHaveBeenCalledWith('https://api.example.com/resource', expect.objectContaining({
            method: 'GET'
        }));
        await expect(fs.readFile('/forge/forge_project_alpha/fetched.txt')).resolves.toBe('approved download');
        expect(approved.events).toEqual(expect.arrayContaining([expect.objectContaining({
            type: 'tool_result',
            toolCallId: 'call_network_write',
            result: expect.objectContaining({
                writeCount: 1,
                workspaceWriteSummary: expect.objectContaining({
                    changedFiles: [expect.objectContaining({
                        path: './fetched.txt',
                        kind: 'create'
                    })]
                })
            })
        })]));
        expect(approved.toolResultMessage).toMatchObject({
            toolCallId: 'call_network_write',
            toolName: 'bash',
            isError: false
        });
        expect(permissions.listGrants()).toEqual([]);
    });

    it('keeps a domain grant when Composer approval allows future requests', async () => {
        const fetchMock = vi.fn(async () => new Response('domain grant download', {
            status: 200,
            statusText: 'OK'
        }));
        vi.stubGlobal('fetch', fetchMock);
        const permissions = new ShellPermissionService();
        const workspaces = new ShellWorkspaceService();
        const shell = new ForgeWorkspaceSearchShell(virtualFileSystemService, permissions);
        const context = createContext();
        const bridge = new ForgePiToolBridge({
            skills: createEmptySkills(),
            capabilities: createEmptyCapabilities(),
            shell,
            permissions,
            workspaces
        } as ConstructorParameters<typeof ForgePiToolBridge>[0] & { permissions: ShellPermissionService });
        const bash = bridge.getTools(context).find(tool => tool.name === 'bash');

        const approval = bridge.requestToolApproval({
            requestId: 'req_network_domain',
            toolCallId: 'call_network_domain',
            toolName: 'bash',
            args: {
                command: 'curl https://api.example.com/first',
                accessMode: 'network-request'
            },
            context,
            source: 'conversation'
        });
        expect(approval).toEqual(expect.objectContaining({
            approvalKind: 'network',
            displaySurface: 'composer'
        }));

        const approved = await bridge.resolveToolApproval('call_network_domain', true, '允许后续访问此域名', {
            grantMode: 'domain'
        });
        const second = await bash?.execute('call_network_domain_second', {
            command: 'curl https://api.example.com/second',
            accessMode: 'network-request'
        });

        expect(approved.resolved).toBe(true);
        expect(permissions.listGrants()).toEqual([expect.objectContaining({
            operation: 'network',
            scope: { urlPrefix: 'https://api.example.com/' },
            status: 'approved'
        })]);
        expect(second?.terminate).not.toBe(true);
        expect(second?.content).toEqual([expect.objectContaining({
            type: 'text',
            text: expect.stringContaining('domain grant download')
        })]);
        expect(fetchMock).toHaveBeenCalledWith('https://api.example.com/first', expect.objectContaining({
            method: 'GET'
        }));
        expect(fetchMock).toHaveBeenCalledWith('https://api.example.com/second', expect.objectContaining({
            method: 'GET'
        }));
    });

    it('keeps an all-network grant when Composer approval allows every future network request', async () => {
        const fetchMock = vi.fn(async () => new Response('all network grant download', {
            status: 200,
            statusText: 'OK'
        }));
        vi.stubGlobal('fetch', fetchMock);
        const permissions = new ShellPermissionService();
        const workspaces = new ShellWorkspaceService();
        const shell = new ForgeWorkspaceSearchShell(virtualFileSystemService, permissions);
        const context = createContext();
        const bridge = new ForgePiToolBridge({
            skills: createEmptySkills(),
            capabilities: createEmptyCapabilities(),
            shell,
            permissions,
            workspaces
        } as ConstructorParameters<typeof ForgePiToolBridge>[0] & { permissions: ShellPermissionService });
        const bash = bridge.getTools(context).find(tool => tool.name === 'bash');

        const approval = bridge.requestToolApproval({
            requestId: 'req_network_all',
            toolCallId: 'call_network_all',
            toolName: 'bash',
            args: {
                command: 'curl https://api.example.com/first',
                accessMode: 'network-request'
            },
            context,
            source: 'conversation'
        });
        expect(approval).toEqual(expect.objectContaining({
            approvalKind: 'network',
            displaySurface: 'composer'
        }));

        const approved = await bridge.resolveToolApproval('call_network_all', true, '允许后续所有网络请求', {
            grantMode: 'all_network'
        });
        const second = await bash?.execute('call_network_all_second', {
            command: 'curl https://other.example.com/second',
            accessMode: 'network-request'
        });

        expect(approved.resolved).toBe(true);
        expect(permissions.listGrants()).toEqual([expect.objectContaining({
            operation: 'network',
            scope: { allNetwork: true },
            status: 'approved'
        })]);
        expect(second?.terminate).not.toBe(true);
        expect(second?.content).toEqual([expect.objectContaining({
            type: 'text',
            text: expect.stringContaining('all network grant download')
        })]);
        expect(fetchMock).toHaveBeenCalledWith('https://api.example.com/first', expect.objectContaining({
            method: 'GET'
        }));
        expect(fetchMock).toHaveBeenCalledWith('https://other.example.com/second', expect.objectContaining({
            method: 'GET'
        }));
    });

    it('applies edit and delete directly without staging effects', async () => {
        const effects: ForgeRuntimeEffect[] = [];
        const workspaces = new ShellWorkspaceService();
        const fs = await workspaces.getFileSystem({
            projectId: 'forge_project_alpha',
            conversationId: 'conversation_alpha'
        });
        await fs.mkdir('/forge/forge_project_alpha', { recursive: true });
        await fs.writeFile('/forge/forge_project_alpha/card.md', 'old content');

        const bridge = new ForgePiToolBridge({
            skills: createEmptySkills(),
            capabilities: createEmptyCapabilities(),
            workspaces,
            onEffects: next => effects.push(...next)
        });
        const tools = bridge.getTools(createContext());
        const edit = tools.find(tool => tool.name === 'edit');
        const deleteTool = tools.find(tool => tool.name === 'delete');

        const edited = await edit?.execute('call_edit', {
            path: './card.md',
            old_string: 'old',
            new_string: 'new'
        });
        const deleted = await deleteTool?.execute('call_delete', {
            path: './card.md'
        });

        await expect(fs.readFile('/forge/forge_project_alpha/card.md')).rejects.toThrow();
        expect(effects).toEqual([]);
        expect(edited?.details).toMatchObject({
            path: './card.md',
            applied: true,
            command: 'edit ./card.md',
            workspaceWriteSummary: {
                sourceToolCallId: 'call_edit',
                writeCount: 1,
                changedFiles: [expect.objectContaining({ kind: 'update' })],
                errors: []
            }
        });
        expect(deleted?.details).toMatchObject({
            path: './card.md',
            applied: true,
            command: 'delete ./card.md',
            workspaceWriteSummary: {
                sourceToolCallId: 'call_delete',
                writeCount: 1,
                changedFiles: [expect.objectContaining({ kind: 'delete' })],
                errors: []
            }
        });
        expect(edited?.details).toEqual(expect.objectContaining({
            workspaceWriteSummary: expect.any(Object)
        }));
        expect(deleted?.details).toEqual(expect.objectContaining({
            workspaceWriteSummary: expect.any(Object)
        }));
    });

    it('returns semantic skill paths from skill tools', async () => {
        const projectSkill: ForgeSkillLoadResult = {
            source: 'project',
            path: './agent/skills/custom-skill/SKILL.md',
            skill: {
                name: 'custom-skill',
                description: '项目技能',
                files: [{ path: 'SKILL.md', content: '# 项目技能' }]
            }
        };
        const builtInSkill: ForgeSkillLoadResult = {
            source: 'built-in',
            path: './agent/skills/memory-curator/SKILL.md',
            skill: {
                name: 'memory-curator',
                description: '整理记忆',
                files: [{ path: 'SKILL.md', content: '# 项目记忆整理员' }]
            }
        };
        const bridge = new ForgePiToolBridge({
            skills: {
                listProjectSkills: vi.fn(async () => [projectSkill]),
                listBuiltInSkills: vi.fn(() => [{
                    name: 'memory-curator',
                    title: '项目记忆整理员',
                    description: '整理记忆',
                    defaultWriteScope: './memory/',
                    resourcePath: 'src/resources/forge-agent/base/skills/memory-curator/SKILL.md',
                    builtIn: true
                }]),
                loadSkill: vi.fn(async () => builtInSkill)
            },
            capabilities: createEmptyCapabilities()
        });

        const context = createContext();
        const skillList = bridge.getTools(context).find(tool => tool.name === 'skillList');
        const skillLoad = bridge.getTools(context).find(tool => tool.name === 'skillLoad');

        const listResult = await skillList?.execute('call_list', {});
        const loadResult = await skillLoad?.execute('call_load', { skillName: 'memory-curator' });

        expect(listResult?.details).toMatchObject({
            projectSkills: [expect.objectContaining({ path: './agent/skills/custom-skill/SKILL.md' })],
            builtInSkills: [expect.objectContaining({ path: './agent/skills/memory-curator/SKILL.md' })]
        });
        expect(loadResult?.details).toMatchObject({
            path: './agent/skills/memory-curator/SKILL.md'
        });
    });

    it('lists and loads preset-provided reference skills through the semantic VFS', async () => {
        const bridge = new ForgePiToolBridge({
            skills: createEmptySkills(),
            capabilities: createEmptyCapabilities()
        });
        const context = createContext();
        const skillList = bridge.getTools(context).find(tool => tool.name === 'skillList');
        const skillLoad = bridge.getTools(context).find(tool => tool.name === 'skillLoad');

        const listResult = await skillList?.execute('call_list', {});
        const loadResult = await skillLoad?.execute('call_load', { skillName: 'reference-anti-cliche' });
        const titleLoadResult = await skillLoad?.execute('call_load_title', { skillName: '反八股与偏向强化' });

        expect(listResult?.details).toMatchObject({
            presetSkills: expect.arrayContaining([
                expect.objectContaining({
                    name: 'reference-anti-cliche',
                    title: '反八股与偏向强化',
                    path: './agent/skills/reference-anti-cliche/SKILL.md',
                    loadPolicy: 'on_demand'
                })
            ])
        });
        expect(loadResult?.details).toMatchObject({
            name: 'reference-anti-cliche',
            path: './agent/skills/reference-anti-cliche/SKILL.md',
            files: [expect.objectContaining({
                content: expect.stringContaining('反八股与偏向强化')
            })]
        });
        expect(titleLoadResult?.details).toMatchObject({
            name: 'reference-anti-cliche',
            path: './agent/skills/reference-anti-cliche/SKILL.md'
        });
    });

    it('reads contract, Forge prompt files, and built-in skill files through semantic VFS', async () => {
        const builtInSkill: ForgeSkillLoadResult = {
            source: 'built-in',
            path: './agent/skills/memory-curator/SKILL.md',
            skill: {
                name: 'memory-curator',
                description: '整理记忆',
                files: [{ path: 'SKILL.md', content: '# 项目记忆整理员\n\n整理稳定偏好。' }]
            }
        };
        const bridge = new ForgePiToolBridge({
            skills: {
                ...createEmptySkills(),
                loadSkill: vi.fn(async () => builtInSkill)
            },
            capabilities: createEmptyCapabilities()
        });
        const read = bridge.getTools(createContext()).find(tool => tool.name === 'read');

        const agents = await read?.execute('call_agents', { path: './AGENTS.md' });
        const systemPrompt = await read?.execute('call_system', { path: './.forge/agent/SYSTEM.md' });
        const conversationPrompt = await read?.execute('call_prompt', { path: './.forge/agent/CONVERSATION.md' });
        const skill = await read?.execute('call_skill', { path: './agent/skills/memory-curator/SKILL.md' });

        expect(agents?.details).toMatchObject({
            path: './AGENTS.md',
            content: expect.stringContaining('工作契约')
        });
        expect(systemPrompt?.details).toMatchObject({
            path: './.forge/agent/SYSTEM.md',
            content: expect.any(String)
        });
        expect(conversationPrompt?.details).toMatchObject({
            path: './.forge/agent/CONVERSATION.md',
            content: expect.any(String)
        });
        expect(skill?.details).toMatchObject({
            path: './agent/skills/memory-curator/SKILL.md',
            source: 'built-in',
            content: expect.stringContaining('项目记忆整理员')
        });
    });

    it('reads long-term memory bodies through the read tool', async () => {
        const bridge = new ForgePiToolBridge({
            skills: createEmptySkills(),
            capabilities: createEmptyCapabilities()
        });
        const context: ForgeRuntimeContext = {
            ...createContext(),
            forgeMemoryTree: {
                entries: [{
                    path: '偏好/禁忌',
                    title: '禁忌',
                    content: '完整正文中才会出现的长句',
                    summary: '避免俗套',
                    updatedAt: 1,
                    source: 'user'
                }],
                lastUpdatedAt: 1
            }
        };
        const read = bridge.getTools(context).find(tool => tool.name === 'read');

        const result = await read?.execute('call_memory', { path: './memory/偏好/禁忌.md' });

        expect(result?.details).toMatchObject({
            path: './memory/偏好/禁忌.md',
            content: expect.stringContaining('完整正文中才会出现的长句')
        });
    });

    it('rejects writes to built-in skill resources instead of creating overlay proposals', async () => {
        const bridge = new ForgePiToolBridge({
            skills: createEmptySkills(),
            capabilities: createEmptyCapabilities()
        });
        const write = bridge.getTools(createContext()).find(tool => tool.name === 'write');

        const result = await write?.execute('call_write', {
            path: './agent/skills/memory-curator/SKILL.md',
            content: '# patched skill'
        });

        expect(result?.details).toMatchObject({
            path: './agent/skills/memory-curator/SKILL.md',
            applied: false,
            error: expect.stringContaining('read-only')
        });
    });

    it('reads stable historical thread paths from Forge workspace projections', async () => {
        const workspaces = new ShellWorkspaceService();
        await workspaces.bindForgeConversation({
            forgeProjectId: 'forge_project_alpha',
            conversationId: 'conversation_alpha'
        });
        await workspaces.bindForgeConversation({
            forgeProjectId: 'forge_project_alpha',
            conversationId: 'conversation_beta'
        });
        await workspaces.writeForgeConversationProjection({
            forgeProjectId: 'forge_project_alpha',
            conversationId: 'conversation_alpha',
            workspaceSessionId: 'forge_project_alpha',
            workspacePath: '/workspaces/forge/forge_project_alpha/chat/conversation_alpha',
            title: '目前线程',
            createdAt: 1,
            updatedAt: 1,
            activeLeafId: null,
            messages: [{ role: 'user', content: 'current' }]
        });
        await workspaces.writeForgeConversationProjection({
            forgeProjectId: 'forge_project_alpha',
            conversationId: 'conversation_beta',
            workspaceSessionId: 'forge_project_alpha',
            workspacePath: '/workspaces/forge/forge_project_alpha/chat/conversation_beta',
            title: '历史线程',
            createdAt: 2,
            updatedAt: 2,
            activeLeafId: null,
            messages: [{ role: 'user', content: 'historical' }]
        });
        const bridge = new ForgePiToolBridge({
            skills: createEmptySkills(),
            capabilities: createEmptyCapabilities(),
            workspaces
        });
        const read = bridge.getTools(createContext()).find(tool => tool.name === 'read');

        const result = await read?.execute('call_thread', {
            path: './threads/02历史线程/messages.md'
        });

        expect(result?.details).toMatchObject({
            path: './threads/02历史线程/messages.md',
            content: expect.stringContaining('historical')
        });
    });

    it('reads the current thread markdown alias from runtime context', async () => {
        const bridge = new ForgePiToolBridge({
            skills: createEmptySkills(),
            capabilities: createEmptyCapabilities()
        });
        const context = {
            ...createContext(),
            messages: [{
                id: 'msg_user_1',
                parentId: null,
                name: 'User',
                role: 'user',
                is_user: true,
                mesRaw: '当前线程语义内容',
                mes: '当前线程语义内容',
                fingerprint: 'fp_user_1',
                extra: {},
                syncStatus: 'local' as const
            }]
        };
        const read = bridge.getTools(context).find(tool => tool.name === 'read');

        const result = await read?.execute('call_current_thread', {
            path: './threads/目前/messages.md'
        });

        expect(result?.details).toMatchObject({
            path: './threads/目前/messages.md',
            content: expect.stringContaining('当前线程语义内容')
        });
        expect(JSON.stringify(result?.details)).not.toContain('conversation_alpha');
    });

    it('reads the current thread metadata alias without leaking internal ids', async () => {
        const bridge = new ForgePiToolBridge({
            skills: createEmptySkills(),
            capabilities: createEmptyCapabilities()
        });
        const read = bridge.getTools(createContext()).find(tool => tool.name === 'read');

        const result = await read?.execute('call_current_thread_meta', {
            path: './threads/目前/thread.md'
        });

        expect(result?.details).toMatchObject({
            path: './threads/目前/thread.md',
            content: expect.stringContaining('Forge Alpha')
        });
        expect(result?.details).toMatchObject({
            content: expect.stringContaining('concept')
        });
        expect(JSON.stringify(result?.details)).not.toContain('conversation_alpha');
        expect(JSON.stringify(result?.details)).not.toContain('forge_project_alpha');
    });

    it('reports semantic directories instead of treating them as missing files', async () => {
        const bridge = new ForgePiToolBridge({
            skills: createEmptySkills(),
            capabilities: createEmptyCapabilities()
        });
        const read = bridge.getTools(createContext()).find(tool => tool.name === 'read');

        const result = await read?.execute('call_current_thread_dir', {
            path: './threads/目前/'
        });

        expect(result?.content?.[0]).toMatchObject({
            type: 'text',
            text: expect.stringContaining('Path is a directory')
        });
        expect(result?.details).toMatchObject({
            path: './threads/目前/',
            directory: true,
            entries: expect.arrayContaining([
                expect.objectContaining({ path: './threads/目前/messages.md', kind: 'file' })
            ])
        });
        expect(result?.details).not.toMatchObject({
            error: expect.stringContaining('File not found')
        });
    });
});
