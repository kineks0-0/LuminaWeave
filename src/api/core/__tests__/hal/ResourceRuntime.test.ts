import { beforeEach, describe, expect, it, vi } from 'vitest';
import { initMockHAL } from '@/api/core/__tests__/support/halMock.js';
import {
    buildSourceResourcePath,
    parseVFSPath,
    summarizeSTCharacter,
    summarizeSTWorldbook,
    worldbookEntriesToLorebookEntries,
    type ResourceDocument,
    type ResourceRef
} from '@shared/resources/index.js';
import { LocalResourceSource } from '@/api/core/host-drivers/standalone/LocalResourceSource.js';
import { LuminaWorldbookTriggerEngine } from '@/api/core/hal/resource/LuminaWorldbookTriggerEngine.js';
import { PromptResourceBindingService } from '@/api/core/hal/resource/PromptResourceBindingService.js';
import { ForgeProjectDataService } from '@/api/core/forge/project/ForgeProjectDataService.js';
import { PromptResourceResolver, type PromptResourceBundle } from '@/api/core/hal/resource/PromptResourceResolver.js';
import { ResourceService } from '@/api/core/hal/resource/ResourceService.js';
import { ResourceSourceRegistry } from '@/api/core/hal/resource/ResourceSourceRegistry.js';
import { AgentBashToolService } from '@/api/core/hal/shell/AgentBashToolService.js';
import { BashTerminalRuntime } from '@/api/core/hal/shell/BashTerminalRuntime.js';
import { ShellPermissionService } from '@/api/core/hal/shell/ShellPermissionService.js';
import { shellWorkspaceService } from '@/api/core/hal/shell/ShellWorkspaceService.js';
import { STResourceSource } from '@/api/core/host-drivers/st/STResourceSource.js';
import { VFSCommandService } from '@/api/core/hal/shell/VFSCommandService.js';
import { VirtualFileSystemService } from '@/api/core/hal/resource/VirtualFileSystemService.js';
import type { ForgeWorkspaceSession } from '@/types/SessionTypes.js';

const { store, stMainRef, stHelperRef, ctxRef } = vi.hoisted(() => ({
    store: new Map<string, unknown>(),
    stMainRef: { value: null as any },
    stHelperRef: { value: null as any },
    ctxRef: { value: null as any }
}));


vi.mock('@/api/core/host-drivers/st/STGlobalAccessor.js', () => ({
    STGlobalAccessor: {
        get stMain() { return stMainRef.value; },
        get stHelper() { return stHelperRef.value; },
        get ctx() { return ctxRef.value; },
        get stGlobal() { return typeof window !== 'undefined' ? window : globalThis; }
    }
}));

vi.mock('@/api/core/host-drivers/st/STClient.js', () => ({
    STClient: {
        getResolvedCurrentCharacterId: vi.fn(() => 'test-character'),
        getResolvedCurrentChatId: vi.fn(() => 'test-chat'),
        getPresets: vi.fn(() => []),
        getPreset: vi.fn(async (name: string) => name === 'in_use'
            ? { name: 'Current Preset', prompts: [{ id: 'main', enabled: true, content: 'Hello' }] }
            : null),
        getCharacters: vi.fn(() => ctxRef.value?.characters ?? []),
        getCharacterData: vi.fn(() => null),
        getWorldbookNames: vi.fn(() => [])
    }
}));

