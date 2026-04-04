import { LuminaWeaveAPIBase } from './LuminaWeaveAPIBase.js';
import { STClient } from './st-adapter/STClient';

/**
 * LorebookManager (世界书管理器)
 * 负责代理 SillyTavern 的 World Info 接口
 */
export class LorebookManager extends LuminaWeaveAPIBase {
    private parentApi: any;
    public entries: LuminaLorebookEntry[] = [];
    public books: { name: string, id: string }[] = [];
    public selectedBook: string | null = null;
    public currentBookData: LorebookData | null = null; // 存储当前独立编辑的书籍全量数据
    public activeEditingEntry: LuminaLorebookEntry | null = null; // 全局活跃编辑项 (多窗口协作用)
    public isLoading: boolean = false;


    constructor(parentApi: any) {
        super();
        this.parentApi = parentApi;
    }

    /**
     * 对条目进行标准排序，先排开启的，再按 order 降序
     */
    private sortEntries(entries: LuminaLorebookEntry[]): LuminaLorebookEntry[] {
        return entries.sort((a: any, b: any) => {
            // 1. 开启状态优先
            const aEnabled = a.enabled !== false;
            const bEnabled = b.enabled !== false;
            if (aEnabled !== bEnabled) {
                return aEnabled ? -1 : 1;
            }
            // 2. 优先级排序 (order 大的在前)
            return (Number(b.position?.order) || 0) - (Number(a.position?.order) || 0);
        });
    }

    /**
     * 同步书籍目录列表
     */
    async syncFromST(): Promise<void> {
        this.isLoading = true;
        try {
            console.log('[LorebookManager] 正在同步世界书列表...');
            let booksRaw: any[] = [];

            // 1. 优先尝试使用基类提供的 stHelper (最可靠)
            const helper = this.stHelper;
            if (helper && typeof helper.getWorldbookNames === 'function') {
                booksRaw = helper.getWorldbookNames() || [];
            } 
            
            // 2. 兜底逻辑：从 context 获取
            if (!booksRaw || booksRaw.length === 0) {
                booksRaw = (this.ctx as any)?.world_info_list || [];
            }

            this.books = Array.isArray(booksRaw) ? booksRaw.map(b => {
                const rawName = typeof b === 'string' ? b : (b.name || b.file_id || '');
                const rawId = typeof b === 'string' ? b : (b.file_id || b.name || '');
                return {
                    name: rawName.replace(/\.json$/, ''),
                    id: rawId.replace(/\.json$/, '')
                };
            }) : [];

            console.log(`[LorebookManager] 成功发现 ${this.books.length} 本世界书`);

            if (!this.selectedBook && this.books.length > 0) {
                let initialBookId = (this.ctx as any)?.selected_world_info || this.books[0].id;
                if (initialBookId && typeof initialBookId === 'string') {
                    initialBookId = initialBookId.replace(/\.json$/, '');
                }
                if (initialBookId) await this.loadLorebook(initialBookId);
            }

            this.emit('LOREBOOK_SYNCED', { entries: this.entries, book: this.selectedBook, books: this.books });
        } finally {
            this.isLoading = false;
        }
    }

    /**
     * 读取世界书原始数据 (Helper 优先)
     */
    async getLorebookRaw(name: string): Promise<any> {
        const normalizedTarget = name.replace(/\.json$/, '');
        const helper = this.stHelper;

        // 1. 尝试使用 Helper 加载 (它是同步返回 Response 对象或 Promise)
        if (helper && typeof helper.getWorldbook === 'function') {
            try {
                console.log(`[LorebookManager] 正在通过 Helper 获取世界书 ${normalizedTarget}`);
                const res = await helper.getWorldbook(normalizedTarget);
                
                // TavernHelper.getWorldbook 可能直接返回数组（根据 d.ts），
                // 如果是这样，我们需要将其包装为 { entries: [...] } 格式以保持内部统一
                if (Array.isArray(res)) {
                    const entriesObj: any = {};
                    res.forEach((item: any) => {
                        if (item && item.uid !== undefined) entriesObj[item.uid] = item;
                    });
                    return { entries: entriesObj };
                }
                
                if (res) {
                    return res;
                }
            } catch (e) {
                console.warn(`[LorebookManager] Helper 获取 ${normalizedTarget} 失败 (可能数据损坏)，返回空结构`, e);
            }
        }

        // 发生错误或不可用时返回空结构，避免流程崩溃
        return { entries: {} };
    }

