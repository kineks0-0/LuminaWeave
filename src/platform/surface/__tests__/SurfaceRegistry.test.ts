import { defineComponent } from 'vue';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { OFFICIAL_SURFACE_INPUT_SCHEMAS } from '../officialContracts.js';
import { SurfaceRegistry } from '../SurfaceRegistry.js';
import type {
    EmptySurfaceRendererDefinition,
    SurfaceContractDefinitionUnion,
    SurfaceRendererDefinition
} from '../types.js';

const createRenderer = (
    ownerId: string,
    kind: SurfaceRendererDefinition<'chat.preview'>['kind'],
    variant?: string
): SurfaceRendererDefinition<'chat.preview'> => ({
    contractId: 'chat.preview',
    component: defineComponent({ name: `${ownerId}Renderer`, template: '<div />' }),
    ownerId,
    kind,
    variant
});

const createEmptyRenderer = (ownerId: string): EmptySurfaceRendererDefinition => ({
    contractId: '__empty__',
    component: defineComponent({ name: `${ownerId}Renderer`, template: '<div />' }),
    ownerId,
    kind: 'empty'
});

const registerContract = (
    registry: SurfaceRegistry,
    contractId: 'chat.preview' | 'settings.root'
): void => {
    registry.registerContract({
        id: contractId,
        inputSchema: OFFICIAL_SURFACE_INPUT_SCHEMAS[contractId]
    });
};

