import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MemoryManager } from '@/api/core/runtime-utils/MemoryManager.js';

describe('MemoryManager Core Logic', () => {
    let manager: MemoryManager;

    beforeEach(() => {
        manager = new MemoryManager();
    });

    it('should correctly register multiple providers with unique IDs', () => {
        const p1 = { id: 'tier1', exportSnapshot: vi.fn(), importSnapshot: vi.fn(), reset: vi.fn() };
        const p2 = { id: 'director', exportSnapshot: vi.fn(), importSnapshot: vi.fn(), reset: vi.fn() };
        
        manager.registerProvider(p1);
        manager.registerProvider(p2);

        // Access private providers map for verification (using any casting)
        const providers = (manager as any).providers;
        expect(providers.size).toBe(2);
        expect(providers.get('tier1')).toBe(p1);
        expect(providers.get('director')).toBe(p2);
    });

    it('should overwrite provider if ID is the same (or undefined)', () => {
        const p1 = { id: 'test', exportSnapshot: vi.fn(), importSnapshot: vi.fn(), reset: vi.fn() };
        const p2 = { id: 'test', exportSnapshot: vi.fn(), importSnapshot: vi.fn(), reset: vi.fn() };
        
        manager.registerProvider(p1);
        manager.registerProvider(p2);

        const providers = (manager as any).providers;
        expect(providers.size).toBe(1);
        expect(providers.get('test')).toBe(p2);
    });

    it('should capture state into msg.extra', () => {
        const p1 = { 
            id: 'tier1', 
            exportSnapshot: vi.fn().mockReturnValue({ data: 123 }), 
            importSnapshot: vi.fn(), 
            reset: vi.fn() 
        };
        manager.registerProvider(p1);

        const msg: any = { id: 'msg1', extra: {} };
        const trace: any[] = []; // depth 0 should trigger snapshot
        
        manager.captureState(msg, trace, true); // 强制执行快照以进行测试

        expect(msg.extra.tier1_snapshot).toEqual({ data: 123 });
    });
});

describe('MemoryManager.unregisterProvider', () => {
    const createProvider = (id: string) => ({ id, exportSnapshot: vi.fn(), importSnapshot: vi.fn(), reset: vi.fn() });

    it('removes the provider only when the registered object is the same reference', () => {
        const manager = new MemoryManager();
        const first = createProvider('same-id');
        const second = createProvider('same-id');
        manager.registerProvider(first);
        manager.registerProvider(second);

        manager.unregisterProvider(first);
        manager.resetAll();
        expect(second.reset).toHaveBeenCalledTimes(1);

        manager.unregisterProvider(second);
        manager.resetAll();
        expect(second.reset).toHaveBeenCalledTimes(1);
    });
});

describe('MemoryManager.restoreProvider / restoreState', () => {
    const createIncremental = (id: string) => ({
        id,
        exportSnapshot: vi.fn(),
        importSnapshot: vi.fn(),
        reset: vi.fn(),
        flushDeltas: vi.fn(() => []),
        applyDelta: vi.fn()
    });
    const node = (id: string, extra: Record<string, unknown> = {}) => ({ id, extra }) as never;

    it('restoreProvider resets, loads the latest own snapshot and replays later deltas for that provider only', () => {
        const manager = new MemoryManager();
        const target = createIncremental('target');
        const other = createIncremental('other');
        manager.registerProvider(target);
        manager.registerProvider(other);

        manager.restoreProvider(target, [
            node('a', { target_snapshot: { v: 1 }, other_snapshot: { v: 9 } }),
            node('b', { target_delta: ['d1'], other_delta: ['x'] }),
            node('c', { target_delta: ['d2'] })
        ]);

        expect(target.reset).toHaveBeenCalledTimes(1);
        expect(target.importSnapshot).toHaveBeenCalledWith({ v: 1 });
        expect(target.applyDelta.mock.calls).toEqual([['d1'], ['d2']]);
        expect(other.reset).not.toHaveBeenCalled();
        expect(other.importSnapshot).not.toHaveBeenCalled();
        expect(other.applyDelta).not.toHaveBeenCalled();
    });

    it('restoreProvider replays every delta from the start when the provider has no snapshot', () => {
        const manager = new MemoryManager();
        const target = createIncremental('target');
        manager.restoreProvider(target, [node('a', { target_delta: ['d1'] }), node('b', { target_delta: ['d2'] })]);

        expect(target.importSnapshot).not.toHaveBeenCalled();
        expect(target.applyDelta.mock.calls).toEqual([['d1'], ['d2']]);
    });

    it('restoreState keeps its original semantics across all registered providers', () => {
        const manager = new MemoryManager();
        const first = createIncremental('first');
        const second = createIncremental('second');
        manager.registerProvider(first);
        manager.registerProvider(second);

        manager.restoreState('c', [
            node('a', { first_snapshot: { v: 1 }, first_delta: ['skipped'] }),
            node('b', { first_delta: ['d1'], second_delta: ['s1'] }),
            node('c', { second_delta: ['s2'] })
        ]);

        expect(first.reset).toHaveBeenCalledTimes(1);
        expect(second.reset).toHaveBeenCalledTimes(1);
        expect(first.importSnapshot).toHaveBeenCalledWith({ v: 1 });
        expect(second.importSnapshot).not.toHaveBeenCalled();
        expect(first.applyDelta.mock.calls).toEqual([['d1']]);
        // 全局快照点在 a：second 没有快照，也只重播快照点之后的增量（既有行为）
        expect(second.applyDelta.mock.calls).toEqual([['s1'], ['s2']]);
    });
});
