import { defineComponent } from 'vue';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { SurfaceRegistry } from '../SurfaceRegistry.js';
import type { EmptySurfaceData, SurfaceContractSpec, SurfaceRendererDefinition } from '../types.js';

declare module '../types.js' {
    interface SurfaceContractMap {
        'test.disposal.owned': SurfaceContractSpec<EmptySurfaceData>;
        'test.disposal.enriched': SurfaceContractSpec<EmptySurfaceData>;
    }
}

const Stub = defineComponent({ name: 'DisposalStub', render: () => null });

const renderer = <K extends 'test.disposal.owned' | 'test.disposal.enriched'>(
    contractId: K,
    ownerId: string,
    variant?: string
): SurfaceRendererDefinition<K> => ({
    contractId,
    component: Stub,
    ownerId,
    kind: 'plugin-business',
    ...(variant ? { variant } : {})
});

describe('SurfaceRegistry registration disposal', () => {
    it('removes contracts and renderers added by a batch', () => {
        const registry = new SurfaceRegistry();
        const dispose = registry.registerBatch({
            contracts: [{
                id: 'test.disposal.owned',
                ownerPluginId: 'owner',
                inputSchema: z.object({}).strict(),
                defaultRenderer: renderer('test.disposal.owned', 'owner')
            }],
            businessRenderers: [renderer('test.disposal.owned', 'owner')]
        });
        expect(registry.resolve({ contractId: 'test.disposal.owned', desktopModeId: 'classic' }).source)
            .toBe('plugin-business');

        dispose();
        dispose();

        expect(registry.hasContract('test.disposal.owned')).toBe(false);
        expect(registry.listRenderers('core-default')).toEqual([]);
        expect(registry.listRenderers('plugin-business')).toEqual([]);
    });

    it('restores an enriched unowned contract to its previous definition', () => {
        const registry = new SurfaceRegistry();
        registry.registerContract({ id: 'test.disposal.enriched', inputSchema: z.object({}).strict() });
        const previous = registry.getContract('test.disposal.enriched');

        const dispose = registry.registerBatch({
            contracts: [{ id: 'test.disposal.enriched', ownerPluginId: 'owner' }],
            businessRenderers: [renderer('test.disposal.enriched', 'owner')]
        });
        expect(registry.getContract('test.disposal.enriched')?.ownerPluginId).toBe('owner');

        dispose();

        expect(registry.getContract('test.disposal.enriched')).toBe(previous);
        expect(registry.listRenderers('plugin-business')).toEqual([]);
    });

    it('only removes the renderers its own batch appended', () => {
        const registry = new SurfaceRegistry();
        registry.registerContract({ id: 'test.disposal.enriched', inputSchema: z.object({}).strict() });
        const disposeFirst = registry.registerBatch({
            businessRenderers: [renderer('test.disposal.enriched', 'first', 'a')]
        });
        registry.registerBatch({
            businessRenderers: [renderer('test.disposal.enriched', 'second', 'b')]
        });

        disposeFirst();

        expect(registry.listRenderers('plugin-business').map(entry => entry.ownerId)).toEqual(['second']);
    });
});
