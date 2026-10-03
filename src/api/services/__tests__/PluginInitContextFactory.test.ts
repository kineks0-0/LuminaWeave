import { describe, expect, it, vi } from 'vitest';
import type { Component } from 'vue';
import { PluginRegistrationScope } from '../../../platform/plugin/PluginRegistrationScope.js';
import { PromptSlot, type PromptFragment } from '../../core/hal/prompt/PromptRegistry.js';
import type { PluginMemoryProvider } from '../../../platform/plugin/PluginInitContext.js';
import { createPluginInitContext, type PluginInitContextDeps } from '../PluginInitContextFactory.js';
import type { RegisteredPanelEntry } from '../DesktopSurfaceService.js';

const createDeps = () => {
    const calls: string[] = [];
    const definitions = new Set<string>();
    const deps = {
        promptRegistry: {
            register: vi.fn((fragment: PromptFragment) => { calls.push(`prompt+${fragment.id}`); }),
            unregisterIfCurrent: vi.fn((fragment: PromptFragment) => { calls.push(`prompt-${fragment.id}`); })
        },
        xmlInterceptor: {
            registerXMLParser: vi.fn((tag: string, _l: string, _h: unknown, sourceId?: string) => {
                calls.push(`xml+${tag}@${sourceId}`);
                definitions.add(tag);
                return () => { calls.push(`xml-${tag}`); };
            }),
            registerPatternParser: vi.fn((regex: RegExp) => {
                calls.push(`pattern+${regex.source}`);
                return () => { calls.push(`pattern-${regex.source}`); };
            })
        },
        xmlTagRegistry: {
            resolveCanonical: vi.fn((tag: string) => tag),
            getDefinition: vi.fn((tag: string) => definitions.has(tag) ? { tag } : undefined),
            unregister: vi.fn((sourceId: string, tag?: string) => { calls.push(`def-${tag}@${sourceId}`); })
        },
        memoryManager: {
            registerProvider: vi.fn((provider: PluginMemoryProvider) => { calls.push(`mem+${provider.id}`); }),
            unregisterProvider: vi.fn((provider: PluginMemoryProvider) => { calls.push(`mem-${provider.id}`); })
        },
        desktopSurface: {
            registerPanel: vi.fn((id: string, component: Component, config: RegisteredPanelEntry['config']): RegisteredPanelEntry => {
                calls.push(`panel+${id}`);
                return { id, component, config };
            }),
            unregisterPanel: vi.fn((id: string) => { calls.push(`panel-${id}`); }),
            registerDesktopMode: vi.fn((manifest: { id: string }) => {
                calls.push(`mode+${manifest.id}`);
                return () => { calls.push(`mode-${manifest.id}`); };
            })
        },
        events: {
            on: vi.fn((event: string) => { calls.push(`on+${event}`); }),
            off: vi.fn((event: string) => { calls.push(`on-${event}`); })
        }
    };
    return { deps: deps as unknown as PluginInitContextDeps & typeof deps, calls, definitions };
};

const fragment: PromptFragment = { id: 'frag', slot: PromptSlot.ST_MAIN, priority: 1, getFragment: () => null };
const provider: PluginMemoryProvider = { id: 'prov', exportSnapshot: () => null, importSnapshot: () => {}, reset: () => {} };
const Panel = { name: 'Panel' } as Component;

describe('createPluginInitContext', () => {
    it('registers into every registry and revokes in LIFO order on scope.dispose', () => {
        const { deps, calls } = createDeps();
        const scope = new PluginRegistrationScope('p1');
        const listener = vi.fn();
        const context = createPluginInitContext('p1', scope, deps);

        expect(context.pluginId).toBe('p1');
        context.prompts.register(fragment);
        context.xml.registerParser('Tag', 'persistent', () => '');
        context.xml.registerPatternParser(/abc/g, 'persistent', () => '');
        context.memory.registerProvider(provider);
        context.panels.register('panel', Panel, { title: 'P' });
        context.events.on('EVT', listener);
        context.onDispose(() => calls.push('custom'));
        expect(calls).toEqual([
            'prompt+frag', 'xml+Tag@plugin:p1', 'pattern+abc', 'mem+prov', 'panel+panel', 'on+EVT'
        ]);
        calls.length = 0;

        scope.dispose();

        expect(calls).toEqual([
            'custom', 'on-EVT', 'panel-panel', 'mem-prov', 'pattern-abc', 'xml-Tag', 'def-Tag@plugin:p1', 'prompt-frag'
        ]);
        expect(deps.promptRegistry.unregisterIfCurrent).toHaveBeenCalledWith(fragment);
    });

    it('uses plugin:<pluginId> as xml sourceId', () => {
        const { deps, calls } = createDeps();
        const context = createPluginInitContext('my-plugin', new PluginRegistrationScope('my-plugin'), deps);
        context.xml.registerParser('Tag', 'ephemeral', () => '');
        expect(calls).toContain('xml+Tag@plugin:my-plugin');
    });

    it('reclaims an auto-added definition only after the last handler of the same tag is revoked', () => {
        const { deps } = createDeps();
        const scope = new PluginRegistrationScope('p1');
        const context = createPluginInitContext('p1', scope, deps);
        const first = context.xml.registerParser('Tag', 'persistent', () => '');
        const second = context.xml.registerParser('Tag', 'persistent', () => '');

        first();
        expect(deps.xmlTagRegistry.unregister).not.toHaveBeenCalled();

        second();
        expect(deps.xmlTagRegistry.unregister).toHaveBeenCalledTimes(1);
        expect(deps.xmlTagRegistry.unregister).toHaveBeenCalledWith('plugin:p1', 'Tag');
    });

    it('does not reclaim a tag definition that already existed', () => {
        const { deps, definitions } = createDeps();
        definitions.add('Existing');
        const scope = new PluginRegistrationScope('p1');
        const context = createPluginInitContext('p1', scope, deps);
        context.xml.registerParser('Existing', 'persistent', () => '');

        scope.dispose();

        expect(deps.xmlTagRegistry.unregister).not.toHaveBeenCalled();
    });

    it('passes the same listener reference to off', () => {
        const { deps } = createDeps();
        const scope = new PluginRegistrationScope('p1');
        const listener = vi.fn();
        createPluginInitContext('p1', scope, deps).events.on('EVT', listener);

        scope.dispose();

        expect(deps.events.off).toHaveBeenCalledWith('EVT', listener);
    });

    it('revokes immediately when the scope is already disposed', () => {
        const { deps, calls } = createDeps();
        const scope = new PluginRegistrationScope('p1');
        const context = createPluginInitContext('p1', scope, deps);
        scope.dispose();

        context.memory.registerProvider(provider);

        expect(calls).toEqual(['mem+prov', 'mem-prov']);
    });

    it('runs a manually invoked disposer only once even when the scope disposes later', () => {
        const { deps } = createDeps();
        const scope = new PluginRegistrationScope('p1');
        const dispose = createPluginInitContext('p1', scope, deps).memory.registerProvider(provider);

        dispose();
        scope.dispose();

        expect(deps.memoryManager.unregisterProvider).toHaveBeenCalledTimes(1);
    });

    it('registers desktop modes into the scope and revokes them on dispose', () => {
        const { deps, calls } = createDeps();
        const scope = new PluginRegistrationScope('p-mode');
        const context = createPluginInitContext('p-mode', scope, deps);

        context.desktopModes.register({ id: 'ctx-mode' } as never);
        expect(calls).toEqual(['mode+ctx-mode']);

        scope.dispose();
        expect(calls).toEqual(['mode+ctx-mode', 'mode-ctx-mode']);
    });
});