    /**
     * 规范化条目数据，补全原生 ST 及其插件 (及 TavernHelper) 必填字段
     */
    private _normalizeEntry(entry: any): any {
        if (!entry) return entry;
        const normalized = { ...entry };

        // 补全缺失的关键数组字段，防止 TavernHelper 的 .map() 崩溃
        if (!Array.isArray(normalized.key)) normalized.key = [];
        if (!Array.isArray(normalized.keysecondary)) normalized.keysecondary = [];
        
        // 补全其他推荐的基础字段
        if (normalized.comment === undefined) normalized.comment = "";
        if (normalized.enabled === undefined) normalized.enabled = true;
        if (normalized.constant === undefined) normalized.constant = true;
        if (normalized.selective === undefined) normalized.selective = false;
        if (normalized.nsfw === undefined) normalized.nsfw = false;
        if (normalized.role === undefined) normalized.role = null;
        if (normalized.position === undefined) normalized.position = 1;
        if (normalized.depth === undefined) normalized.depth = 0;
        
        return normalized;
    }

    /**
     * 独立加载世界书
     */
    async loadLorebook(idOrObj: string | { id: string }): Promise<boolean> {
        let name = typeof idOrObj === 'string' ? idOrObj : idOrObj?.id;
        if (!name) return false;

        name = name.replace(/\.json$/, '');

        this.isLoading = true;
        try {
            const csrfToken = await STClient.getCsrfToken();
            const res = await fetch('/api/worldinfo/get', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrfToken },
                body: JSON.stringify({ name })
            });