describe('SurfaceRegistry', () => {
    it('resolves desktop override before plugin business and core default renderers', () => {
        const registry = new SurfaceRegistry();
        registerContract(registry, 'chat.preview');
        registry.registerDefaultRenderer(createRenderer('core', 'core-default'));
        registry.registerBusinessRenderer(createRenderer('lumina-chat', 'plugin-business'));
        registry.registerDesktopOverride('telegram', createRenderer('telegram', 'desktop-override'));

        const resolved = registry.resolve({
            contractId: 'chat.preview',
            desktopModeId: 'telegram'
        });

        expect(resolved.source).toBe('desktop-override');
        expect(resolved.renderer.ownerId).toBe('telegram');
    });

    it('falls back to plugin business renderer before core default renderer', () => {
        const registry = new SurfaceRegistry();
        registerContract(registry, 'chat.preview');
        registry.registerDefaultRenderer(createRenderer('core', 'core-default'));
        registry.registerBusinessRenderer(createRenderer('lumina-chat', 'plugin-business'));

        const resolved = registry.resolve({
            contractId: 'chat.preview',
            desktopModeId: 'classic'
        });

        expect(resolved.source).toBe('plugin-business');
        expect(resolved.renderer.ownerId).toBe('lumina-chat');
    });

    it('falls back to core default renderer when no desktop or plugin renderer exists', () => {
        const registry = new SurfaceRegistry();
        registerContract(registry, 'chat.preview');
        registry.registerDefaultRenderer(createRenderer('core', 'core-default'));

        const resolved = registry.resolve({
            contractId: 'chat.preview',
            desktopModeId: 'classic'
        });

        expect(resolved.source).toBe('core-default');
        expect(resolved.renderer.ownerId).toBe('core');
    });

    it('uses an empty renderer for missing surfaces when one is registered', () => {
        const registry = new SurfaceRegistry();
        registerContract(registry, 'settings.root');
        registry.registerEmptyRenderer(createEmptyRenderer('core-empty'));

        const resolved = registry.resolve({
            contractId: 'settings.root',
            desktopModeId: 'stage'
        });

        expect(resolved.source).toBe('empty');
        expect(resolved.renderer.contractId).toBe('settings.root');
        expect(resolved.renderer.ownerId).toBe('core-empty');
    });

    it('selects the requested renderer variant when one is available', () => {
        const registry = new SurfaceRegistry();
        registerContract(registry, 'chat.preview');
        registry.registerBusinessRenderer(createRenderer('lumina-chat', 'plugin-business'));
        registry.registerBusinessRenderer(createRenderer('lumina-chat-compact', 'plugin-business', 'compact'));

        const resolved = registry.resolve({
            contractId: 'chat.preview',
            desktopModeId: 'classic',
            preferredVariant: 'compact'
        });

        expect(resolved.source).toBe('plugin-business');
        expect(resolved.renderer.ownerId).toBe('lumina-chat-compact');
    });

    it('rejects duplicate renderers for the same contract and variant', () => {
        const registry = new SurfaceRegistry();
        registerContract(registry, 'chat.preview');
        registry.registerBusinessRenderer(createRenderer('lumina-chat', 'plugin-business'));

        expect(() => registry.registerBusinessRenderer(createRenderer('other-chat', 'plugin-business'))).toThrow(
            /Duplicate plugin business renderer/
        );
    });

    it('allows official empty contracts to be enriched by their owning plugin', () => {
        const registry = new SurfaceRegistry();
        registerContract(registry, 'chat.preview');

        expect(() => registry.registerContract({
            id: 'chat.preview',
            ownerPluginId: 'lumina-chat',
            description: 'Chat preview'
        })).not.toThrow();

        expect(registry.getContract('chat.preview')?.ownerPluginId).toBe('lumina-chat');
    });

    it('parses contract input with the registered Zod schema', () => {
        const registry = new SurfaceRegistry();
        registry.registerContract({
            id: 'chat.main',
            inputSchema: z.object({
                isMobile: z.boolean().optional()
            }).strict()
        });

        expect(registry.parseInput('chat.main', { isMobile: true })).toEqual({ isMobile: true });
        expect(() => registry.parseInput('chat.main', { isMobile: 'true' })).toThrow(
            /Invalid input for surface contract/
        );
    });

    it('rejects unknown contracts even when an empty renderer exists', () => {
        const registry = new SurfaceRegistry();
        registry.registerEmptyRenderer(createEmptyRenderer('core-empty'));

        expect(() => registry.resolve({
            contractId: 'settings.root',
            desktopModeId: 'classic'
        })).toThrow(/Unknown surface contract/);
    });

    it('identifies registered contract ids without inferring unknown strings', () => {
        const registry = new SurfaceRegistry();
        registerContract(registry, 'chat.preview');

        expect(registry.hasContract('chat.preview')).toBe(true);
        expect(registry.hasContract('unregistered.surface')).toBe(false);
    });

    it('rejects duplicate owned contract registrations', () => {
        const registry = new SurfaceRegistry();
        registry.registerContract({
            id: 'chat.preview',
            ownerPluginId: 'lumina-chat',
            inputSchema: z.object({}).strict()
        });

        expect(() => registry.registerContract({
            id: 'chat.preview',
            ownerPluginId: 'lumina-chat',
            inputSchema: z.object({}).strict()
        })).toThrow(/Duplicate surface contract registration/);
    });

    it('rejects renderer registrations with an empty owner id', () => {
        const registry = new SurfaceRegistry();
        registerContract(registry, 'chat.preview');

        expect(() => registry.registerBusinessRenderer(createRenderer('', 'plugin-business'))).toThrow(
            /Invalid surface renderer registration/
        );
    });

    it('rejects renderer registrations that target an unavailable contract', () => {
        const registry = new SurfaceRegistry();

        expect(() => registry.registerBusinessRenderer(
            createRenderer('lumina-chat', 'plugin-business')
        )).toThrow(/Renderer target contract is unavailable/);
    });

    it('rejects an embedded renderer whose contract id differs from its contract', () => {
        const registry = new SurfaceRegistry();
        const malformedContract = {
            id: 'settings.root',
            inputSchema: OFFICIAL_SURFACE_INPUT_SCHEMAS['settings.root'],
            businessRenderer: createRenderer('lumina-settings', 'plugin-business')
        } as unknown as SurfaceContractDefinitionUnion;

        expect(() => registry.registerContract(malformedContract)).toThrow(
            /Embedded renderer contract mismatch/
        );
        expect(registry.hasContract('settings.root')).toBe(false);
    });

    it('rejects a second unowned contract instead of silently overwriting its schema', () => {
        const registry = new SurfaceRegistry();
        registerContract(registry, 'chat.preview');

        expect(() => registerContract(registry, 'chat.preview')).toThrow(
            /Duplicate surface contract registration/
        );
    });
});
