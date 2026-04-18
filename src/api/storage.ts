/**
 * LuminaWeave Storage Core API
 * 负责集中管理插件的所有设置项及拓展数据，支持细粒度的作用域 (Scopes) 分发。
 */

import { STClient } from './core/st-adapter/STClient.js';
import { LuminaWeaveAPIBase } from './core/LuminaWeaveAPIBase.js';
import { BridgeDispatcher } from '../../../shared/api/BridgeDispatcher.js';

export type StorageScope = 'Global' | 'Character' | 'Chat' | 'Session';

export class StorageCore extends LuminaWeaveAPIBase {
    private sessionData: Map<string, any>;
    private globalIndependentData: Record<string, any> = {}; // 独立存储的全局配置
    private listeners: Map<string, Function[]> = new Map(); // 订阅设置变更
    private _saveTimeout: any = null;
    private _activeSavePromise: Promise<void> | null = null;

    constructor() {
        super();
        this.sessionData = new Map();
    }

    /**
     * 初始化异步存储数据
     */
    public async initStorage(): Promise<void> {
        // 先尝试从 Bridge 加载 Session
        try {
            const data = await BridgeDispatcher.extensionStore.getJson({ namespace: 'lumina_weave', key: 'session-state' });
            if (data) {
                this.sessionData = new Map(Object.entries(data));
            }
        } catch (e) {
            console.warn('[LuminaWeave Storage] Failed to load Session Data from extensionStore, fallback to localStorage.');
            this.sessionData = this._loadSessionData();
        }

        // 加载独立配置
        await this.loadIndependentGlobalData();
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
        BridgeDispatcher.extensionStore.setJson({ 
            namespace: 'lumina_weave', 
            key: 'storage-mode', 
            value: { independent: val } 
        });
        // 切换后触发界面全面更新响应
        this.emit('*', null, 'Global');
    }

    /**
     * 从后端（全栈插件服务器）异步拉取 JSON 数据
     */
    async loadIndependentGlobalData(): Promise<void> {
        try {
            this.globalIndependentData = await BridgeDispatcher.settings.getSettings();
            
            // 镜像备份到 extensionStore，而不是 localStorage
            await BridgeDispatcher.extensionStore.setJson({ 
                namespace: 'lumina_weave', 
                key: 'global-settings-mirror', 
                value: this.globalIndependentData 
            });

            // 如果当前处在独立模式，拉取完毕后通知全体渲染刷新
            if (this.useIndependentGlobalStorage) {
                this.emit('*', null, 'Global');
            }
            console.log('[LuminaWeave Storage] Independent backend loaded successfully and mirrored to extension store.');
        } catch (e) {
            console.warn('[LuminaWeave Storage] Independent backend not reachable. Attempting to recover from extension mirror...');
            try {
                const mirror = await BridgeDispatcher.extensionStore.getJson({ 
                    namespace: 'lumina_weave', 
                    key: 'global-settings-mirror' 
                });
                if (mirror) {
                    this.globalIndependentData = mirror;
                    console.info('[LuminaWeave Storage] Successfully recovered API configuration from extension mirror.');
                }
            } catch (recoveryErr) {
                console.error('[LuminaWeave Storage] Failed to recover from extension mirror:', recoveryErr);
            }
        }
    }

    /**
     * 将数据推送至后端（全栈插件服务器）保存为独立的 json 文件
     */
    async _saveIndependentGlobalData(): Promise<void> {
        try {
            // 同步备份到 extensionStore
            await BridgeDispatcher.extensionStore.setJson({ 
                namespace: 'lumina_weave', 
                key: 'global-settings-mirror', 
                value: this.globalIndependentData 
            });
            await BridgeDispatcher.settings.saveSettings(this.globalIndependentData);
        } catch (e) {
            console.error('[LuminaWeave Storage] Failed to save independent JSON:', e);
            throw e; 
        }
    }

    /**
     * 导入指定的全局配置项
     * @param data 要导入的数据对象
     * @param selectedKeys 选中的键名列表
     */
    public async importData(data: Record<string, any>, selectedKeys: string[]): Promise<void> {
        if (!data || typeof data !== 'object') {
            throw new Error('Invalid data format');
        }

        let changed = false;
        for (const key of selectedKeys) {
            if (data[key] !== undefined) {
                // 如果是对象或数组，进行深度拷贝
                this.globalIndependentData[key] = JSON.parse(JSON.stringify(data[key]));
                changed = true;
                this.emit(key, this.globalIndependentData[key], 'Global');
            }
        }

        if (changed) {
            this.emit('*', null, 'Global');
            await this.flush();
        }
    }

    /**
     * 防抖版的独立持久化方法
     */
    private _saveIndependentGlobalDataDebounced(): Promise<void> {
        if (this._saveTimeout) {
            clearTimeout(this._saveTimeout);
        }

        return new Promise((resolve, reject) => {
            this._saveTimeout = setTimeout(async () => {
                try {
                    this._activeSavePromise = this._saveIndependentGlobalData();
                    await this._activeSavePromise;
                    this._saveTimeout = null;
                    this._activeSavePromise = null;
                    resolve();
                } catch (e) {
                    this._saveTimeout = null;
                    this._activeSavePromise = null;
                    reject(e);
                }
            }, 850); // 850ms 防抖，合并热点写操作
        });
    }

    /**
     * 立即强制持久化当前所有待定的全局改动
     */
    public async flush(): Promise<void> {
        if (this._saveTimeout) {
            clearTimeout(this._saveTimeout);
            this._saveTimeout = null;
        }
        
        if (this._activeSavePromise) {
            return this._activeSavePromise;
        }

        return this._saveIndependentGlobalData();
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
     * 持久化写入 extensionStore
     */
    private async _saveSessionData(): Promise<void> {
        try {
            const obj = Object.fromEntries(this.sessionData);
            await BridgeDispatcher.extensionStore.setJson({ 
                namespace: 'lumina_weave', 
                key: 'session-state', 
                value: obj 
            });
        } catch (e) {
            console.error('[LuminaWeave Storage] Failed to save Session Data to extensionStore:', e);
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

        // 核心修复：避免强制 String() 转换导致 null 变成 "null"
        const finalCharId = charId !== null && charId !== undefined ? String(charId) : 'Global';
        const finalChatId = (chatId !== null && chatId !== undefined && chatId !== 'null' && chatId !== 'undefined') ? String(chatId) : '';

        return { charId: finalCharId, chatId: finalChatId };
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
                    promise = this._saveIndependentGlobalDataDebounced();
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
