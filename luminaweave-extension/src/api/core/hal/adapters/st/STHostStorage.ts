import { IHostStorage } from '../../interfaces.js';
import { STGlobalAccessor } from '../../../host-drivers/st/STGlobalAccessor.js';

/**
 * SillyTavern 宿主的存储实现
 * 直接操作 ST 的 extensionSettings 或 localStorage
 */
export class STHostStorage implements IHostStorage {

    /**
     * @internal 用于 StorageCore 同步访问
     */
    public _getInternalBase(): any {
        return this._getBase();
    }

    /**
     * @internal 用于 StorageCore 触发保存
     */
    public _triggerSave(): void {
        this._save();
    }

    private _getBase(): any {
        const ctx = STGlobalAccessor.ctx;
        const extSettings = ctx?.extensionSettings || (typeof window !== 'undefined' ? (window as any).extension_settings : null);

        if (!extSettings) return null;

        if (!extSettings.luminaWeave) {
            extSettings.luminaWeave = {
                global: {},
                characters: {},
                chats: {}
            };
        }
        return extSettings.luminaWeave;
    }

    private _save(): void {
        const ctx = STGlobalAccessor.ctx;
        const saveFn = ctx?.saveSettingsDebounced || (typeof window !== 'undefined' ? (window as any).saveSettingsDebounced : null);
        if (typeof saveFn === 'function') {
            saveFn();
        }
    }

    async getItem(namespace: string | undefined, key: string, table?: string): Promise<string | null> {
        const base = this._getBase();
        if (!base) return localStorage.getItem(key);

        const effectiveKey = table ? `${table}:${key}` : key;
        const scope = namespace || 'Global';

        switch (scope) {
            case 'Global':
                return base.global[effectiveKey] ?? localStorage.getItem(key);
            case 'Character': {
                const ctx = STGlobalAccessor.ctx as any;
                const charId = ctx?.character_id ?? ctx?.characterId; // 优先从上下文取，避免循环依赖
                if (!charId || !base.characters[charId]) return null;
                return base.characters[charId][effectiveKey] ?? null;
            }
            case 'Chat': {
                const chatId = STGlobalAccessor.ctx?.chatId;
                if (!chatId || !base.chats[chatId]) return null;
                return base.chats[chatId][effectiveKey] ?? null;
            }
        }

        return null;
    }

    async setItem(namespace: string | undefined, key: string, value: string, table?: string): Promise<void> {
        const base = this._getBase();
        const effectiveKey = table ? `${table}:${key}` : key;
        const scope = namespace || 'Global';

        if (!base || scope === 'localStorage') {
            localStorage.setItem(key, value);
            return;
        }

        switch (scope) {
            case 'Global':
                base.global[effectiveKey] = value;
                break;
            case 'Character': {
                const ctx = STGlobalAccessor.ctx as any;
                const charId = ctx?.character_id ?? ctx?.characterId;
                if (!charId) return;
                if (!base.characters[charId]) base.characters[charId] = {};
                base.characters[charId][effectiveKey] = value;
                break;
            }
            case 'Chat': {
                const chatId = STGlobalAccessor.ctx?.chatId;
                if (!chatId) return;
                if (!base.chats[chatId]) base.chats[chatId] = {};
                base.chats[chatId][effectiveKey] = value;
                break;
            }
        }

        this._save();
    }

    async removeItem(namespace: string | undefined, key: string, table?: string): Promise<void> {
        const base = this._getBase();
        const effectiveKey = table ? `${table}:${key}` : key;
        const scope = namespace || 'Global';

        if (!base) {
            localStorage.removeItem(key);
            return;
        }

        switch (scope) {
            case 'Global':
                delete base.global[effectiveKey];
                break;
            case 'Character': {
                const ctx = STGlobalAccessor.ctx as any;
                const charId = ctx?.character_id ?? ctx?.characterId;
                if (charId && base.characters[charId]) {
                    delete base.characters[charId][effectiveKey];
                }
                break;
            }
            case 'Chat': {
                const chatId = STGlobalAccessor.ctx?.chatId;
                if (chatId && base.chats[chatId]) {
                    delete base.chats[chatId][effectiveKey];
                }
                break;
            }
        }

        this._save();
    }
}
