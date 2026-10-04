import { describe, expect, it, vi } from 'vitest';
import type { LuminaChatMessage } from '@shared/LuminaMessage.js';
import { TimelineManager } from '../../storage/TimelineManager.js';
import { WorldlineStore } from '../../storage/WorldlineStore.js';

const buildNode = (overrides: Partial<LuminaChatMessage> & Pick<LuminaChatMessage, 'id' | 'parentId'>): LuminaChatMessage => ({
    mes: '',
    mesRaw: '',
    role: 'user',
    is_user: true,
    extra: {},
    ...overrides
} as LuminaChatMessage);

const createManager = () => {
    const store = new WorldlineStore();
    const manager = new TimelineManager({ chatManager: { store } } as never);
    return { store, manager };
};

describe('TimelineManager', () => {
    it('maps a worldline trace into UI nodes with text, timestamp and original reference', () => {
        const { store, manager } = createManager();
        const first = buildNode({ id: 'a', parentId: null, mesRaw: 'first', extra: { send_date: 100 } });
        const second = buildNode({ id: 'b', parentId: 'a', mes: 'second', extra: { send_date: 200 } });
        store.setNodes([first, second]);

        const trace = manager.getTrace('b');

        expect(trace.map(node => node.id)).toEqual(['a', 'b']);
        expect(trace[0].text).toBe('first');
        expect(trace[0].timestamp).toBe(100);
        expect(trace[0]._original).toBe(first);
        expect(trace[1].text).toBe('second');
    });

    it('emits TIMELINE_UPDATED with the full graph and active leaf on refresh', async () => {
        const { store, manager } = createManager();
        store.setNodes([
            buildNode({ id: 'a', parentId: null, mesRaw: 'first' }),
            buildNode({ id: 'b', parentId: 'a', mesRaw: 'second' })
        ]);
        store.activeLeafId = 'b';
        const listener = vi.fn();
        manager.on('TIMELINE_UPDATED', listener);

        await manager.refreshCurrentChatTimeline();

        expect(listener).toHaveBeenCalledTimes(1);
        const payload = listener.mock.calls[0][0] as { graph: Record<string, { text: string }>; activeId: string | null };
        expect(Object.keys(payload.graph).sort()).toEqual(['a', 'b']);
        expect(payload.graph.a.text).toBe('first');
        expect(payload.activeId).toBe('b');
        expect(manager.isSyncing).toBe(false);
    });

    it('refreshes automatically when the worldline store updates or switches', async () => {
        const { store, manager } = createManager();
        store.setNodes([buildNode({ id: 'a', parentId: null, mesRaw: 'first' })]);
        store.activeLeafId = 'a';
        const listener = vi.fn();
        manager.on('TIMELINE_UPDATED', listener);

        store.emit('WORLDLINE_UPDATED');
        await new Promise(resolve => setTimeout(resolve, 0));
        store.emit('WORLDLINE_SWITCHED');
        await new Promise(resolve => setTimeout(resolve, 0));

        expect(listener).toHaveBeenCalledTimes(2);
    });

    it('generates stable fingerprints from message content', () => {
        const { manager } = createManager();

        const [first, second, other] = manager.generateStableIds([
            buildNode({ id: 'a', parentId: null, mesRaw: 'same' }),
            buildNode({ id: 'b', parentId: 'a', mesRaw: 'same' }),
            buildNode({ id: 'c', parentId: 'b', mesRaw: 'different' })
        ]);

        expect(first).toBe(second);
        expect(first).not.toBe(other);
        expect(first.startsWith('fp_')).toBe(true);
    });
});