describe('Resource Runtime', () => {
    beforeEach(() => {
        store.clear();
        initMockHAL({ runtime: { extensionStore: { listKeys: vi.fn(async () => Array.from(store.keys())), getJson: vi.fn(async ({ key }: { key: string }) => store.get(key) ?? null), setJson: vi.fn(async ({ key, value }: { key: string; value: unknown }) => { store.set(key, value); }), updateJson: vi.fn(async ({ key, value }: { key: string; value: unknown }) => { store.set(key, value); }), deleteJson: vi.fn(async ({ key }: { key: string }) => { store.delete(key); }), setBlob: vi.fn(), getBlob: vi.fn() } } });
        shellWorkspaceService.resetForTests({ clearStorage: true });
        stMainRef.value = null;
        stHelperRef.value = null;
        ctxRef.value = null;
    });

    it('summarizes ST character and worldbook raw payloads without mutating raw data', () => {
        const worldbook = {
            entries: {
                1: { key: ['castle'], content: 'Stone keep', disable: false },
                2: { key: ['hidden'], content: 'Secret', disable: true }
            }
        };
        const before = JSON.stringify(worldbook);

        expect(summarizeSTCharacter('alice', { name: 'Alice', description: 'A knight' })).toMatchObject({
            id: 'alice',
            type: 'character',
            name: 'Alice'
        });
        expect(summarizeSTWorldbook('book', worldbook)).toMatchObject({
            id: 'book',
            type: 'worldbook',
            entryCount: 2,
            keywords: ['castle', 'hidden']
        });
        expect(JSON.stringify(worldbook)).toBe(before);
    });

    it('preserves ST worldbook keyword matching flags when deriving Lumina entries', () => {
        const entries = worldbookEntriesToLorebookEntries({
            entries: {
                a: {
                    key: ['c.stle'],
                    content: 'Regex castle detail.',
                    case_sensitive: true,
                    match_whole_words: true,
                    use_regex: true,
                    extensions: {
                        position: 7,
                        outlet_name: 'custom-outlet',
                        exclude_recursion: true,
                        prevent_recursion: false,
                        delay_until_recursion: true
                    }
                }
            }
        });

        expect(entries[0]).toMatchObject({
            uid: 'a',
            key: ['c.stle'],
            caseSensitive: true,
            matchWholeWords: true,
            useRegex: true,
            position: 7,
            outletName: 'custom-outlet',
            excludeRecursion: true,
            preventRecursion: false,
            delayUntilRecursion: true
        });
    });

    it('parses source and library VFS paths', () => {
        const path = buildSourceResourcePath('st', 'worldbook', 'main');
        expect(path).toBe('/sources/st/worldbooks/main');
        expect(parseVFSPath(path)).toMatchObject({
            kind: 'resource',
            sourceId: 'st',
            resourceType: 'worldbook',
            resourceId: 'main'
        });
        expect(parseVFSPath('/library/characters')).toMatchObject({
            kind: 'library-type',
            resourceType: 'character'
        });
    });

    it('lists local resources through ResourceService and VFS without merging same-name resources', async () => {
        const registry = new ResourceSourceRegistry();
        registry.registerSource(new LocalResourceSource());
        const service = new ResourceService(registry);
        const vfs = new VirtualFileSystemService(registry, service);

        await service.importResource('local', 'character', {
            name: 'Same Name',
            description: 'Local copy'
        });

        const resources = await service.listResources({ resourceType: 'character' });
        expect(resources).toHaveLength(1);
        expect(resources[0].ref).toMatchObject({
            sourceId: 'local',
            resourceType: 'character',
            writable: true
        });

        const library = await vfs.listDir('/library/characters');
        expect(library[0].name).toContain('[local]');
        expect(await vfs.readFile(resources[0].ref.path)).toContain('Local copy');
    });

    it('executes read-only VFS commands for resource browsing', async () => {
        const registry = new ResourceSourceRegistry();
        registry.registerSource(new LocalResourceSource());
        const service = new ResourceService(registry);
        const vfs = new VirtualFileSystemService(registry, service);
        const commands = new VFSCommandService(vfs);

        const document = await service.importResource('local', 'worldbook', {
            name: 'Command Book',
            entries: {
                a: {
                    key: ['castle'],
                    content: 'Command line castle detail.'
                }
            }
        });

        await expect(commands.executeLine('ls /library/worldbooks')).resolves.toMatchObject({
            ok: true,
            text: expect.stringContaining('Command Book [local]')
        });
        await expect(commands.executeLine('grep castle /library/worldbooks')).resolves.toMatchObject({
            ok: true,
            text: expect.stringContaining('castle')
        });
        await expect(commands.executeLine(`cat ${document.ref.path}`)).resolves.toMatchObject({
            ok: true,
            text: expect.stringContaining('Command line castle detail.')
        });
        await expect(commands.executeLine(`stat ${document.ref.path}`)).resolves.toMatchObject({
            ok: true,
            text: expect.stringContaining('ref: local/worldbook/')
        });
        await expect(commands.executeLine('tree /sources/local/worldbooks')).resolves.toMatchObject({
            ok: true,
            text: expect.stringContaining('└── Command-Book')
        });
        await expect(commands.executeLine('tree /sources/local/worldbooks --info')).resolves.toMatchObject({
            ok: true,
            text: expect.stringContaining('st-worldbook-object')
        });
    });

    it('exposes command metadata as the single source for terminal help and prompt manuals', async () => {
        const registry = new ResourceSourceRegistry();
        registry.registerSource(new LocalResourceSource());
        const service = new ResourceService(registry);
        const vfs = new VirtualFileSystemService(registry, service);
        const commands = new VFSCommandService(vfs);

        const definitions = commands.listCommands();
        const zhHelp = commands.getHelpText();
        const enHelp = commands.getHelpText({ locale: 'en-US' });

        expect(definitions.map(command => command.name)).toEqual([
            'ls',
            'cat',
            'grep',
            'find',
            'tree',
            'stat',
            'echo',
            'write',
            'edit',
            'tee',
            'jq',
            'json-set',
            'help',
            'clear'
        ]);
        for (const definition of definitions) {
            expect(definition.summary['zh-CN']).toBeTruthy();
            expect(definition.summary['en-US']).toBeTruthy();
            expect(definition.usage).toBeTruthy();
            expect(definition.examples.length).toBeGreaterThanOrEqual(2);
            expect(zhHelp).toContain(`${definition.name} - ${definition.summary['zh-CN']}`);
            expect(zhHelp).toContain(`用法: ${definition.usage}`);
            expect(enHelp).toContain(`${definition.name} - ${definition.summary['en-US']}`);
            expect(enHelp).toContain(`Usage: ${definition.usage}`);
            for (const example of definition.examples.slice(0, 2)) {
                expect(example.command).toBeTruthy();
                expect(typeof example.output).toBe('string');
                expect(zhHelp).toContain(`示例: ${example.command}`);
                expect(zhHelp).toContain(`输出: ${example.output}`);
                expect(enHelp).toContain(`Example: ${example.command}`);
                expect(enHelp).toContain(`Output: ${example.output}`);
            }
        }
        await expect(commands.executeLine('help')).resolves.toMatchObject({
            ok: true,
            text: expect.stringContaining('命令手册')
        });
        await expect(commands.executeLine('help en-US')).resolves.toMatchObject({
            ok: true,
            text: expect.stringContaining('Command manual')
        });
    });

    it('completes command names and VFS paths for terminal tab completion', async () => {
        const registry = new ResourceSourceRegistry();
        registry.registerSource(new LocalResourceSource());
        const service = new ResourceService(registry);
        const vfs = new VirtualFileSystemService(registry, service);
        const commands = new VFSCommandService(vfs);

        const document = await service.importResource('local', 'worldbook', {
            name: 'Completion Book',
            entries: {}
        });
        const localizedDocument = await service.importResource('local', 'worldbook', {
            name: '中文 世界书',
            entries: {}
        });

        await expect(commands.completeLine('sta')).resolves.toMatchObject({
            completed: true,
            replacement: 'stat ',
            candidates: [expect.objectContaining({ value: 'stat', type: 'command' })]
        });

        await expect(commands.completeLine('cat /sou')).resolves.toMatchObject({
            completed: true,
            replacementStart: 4,
            replacement: '/sources/'
        });

        await expect(commands.completeLine('cat /sources/local/worldbooks/Completion')).resolves.toMatchObject({
            completed: true,
            replacement: `${document.ref.path} `
        });

        await expect(commands.completeLine('cat /library/worldbooks/Completion')).resolves.toMatchObject({
            completed: true,
            replacement: '/library/worldbooks/Completion-Book '
        });

        await expect(commands.completeLine('cat /sources/local/worldbooks/中文')).resolves.toMatchObject({
            completed: true,
            replacement: '/sources/local/worldbooks/中文-世界书 '
        });
        expect(localizedDocument.ref.path).toContain('%E4%B8%AD%E6%96%87');
        await expect(commands.completeLine('cat /library/worldbooks/中文')).resolves.toMatchObject({
            completed: true,
            replacement: '/library/worldbooks/中文-世界书 '
        });

        const piped = await commands.completeLine('echo {} | cat /sou');
        expect(piped.completed).toBe(true);
        expect(piped.replacement).toBe('/sources/');
        expect(piped.replacementStart).toBe('echo {} | cat '.length);
    });

    it('parses shell-style quotes and rejects unsupported shell operators', async () => {
        const registry = new ResourceSourceRegistry();
        registry.registerSource(new LocalResourceSource());
        const service = new ResourceService(registry);
        const vfs = new VirtualFileSystemService(registry, service);
        const commands = new VFSCommandService(vfs);

        await expect(commands.executeLine('echo "a b"')).resolves.toMatchObject({
            ok: true,
            text: 'a b'
        });
        await expect(commands.executeLine('echo 中文 路径')).resolves.toMatchObject({
            ok: true,
            text: '中文 路径'
        });
        await expect(commands.executeLine('echo a\\ b')).resolves.toMatchObject({
            ok: true,
            text: 'a b'
        });
        await expect(commands.executeLine('echo $HOME')).resolves.toMatchObject({
            ok: true,
            text: '$HOME'
        });
        expect(() => commands.parse('echo hi && echo no')).toThrow(/logical AND/);
        expect(() => commands.parse('echo hi; echo no')).toThrow(/command sequencing/);
        expect(() => commands.parse('cat < input')).toThrow(/input redirection/);
        expect(() => commands.parse('echo hi > output')).toThrow(/output redirection/);
    });

    it('supports VFS pipelines and JSON edit commands through ResourceService write policy', async () => {
        const registry = new ResourceSourceRegistry();
        registry.registerSource(new LocalResourceSource());
        const service = new ResourceService(registry);
        const vfs = new VirtualFileSystemService(registry, service);
        const commands = new VFSCommandService(vfs);

        const document = await service.importResource('local', 'worldbook', {
            name: 'Editable Book',
            entries: {
                a: {
                    key: ['castle'],
                    content: 'Before edit.'
                }
            }
        });

        await expect(commands.executeLine(`cat ${document.ref.path} | grep castle`)).resolves.toMatchObject({
            ok: true,
            text: expect.stringContaining('castle')
        });

        await expect(commands.executeLine(`echo '{"name":"Edited Book","entries":{"a":{"key":["edited"],"content":"After edit."}}}' | write ${document.ref.path}`)).resolves.toMatchObject({
            ok: true,
            text: expect.stringContaining('saved:')
        });

        await expect(commands.executeLine(`cat ${document.ref.path} | grep "After edit"`)).resolves.toMatchObject({
            ok: true,
            text: expect.stringContaining('After edit.')
        });
    });

    it('queries JSON resources and piped stdin with jq JSONPath', async () => {
        const registry = new ResourceSourceRegistry();
        registry.registerSource(new LocalResourceSource());
        const service = new ResourceService(registry);
        const vfs = new VirtualFileSystemService(registry, service);
        const commands = new VFSCommandService(vfs);

        const document = await service.importResource('local', 'character', {
            name: 'Json Hero',
            character: {
                traits: ['brave', 'careful']
            }
        });

        await expect(commands.executeLine(`jq "$.name" ${document.ref.path}`)).resolves.toMatchObject({
            ok: true,
            text: '"Json Hero"'
        });
        await expect(commands.executeLine(`cat ${document.ref.path} | jq "$.character.traits"`)).resolves.toMatchObject({
            ok: true,
            text: JSON.stringify(['brave', 'careful'], null, 2)
        });
        await expect(commands.executeLine('echo "not-json" | jq "$.name"')).resolves.toMatchObject({
            ok: false,
            error: expect.stringContaining('jq input must be valid JSON')
        });
    });

    it('updates a single JSONPath target with json-set and rejects broad selectors', async () => {
        const registry = new ResourceSourceRegistry();
        registry.registerSource(new LocalResourceSource());
        const service = new ResourceService(registry);
        const vfs = new VirtualFileSystemService(registry, service);
        const commands = new VFSCommandService(vfs);

        const document = await service.importResource('local', 'worldbook', {
            name: 'Json Set Book',
            entries: {
                a: {
                    key: ['state'],
                    content: 'Before'
                }
            }
        });

        await expect(commands.executeLine(`json-set ${document.ref.path} "$.entries.a.content" '"After"'`)).resolves.toMatchObject({
            ok: true,
            text: expect.stringContaining('saved:')
        });
        await expect(commands.executeLine(`jq "$.entries.a.content" ${document.ref.path}`)).resolves.toMatchObject({
            ok: true,
            text: '"After"'
        });
        await expect(commands.executeLine(`json-set ${document.ref.path} "$.entries.*.content" '"Broken"'`)).resolves.toMatchObject({
            ok: false,
            error: expect.stringContaining('single deterministic JSONPath')
        });
    });

    it('keeps ST resources protected when json-set reaches write policy', async () => {
        stMainRef.value = {};
        stHelperRef.value = {};
        ctxRef.value = {
            characterId: 0,
            characters: [
                { name: 'ST Hero', data: { name: 'ST Hero', description: 'Original' } }
            ]
        };
        const registry = new ResourceSourceRegistry();
        registry.registerSource(new STResourceSource());
        const service = new ResourceService(registry);
        const vfs = new VirtualFileSystemService(registry, service);
        const commands = new VFSCommandService(vfs);
        const stCharacter = (await service.listResources({ sourceId: 'st', resourceType: 'character' }))[0];

        await expect(commands.executeLine(`json-set ${stCharacter.ref.path} "$.description" '"Changed"'`)).resolves.toMatchObject({
            ok: false,
            error: expect.stringContaining('requires_policy')
        });
    });

    it('exposes ST character PNG avatars as JSON resource files in VFS', async () => {
        stMainRef.value = {};
        stHelperRef.value = {};
        ctxRef.value = {
            characterId: 0,
            characters: [
                {
                    name: 'PNG Hero',
                    avatar: 'PNG Hero.png',
                    data: {
                        name: 'PNG Hero',
                        description: 'Embedded card data'
                    }
                }
            ]
        };
        const registry = new ResourceSourceRegistry();
        registry.registerSource(new STResourceSource());
        const service = new ResourceService(registry);
        const vfs = new VirtualFileSystemService(registry, service);

        const [character] = await service.listResources({ sourceId: 'st', resourceType: 'character' });
        expect(character.ref.resourceId).toBe('PNG-Hero.json');
        expect(character.ref.path).toBe('/sources/st/characters/PNG-Hero.json');
        await expect(vfs.readFile('/sources/st/characters/PNG-Hero.json')).resolves.toContain('Embedded card data');
        await expect(vfs.readFile('/sources/st/characters/PNG-Hero-png')).resolves.toContain('Embedded card data');
    });

    it('runs just-bash against Resource Domain mounts for user terminal reads and local writes', async () => {
        const registry = new ResourceSourceRegistry();
        registry.registerSource(new LocalResourceSource());
        const service = new ResourceService(registry);
        const vfs = new VirtualFileSystemService(registry, service);
        const permissions = new ShellPermissionService();
        const document = await service.importResource('local', 'worldbook', {
            name: 'Bash Book',
            entries: {
                a: {
                    key: ['castle'],
                    content: 'Bash castle detail.'
                }
            }
        });
        const runtime = new BashTerminalRuntime({
            session: {
                shellSessionId: 'user-terminal',
                kind: 'user-terminal',
                ownerType: 'user',
                ownerId: 'local-user'
            },
            vfs,
            permissions
        });

        await expect(runtime.exec(`cat ${document.ref.path} | grep castle`)).resolves.toMatchObject({
            exitCode: 0,
            stdout: expect.stringContaining('Bash castle detail')
        });
        await expect(runtime.exec(`printf '{"name":"Bash Book","entries":{}}' > ${document.ref.path}`)).resolves.toMatchObject({
            exitCode: 0
        });
        await expect(runtime.exec(`jq ".name" ${document.ref.path}`)).resolves.toMatchObject({
            exitCode: 0,
            stdout: expect.stringContaining('Bash Book')
        });
    });

    it('keeps just-bash tree and ls consistent for library display entries', async () => {
        const registry = new ResourceSourceRegistry();
        registry.registerSource(new LocalResourceSource());
        const service = new ResourceService(registry);
        const vfs = new VirtualFileSystemService(registry, service);
        const permissions = new ShellPermissionService();
        await service.importResource('local', 'character', {
            name: 'Tree Hero',
            description: 'Visible through library tree'
        });
        const runtime = new BashTerminalRuntime({
            session: {
                shellSessionId: 'user-terminal',
                kind: 'user-terminal',
                ownerType: 'user',
                ownerId: 'local-user'
            },
            vfs,
            permissions
        });

        await expect(runtime.exec('ls -l /library/characters')).resolves.toMatchObject({
            exitCode: 0,
            stdout: expect.stringContaining('Tree Hero [local]')
        });
        await expect(runtime.exec('tree /library/characters')).resolves.toMatchObject({
            exitCode: 0,
            stdout: expect.stringContaining('Tree Hero [local]')
        });
        await expect(runtime.exec('tree /library/characters')).resolves.toMatchObject({
            stdout: expect.not.stringContaining('0 directories, 0 files')
        });
        await expect(runtime.exec('tree /')).resolves.toMatchObject({
            exitCode: 0,
            stdout: expect.stringContaining('Tree Hero [local]')
        });
        await expect(runtime.exec('cat "/library/characters/Tree Hero [local]"')).resolves.toMatchObject({
            exitCode: 0,
            stdout: expect.stringContaining('Visible through library tree')
        });
    });

    it('routes just-bash resource writes, copies, and append errors through Resource-backed FS policy', async () => {
        const registry = new ResourceSourceRegistry();
        registry.registerSource(new LocalResourceSource());
        registry.registerSource(new STResourceSource());
        const service = new ResourceService(registry);
        const vfs = new VirtualFileSystemService(registry, service);
        const permissions = new ShellPermissionService();
        const runtime = new BashTerminalRuntime({
            session: {
                shellSessionId: 'user-terminal',
                kind: 'user-terminal',
                ownerType: 'user',
                ownerId: 'local-user'
            },
            vfs,
            permissions
        });

        await expect(runtime.exec('printf \'{"name":"Shell Draft","entries":{}}\' > /sources/local/worldbooks/shell-draft')).resolves.toMatchObject({
            exitCode: 0
        });
        await expect(runtime.exec('jq .name /sources/local/worldbooks/shell-draft')).resolves.toMatchObject({
            exitCode: 0,
            stdout: expect.stringContaining('Shell Draft')
        });
        await expect(runtime.exec('cp /sources/local/worldbooks/shell-draft /workspaces/forge/copied.json && jq .name /workspaces/forge/copied.json')).resolves.toMatchObject({
            exitCode: 0,
            stdout: expect.stringContaining('Shell Draft')
        });
        await expect(runtime.exec('printf \'{"name":"Copy Back","entries":{}}\' > /workspaces/forge/copy-back.json && cp /workspaces/forge/copy-back.json /sources/local/worldbooks/copy-back')).resolves.toMatchObject({
            exitCode: 0
        });
        await expect(runtime.exec('printf \'{"bad":true}\' >> /sources/local/worldbooks/copy-back')).resolves.toMatchObject({
            exitCode: expect.any(Number),
            stderr: expect.stringContaining('unsupported_operation')
        });
        await expect(runtime.exec('rm /sources/local/worldbooks/copy-back')).resolves.toMatchObject({
            exitCode: expect.any(Number),
            stderr: expect.stringContaining('unsupported_operation')
        });
    });

    it('preserves shell cwd and exported env across just-bash exec calls', async () => {
        const registry = new ResourceSourceRegistry();
        registry.registerSource(new LocalResourceSource());
        const service = new ResourceService(registry);
        const vfs = new VirtualFileSystemService(registry, service);
        const permissions = new ShellPermissionService();
        const runtime = new BashTerminalRuntime({
            session: {
                shellSessionId: 'user-terminal',
                kind: 'user-terminal',
                ownerType: 'user',
                ownerId: 'local-user'
            },
            vfs,
            permissions
        });

        await expect(runtime.exec('mkdir -p /workspaces/forge/manual && cd /workspaces/forge/manual && export FOO=bar')).resolves.toMatchObject({
            exitCode: 0
        });
        expect(runtime.getCwd()).toBe('/workspaces/forge/manual');
        expect(runtime.getEnv().FOO).toBe('bar');

        await expect(runtime.exec('pwd && echo $FOO && printf note > note.txt')).resolves.toMatchObject({
            exitCode: 0,
            stdout: '/workspaces/forge/manual\nbar\n'
        });
        await expect(runtime.exec('cat note.txt')).resolves.toMatchObject({
            exitCode: 0,
            stdout: 'note'
        });
    });

    it('shares and persists project workspaces across Forge agent shell runtimes', async () => {
        const registry = new ResourceSourceRegistry();
        registry.registerSource(new LocalResourceSource());
        const service = new ResourceService(registry);
        const vfs = new VirtualFileSystemService(registry, service);
        const permissions = new ShellPermissionService();
        const session = {
            shellSessionId: 'forge-agent-project-a-1',
            kind: 'forge-agent' as const,
            ownerType: 'forge' as const,
            ownerId: 'forge-agent',
            projectId: 'project-a',
            conversationId: 'conversation-a'
        };
        const writer = new BashTerminalRuntime({ session, vfs, permissions });

        await expect(writer.exec('mkdir -p drafts && printf "shared draft" > drafts/card.md')).resolves.toMatchObject({
            exitCode: 0
        });

        const reader = new BashTerminalRuntime({
            session: {
                ...session,
                shellSessionId: 'forge-agent-project-a-2',
                conversationId: 'conversation-b'
            },
            vfs,
            permissions
        });
        await expect(reader.exec('cat drafts/card.md')).resolves.toMatchObject({
            exitCode: 0,
            stdout: 'shared draft'
        });

        shellWorkspaceService.resetForTests();
        const reloadedReader = new BashTerminalRuntime({
            session: {
                ...session,
                shellSessionId: 'forge-agent-project-a-reloaded'
            },
            vfs,
            permissions
        });
        await expect(reloadedReader.exec('cat drafts/card.md')).resolves.toMatchObject({
            exitCode: 0,
            stdout: 'shared draft'
        });
    });

    it('stores Forge conversation to project workspace bindings in the workspace namespace', async () => {
        const binding = await shellWorkspaceService.bindForgeConversation({
            forgeProjectId: 'project-bind',
            conversationId: 'conversation-bind'
        });

        expect(binding).toMatchObject({
            forgeProjectId: 'project-bind',
            conversationId: 'conversation-bind',
            workspacePath: '/workspaces/forge/project-bind/chat/conversation-bind'
        });
        await expect(shellWorkspaceService.getForgeBinding('conversation-bind')).resolves.toMatchObject({
            forgeProjectId: 'project-bind'
        });

        shellWorkspaceService.resetForTests();
        await expect(shellWorkspaceService.getForgeBinding('conversation-bind')).resolves.toMatchObject({
            workspacePath: '/workspaces/forge/project-bind/chat/conversation-bind'
        });
    });

    it('notifies approval UI listeners when shell permission requests and grants change', () => {
        const permissions = new ShellPermissionService();
        const events: number[] = [];
        const unsubscribe = permissions.subscribe(() => {
            events.push(permissions.listRequests().length + permissions.listGrants().length);
        });
        const agentSession = {
            shellSessionId: 'forge-agent-permission-ui',
            kind: 'forge-agent' as const,
            ownerType: 'forge' as const,
            ownerId: 'forge-agent',
            projectId: 'project-a'
        };
        const userSession = {
            shellSessionId: 'user-terminal',
            kind: 'user-terminal' as const,
            ownerType: 'user' as const,
            ownerId: 'local-user'
        };

        const request = permissions.requestPermission({
            session: agentSession,
            operation: 'write',
            scope: { pathPrefix: '/sources/local/worldbooks/draft' },
            reason: 'Need to save local draft',
            expiresAt: null
        });
        const grant = permissions.approveRequest(request.requestId);
        permissions.revokeGrant(grant.grantId, userSession);
        const rejected = permissions.requestPermission({
            session: agentSession,
            operation: 'network',
            scope: { urlPrefix: 'https://api.example.com/' },
            reason: 'Need reference data',
            expiresAt: null
        });
        permissions.rejectRequest(rejected.requestId, 'Not needed');
        unsubscribe();

        expect(events.length).toBeGreaterThanOrEqual(5);
        expect(permissions.listRequests().find(item => item.requestId === rejected.requestId)?.decisionReason).toBe('Not needed');
        expect(permissions.listGrants()).toHaveLength(0);
    });

    it('completes just-bash builtins and mounted filesystem paths from the shell runtime', async () => {
        const registry = new ResourceSourceRegistry();
        registry.registerSource(new LocalResourceSource());
        const service = new ResourceService(registry);
        const vfs = new VirtualFileSystemService(registry, service);
        const permissions = new ShellPermissionService();
        const document = await service.importResource('local', 'worldbook', {
            name: 'Bash Completion Book',
            entries: {}
        });
        const runtime = new BashTerminalRuntime({
            session: {
                shellSessionId: 'user-terminal',
                kind: 'user-terminal',
                ownerType: 'user',
                ownerId: 'local-user'
            },
            vfs,
            permissions
        });

        const commandCompletion = await runtime.completeLine('c');
        expect(commandCompletion.candidates).toEqual(expect.arrayContaining([
            expect.objectContaining({ value: 'cat', type: 'command' }),
            expect.objectContaining({ value: 'cd', type: 'command' }),
            expect.objectContaining({ value: 'clear', type: 'command' })
        ]));

        await expect(runtime.completeLine('cd /sou')).resolves.toMatchObject({
            completed: true,
            replacementStart: 3,
            replacement: '/sources/'
        });
        await expect(runtime.completeLine('cat /sources/local/worldbooks/Bash')).resolves.toMatchObject({
            completed: true,
            replacement: `${document.ref.path} `
        });

        await expect(runtime.exec('mkdir -p /workspaces/forge/manual && cd /workspaces/forge/manual && touch notes.txt')).resolves.toMatchObject({
            exitCode: 0
        });
        await expect(runtime.completeLine('cat no')).resolves.toMatchObject({
            completed: true,
            replacement: 'notes.txt '
        });
    });

    it('keeps curl unavailable without network config and permission-gated for agent sessions', async () => {
        const registry = new ResourceSourceRegistry();
        registry.registerSource(new LocalResourceSource());
        const service = new ResourceService(registry);
        const vfs = new VirtualFileSystemService(registry, service);
        const permissions = new ShellPermissionService();
        const userRuntime = new BashTerminalRuntime({
            session: {
                shellSessionId: 'user-terminal',
                kind: 'user-terminal',
                ownerType: 'user',
                ownerId: 'local-user'
            },
            vfs,
            permissions
        });

        await expect(userRuntime.exec('curl https://api.example.com/resource')).resolves.toMatchObject({
            exitCode: expect.any(Number),
            stderr: expect.stringContaining('command not found')
        });

        const agentRuntime = new BashTerminalRuntime({
            session: {
                shellSessionId: 'forge-agent-network',
                kind: 'forge-agent',
                ownerType: 'forge',
                ownerId: 'forge-agent',
                projectId: 'project-a'
            },
            vfs,
            permissions,
            network: {
                allowedUrlPrefixes: ['https://api.example.com/']
            }
        });

        await expect(agentRuntime.exec('curl https://api.example.com/resource')).resolves.toMatchObject({
            exitCode: expect.any(Number),
            stderr: expect.stringContaining('network permission required')
        });
    });

    it('keeps network requests inside allow-list and grants for agent sessions', async () => {
        const registry = new ResourceSourceRegistry();
        registry.registerSource(new LocalResourceSource());
        const service = new ResourceService(registry);
        const vfs = new VirtualFileSystemService(registry, service);
        const permissions = new ShellPermissionService();
        const fetchMock = vi.fn(async () => new Response('network-ok', {
            status: 200,
            statusText: 'OK'
        }));
        vi.stubGlobal('fetch', fetchMock);
        const session = {
            shellSessionId: 'forge-agent-network-grant',
            kind: 'forge-agent' as const,
            ownerType: 'forge' as const,
            ownerId: 'forge-agent',
            projectId: 'project-a'
        };
        const runtime = new BashTerminalRuntime({
            session,
            vfs,
            permissions,
            network: {
                allowedUrlPrefixes: ['https://api.example.com/v1/']
            }
        });

        await expect(runtime.exec('lw-permission request network https://other.example.com/ --reason "nope"')).resolves.toMatchObject({
            exitCode: 2,
            stderr: expect.stringContaining('network denied by allow-list')
        });
        await expect(runtime.exec('curl https://api.example.com/v1/resource')).resolves.toMatchObject({
            exitCode: expect.any(Number),
            stderr: expect.stringContaining('network permission required')
        });

        const request = await runtime.exec('lw-permission request network https://api.example.com/v1/ --reason "Fetch reference"');
        expect(request.stdout).toContain('permission request pending');
        permissions.approveRequest(permissions.listRequests()[0].requestId);

        await expect(runtime.exec('curl https://api.example.com/v1/resource')).resolves.toMatchObject({
            exitCode: 0,
            stdout: expect.stringContaining('network-ok')
        });
        expect(fetchMock).toHaveBeenCalledWith('https://api.example.com/v1/resource', expect.objectContaining({
            method: 'GET'
        }));
    });

    it('prints Lumina shell command metadata from lw-help', async () => {
        const registry = new ResourceSourceRegistry();
        registry.registerSource(new LocalResourceSource());
        const service = new ResourceService(registry);
        const vfs = new VirtualFileSystemService(registry, service);
        const permissions = new ShellPermissionService();
        const runtime = new BashTerminalRuntime({
            session: {
                shellSessionId: 'user-terminal',
                kind: 'user-terminal',
                ownerType: 'user',
                ownerId: 'local-user'
            },
            vfs,
            permissions
        });

        await expect(runtime.exec('lw-help')).resolves.toMatchObject({
            exitCode: 0,
            stdout: expect.stringContaining('Lumina Resource Domain shell')
        });
        await expect(runtime.exec('lw-help')).resolves.toMatchObject({
            stdout: expect.stringContaining('lw-permission (lumina)')
        });
        await expect(runtime.exec('lw-help')).resolves.toMatchObject({
            stdout: expect.stringContaining('just-bash jq-style filtering')
        });
    });

    it('creates bash-tool agent tools on top of Lumina shell runtime and permissions', async () => {
        const registry = new ResourceSourceRegistry();
        registry.registerSource(new LocalResourceSource());
        const service = new ResourceService(registry);
        const vfs = new VirtualFileSystemService(registry, service);
        const permissions = new ShellPermissionService();
        const trace: string[] = [];
        const tools = await new AgentBashToolService({
            vfs,
            permissions,
            onTrace: event => trace.push(`${event.phase}:${event.command}`)
        }).createAgentBashTools({
            session: {
                shellSessionId: 'forge-agent-tools',
                kind: 'forge-agent',
                ownerType: 'forge',
                ownerId: 'forge-agent',
                projectId: 'project-a'
            }
        });

        expect(Object.keys(tools.tools)).toEqual(['bash', 'readFile', 'writeFile']);

        const writeResult = await (tools.tools.writeFile as any).execute({
            path: 'drafts/角色.md',
            content: '中文草稿'
        });
        expect(writeResult).toEqual({ success: true });

        const readResult = await (tools.tools.readFile as any).execute({
            path: 'drafts/角色.md'
        });
        expect(readResult).toEqual({ content: '中文草稿' });

        const bashResult = await (tools.tools.bash as any).execute({
            command: 'cat drafts/角色.md'
        });
        expect(bashResult).toMatchObject({
            exitCode: 0,
            stdout: '中文草稿'
        });
        expect(trace).toContain('before:cat drafts/角色.md');
        expect(trace).toContain('after:cat drafts/角色.md');

        const denied = await (tools.tools.writeFile as any).execute({
            path: '/sources/local/worldbooks/denied',
            content: '{"name":"Denied","entries":{}}'
        }).catch((error: unknown) => error);
        expect(denied).toBeInstanceOf(Error);
        expect(String(denied.message)).toContain('permission denied');
    });

    it('exposes structured Agent shell tool prompt metadata for prompt assembly', () => {
        const registry = new ResourceSourceRegistry();
        registry.registerSource(new LocalResourceSource());
        const service = new ResourceService(registry);
        const vfs = new VirtualFileSystemService(registry, service);
        const permissions = new ShellPermissionService();
        const agentTools = new AgentBashToolService({ vfs, permissions });
        const session = {
            shellSessionId: 'forge-agent-manual',
            kind: 'forge-agent' as const,
            ownerType: 'forge' as const,
            ownerId: 'forge-agent',
            projectId: 'project-a'
        };

        const manual = agentTools.getToolManual({ session });
        const prompt = agentTools.getToolPrompt({
            session,
            extraInstructions: 'Return concise command summaries in trace.'
        });

        expect(manual.workingDirectory).toBe('/workspaces/forge/project-a');
        expect(manual.tools.map((item: any) => item.name)).toEqual(['bash', 'readFile', 'writeFile']);
        expect(manual.shellCommands.map((item: any) => item.name)).toEqual(expect.arrayContaining(['cp', 'tree', 'jq', 'lw-permission', 'lw-help']));
        for (const toolManual of manual.tools) {
            expect(toolManual.usage).toBeTruthy();
            expect(toolManual.examples).toHaveLength(2);
            expect(toolManual.permissions).toBeTruthy();
            expect(prompt).toContain(`${toolManual.name} - ${toolManual.summary}`);
            expect(prompt).toContain(`Usage: ${toolManual.usage}`);
            expect(prompt).toContain(`Example: ${toolManual.examples[0]}`);
        }
        expect(prompt).toContain('Supported shell command reference:');
        expect(prompt).toContain('jq (just-bash)');
        expect(prompt).toContain('not the legacy VFSCommandService JSONPath jq syntax');
        expect(prompt).toContain('/sources: explicit Resource Source mounts');
        expect(prompt).toContain('lw-permission request');
        expect(prompt).toContain('Return concise command summaries in trace.');
    });

    it('includes available skills with paths and files in Agent shell prompt metadata', () => {
        const registry = new ResourceSourceRegistry();
        registry.registerSource(new LocalResourceSource());
        const service = new ResourceService(registry);
        const vfs = new VirtualFileSystemService(registry, service);
        const permissions = new ShellPermissionService();
        const agentTools = new AgentBashToolService({ vfs, permissions });
        const session = {
            shellSessionId: 'forge-agent-skill-manual',
            kind: 'forge-agent' as const,
            ownerType: 'forge' as const,
            ownerId: 'forge-agent',
            projectId: 'project-a'
        };

        const manual = agentTools.getToolManual({
            session,
            skills: [{
                name: 'text-tools',
                description: 'Text processing helpers.',
                files: [
                    { path: 'SKILL.md', content: 'Use this skill.' },
                    { path: 'scripts/render.sh', content: 'echo ok' }
                ]
            }]
        });
        const prompt = agentTools.getToolPrompt({
            session,
            skills: [{
                name: 'text-tools',
                description: 'Text processing helpers.',
                files: [
                    { path: 'SKILL.md', content: 'Use this skill.' },
                    { path: 'scripts/render.sh', content: 'echo ok' }
                ]
            }]
        });

        expect(manual.skills).toEqual([
            {
                name: 'text-tools',
                description: 'Text processing helpers.',
                path: '/workspaces/forge/project-a/skills/text-tools',
                files: ['SKILL.md', 'scripts/render.sh']
            }
        ]);
        expect(manual.tools.map((item: any) => item.name)).toEqual(['skill', 'bash', 'readFile', 'writeFile']);
        expect(prompt).toContain('Available skills:');
        expect(prompt).toContain('skill("text-tools") - Text processing helpers.');
        expect(prompt).toContain('Path: /workspaces/forge/project-a/skills/text-tools');
        expect(prompt).toContain('Files: SKILL.md, scripts/render.sh');
    });

    it('installs workspace skills and exposes a bash-tool-style skill loader', async () => {
        const registry = new ResourceSourceRegistry();
        registry.registerSource(new LocalResourceSource());
        const service = new ResourceService(registry);
        const vfs = new VirtualFileSystemService(registry, service);
        const permissions = new ShellPermissionService();
        const tools = await new AgentBashToolService({ vfs, permissions }).createAgentBashTools({
            session: {
                shellSessionId: 'forge-agent-skills',
                kind: 'forge-agent',
                ownerType: 'forge',
                ownerId: 'forge-agent',
                projectId: 'project-a'
            },
            skills: [
                {
                    name: 'text-tools',
                    description: 'Text processing helpers.',
                    files: [
                        {
                            path: 'SKILL.md',
                            content: [
                                '---',
                                'name: text-tools',
                                'description: Text processing helpers.',
                                '---',
                                'Use scripts/render.sh to render text summaries.'
                            ].join('\n')
                        },
                        {
                            path: 'scripts/render.sh',
                            content: 'echo skill-script'
                        }
                    ]
                }
            ]
        });

        expect(tools.skills).toEqual([
            expect.objectContaining({
                name: 'text-tools',
                path: '/workspaces/forge/project-a/skills/text-tools',
                files: ['SKILL.md', 'scripts/render.sh']
            })
        ]);
        expect(Object.keys(tools.tools)).toEqual(['skill', 'bash', 'readFile', 'writeFile']);

        const loaded = await (tools.tools.skill as any).execute({ skillName: 'text-tools' });
        expect(loaded).toMatchObject({
            success: true,
            skill: {
                name: 'text-tools',
                path: '/workspaces/forge/project-a/skills/text-tools'
            },
            instructions: 'Use scripts/render.sh to render text summaries.',
            files: ['scripts/render.sh']
        });

        await expect((tools.tools.readFile as any).execute({
            path: 'skills/text-tools/scripts/render.sh'
        })).resolves.toEqual({
            content: 'echo skill-script'
        });
        await expect((tools.tools.bash as any).execute({
            command: 'bash skills/text-tools/scripts/render.sh'
        })).resolves.toMatchObject({
            exitCode: 0,
            stdout: 'skill-script\n'
        });
    });

    it('enforces project-scoped workspace writes and permission requests for agent shell sessions', async () => {
        const registry = new ResourceSourceRegistry();
        registry.registerSource(new LocalResourceSource());
        const service = new ResourceService(registry);
        const vfs = new VirtualFileSystemService(registry, service);
        const permissions = new ShellPermissionService();
        const document = await service.importResource('local', 'worldbook', {
            name: 'Protected Book',
            entries: {}
        });
        const session = {
            shellSessionId: 'forge-agent-a',
            kind: 'forge-agent' as const,
            ownerType: 'forge' as const,
            ownerId: 'agent-a',
            projectId: 'project-a'
        };
        const runtime = new BashTerminalRuntime({ session, vfs, permissions });

        await expect(runtime.exec('echo 中文 > /workspaces/forge/project-a/notes.txt && cat /workspaces/forge/project-a/notes.txt')).resolves.toMatchObject({
            exitCode: 0,
            stdout: '中文\n'
        });
        await expect(runtime.exec('echo no > /workspaces/forge/project-b/notes.txt')).resolves.toMatchObject({
            exitCode: expect.any(Number),
            stderr: expect.stringContaining('permission denied')
        });
        await expect(runtime.exec(`printf '{"name":"Denied","entries":{}}' > ${document.ref.path}`)).resolves.toMatchObject({
            exitCode: expect.any(Number),
            stderr: expect.stringContaining('permission denied')
        });

        const request = await runtime.exec(`lw-permission request write ${document.ref.path} --reason "需要更新本地世界书"`);
        expect(request.stdout).toContain('permission request pending');
        const pending = permissions.listRequests()[0];
        permissions.approveRequest(pending.requestId);

        await expect(runtime.exec(`printf '{"name":"Approved","entries":{}}' > ${document.ref.path}`)).resolves.toMatchObject({
            exitCode: 0
        });
        await expect(runtime.exec(`jq ".name" ${document.ref.path}`)).resolves.toMatchObject({
            exitCode: 0,
            stdout: expect.stringContaining('Approved')
        });
    });

    it('keeps ST source unavailable outside ST while local resources remain usable', async () => {
        const registry = new ResourceSourceRegistry();
        registry.registerSource(new STResourceSource());
        registry.registerSource(new LocalResourceSource());
        const service = new ResourceService(registry);

        await service.importResource('local', 'worldbook', {
            name: 'Local Book',
            entries: { a: { key: ['local'], content: 'Only local' } }
        });

        expect(registry.getSource('st')?.descriptor.status.available).toBe(false);
        const resources = await service.listResources();
        expect(resources.map((resource: any) => resource.ref.sourceId)).toEqual(['local']);
    });

    it('can list ST characters and active preset when ST is available', async () => {
        stMainRef.value = {};
        stHelperRef.value = {};
        ctxRef.value = {
            characterId: 0,
            characters: [
                { name: 'Same Name', data: { name: 'Same Name', description: 'ST original' } }
            ]
        };

        const registry = new ResourceSourceRegistry();
        registry.registerSource(new STResourceSource());
        const service = new ResourceService(registry);
        const resources = await service.listResources();

        expect(resources.some((resource: any) => resource.ref.sourceId === 'st' && resource.ref.resourceType === 'character')).toBe(true);
        expect(resources.some((resource: any) => resource.ref.sourceId === 'st' && resource.ref.resourceType === 'preset')).toBe(true);
    });

    it('keeps worldbook source selection at binding level instead of mutating resource refs', () => {
        const service = new PromptResourceBindingService('Session');
        const owner = { kind: 'session' as const, id: 'chat-a' };
        const stBook: ResourceRef = {
            sourceId: 'st',
            resourceType: 'worldbook',
            resourceId: 'main',
            path: '/sources/st/worldbooks/main',
            writable: false
        };
        const localBook: ResourceRef = {
            sourceId: 'local',
            resourceType: 'worldbook',
            resourceId: 'main',
            path: '/sources/local/worldbooks/main',
            writable: true
        };

        service.setBindings(owner, [stBook, localBook]);
        service.setSourceSelection(owner, {
            worldbook: {
                enabled: true,
                excludedRefs: [stBook]
            }
        });
        const resolution = service.resolveBindings(owner);

        expect(service.getBindings(owner)).toHaveLength(2);
        expect(service.getEnabledBindings(owner)).toMatchObject([{ sourceId: 'local' }]);
        expect(resolution.enabledRefs).toMatchObject([{ sourceId: 'local' }]);
        expect(resolution.excludedRefs).toMatchObject([{ sourceId: 'st' }]);
        expect(service.getSourceSelection(owner)?.worldbook?.excludedRefs?.[0]).toMatchObject({
            sourceId: 'st',
            resourceType: 'worldbook',
            resourceId: 'main'
        });
    });

    it('allows explicit worldbook includes when the session disables worldbooks by default', () => {
        const service = new PromptResourceBindingService('Session');
        const owner = PromptResourceBindingService.sessionOwner('chat-b');
        const stBook: ResourceRef = {
            sourceId: 'st',
            resourceType: 'worldbook',
            resourceId: 'main',
            path: '/sources/st/worldbooks/main',
            writable: false
        };
        const localBook: ResourceRef = {
            sourceId: 'local',
            resourceType: 'worldbook',
            resourceId: 'side',
            path: '/sources/local/worldbooks/side',
            writable: true
        };
        const character: ResourceRef = {
            sourceId: 'local',
            resourceType: 'character',
            resourceId: 'hero',
            path: '/sources/local/characters/hero',
            writable: true
        };

        service.setBindings(owner, [stBook, localBook, character]);
        service.setWorldbookEnabled(owner, false);
        service.includeWorldbook(owner, localBook);

        const resolution = service.resolveBindings(owner);

        expect(resolution.enabledRefs.map((ref: any) => `${ref.resourceType}:${ref.resourceId}`)).toEqual([
            'worldbook:side',
            'character:hero'
        ]);
        expect(resolution.excludedRefs.map((ref: any) => ref.resourceId)).toEqual(['main']);
    });

    it('provides stable owner helpers and worldbook ref selection mutations for UI callers', () => {
        const service = new PromptResourceBindingService('Session');
        const owner = PromptResourceBindingService.forgeWorkspaceOwner('forge-1');
        const worldbook: ResourceRef = {
            sourceId: 'local',
            resourceType: 'worldbook',
            resourceId: 'book',
            path: '/sources/local/worldbooks/book',
            writable: true
        };
        const character: ResourceRef = {
            sourceId: 'local',
            resourceType: 'character',
            resourceId: 'hero',
            path: '/sources/local/characters/hero',
            writable: true
        };

        service.setBindings(owner, [worldbook]);
        service.excludeWorldbook(owner, worldbook);
        expect(service.resolveBindings(owner).excludedRefs).toMatchObject([{ resourceId: 'book' }]);

        service.includeWorldbook(owner, worldbook);
        service.setWorldbookEnabled(owner, false);
        expect(service.resolveBindings(owner).enabledRefs).toMatchObject([{ resourceId: 'book' }]);

        service.clearWorldbookRefSelection(owner, worldbook);
        expect(service.resolveBindings(owner).excludedRefs).toMatchObject([{ resourceId: 'book' }]);
        service.setWorldbookEnabled(owner, true);
        expect(service.resolveBindings(owner).excludedRefs).toEqual([]);
        expect(() => service.includeWorldbook(owner, character)).toThrow(/worldbook refs/);

        expect(PromptResourceBindingService.promptPresetOwner('forge-agent', 'preset-a')).toEqual({
            kind: 'prompt-preset',
            id: 'forge-agent/preset-a'
        });
    });

    it('migrates Forge prompt resource bindings from workspace owner to project owner', () => {
        const service = new PromptResourceBindingService('Session');
        const legacyOwner = PromptResourceBindingService.forgeWorkspaceOwner('legacy-workspace');
        const projectOwner = PromptResourceBindingService.forgeWorkspaceOwner('project-a');
        const worldbook: ResourceRef = {
            sourceId: 'local',
            resourceType: 'worldbook',
            resourceId: 'book',
            path: '/sources/local/worldbooks/book',
            writable: true
        };
        const character: ResourceRef = {
            sourceId: 'local',
            resourceType: 'character',
            resourceId: 'hero',
            path: '/sources/local/characters/hero',
            writable: true
        };

        service.setBindings(legacyOwner, [worldbook]);
        service.excludeWorldbook(legacyOwner, worldbook);
        service.setBindings(projectOwner, [character]);

        const migrated = service.migrateForgeWorkspaceOwner('legacy-workspace', 'project-a');
        const resolution = service.resolveBindings(projectOwner);

        expect(migrated?.owner).toEqual(projectOwner);
        expect(service.getDocument(legacyOwner)).toBeNull();
        expect(resolution.refs.map((ref: any) => ref.resourceId).sort()).toEqual(['book', 'hero']);
        expect(resolution.enabledRefs).toMatchObject([{ resourceId: 'hero' }]);
        expect(resolution.excludedRefs).toMatchObject([{ resourceId: 'book' }]);
    });

    it('hydrates Forge project resource files from the VFS workspace', async () => {
        const service = new ForgeProjectDataService(shellWorkspaceService);
        const baseSession = {
            id: 'legacy-session',
            forgeProjectId: 'project-vfs',
            conversationId: 'conversation-vfs',
            workspacePath: '/workspaces/forge/project-vfs',
            sessionChatId: 'conversation-vfs',
            title: 'VFS Project',
            createdAt: 100,
            updatedAt: 200,
            presetId: 'preset-a',
            activeLeafId: null,
            worldlineNodes: [],
            selectedChatSessionId: 'chat-ref',
            selectedChatSnapshotId: null,
            draftInput: '',
            timelineItems: [],
            stagingEntries: [{
                id: 'stage-a',
                targetEntryId: 'entry-a',
                description: 'Draft change',
                originalContent: '',
                proposedContent: 'new',
                timestamp: 210,
                layer: 'concept',
                sourceTag: null,
                sourceMessageId: null,
                sourceSessionId: 'project-vfs'
            }],
            commitReadyEntries: [],
            virtualLorebookEntries: [{
                id: 'entry-a',
                entry: {
                    uid: 'entry-a',
                    key: ['castle'],
                    keysecondary: [],
                    comment: 'Castle',
                    content: 'Stone keep',
                    order: 100,
                    disable: false,
                    constant: false,
                    selective: false,
                    selectiveLogic: 0,
                    position: 0,
                    depth: 0,
                    probability: 100,
                    scan_depth: 0
                } as LuminaLorebookEntry,
                sourceBookId: null,
                createdAt: 120,
                updatedAt: 220
            }],
            importedLorebookId: null,
            workflowSnapshot: null,
            detailMode: 'quick',
            entryMode: 'structured',
            structuredState: {
                activeFormId: 'role',
                activeMessageFormId: null,
                submitConfigs: {},
                submittedScopes: {},
                lastUpdatedAt: 230,
                forms: {}
            },
            draftTree: {
                nodes: [{
                    id: 'draft-a',
                    title: 'Castle Draft',
                    layer: 'concept',
                    content: 'Stone keep',
                    status: 'proposal',
                    sourceMessageId: null,
                    sourceEntryId: 'entry-a',
                    sourceTag: 'virtual_lorebook',
                    sourceSessionId: 'project-vfs',
                    updatedAt: 240
                }],
                lastUpdatedAt: 240
            },
            forgeMemoryTree: {
                entries: [{
                    path: 'prefs/tone',
                    title: 'Tone',
                    content: 'quiet',
                    summary: 'quiet',
                    updatedAt: 250,
                    source: 'user'
                }],
                lastUpdatedAt: 250
            },
            activeLayer: 'concept',
            completedLayers: [],
            publishState: 'drafting',
            workspaceMode: 'workspace'
        } satisfies ForgeWorkspaceSession;

        await service.saveFromSession(baseSession);
        const fs = await shellWorkspaceService.getFileSystem({ projectId: 'project-vfs' });

        await expect(fs.readFile('/forge/project-vfs/project.json')).resolves.toContain('"forgeProjectId": "project-vfs"');
        await expect(fs.readFile('/forge/project-vfs/lorebook/entries/entry-a.json')).resolves.toContain('Stone keep');
        await expect(fs.readFile('/forge/project-vfs/memory/tree.json')).resolves.toContain('prefs/tone');
        await expect(fs.readFile('/forge/project-vfs/drafts/tree.json')).resolves.toContain('Castle Draft');
        await expect(fs.readFile('/forge/project-vfs/review/staging.json')).resolves.toContain('stage-a');

        const loaded = await service.loadForSession({
            ...baseSession,
            title: 'Stale',
            selectedChatSessionId: null,
            stagingEntries: [],
            virtualLorebookEntries: [],
            draftTree: { nodes: [], lastUpdatedAt: 0 },
            forgeMemoryTree: { entries: [], lastUpdatedAt: 0 }
        });

        expect(loaded?.title).toBe('VFS Project');
        expect(loaded?.selectedChatSessionId).toBe('chat-ref');
        expect(loaded?.virtualLorebookEntries?.[0]?.entry.content).toBe('Stone keep');
        expect(loaded?.forgeMemoryTree?.entries[0]?.path).toBe('prefs/tone');
        expect(loaded?.draftTree?.nodes[0]?.title).toBe('Castle Draft');
        expect(loaded?.stagingEntries[0]?.id).toBe('stage-a');
    });

    it('blocks non-ST resources from the ST prompt engine instead of silently injecting them', () => {
        const stRef: ResourceRef = {
            sourceId: 'st',
            resourceType: 'worldbook',
            resourceId: 'st-book',
            path: '/sources/st/worldbooks/st-book',
            writable: false
        };
        const localRef: ResourceRef = {
            sourceId: 'local',
            resourceType: 'worldbook',
            resourceId: 'local-book',
            path: '/sources/local/worldbooks/local-book',
            writable: true
        };
        const documentFor = (ref: ResourceRef, content: string): ResourceDocument => ({
            ref,
            raw: {
                entries: {
                    a: {
                        key: [ref.resourceId],
                        content
                    }
                }
            },
            summary: {
                id: ref.resourceId,
                type: ref.resourceType,
                name: ref.resourceId,
                format: 'st-worldbook-object'
            },
            capabilities: {
                readable: true,
                writable: ref.writable,
                forkable: true,
                importable: true,
                exportable: true,
                searchable: true
            }
        });
        const bundle: PromptResourceBundle = {
            refs: [stRef, localRef],
            documents: [documentFor(stRef, 'ST detail.'), documentFor(localRef, 'Local detail.')],
            lorebookEntries: [
                {
                    uid: 'st-entry',
                    comment: 'ST Entry',
                    key: ['st-book'],
                    keysecondary: [],
                    content: 'ST detail.',
                    constant: false,
                    selective: false,
                    selectiveLogic: 0,
                    disable: false,
                    enabled: true,
                    position: 0,
                    depth: 0,
                    order: 0,
                    probability: 100,
                    scan_depth: 0,
                    resourceRef: stRef,
                    sourceId: 'st',
                    resourceId: 'st-book',
                    sourcePath: stRef.path
                },
                {
                    uid: 'local-entry',
                    comment: 'Local Entry',
                    key: ['local-book'],
                    keysecondary: [],
                    content: 'Local detail.',
                    constant: false,
                    selective: false,
                    selectiveLogic: 0,
                    disable: false,
                    enabled: true,
                    position: 0,
                    depth: 0,
                    order: 0,
                    probability: 100,
                    scan_depth: 0,
                    resourceRef: localRef,
                    sourceId: 'local',
                    resourceId: 'local-book',
                    sourcePath: localRef.path
                }
            ],
            charCard: null,
            presetRaw: null,
            diagnostics: []
        };

        const resolution = PromptResourceResolver.resolveSTEngineResources([stRef, localRef]);
        const filtered = PromptResourceResolver.filterBundleForSTEngine(bundle);

        expect(resolution.passthroughRefs).toEqual([stRef]);
        expect(resolution.blockedRefs).toEqual([localRef]);
        expect(resolution.diagnostics).toContainEqual(expect.objectContaining({
            code: 'ST_ENGINE_NON_ST_RESOURCE_BLOCKED'
        }));
        expect(filtered.refs).toEqual([stRef]);
        expect(filtered.documents.map((document: any) => document.ref.path)).toEqual([stRef.path]);
        expect(filtered.lorebookEntries.map((entry: any) => entry.sourcePath)).toEqual([stRef.path]);
    });

    it('resolves ST-style worldbook selective logic without changing raw entry enable state', () => {
        const engine = new LuminaWorldbookTriggerEngine();
        const entries: LuminaLorebookEntry[] = [
            {
                uid: 1,
                comment: 'AND ANY',
                key: ['castle'],
                keysecondary: ['rain', 'storm'],
                content: 'A wet castle.',
                constant: false,
                selective: true,
                selectiveLogic: 0,
                disable: false,
                enabled: true,
                position: 0,
                depth: 0,
                order: 0,
                probability: 100,
                scan_depth: 0
            },
            {
                uid: 2,
                comment: 'NOT ANY',
                key: ['castle'],
                keysecondary: ['rain'],
                content: 'A dry castle.',
                constant: false,
                selective: true,
                selectiveLogic: 2,
                disable: false,
                enabled: true,
                position: 0,
                depth: 0,
                order: 1,
                probability: 100,
                scan_depth: 0
            }
        ];

        const result = engine.resolve(entries, { inputText: 'castle rain' });

        expect(result.entries.map((entry: any) => entry.uid)).toEqual([1]);
        expect(entries[1].enabled).toBe(true);
    });

    it('respects ST-style worldbook case sensitivity, whole-word matching, and regex keys', () => {
        const engine = new LuminaWorldbookTriggerEngine();
        const createEntry = (entry: Partial<LuminaLorebookEntry> & Pick<LuminaLorebookEntry, 'uid' | 'key' | 'content'>): LuminaLorebookEntry => ({
            comment: String(entry.uid),
            keysecondary: [],
            constant: false,
            selective: false,
            selectiveLogic: 0,
            disable: false,
            enabled: true,
            position: 0,
            depth: 0,
            order: 0,
            probability: 100,
            scan_depth: 0,
            ...entry
        });

        const result = engine.resolve([
            createEntry({
                uid: 'case-sensitive-miss',
                key: ['Castle'],
                content: 'Should not match lowercase castle.',
                caseSensitive: true
            }),
            createEntry({
                uid: 'whole-word',
                key: ['cat'],
                content: 'Should only match the standalone cat.',
                matchWholeWords: true,
                order: 1
            }),
            createEntry({
                uid: 'regex',
                key: ['c.stle'],
                content: 'Should match castle by regex.',
                useRegex: true,
                order: 2
            }),
            createEntry({
                uid: 'plain-escaped',
                key: ['c.stle'],
                content: 'Should not treat dot as wildcard without useRegex.',
                order: 3
            })
        ], {
            inputText: 'castle cathedral cat'
        });

        expect(result.entries.map((entry: any) => entry.uid)).toEqual(['whole-word', 'regex']);
        expect(result.trace).toEqual(expect.arrayContaining([
            expect.objectContaining({
                uid: 'whole-word',
                status: 'selected',
                matchedKeys: ['cat'],
                firstMatch: expect.objectContaining({
                    matchedKey: 'cat',
                    matchedKeyType: 'plain'
                })
            }),
            expect.objectContaining({
                uid: 'regex',
                status: 'selected',
                matchedKeys: ['c.stle'],
                firstMatch: expect.objectContaining({
                    matchedKey: 'c.stle',
                    matchedKeyType: 'regex'
                })
            }),
            expect.objectContaining({
                uid: 'case-sensitive-miss',
                status: 'skipped',
                reason: 'no-key-match'
            }),
            expect.objectContaining({
                uid: 'plain-escaped',
                status: 'skipped',
                reason: 'no-key-match'
            })
        ]));
    });

    it('applies worldbook probability with deterministic trace when random is injected', () => {
        const engine = new LuminaWorldbookTriggerEngine();
        const entries: LuminaLorebookEntry[] = [
            {
                uid: 'low-probability',
                comment: 'Low probability',
                key: ['castle'],
                keysecondary: [],
                content: 'Rare castle detail.',
                constant: false,
                selective: false,
                selectiveLogic: 0,
                disable: false,
                enabled: true,
                position: 0,
                depth: 0,
                order: 0,
                probability: 20,
                scan_depth: 0,
                useProbability: true
            },
            {
                uid: 'disabled-probability',
                comment: 'Disabled probability',
                key: ['castle'],
                keysecondary: [],
                content: 'Always castle detail.',
                constant: false,
                selective: false,
                selectiveLogic: 0,
                disable: false,
                enabled: true,
                position: 0,
                depth: 0,
                order: 1,
                probability: 0,
                scan_depth: 0,
                useProbability: false
            }
        ];

        const result = engine.resolve(entries, {
            inputText: 'castle',
            random: () => 0.5
        });

        expect(result.entries.map((entry: any) => entry.uid)).toEqual(['disabled-probability']);
        expect(result.trace).toContainEqual(expect.objectContaining({
            uid: 'low-probability',
            status: 'skipped',
            reason: 'probability',
            probability: 20,
            roll: 50
        }));
    });

    it('records skipped worldbook entries for disabled, empty, delayed, and unmatched states', () => {
        const engine = new LuminaWorldbookTriggerEngine();
        const base = {
            key: ['castle'],
            keysecondary: [] as string[],
            constant: false,
            selective: false,
            selectiveLogic: 0,
            position: 0,
            depth: 0,
            order: 0,
            probability: 100,
            scan_depth: 0
        };
        const entries: LuminaLorebookEntry[] = [
            {
                ...base,
                uid: 'disabled',
                comment: 'Disabled',
                content: 'Disabled content.',
                disable: true,
                enabled: true
            },
            {
                ...base,
                uid: 'empty',
                comment: 'Empty',
                content: '',
                disable: false,
                enabled: true
            },
            {
                ...base,
                uid: 'delayed',
                comment: 'Delayed',
                content: 'Delayed content.',
                disable: false,
                enabled: true,
                delayUntilRecursion: true
            },
            {
                ...base,
                uid: 'unmatched',
                comment: 'Unmatched',
                content: 'Unmatched content.',
                key: ['forest'],
                disable: false,
                enabled: true
            }
        ];

        const result = engine.resolve(entries, {
            inputText: 'castle',
            maxRecursivePasses: 1
        });

        expect(result.trace).toEqual(expect.arrayContaining([
            expect.objectContaining({ uid: 'disabled', status: 'skipped', reason: 'disabled' }),
            expect.objectContaining({ uid: 'empty', status: 'skipped', reason: 'empty-content' }),
            expect.objectContaining({ uid: 'delayed', status: 'skipped', reason: 'delay-until-recursion' }),
            expect.objectContaining({ uid: 'unmatched', status: 'skipped', reason: 'no-key-match' })
        ]));
        expect(result.entries).toEqual([]);
    });

    it('enforces a triggered entry budget and records placement data in trace', () => {
        const engine = new LuminaWorldbookTriggerEngine();
        const createEntry = (uid: string, order: number): LuminaLorebookEntry => ({
            uid,
            comment: uid,
            key: ['castle'],
            keysecondary: [],
            content: `${uid} content.`,
            constant: false,
            selective: false,
            selectiveLogic: 0,
            disable: false,
            enabled: true,
            position: 'before_char',
            depth: order,
            order,
            probability: 100,
            scan_depth: 0
        });

        const result = engine.resolve([
            createEntry('first', 1),
            createEntry('second', 2)
        ], {
            inputText: 'castle',
            maxTriggeredEntries: 1
        });

        expect(result.entries.map((entry: any) => entry.uid)).toEqual(['first']);
        expect(result.trace).toEqual(expect.arrayContaining([
            expect.objectContaining({
                uid: 'first',
                status: 'selected',
                position: 'before_char',
                depth: 1,
                order: 1
            }),
            expect.objectContaining({
                uid: 'second',
                status: 'skipped',
                reason: 'budget',
                budgetLimit: 1,
                budgetType: 'entry_count',
                budgetUsed: 1
            })
        ]));
    });

    it('enforces a worldbook token budget with an injectable estimator', () => {
        const engine = new LuminaWorldbookTriggerEngine();
        const createEntry = (uid: string, content: string, order: number): LuminaLorebookEntry => ({
            uid,
            comment: uid,
            key: ['castle'],
            keysecondary: [],
            content,
            constant: false,
            selective: false,
            selectiveLogic: 0,
            disable: false,
            enabled: true,
            position: 0,
            depth: 0,
            order,
            probability: 100,
            scan_depth: 0
        });

        const result = engine.resolve([
            createEntry('small', 'small lore', 0),
            createEntry('large', 'large lore that should exceed budget', 1)
        ], {
            inputText: 'castle',
            maxWorldbookTokens: 5,
            estimateTokens: (text: string) => text.startsWith('small') ? 3 : 4
        });

        expect(result.entries.map((entry: any) => entry.uid)).toEqual(['small']);
        expect(result.trace).toEqual(expect.arrayContaining([
            expect.objectContaining({
                uid: 'large',
                status: 'skipped',
                reason: 'budget',
                budgetLimit: 5,
                budgetType: 'token',
                budgetUsed: 3,
                budgetCost: 4
            })
        ]));
    });

    it('records recursive contribution and recursion limit diagnostics', () => {
        const engine = new LuminaWorldbookTriggerEngine();
        const entries: LuminaLorebookEntry[] = [
            {
                uid: 'seed',
                comment: 'Seed',
                key: ['seed'],
                keysecondary: [],
                content: 'bridge',
                constant: true,
                selective: false,
                selectiveLogic: 0,
                disable: false,
                enabled: true,
                position: 0,
                depth: 0,
                order: 0,
                probability: 100,
                scan_depth: 0
            },
            {
                uid: 'bridge',
                comment: 'Bridge',
                key: ['bridge'],
                keysecondary: [],
                content: 'final-key',
                constant: false,
                selective: false,
                selectiveLogic: 0,
                disable: false,
                enabled: true,
                position: 0,
                depth: 0,
                order: 1,
                probability: 100,
                scan_depth: 0,
                preventRecursion: true
            },
            {
                uid: 'final',
                comment: 'Final',
                key: ['final-key'],
                keysecondary: [],
                content: 'Final content.',
                constant: false,
                selective: false,
                selectiveLogic: 0,
                disable: false,
                enabled: true,
                position: 0,
                depth: 0,
                order: 2,
                probability: 100,
                scan_depth: 0
            }
        ];

        const result = engine.resolve(entries, {
            inputText: 'seed',
            maxRecursivePasses: 1
        });

        expect(result.entries.map((entry: any) => entry.uid)).toEqual(['seed', 'bridge']);
        expect(result.trace).toEqual(expect.arrayContaining([
            expect.objectContaining({
                uid: 'seed',
                recursiveContentIncluded: true
            }),
            expect.objectContaining({
                uid: 'bridge',
                recursiveContentIncluded: false,
                recursionBlockedBy: 'preventRecursion'
            })
        ]));
        expect(result.recursivePassesUsed).toBe(1);
        expect(result.recursionLimitReached).toBe(true);
        expect(result.diagnostics).toContainEqual(expect.objectContaining({
            code: 'LUMINA_WORLDBOOK_RECURSION_LIMIT_REACHED'
        }));
    });

    it('projects activated worldbook entries into prompt-consumable placement DTOs', () => {
        const engine = new LuminaWorldbookTriggerEngine();
        const resourceRef: ResourceRef = {
            sourceId: 'local',
            resourceType: 'worldbook',
            resourceId: 'castle-book',
            path: '/sources/local/worldbooks/castle-book',
            writable: true
        };
        const result = engine.resolve([
            {
                uid: 'assistant-entry',
                comment: 'Assistant Entry',
                key: ['castle'],
                keysecondary: [],
                content: 'Assistant-facing detail.',
                constant: false,
                selective: false,
                selectiveLogic: 0,
                disable: false,
                enabled: true,
                position: 'at_depth',
                role: 2,
                depth: 4,
                order: 7,
                probability: 100,
                scan_depth: 0,
                excludeRecursion: true,
                resourceRef,
                sourceId: 'local',
                resourceId: 'castle-book',
                sourcePath: '/sources/local/worldbooks/castle-book'
            }
        ], {
            messages: [{ role: 'user', content: 'The castle gate opens.' }],
            inputText: ''
        });

        expect(result.activatedEntries).toEqual([
            expect.objectContaining({
                uid: 'assistant-entry',
                comment: 'Assistant Entry',
                content: 'Assistant-facing detail.',
                role: 'assistant',
                position: 'at_depth',
                depth: 4,
                order: 7,
                reason: 'keyword',
                matchedKeys: ['castle'],
                recursiveContentIncluded: false,
                recursionBlockedBy: 'excludeRecursion',
                resourceRef,
                sourceId: 'local',
                resourceId: 'castle-book',
                sourcePath: '/sources/local/worldbooks/castle-book',
                insertion: {
                    position: 'at_depth',
                    depth: 4,
                    role: 'assistant',
                    outletName: undefined,
                    anchor: 'depth',
                    anchorPosition: undefined
                },
                firstMatch: expect.objectContaining({
                    messageIndexFromLatest: 0,
                    matchedKey: 'castle',
                    matchedKeyScope: 'primary',
                    matchedKeyType: 'plain'
                })
            })
        ]);
        expect(result.insertionBuckets.at_depth).toHaveLength(1);
        expect(result.trace).toContainEqual(expect.objectContaining({
            uid: 'assistant-entry',
            sourceId: 'local',
            sourcePath: '/sources/local/worldbooks/castle-book',
            firstMatch: expect.objectContaining({
                excerpt: 'The castle gate opens.'
            })
        }));
    });

    it('maps ST numeric example-message and outlet positions with outlet trace metadata', () => {
        const engine = new LuminaWorldbookTriggerEngine();
        const createEntry = (
            uid: string,
            position: number,
            extra: Partial<LuminaLorebookEntry> = {}
        ): LuminaLorebookEntry => ({
            uid,
            comment: uid,
            key: [uid],
            keysecondary: [],
            content: `${uid} detail.`,
            constant: false,
            selective: false,
            selectiveLogic: 0,
            disable: false,
            enabled: true,
            position,
            role: 0,
            depth: 0,
            order: 0,
            probability: 100,
            scan_depth: 0,
            ...extra
        });

        const result = engine.resolve([
            createEntry('before-example', 5),
            createEntry('after-example', 6),
            createEntry('named-outlet', 7, {
                outlet_name: 'status-panel'
            })
        ], {
            inputText: 'before-example after-example named-outlet'
        });

        expect(result.insertionBuckets.em_top[0].insertion).toMatchObject({
            position: 'em_top',
            anchor: 'example_messages',
            anchorPosition: 'before'
        });
        expect(result.insertionBuckets.em_bottom[0].insertion).toMatchObject({
            position: 'em_bottom',
            anchor: 'example_messages',
            anchorPosition: 'after'
        });
        expect(result.insertionBuckets.outlet[0].insertion).toMatchObject({
            position: 'outlet',
            anchor: 'outlet',
            outletName: 'status-panel'
        });
    });
});
