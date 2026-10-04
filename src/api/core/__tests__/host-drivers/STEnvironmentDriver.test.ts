import { afterEach, describe, expect, it, vi } from 'vitest';
import { STEnvironmentDriver } from '@/api/core/host-drivers/st/STEnvironmentDriver.js';
import { STGlobalAccessor } from '@/api/core/host-drivers/st/STGlobalAccessor.js';

describe('STEnvironmentDriver.waitForReady', () => {
    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('should resolve true when ST, event source and helper are ready', async () => {
        vi.spyOn(STGlobalAccessor, 'waitForGlobal').mockResolvedValue(true);
        vi.spyOn(STGlobalAccessor, 'stMain', 'get').mockReturnValue({} as any);
        vi.spyOn(STGlobalAccessor, 'ctx', 'get').mockReturnValue({} as any);
        vi.spyOn(STGlobalAccessor, 'stEventSource', 'get').mockReturnValue({ on: vi.fn() } as any);
        vi.spyOn(STGlobalAccessor, 'stHelper', 'get').mockReturnValue({} as any);

        await expect(STEnvironmentDriver.waitForReady({ timeoutMs: 50 })).resolves.toBe(true);
    });

    it('should resolve false without throwing when helper is missing and requireReady is not set', async () => {
        vi.spyOn(STGlobalAccessor, 'waitForGlobal').mockResolvedValue(false);
        vi.spyOn(STGlobalAccessor, 'stMain', 'get').mockReturnValue({} as any);
        vi.spyOn(STGlobalAccessor, 'ctx', 'get').mockReturnValue({} as any);
        vi.spyOn(STGlobalAccessor, 'stEventSource', 'get').mockReturnValue({ on: vi.fn() } as any);
        vi.spyOn(STGlobalAccessor, 'stHelper', 'get').mockReturnValue(undefined);

        await expect(STEnvironmentDriver.waitForReady({ timeoutMs: 1 })).resolves.toBe(false);
    });

    it('should throw with an installation hint when requireReady is set and helper is missing', async () => {
        vi.spyOn(STGlobalAccessor, 'waitForGlobal').mockResolvedValue(false);
        vi.spyOn(STGlobalAccessor, 'stMain', 'get').mockReturnValue({} as any);
        vi.spyOn(STGlobalAccessor, 'ctx', 'get').mockReturnValue({} as any);
        vi.spyOn(STGlobalAccessor, 'stEventSource', 'get').mockReturnValue({ on: vi.fn() } as any);
        vi.spyOn(STGlobalAccessor, 'stHelper', 'get').mockReturnValue(undefined);

        await expect(
            STEnvironmentDriver.waitForReady({ timeoutMs: 1, requireReady: true })
        ).rejects.toThrow('酒馆助手');
    });
});