            if (res.ok) {
                const bookData: any = await res.json();
                this.currentBookData = bookData;
                this.selectedBook = name;

                const rawEntries = bookData.entries || bookData.data || {};
                const list = Object.entries(rawEntries)
                    .map(([uid, entry]) => ({ uid, ...(entry as any) }));
                this.entries = this.sortEntries(list);

                this.emit('UPDATED');
                this.emit('LOREBOOK_SYNCED', { entries: this.entries, book: this.selectedBook, books: this.books });
                return true;
            }
        } catch (e) {
            console.error('[LorebookManager] 加载书籍失败:', e);
        } finally {
            this.isLoading = false;
        }
        return false;
    }

    /**
     * 确保世界书存在 (新建逻辑)
     */
    async ensureBookExists(name: string): Promise<boolean> {
        const normalizedTarget = name.replace(/\.json$/, '');
        const helper = this.stHelper;

        // 1. 优先使用 TavernHelper 获取列表并校验
        if (helper && typeof helper.getWorldbookNames === 'function') {
            const rawNames = helper.getWorldbookNames() || [];
            const names = rawNames.map((n: string) => n.replace(/\.json$/, ''));

            if (names.includes(normalizedTarget)) {
                return true;
            }

            console.log(`[LorebookManager] 正在通过 Helper 创建世界书 ${normalizedTarget}`);
            try {
                const created = await helper.createWorldbook(normalizedTarget, []);
                // 增加微小延迟，防止 ST 索引未同步导致后续读取失败
                if (created) await new Promise(resolve => setTimeout(resolve, 100));
                return created;
            } catch (e) {
                console.error('[LorebookManager] Helper 创建世界书失败', e);
            }
        }

        // 2. 兜底逻辑：检查 context
        const booksRaw: any[] = (this.ctx as any)?.world_info_list || [];
        const existingBooks = booksRaw.map(b => {
            const rawName = typeof b === 'string' ? b : (b.name || b.file_id || '');
            return rawName.replace(/\.json$/, '');
        });

        if (existingBooks.includes(normalizedTarget)) {
            return true;
        }

        console.warn(`[LorebookManager] 未找到 Helper 或 Helper 执行失败: ${normalizedTarget}`);
        return false;
    }

    /**
     * 保存或更新条目
     */
    async saveEntry(uid: string | number | null, entryData: LuminaLorebookEntry): Promise<boolean> {
        if (!this.selectedBook || !this.currentBookData) return false;

        try {
            const targetUid = uid || `lw_${Date.now()}`;

            const book = this.currentBookData as any;
            if (!book.entries && !book.data) {
                book.entries = {};
            }
            const entriesContainer = book.entries || book.data;
            if (entriesContainer) {
                entriesContainer[targetUid] = this._normalizeEntry({ ...entryData, uid: targetUid });
            }

            // 核心增强：强制使用 TavernHelper 的 Raw 导入功能，不再 fallback 到 REST API
            const helper = this.stHelper;
            if (helper && typeof helper.importRawWorldbook === 'function') {
                console.log(`[LorebookManager] Syncing via Helper (Entry Update): ${this.selectedBook}`);
                const res = await helper.importRawWorldbook(this.selectedBook, JSON.stringify(this.currentBookData));
                
                // 兼容性处理：Helper 可能返回 Response (d.ts 定义) 或 boolean (实际实现)
                const isSuccess = ((res as any) === true) || (res && (res as any).ok);
                
                if (isSuccess) {
                    await this.loadLorebook(this.selectedBook);
                    return true;
                } else {
                    console.error('[LorebookManager] Helper 导入条目失败', res);
                }
            } else {
                console.error('[LorebookManager] Helper 不可用，无法保存条目');
            }
        } catch (e) {
            console.error('[LorebookManager] 保存条目失败:', e);
        }
        return false;
    }

    /**
     * 保存全量世界书数据
     */
    async saveLorebook(name: string, entries: any): Promise<boolean> {
        if (!name || !entries) return false;

        await this.ensureBookExists(name);

        try {
            // 构建标准的 ST 书籍 JSON 结构 (不再包含冗余的顶级 name)
            const normalizedEntries: any = {};
            if (Array.isArray(entries)) {
                entries.forEach(curr => {
                    normalizedEntries[curr.uid] = this._normalizeEntry(curr);
                });
            } else {
                Object.entries(entries).forEach(([uid, curr]: [string, any]) => {
                    normalizedEntries[uid] = this._normalizeEntry({ ...curr, uid });
                });
            }

            const bookData = {
                entries: normalizedEntries
            };

            // 核心增强：强制使用 TavernHelper 的 Raw 导入功能
            const helper = this.stHelper;
            if (helper && typeof helper.importRawWorldbook === 'function') {
                console.log(`[LorebookManager] Syncing via Helper (Full Sync): ${name}`);
                const res = await helper.importRawWorldbook(name, JSON.stringify(bookData));
                
                // 兼容性处理
                const isSuccess = ((res as any) === true) || (res && (res as any).ok);

                if (isSuccess) {
                    if (this.selectedBook === name) await this.loadLorebook(name);
                    return true;
                } else {
                    // 如果是 Response 对象且失败，尝试记录错误信息
                    let errorMsg = 'Unknown error';
                    if (res && typeof (res as any).text === 'function') {
                        errorMsg = await (res as any).text().catch(() => 'No body content');
                    }
                    console.error(`[LorebookManager] Sync via Helper (Full Sync) 失败:`, errorMsg, res);
                }
            } else {
                console.error('[LorebookManager] Helper 不可用，无法保存世界书');
            }
        } catch (e) {
            console.error(`[LorebookManager] 保存书籍 ${name} 失败:`, e);
        }
        return false;
    }

    /**
     * 删除条目
     */
    async deleteEntry(uid: string | number): Promise<boolean> {
        if (!this.selectedBook || !this.currentBookData || !uid) return false;

        try {
            const book = this.currentBookData as any;
            const entriesContainer = book.entries || book.data;
            if (entriesContainer && entriesContainer[uid]) {
                delete entriesContainer[uid];
            } else {
                return false;
            }

            // 核心增强：仅使用 TavernHelper
            const helper = this.stHelper;
            if (helper && typeof helper.importRawWorldbook === 'function') {
                console.log(`[LorebookManager] Syncing via Helper (Delete Entry): ${this.selectedBook}`);
                const res = await helper.importRawWorldbook(this.selectedBook, JSON.stringify(this.currentBookData));
                
                // 兼容性处理
                const isSuccess = ((res as any) === true) || (res && (res as any).ok);
                
                if (isSuccess) {
                    await this.loadLorebook(this.selectedBook);
                    return true;
                }
            } else {
                console.error('[LorebookManager] Helper 不可用，无法删除条目');
            }
        } catch (e) {
            console.error('[LorebookManager] 删除条目失败:', e);
        }
        return false;
    }

    /**
     * 激活为全局世界书
     */
    async activateAsGlobal(bookName: string): Promise<boolean> {
        if (!bookName) return false;

        try {
            // 采用 TavernHelper 进行绑定
            const helper = this.stHelper;
            if (helper && typeof helper.rebindGlobalWorldbooks === 'function') {
                const globalBooks: string[] = helper.getGlobalWorldbookNames() || (this.ctx as any)?.world_info_global || [];
                // 无论是否已包含，都执行一次强制重新绑定，以确保 ST 刷新内部缓存
                const newList = globalBooks.includes(bookName) ? [...globalBooks] : [...globalBooks, bookName];
                await helper.rebindGlobalWorldbooks(newList);
                return true;
            } else {
                console.error('[LorebookManager] activateAsGlobal: Helper 不可用');
                return false;
            }
        } catch (e) {
            console.warn(`[LorebookManager] 激活全局世界书 ${bookName} 失败`, e);
            return false;
        }
    }

    getFilteredEntries(query: string): any[] {
        if (!query) return this.entries;
        const q = query.toLowerCase();
        return this.entries.filter((e: any) =>
            e.comment?.toLowerCase().includes(q) ||
            (e.keys || e.key)?.some((k: string) => typeof k === 'string' && k.toLowerCase().includes(q)) ||
            e.content?.toLowerCase().includes(q)
        );
    }

    public findTriggers(text: string): any[] {
        if (!text) return [];
        return this.entries.filter((entry: any) => {
            const keys = entry.keys || entry.key;
            if ((entry.enabled === false) || !keys) return false;
            return keys.some((k: string) => text.includes(k));
        });
    }

    public setEditingEntry(entry: LuminaLorebookEntry | null): void {
        this.activeEditingEntry = entry ? JSON.parse(JSON.stringify(entry)) : null;
        this.emit('EDITING_ENTRY_CHANGED', this.activeEditingEntry);
        this.emit('UPDATED');
    }

    /**
     * 从全局世界书列表中移除
     */
    async deactivateFromGlobal(bookName: string): Promise<boolean> {
        if (!bookName) return false;

        try {
            const helper = this.stHelper;
            if (helper && typeof helper.rebindGlobalWorldbooks === 'function') {
                const globalBooks: string[] = helper.getGlobalWorldbookNames() || (this.ctx as any)?.world_info_global || [];
                const newList = globalBooks.filter(name => name.replace(/\.json$/, '') !== bookName.replace(/\.json$/, ''));
                if (newList.length !== globalBooks.length) {
                    await helper.rebindGlobalWorldbooks(newList);
                }
                return true;
            } else {
                console.error('[LorebookManager] deactivateFromGlobal: Helper 不可用');
                return false;
            }
        } catch (e) {
            console.warn(`[LorebookManager] 取消激活全局世界书 ${bookName} 失败`, e);
            return false;
        }
    }
}
