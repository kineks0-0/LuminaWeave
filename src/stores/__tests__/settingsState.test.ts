import { beforeEach, describe, expect, it, vi } from 'vitest';

const onAnyChange = vi.fn(() => () => undefined);
const getEffectiveValue = vi.fn(() => null);

vi.mock('@/api/services/SettingsDomainService.js', () => ({
    settingsDomainService: {
        onAnyChange,
        getEffectiveValue,
        getEffectiveScope: vi.fn(() => null),
        setSetting: vi.fn(async () => undefined),
        canonicalizeStorageKey: (key: string) => key
    }
}));

describe('settingsState', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('keeps a single global subscription regardless of useSettings call count', async () => {
        const state = await import('@/stores/settingsState.js');
        expect(onAnyChange).toHaveBeenCalledTimes(1);

        const { useSettings } = await import('@/plugins/settings/useSettings.js');
        const first = useSettings();
        const second = useSettings();

        expect(onAnyChange).toHaveBeenCalledTimes(1);
        expect(first.activeSettings).toBe(state.activeSettings);
        expect(second.activeSettings).toBe(state.activeSettings);
    });
});
