import { lwStorage, type StorageScope } from '../storage.js';
import {
    getCanonicalSettingsStorageKey,
    getLegacySettingsStorageKey
} from '../../theme/themeRegistry.js';

export interface SettingsStorageChange {
    key: string;
    value: unknown;
    scope: StorageScope;
}

export type SettingsStorageChangeHandler = (data: SettingsStorageChange) => void;

export interface SettingsStoragePort {
    readonly useIndependentGlobalStorage?: boolean;
    get(key: string, defaultValue?: unknown, scope?: StorageScope | null): unknown;
    set(key: string, value: unknown, scope?: StorageScope): Promise<void>;
    getScopeOf(key: string): StorageScope | null;
    on(key: string, callback: Function): void;
    off(key: string, callback: Function): void;
    importData?(data: Record<string, unknown>, selectedKeys: string[]): Promise<void>;
}

export class SettingsDomainService {
    constructor(private readonly storage: SettingsStoragePort = lwStorage) {}

    getValue(storageKey: string, defaultValue: unknown = null, scope?: StorageScope): unknown {
        return this.storage.get(storageKey, defaultValue, scope ?? null);
    }

    getGlobalValue<T = unknown>(storageKey: string, defaultValue: T): T {
        return this.getValue(storageKey, defaultValue, 'Global') as T;
    }

    getEffectiveValue(storageKey: string, scope?: StorageScope): unknown {
        const primaryValue = this.getValue(storageKey, null, scope);
        if (primaryValue !== null && primaryValue !== undefined) {
            return primaryValue;
        }

        const legacyStorageKey = getLegacySettingsStorageKey(storageKey);
        if (!legacyStorageKey) {
            return primaryValue;
        }

        return this.getValue(legacyStorageKey, null, scope);
    }

    getEffectiveScope(storageKey: string): StorageScope | null {
        const directScope = this.storage.getScopeOf(storageKey);
        if (directScope) {
            return directScope;
        }

        const legacyStorageKey = getLegacySettingsStorageKey(storageKey);
        return legacyStorageKey ? this.storage.getScopeOf(legacyStorageKey) : null;
    }

    async setSetting(storageKey: string, value: unknown, scope: StorageScope = 'Global'): Promise<void> {
        await this.storage.set(storageKey, value, scope);
        const legacyStorageKey = getLegacySettingsStorageKey(storageKey);
        if (legacyStorageKey) {
            await this.storage.set(legacyStorageKey, value, scope);
        }
    }

    setGlobalValue(storageKey: string, value: unknown): Promise<void> {
        return this.storage.set(storageKey, value, 'Global');
    }

    importData(data: Record<string, unknown>, selectedKeys: string[]): Promise<void> {
        if (!this.storage.importData) {
            throw new Error('Settings storage import is not available.');
        }
        return this.storage.importData(data, selectedKeys);
    }

    isIndependentGlobalStorageEnabled(): boolean {
        return Boolean(this.storage.useIndependentGlobalStorage);
    }

    getGlobalSettingsSnapshot(): Record<string, unknown> {
        return { ...((this.storage as { globalIndependentData?: Record<string, unknown> }).globalIndependentData ?? {}) };
    }

    canonicalizeStorageKey(storageKey: string): string {
        return getCanonicalSettingsStorageKey(storageKey);
    }

    onAnyChange(callback: SettingsStorageChangeHandler): () => void {
        const listener = (data: SettingsStorageChange) => callback(data);
        this.storage.on('*', listener);
        return () => this.storage.off('*', listener);
    }
}

export const settingsDomainService = new SettingsDomainService();
export type { StorageScope };
