import { defineComponent } from 'vue';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { SurfaceRegistry } from '../SurfaceRegistry.js';
import type { EmptySurfaceData, SurfaceContractSpec, SurfaceRendererDefinition } from '../types.js';

declare module '../types.js' {
    interface SurfaceContractMap {
        'test.dependents.main': SurfaceContractSpec<EmptySurfaceData>;
        'ns:test.dependents.main': SurfaceContractSpec<EmptySurfaceData>;
    }
}

const Stub = defineComponent({ name: 'DependentsStub', render: () => null });
type RendererKind = 'plugin-business' | 'core-default' | 'desktop-override';

const renderer = (ownerId: string, kind: RendererKind = 'plugin-business'): SurfaceRendererDefinition<'test.dependents.main'> => ({
    contractId: 'test.dependents.main',
    component: Stub,
    ownerId,
    kind
});

const nsRenderer = (ownerId: string, kind: RendererKind): SurfaceRendererDefinition<'ns:test.dependents.main'> => ({
    contractId: 'ns:test.dependents.main',
    component: Stub,
    ownerId,
    kind
});

const setup = () => {
    const registry = new SurfaceRegistry();
    registry.registerBatch({
        contracts: [{ id: 'test.dependents.main', ownerPluginId: 'a', inputSchema: z.object({}).strict() }]
    });
    return registry;
};

describe('SurfaceRegistry.findForeignDependents', () => {
    it('ignores renderers owned by the contract owner itself', () => {
        const registry = setup();
        registry.registerBatch({
            businessRenderers: [renderer('a')],
            defaultRenderers: [renderer('a', 'core-default')]
        });
        expect(registry.findForeignDependents('a')).toEqual([]);
    });

    it('reports business, fallback and desktop-override renderers from other owners', () => {
        const registry = setup();
        registry.registerBatch({
            businessRenderers: [renderer('b')],
            defaultRenderers: [renderer('c', 'core-default')]
        });
        // 模式没有 owner（内置或门面注册）时视为外部依赖
        registry.registerDesktopOverrides('mode-x', [renderer('d', 'desktop-override')]);

        expect(registry.findForeignDependents('a')).toEqual([
            { contractId: 'test.dependents.main', kind: 'business', ownerPluginId: 'b' },
            { contractId: 'test.dependents.main', kind: 'fallback', ownerPluginId: 'c' },
            { contractId: 'test.dependents.main', kind: 'desktop-override', modeId: 'mode-x' }
        ]);
    });

    it('stops reporting a dependent after it is disposed', () => {
        const registry = setup();
        const dispose = registry.registerBatch({ businessRenderers: [renderer('b')] });
        expect(registry.findForeignDependents('a')).toHaveLength(1);
        dispose();
        expect(registry.findForeignDependents('a')).toEqual([]);
    });

    it('does not report anything for plugins that own no contract', () => {
        expect(setup().findForeignDependents('nobody')).toEqual([]);
    });

    it('judges override ownership by the mode owner, not by the renderer ownerId', () => {
        const registry = setup();
        // renderer.ownerId 由插件自己填写，不可信：即使写成 'a'，非 a 拥有的模式仍是外部依赖
        registry.registerDesktopOverrides('mode-own', [renderer('x', 'desktop-override')], 'a');
        registry.registerDesktopOverrides('mode-foreign', [renderer('a', 'desktop-override')], 'b');
        registry.registerDesktopOverrides('mode-unowned', [renderer('a', 'desktop-override')]);

        expect(registry.findForeignDependents('a')).toEqual([
            { contractId: 'test.dependents.main', kind: 'desktop-override', modeId: 'mode-foreign' },
            { contractId: 'test.dependents.main', kind: 'desktop-override', modeId: 'mode-unowned' }
        ]);
    });

    it('keeps the override index correct after dispose, with colons in mode and contract ids', () => {
        const registry = setup();
        registry.registerBatch({
            contracts: [{ id: 'ns:test.dependents.main', ownerPluginId: 'c', inputSchema: z.object({}).strict() }]
        });
        const disposeColonMode = registry.registerDesktopOverrides(
            'm:1',
            [nsRenderer('z', 'desktop-override')]
        );

        // 'm:1:ns:test.dependents.main' 以 ':test.dependents.main' 结尾，但它不是 a 的 contract
        expect(registry.findForeignDependents('a')).toEqual([]);
        expect(registry.findForeignDependents('c')).toEqual([
            { contractId: 'ns:test.dependents.main', kind: 'desktop-override', modeId: 'm:1' }
        ]);

        disposeColonMode();
        expect(registry.findForeignDependents('c')).toEqual([]);
    });
});
