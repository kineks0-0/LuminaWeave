import { computed, defineComponent } from 'vue';
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

    describe('reactive version', () => {
        const contract = {
            id: 'test.disposal.owned' as const,
            ownerPluginId: 'owner',
            inputSchema: z.object({}).strict()
        };

        it('bumps on batch registration and on its disposer', () => {
            const registry = new SurfaceRegistry();
            const start = registry.version;

            const dispose = registry.registerBatch({ contracts: [contract] });
            expect(registry.version).toBe(start + 1);

            dispose();
            expect(registry.version).toBe(start + 2);
        });

        it('bumps on desktop overrides and removes them by reference in the disposer', () => {
            const registry = new SurfaceRegistry();
            registry.registerContract(contract);
            const start = registry.version;
            const override = renderer('test.disposal.owned', 'owner');

            const dispose = registry.registerDesktopOverrides('mode-a', [override]);
            expect(registry.version).toBe(start + 1);
            expect(registry.resolve({ contractId: 'test.disposal.owned', desktopModeId: 'mode-a' }).source)
                .toBe('desktop-override');

            dispose();
            dispose();
            expect(registry.version).toBe(start + 2);
            expect(() => registry.resolve({ contractId: 'test.disposal.owned', desktopModeId: 'mode-a' }))
                .toThrow();
        });

        it('keeps other overrides of the same mode when one disposer runs', () => {
            const registry = new SurfaceRegistry();
            registry.registerContract(contract);
            const disposeFirst = registry.registerDesktopOverrides('mode-a', [renderer('test.disposal.owned', 'one', 'v1')]);
            registry.registerDesktopOverrides('mode-a', [renderer('test.disposal.owned', 'two', 'v2')]);

            disposeFirst();

            expect(registry.resolve({
                contractId: 'test.disposal.owned',
                desktopModeId: 'mode-a',
                preferredVariant: 'v2'
            }).renderer.ownerId).toBe('two');
        });

        it('bumps when an empty renderer is registered', () => {
            const registry = new SurfaceRegistry();
            const start = registry.version;

            registry.registerEmptyRenderer({ contractId: '__empty__', component: Stub, ownerId: 'owner', kind: 'empty' });

            expect(registry.version).toBe(start + 1);
        });

        it('invalidates computed values that read the version', () => {
            const registry = new SurfaceRegistry();
            const hasContract = computed(() => registry.version >= 0 && registry.hasContract('test.disposal.owned'));
            expect(hasContract.value).toBe(false);

            const dispose = registry.registerBatch({ contracts: [contract] });
            expect(hasContract.value).toBe(true);

            dispose();
            expect(hasContract.value).toBe(false);
        });
    });
});
