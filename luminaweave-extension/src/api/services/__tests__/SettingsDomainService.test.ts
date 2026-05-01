import { describe, expect, it, vi } from 'vitest';
import { SettingsDomainService, type SettingsStorageChange, type SettingsStoragePort } from '../SettingsDomainService';
import type { StorageScope } from '../../storage';

const createStoragePort = (initialValues: Record<string, unknown> = {}) => {
    const values = new Map<string, unknown>(Object.entries(initialValues));
    const scopes = new Map<string, StorageScope>();
    const listeners = new Map<string, Function[]>();
    const port: SettingsStoragePort = {
        get: vi.fn((key: string, defaultValue: unknown = null) => (
            values.has(key) ? values.get(key) : defaultValue
        )),
        set: vi.fn(async (key: string, value: unknown, scope: StorageScope = 'Global') => {
            values.set(key, value);
            scopes.set(key, scope);
            const data: SettingsStorageChange = { key, value, scope };
            listeners.get('*')?.forEach((callback) => callback(data));
        }),
        getScopeOf: vi.fn((key: string) => scopes.get(key) ?? null),
        on: vi.fn((key: string, callback: Function) => {
            listeners.set(key, [...(listeners.get(key) ?? []), callback]);
        }),
        off: vi.fn((key: string, callback: Function) => {
            listeners.set(key, (listeners.get(key) ?? []).filter((item) => item !== callback));
        })
    };
    return port;
};

describe('SettingsDomainService', () => {
    it('reads canonical values before legacy aliases', () => {
        const storage = createStoragePort({
            'desktop-mode-discord.messageDensity': 'compact',
            'theme-pack-discord.messageDensity': 'comfortable'
        });
        const service = new SettingsDomainService(storage);

        expect(service.getEffectiveValue('desktop-mode-discord.messageDensity')).toBe('compact');
    });

    it('falls back to legacy aliases when the canonical key is empty', () => {
        const storage = createStoragePort({
            'theme-pack-discord.messageDensity': 'comfortable'
        });
        const service = new SettingsDomainService(storage);

        expect(service.getEffectiveValue('desktop-mode-discord.messageDensity')).toBe('comfortable');
    });

    it('writes canonical and legacy aliases for migrated desktop mode settings', async () => {
        const storage = createStoragePort();
        const service = new SettingsDomainService(storage);

        await service.setSetting('desktop-mode-discord.messageDensity', 'compact', 'Global');

        expect(storage.set).toHaveBeenCalledWith('desktop-mode-discord.messageDensity', 'compact', 'Global');
        expect(storage.set).toHaveBeenCalledWith('theme-pack-discord.messageDensity', 'compact', 'Global');
    });

    it('subscribes to wildcard storage changes and returns an unsubscribe function', () => {
        const storage = createStoragePort();
        const service = new SettingsDomainService(storage);
        const callback = vi.fn();

        const unsubscribe = service.onAnyChange(callback);
        unsubscribe();

        expect(storage.on).toHaveBeenCalledWith('*', expect.any(Function));
        expect(storage.off).toHaveBeenCalledWith('*', expect.any(Function));
    });
});
