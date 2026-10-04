import { afterEach, describe, expect, it, vi } from 'vitest';
import { HostInteractionService } from '../HostInteractionService.js';

describe('HostInteractionService', () => {
    afterEach(() => {
        vi.restoreAllMocks();
        delete (globalThis as { window?: unknown }).window;
    });

    it('sends toast messages to the host toastr bridge when available', () => {
        const success = vi.fn();
        (globalThis as { window?: unknown }).window = {
            toastr: { success }
        };
        const service = new HostInteractionService();

        service.showToast('Saved', 'success', 'Done', 1500);

        expect(success).toHaveBeenCalledWith('Saved', 'Done', { timeOut: 1500 });
    });

    it('does not throw when the host toastr bridge is missing', () => {
        const service = new HostInteractionService();

        expect(() => service.showToast('Saved')).not.toThrow();
    });

    it('delegates confirm to the registered handler', async () => {
        const service = new HostInteractionService();
        const handler = vi.fn(async () => true);
        service.setConfirmHandler(handler);

        await expect(service.confirm({ message: 'Delete?' })).resolves.toBe(true);
        expect(handler).toHaveBeenCalledWith({ message: 'Delete?' });
    });

    it('returns false when no confirm handler is registered', async () => {
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
        const service = new HostInteractionService();

        await expect(service.confirm('Delete?')).resolves.toBe(false);
        expect(warn).toHaveBeenCalled();
    });
});
