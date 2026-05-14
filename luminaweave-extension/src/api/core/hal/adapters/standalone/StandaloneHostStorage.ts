import type { IHostStorage } from "../../interfaces.js";

type StorageScope = 'Global' | 'Character' | 'Chat';

/**
 * 独立模式存储适配器
 * 直接使用浏览器的 localStorage 进行数据持久化
 */
export class StandaloneHostStorage implements IHostStorage {
    private get storage(): Storage {
        if (typeof localStorage !== 'undefined') return localStorage;
        return window.localStorage;
    }

    private getPrefix(scope: StorageScope, id?: string): string {
        if (scope === 'Character' && id) return `lw_char_${id}:`;
        if (scope === 'Chat' && id) return `lw_chat_${id}:`;
        return 'lw_global:';
    }

    private getNamespacePrefix(namespace: string | undefined, table = 'settings'): string {
        return `lw_${namespace || 'global'}:${table}:`;
    }

    async getItem(namespace: string | undefined, key: string, table?: string): Promise<string | null> {
        return this.storage.getItem(this.getNamespacePrefix(namespace, table) + key);
    }

    async setItem(namespace: string | undefined, key: string, value: string, table?: string): Promise<void> {
        this.storage.setItem(this.getNamespacePrefix(namespace, table) + key, value);
    }

    async removeItem(namespace: string | undefined, key: string, table?: string): Promise<void> {
        this.storage.removeItem(this.getNamespacePrefix(namespace, table) + key);
    }

    get(key: string, scope: StorageScope, id?: string): any {
        const prefix = this.getPrefix(scope, id);
        const fullKey = prefix + key;
        const val = this.storage.getItem(fullKey);
        if (val === null) return undefined;
        try {
            return JSON.parse(val);
        } catch {
            return val;
        }
    }

    set(key: string, value: any, scope: StorageScope, id?: string): void {
        const prefix = this.getPrefix(scope, id);
        const fullKey = prefix + key;
        if (value === undefined || value === null) {
            this.storage.removeItem(fullKey);
        } else {
            this.storage.setItem(fullKey, JSON.stringify(value));
        }
    }

    delete(key: string, scope: StorageScope, id?: string): void {
        const prefix = this.getPrefix(scope, id);
        const fullKey = prefix + key;
        this.storage.removeItem(fullKey);
    }

    listKeys(scope: StorageScope, id?: string): string[] {
        const prefix = this.getPrefix(scope, id);
        const keys: string[] = [];
        const storage = this.storage;
        for (let i = 0; i < storage.length; i++) {
            const key = storage.key(i);
            if (key && key.startsWith(prefix)) {
                keys.push(key.substring(prefix.length));
            }
        }
        return keys;
    }
}
