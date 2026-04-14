import { describe, it, expect, vi } from 'vitest';
import { EventFlow } from '../../../../../shared/EventFlow.js';

describe('EventFlow', () => {
    it('should correctly register and emit to multiple consumers', async () => {
        const flow = new EventFlow<{ data: string }>();
        const mock1 = vi.fn();
        const mock2 = vi.fn();

        flow.collect(mock1);
        flow.collect(mock2);

        await flow.emit({ data: 'test_payload' });

        expect(mock1).toHaveBeenCalledWith({ data: 'test_payload' });
        expect(mock2).toHaveBeenCalledWith({ data: 'test_payload' });
        expect(mock1).toHaveBeenCalledTimes(1);
    });

    it('should wait for all async consumers to finish', async () => {
        const flow = new EventFlow<number>();
        let sum = 0;
        
        flow.collect(async (val) => {
            await new Promise(r => setTimeout(r, 50));
            sum += val;
        });

        flow.collect(async (val) => {
            await new Promise(r => setTimeout(r, 10));
            sum += val * 2;
        });

        await flow.emit(10);
        // Ensure both finished
        expect(sum).toBe(30);
    });

    it('should handle unsubscription correctly', async () => {
        const flow = new EventFlow<void>();
        const mockFn = vi.fn();

        const unsubscribe = flow.collect(mockFn);
        unsubscribe(); // Unsubscribe before emit

        await flow.emit();

        expect(mockFn).not.toHaveBeenCalled();
    });

    it('should swallow synchronous consumer errors without blocking others', async () => {
        const flow = new EventFlow<void>();
        const mock1 = vi.fn(() => { throw new Error('Sync Error!'); });
        const mock2 = vi.fn();

        flow.collect(mock1);
        flow.collect(mock2);

        await expect(flow.emit()).resolves.toBeUndefined();
        expect(mock2).toHaveBeenCalled();
    });

    it('should swallow asynchronous consumer rejections without throwing emit', async () => {
        const flow = new EventFlow<void>();
        const mock1 = vi.fn().mockRejectedValue(new Error('Async error'));
        const mock2 = vi.fn().mockResolvedValue(true);

        flow.collect(mock1);
        flow.collect(mock2);

        await expect(flow.emit()).resolves.toBeUndefined();
        expect(mock2).toHaveBeenCalled();
    });
});
