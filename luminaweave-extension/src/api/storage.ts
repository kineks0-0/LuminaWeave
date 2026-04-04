/**
 * LuminaWeave Storage Core API
 * 负责集中管理插件的所有设置项及拓展数据，支持细粒度的作用域 (Scopes) 分发。
 */

import { STClient } from './core/st-adapter/STClient.js';
import { LuminaWeaveAPIBase } from './core/LuminaWeaveAPIBase.js';

export type StorageScope = 'Global' | 'Character' | 'Chat' | 'Session';

export class StorageCore extends LuminaWeaveAPIBase {
    private sessionData: Map<string, any>;
    private globalIndependentData: Record<string, any> = {}; // 独立存储的全局配置
    private listeners: Map<string, Function[]> = new Map(); // 订阅设置变更

    constructor() {
        super();
        this.sessionData = this._loadSessionData(); // Session 作用域实际下沉至 localStorage

        // 初始化时加载独立 JSON
        this.loadIndependentGlobalData();
    }

    // 统一通过基类 ctx 访问

    /**
     * 判断当前是否启用了独立的 JSON 存储引擎 (依靠本地浏览器缓存记录该开关)
     */
    get useIndependentGlobalStorage(): boolean {
        return true;
        // return localStorage.getItem('luminaWeave_useIndependentStorage') === 'true';
    }

    set useIndependentGlobalStorage(val: boolean) {
        localStorage.setItem('luminaWeave_useIndependentStorage', val ? 'true' : 'false');
        // 切换后触发界面全面更新响应
        this.emit('*', null, 'Global');
    }

    /**
     * 从后端（全栈插件服务器）异步拉取 JSON 数据
     */
    async loadIndependentGlobalData(): Promise<void> {
        try {
            const res = await fetch('/api/plugins/luminaweave/settings');
            if (res.ok) {
                this.globalIndependentData = await res.json();
                // 如果当前处在独立模式，拉取完毕后通知全体渲染刷新
                if (this.useIndependentGlobalStorage) {
                    this.emit('*', null, 'Global');
                }
                console.log('[LuminaWeave Storage] Independent backend loaded successfully.');
                console.log(this.globalIndependentData);
            }
        } catch (e) {
            console.log('[LuminaWeave Storage] Independent backend not reachable or not installed.');
        }
    }

    /**
     * 将数据推送至后端（全栈插件服务器）保存为独立的 json 文件
     */
    async _saveIndependentGlobalData(): Promise<void> {
        try {
            // 使用 STClient 统一获取 Token
            const csrfToken = await STClient.getCsrfToken();

            const res = await fetch('/api/plugins/luminaweave/settings/save', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRF-Token': csrfToken
                },
                body: JSON.stringify(this.globalIndependentData)
            });

