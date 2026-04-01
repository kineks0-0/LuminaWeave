import { LorebookManager } from './LorebookManager';
import { promptBuilder } from './PromptBuilder';
import { lwStorage } from '../storage';
import { globalRegexSyncService } from './RegexSyncService';

/**
 * Camouflaged Topologies via World Info
 * 负责将注册的 PromptFragment 动态同步到 ST 的世界书中。
 */
export class PromptWorldInfoMount {
    private lorebookManager: LorebookManager;
    private _isSyncing: boolean = false;
    private _debounceTimer: any = null;

    constructor(lorebookManager: LorebookManager) {
        this.lorebookManager = lorebookManager;
    }

    private getBookName(): string {
        return lwStorage.get('lumina-settings.dedicatedPromptLorebookName', 'LuminaWeave_System', 'Global');
    }

    /**
     * 将当前可用的所有片段同步到特殊世界书 (带防抖处理)
     */
    public syncToWorldInfo() {
        if (this._debounceTimer) clearTimeout(this._debounceTimer);
        this._debounceTimer = setTimeout(() => this._executeSync(), 500);
    }

    private async _executeSync() {
        if (this._isSyncing) return;
        this._isSyncing = true;
        try {
            await this._performSync();
        } finally {
            this._isSyncing = false;
        }
    }

    private async _performSync() {
        const bookName = this.getBookName();
        const isGlobalEnabled = lwStorage.get('lumina-settings.isPromptInjectionEnabled', true, 'Global');

        if (!isGlobalEnabled) {
            console.log(`[PromptWorldInfoMount] 插件提示词已禁用，正在注销世界书 ${bookName}`);
            await this.lorebookManager.deactivateFromGlobal(bookName);
            return;
        }

        console.log(`[PromptWorldInfoMount] 开始同步提示词到世界书: ${bookName}`);

        // 确保世界书存在
        await this.lorebookManager.ensureBookExists(bookName);

        // 1. 获取现有书籍数据 (使用代理 getLorebookRaw)
        let bookData = await this.lorebookManager.getLorebookRaw(bookName) || {};

        // 2. 通过 promptBuilder 获取所有应注入的提示词和宏文本
        const fragmentsToMount = promptBuilder.buildWorldInfoPrompts();
        const newEntries: any = {};

        // 提取现有 entries 对象 (ST 可能是 { entries: { ... } } 或直接是 { ... })
        const existingEntries = bookData.entries || bookData.data || bookData || {};

        // 保留 Lumina 系统同步的条目
        Object.entries(existingEntries).forEach(([uid, entry]: [string, any]) => {
            const comment = entry.comment || '';
            const isLuminaEntry = comment.startsWith('[LuminaSys]') || comment.startsWith('[L]');
            if (!isLuminaEntry) {
                newEntries[uid] = entry;
            }
        });

        // 3. 将片段写入常量 (Constant) 条目
        for (const f of fragmentsToMount) {
            let contentText = '';
            const raw = f.getFragment();
            if (raw instanceof Promise) continue;
            if (!raw) continue;

            if (typeof raw === 'string') {
                contentText = raw;
            } else if (Array.isArray(raw)) {
                contentText = raw.map((m: any) => m.content).join('\n');
            } else {
                contentText = (raw as any).content || '';
            }

            if (!contentText) continue;

            const entryComment = `[L] ${f.label || f.id}`;
            const uid = `lw_${f.id}`;

            // 使用 Raw ST 格式 (补全 TavernHelper 预期的所有关键字)
            newEntries[uid] = {
                uid,
                key: [],
                keysecondary: [], // 核心修复：显式补全此字段，防止 TavernHelper 的 .map() 崩溃
                content: contentText,
                comment: entryComment,
                order: f.priority || 100,
                enabled: true,
                constant: true,
                selective: false,
                nsfw: false,
                role: 0, // System
                position: 1, // After Character Definition
                depth: 0,
                displayIndex: uid, // 补全 displayIndex
                extensions: { l_sync: true, system: true }
            };
        }

        // 4. 发起批量保存
        console.log(`[PromptWorldInfoMount] 正在批量同步 ${Object.keys(newEntries).length} 个条目至 ${bookName} `);
        const success = await this.lorebookManager.saveLorebook(bookName, newEntries);

        if (success) {
            // 自动将该书激活为全局世界书
            await this.lorebookManager.activateAsGlobal(bookName);
            console.log(`[PromptWorldInfoMount] 同步完成: ${bookName} `);

            // 同时触发正则规则同步，确保标签过滤也处于最新状态
            await globalRegexSyncService.syncLuminaRegexToST();
        } else {
            console.error(`[PromptWorldInfoMount] 同步失败: ${bookName} `);
        }
    }
}
