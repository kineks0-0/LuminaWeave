import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MemoryManager } from '../MemoryManager';

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