            if (!res.ok) throw new Error(`Server responded with ${res.status}`);
        } catch (e) {
            console.error('[LuminaWeave Storage] Failed to save independent JSON:', e);
            throw e; // Rethrow allowing the UI to catch and display the red error state
        }
    }

    /**
     * 从 localStorage 恢复以保证 F5 刷新依然持有，但不落盘进 ST
     */
    private _loadSessionData(): Map<string, any> {
        try {
            const data = localStorage.getItem('luminaWeave_sessionConfig');
            return data ? new Map(Object.entries(JSON.parse(data))) : new Map();
        } catch (e) {
            console.warn('[LuminaWeave Storage] Failed to parse Session Data, resetting.');
            return new Map();
        }
    }

    /**
     * 持久化写入 localStorage
     */
    private _saveSessionData(): void {
        try {
            const obj = Object.fromEntries(this.sessionData);
            localStorage.setItem('luminaWeave_sessionConfig', JSON.stringify(obj));
        } catch (e) {
            console.error('[LuminaWeave Storage] Failed to save Session Data:', e);
        }
    }

    /**
     * 动态获取或初始化底层的 extension_settings，划分 luminaWeave 命名空间
     */
    private _getBase(): any {
        // 如果能获取到官方上下文的设置字典，优先挂载在那上面；否则降级退回全局变量
        const extSettings = this.ctx?.extensionSettings || (typeof window !== 'undefined' ? (window as any).extension_settings : null);

        if (!extSettings) return null; // 极端冷启动防呆

        if (!extSettings.luminaWeave) {
            extSettings.luminaWeave = {
                global: {},
                characters: {},
                chats: {}
            };
        }
        return extSettings.luminaWeave;
    }

    /**
     * 事件监听：当某个 Key 改变时触发的回调
     */
    on(key: string, callback: Function): void {
        if (!this.listeners.has(key)) {
            this.listeners.set(key, []);
        }
        this.listeners.get(key)!.push(callback);
    }

    off(key: string, callback: Function): void {
        if (!this.listeners.has(key)) return;
        const callbacks = this.listeners.get(key)!;
        this.listeners.set(key, callbacks.filter(cb => cb !== callback));
    }

    emit(key: string, value: any, scope: StorageScope): void {
        if (this.listeners.has(key)) {
            this.listeners.get(key)!.forEach(cb => {
                try {
                    cb(value, scope);
                } catch (e) {
                    console.error('[LuminaWeave Storage] Listener Error:', e);
                }
            });
        }
    }

    /**
     * 获取当前的上下文标识符
     */
    public _getContextIds(): { charId: string | number; chatId: string } {
        // 优先尝试从 SillyTavern 官方 API 上下文获取
        const ctx = this.ctx as any;
        let charId = ctx?.characterId ?? (typeof window !== 'undefined' ? (window as any).this_chid : null);

        // 如果不存在 charId 尝试防御
        if (charId === undefined || charId === null) charId = 'Global';

        // 探测 ChatID (最高优先级: 官方 API 上下文)
        let chatId = ctx?.chatId ?? (typeof window !== 'undefined' && (window as any).chat_metadata ? (window as any).chat_metadata.chat_id : null);

        // 兜底路径: window 全局变量或 ID 探测
        if (!chatId || chatId === 'undefined' || chatId === 'null') {
            const messages = STClient.getRawMessages();
            if (messages.length > 0) {
                const lastMessage = messages[messages.length - 1];
                if (lastMessage && lastMessage.extra && lastMessage.extra._lw_sync_chat_id) {
                    chatId = String(lastMessage.extra._lw_sync_chat_id);
                    console.log('[LuminaWeave] storage.ts: fallback to chat_id from ST last message:', chatId);
                }
            }
        }

        return { charId: String(charId), chatId: String(chatId) };
    }

    /**
     * 写入数据，触发底层落盘，返回 Promise 以便 UI 捕获异步服务器错误（如 CSRF）
     * @param key 
     * @param value 
     * @param scope - 强制指定写入的作用域
     */
    async set(key: string, value: any, scope: StorageScope = 'Session'): Promise<void> {
        const { charId, chatId } = this._getContextIds();
        const base = this._getBase();
        let promise = Promise.resolve();

        switch (scope) {
            case 'Global':
                if (this.useIndependentGlobalStorage) {
                    this.globalIndependentData[key] = value;
                    promise = this._saveIndependentGlobalData();
                } else {
                    if (base) base.global[key] = value;
                    this.save();
                    promise = Promise.resolve();
                }
                break;
            case 'Character':
                if (base) {
                    if (!base.characters[charId]) base.characters[charId] = {};
                    base.characters[charId][key] = value;
                    this.save();
                }
                break;
            case 'Chat':
                if (base) {
                    if (!base.chats[chatId]) base.chats[chatId] = {};
                    base.chats[chatId][key] = value;
                    this.save();
                }
                break;
            case 'Session':
                this.sessionData.set(key, value);
                this._saveSessionData();
                break;
            default:
                console.warn(`[LuminaWeave Storage] Unknown scope: ${scope}, fallback to Session`);
                this.sessionData.set(key, value);
                this._saveSessionData();
                promise = Promise.resolve();
        }

        this.emit(key, value, scope);
        // 也派发一个通用的变更事件
        this.emit('*', { key, value, scope }, scope);
        return promise;
    }

    /**
     * 读取数据（如果作用域未传递，会尝试按 Session -> Chat -> Character -> Global 优先级查找）
     * 但通常由具体的 Settings 模块传递显式的 scope。
     * @param key 
     * @param scope - 限定的作用域
     * @param defaultValue - 默认值
     */
    get(key: string, defaultValue: any = null, scope: StorageScope | null = null): any {
        const { charId, chatId } = this._getContextIds();
        const base = this._getBase();

        // 如果明确指定了作用域，只从该作用域读
        if (scope) {
            switch (scope) {
                case 'Global':
                    return this.useIndependentGlobalStorage
                        ? (this.globalIndependentData[key] !== undefined ? this.globalIndependentData[key] : defaultValue)
                        : (base?.global[key] !== undefined ? base.global[key] : defaultValue);
                case 'Character': return (base?.characters[charId] && base.characters[charId][key] !== undefined) ? base.characters[charId][key] : defaultValue;
                case 'Chat': return (base?.chats[chatId] && base.chats[chatId][key] !== undefined) ? base.chats[chatId][key] : defaultValue;
                case 'Session': return this.sessionData.has(key) ? this.sessionData.get(key) : defaultValue;
            }
            return defaultValue;
        }

        // 瀑布流读取优先级：Session -> Chat -> Character -> Global
        if (this.sessionData.has(key)) return this.sessionData.get(key);
        if (base?.chats[chatId] && base.chats[chatId][key] !== undefined) return base.chats[chatId][key];
        if (base?.characters[charId] && base.characters[charId][key] !== undefined) return base.characters[charId][key];
        if (this.useIndependentGlobalStorage) {
            if (this.globalIndependentData[key] !== undefined) return this.globalIndependentData[key];
        } else {
            if (base?.global[key] !== undefined) return base.global[key];
        }

        return defaultValue;
    }

    /**
     * 获取当前生效值所在的作用域层级
     * @param key 
     */
    getScopeOf(key: string): StorageScope | null {
        const { charId, chatId } = this._getContextIds();
        const base = this._getBase();
        if (this.sessionData.has(key)) return 'Session';
        if (base?.chats[chatId] && base.chats[chatId][key] !== undefined) return 'Chat';
        if (base?.characters[charId] && base.characters[charId][key] !== undefined) return 'Character';
        if (this.useIndependentGlobalStorage) {
            if (this.globalIndependentData[key] !== undefined) return 'Global';
        } else {
            if (base?.global[key] !== undefined) return 'Global';
        }
        return null; // 表示全区域未设置，此时再Fallback
    }

    /**
     * 触发 ST 原生系统的保存落地
     */
    public save(): void {
        const saveFn = this.ctx?.saveSettingsDebounced || (typeof window !== 'undefined' ? (window as any).saveSettingsDebounced : null);
        if (typeof saveFn === 'function') {
            saveFn();
        }
    }
}

// 导出单例实例
export const lwStorage = new StorageCore();
