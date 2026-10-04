import { beforeEach, describe, expect, it, vi } from 'vitest';

const changeCallbacks: Array<(data: { key: string }) => void> = [];
const onAnyChange = vi.fn((callback: (data: { key: string }) => void) => {
    changeCallbacks.push(callback);
    return () => undefined;
});
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

    it('only syncs registered settings from storage change events', async () => {
        const state = await import('@/stores/settingsState.js');
        expect(changeCallbacks.length).toBeGreaterThan(0);
        const notify = changeCallbacks[0];

        state.setSettingValue('lumina-settings.testSetting', 'initial');
        getEffectiveValue.mockReturnValueOnce('updated');
        notify({ key: 'lumina-settings.testSetting' });
        expect(state.activeSettings['lumina-settings.testSetting']).toBe('updated');

        notify({ key: 'lumina-chat.regexScripts' });
        expect(Object.prototype.hasOwnProperty.call(state.activeSettings, 'lumina-chat.regexScripts')).toBe(false);
    });
});
