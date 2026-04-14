import { describe, it, expect, beforeEach } from 'vitest';
import { WorldlineStore, WorldlineEvent } from '../WorldlineStore';

describe('WorldlineStore', () => {
    let store: WorldlineStore;

    beforeEach(() => {
        store = new WorldlineStore();
    });

    it('should manage activeLeafId and emit events', () => {
        let eventId: string | null = null;
        store.on(WorldlineEvent.SWITCHED, (id: any) => eventId = id);

        store.activeLeafId = 'node_1';
        expect(store.activeLeafId).toBe('node_1');
        expect(eventId).toBe('node_1');
    });

    it('should build trace correctly', () => {
        const n1 = { id: '1', parentId: null, mesRaw: '1' } as any;
        const n2 = { id: '2', parentId: '1', mesRaw: '2' } as any;
        const n3 = { id: '3', parentId: '2', mesRaw: '3' } as any;
        
        store.setNodes([n1, n2, n3]);
        
        const trace = store.getTrace('3');
        expect(trace.map(n => n.id)).toEqual(['1', '2', '3']);
    });

    it('should handle syncStatus and source correctly', () => {
        const n1 = { id: 'local_1', mesRaw: 'hello' } as any;
        store.upsertNode(n1); // Default is local
        expect(store.getNode('local_1')?.syncStatus).toBe('local');

        const n2 = { id: 'backend_1', mesRaw: 'hi' } as any;
        store.upsertNode(n2, { source: 'backend' });
        expect(store.getNode('backend_1')?.syncStatus).toBe('synced');

        store.setNodes([{ id: 'loaded_1', mesRaw: 'loaded' } as any]);
        expect(store.getNode('loaded_1')?.syncStatus).toBe('synced');
    });

    it('should remove subtree (incremental prune) correctly', () => {
        // Tree: 1 -> 2 -> 3
        //            \ -> 4
        const n1 = { id: '1', parentId: null } as any;
        const n2 = { id: '2', parentId: '1' } as any;
        const n3 = { id: '3', parentId: '2' } as any;
        const n4 = { id: '4', parentId: '2' } as any;
        
        store.setNodes([n1, n2, n3, n4]);
        
        // Remove from 2 (removes 3 and 4)
        store.removeSubtree('2');
        
        expect(store.hasNode('1')).toBe(true);
        expect(store.hasNode('2')).toBe(true);
        expect(store.hasNode('3')).toBe(false);
        expect(store.hasNode('4')).toBe(false);
    });
});
