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
});
