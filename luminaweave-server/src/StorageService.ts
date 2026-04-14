import path from 'path';
import fs from 'fs';
import { TransactionRecord, TransactionStatus, TransactionScope, TransactionError, TransactionErrorCode, PresetRecord, ForgeSessionRecord } from './types.js';
import { Logger } from './logger.js';

export class StorageService {
    private dataDir: string;
    private chatCache: Map<string, any[]> = new Map();
    private transactionCache: Map<string, TransactionRecord[]> = new Map();
    private dirtyChats: Set<string> = new Set();
    private dirtyTransactions: Set<string> = new Set();
    private presetsFile: string;
    private forgeSessionsFile: string;
    private appendLocks: Map<string, Promise<void>> = new Map();

    private chatsDir: string;
    private forgeDir: string;

    constructor(dataDir: string) {
        this.dataDir = dataDir;
        this.chatsDir = path.join(this.dataDir, 'chats');
        this.forgeDir = path.join(this.dataDir, 'forge');
        this.presetsFile = path.join(this.dataDir, 'presets.json');
        
        // 我们将索引文件移动到 forge 子目录，但构造函数中先保持对路径的定义
        this.forgeSessionsFile = path.join(this.forgeDir, 'forge_sessions.json');

        this.ensureDirectories();
        this.migrateLegacyData();
    }

    private ensureDirectories() {
        [this.dataDir, this.chatsDir, this.forgeDir].forEach(dir => {
            if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir, { recursive: true });
            }
        });
    }

    /**
     * 根据 chatId 自动解析存储目录
     */
    private getStorageDir(chatId: string): string {
        return chatId.startsWith('lw_card_') ? this.forgeDir : this.chatsDir;
    }

    /**
     * 根据 chatId 获取文件路径
     */
    private getChatFilePath(chatId: string, extension: string = '.jsonl'): string {
        if (!chatId || chatId === 'null' || chatId === 'undefined') {
            throw new Error(`Invalid chatId: ${chatId}`);
        }
        return path.join(this.getStorageDir(chatId), `chat_${chatId}${extension}`);
    }

    /**
     * 自动迁移 legacy 数据（从 data/ 移动到子目录）
     */
    private migrateLegacyData() {
        if (!fs.existsSync(this.dataDir)) return;

        // 迁移旧的 forge_sessions.json 如果它还在根目录
        const oldForgeSessions = path.join(this.dataDir, 'forge_sessions.json');
        if (fs.existsSync(oldForgeSessions)) {
            try {
                // 如果目标文件已存在，可能需要合并或跳过，这里简单重命名（如果目标不存在）
                if (!fs.existsSync(this.forgeSessionsFile)) {
                    fs.renameSync(oldForgeSessions, this.forgeSessionsFile);
                    Logger.info('Storage', '已迁移索引文件 forge_sessions.json 到 forge 目录');
                } else if (oldForgeSessions !== this.forgeSessionsFile) {
                    // 如果两个都在，择优或报错，这里选择删除旧的（假设新的已存在且有效）
                    fs.unlinkSync(oldForgeSessions);
                    Logger.warn('Storage', '根目录发现冗余 forge_sessions.json，已清理');
                }
            } catch (err) {
                Logger.error('Storage', '迁移索引文件失败', { error: (err as Error).message });
            }
        }

        const files = fs.readdirSync(this.dataDir);
        let migratedCount = 0;

        for (const file of files) {
            // 只处理 chat_*.jsonl 和 chat_*.tx.jsonl 文件
            if (!file.startsWith('chat_') || (!file.endsWith('.jsonl') && !file.endsWith('.tx.jsonl'))) {
                continue;
            }

            const oldPath = path.join(this.dataDir, file);
            // 提取 ID
            // chat_lw_card_xxx.jsonl -> lw_card_xxx
            const chatId = file.replace(/^chat_/, '').replace(/\.(tx\.)?jsonl$/, '');
            const targetDir = this.getStorageDir(chatId);
            const newPath = path.join(targetDir, file);

            try {
                if (!fs.existsSync(newPath)) {
                    fs.renameSync(oldPath, newPath);
                    migratedCount++;
                } else if (oldPath !== newPath) {
                    // 已存在则删除旧的，防止冲突
                    fs.unlinkSync(oldPath);
                }
            } catch (err) {
                Logger.error('Storage', `迁移文件失败: ${file}`, { error: (err as Error).message });
            }
        }

        if (migratedCount > 0) {
            Logger.info('Storage', `完成存量数据迁移: 共 ${migratedCount} 个文件已归类`);
        }
    }


    syncToDisk() {
        const txCount = this.dirtyTransactions.size;
        const chatCount = this.dirtyChats.size;
        if (txCount > 0 || chatCount > 0) {
            Logger.info('Storage', `开始后台持久化: 待写入事务=${txCount}, 待写入对话=${chatCount}`);
        }

        try {
            // 事务同步
            for (const chatId of this.dirtyTransactions) {
                this.flushTransactionsToDisk(chatId);
            }
            this.dirtyTransactions.clear();

            // 对话同步 (针对 PATCH/DELETE 等需要全量同步的操作)
            for (const chatId of this.dirtyChats) {
                this.flushChatToDisk(chatId);
            }
            this.dirtyChats.clear();
        } catch (err) {
            Logger.error('Storage', '后台持久化失败', { error: (err as Error).message });
        }
    }

    private flushTransactionsToDisk(chatId: string) {
        const records = this.transactionCache.get(chatId);
        if (records) {
            const txFile = this.getChatFilePath(chatId, '.tx.jsonl');
            const jsonl = records.map(record => JSON.stringify(record)).join('\n');
            fs.writeFileSync(txFile, jsonl ? `${jsonl}\n` : '', 'utf8');
        }
    }

    /**
     * 将指定对话的内存内容强制刷入磁盘 (全量覆写)。
     */
    flushChatToDisk(chatId: string) {
        const data = this.chatCache.get(chatId);
        if (data) {
            const chatFile = this.getChatFilePath(chatId);
            const jsonl = data.map(item => JSON.stringify(item)).join('\n');
            fs.writeFileSync(chatFile, jsonl ? `${jsonl}\n` : '', 'utf8');
            this.dirtyChats.delete(chatId);
            Logger.info('Storage', `对话已同步到磁盘: ${chatId} (总计 ${data.length} 条)`);
        }
    }

    // --- 对话读写 ---
    readChat(chatId: string): any[] {
        if (this.chatCache.has(chatId)) return this.chatCache.get(chatId)!;
        const chatFile = this.getChatFilePath(chatId);
        let data: any[] = [];
        if (fs.existsSync(chatFile)) {
            const lines = fs.readFileSync(chatFile, 'utf8').split('\n').filter((l: string) => l.trim());
            data = lines.map((l: string) => JSON.parse(l));
        }
        this.chatCache.set(chatId, data);
        return data;
    }

    writeChat(chatId: string, data: any[]) {
        this.chatCache.set(chatId, data);
        this.dirtyChats.add(chatId);
    }

    /**
     * 高性能追加单个节点：内存追加 + 物理文件追加。
     * 避免大文件全量重写。
     */
    appendChatRecord(chatId: string, item: any) {
        const data = this.readChat(chatId);
        const wasDirty = this.dirtyChats.has(chatId);
        data.push(item);
        
        // 物理追加优化
        const chatFile = this.getChatFilePath(chatId);
        try {
            fs.appendFileSync(chatFile, JSON.stringify(item) + '\n', 'utf8');
            // 如果原本是干净的，追加后依然认为它是干净的（因为文件已在磁盘同步追加）
            // 如果原本是脏的，维持脏状态，等待后续全量 flush 修复旧有的差异
            if (!wasDirty) {
                this.dirtyChats.delete(chatId); 
            }
            Logger.info('Storage', `对话已物理追加新节点: ${chatId} (ID: ${item.id}) [${wasDirty ? '维持脏状态' : '保持同步'}]`);
        } catch (err) {
            Logger.warn('Storage', `物理追加失败，回退到全量同步模式: ${chatId}`, { error: (err as Error).message });
            this.dirtyChats.add(chatId);
        }
    }

    /**
     * 更新对话元数据 (type === 'metadata')。
     * 并在下次 syncToDisk 时全量持久化。
     */
    updateChatMetadata(chatId: string, updates: Record<string, any>) {
        const data = this.readChat(chatId);
        const metaIdx = data.findIndex(item => item.type === 'metadata');
        const now = Date.now();

        if (metaIdx === -1) {
            // 如果不存在，在头部插入一个
            data.unshift({
                type: 'metadata',
                ...updates,
                updatedAt: now
            });
        } else {
            // 如果存在，进行合并更新
            data[metaIdx] = {
                ...data[metaIdx],
                ...updates,
                updatedAt: now
            };
        }

        // 标记为脏，触发全量 flush。因为 metadata 在文件开头，不支持物理追加更新单个字段。
        this.dirtyChats.add(chatId);
        Logger.info('Storage', `对话元数据已更新并标记脏状态: ${chatId}`);
    }

    // --- 事务核心 ---
    readTransactionLog(chatId: string): TransactionRecord[] {
        if (this.transactionCache.has(chatId)) return this.transactionCache.get(chatId)!;
        const txFile = this.getChatFilePath(chatId, '.tx.jsonl');
        let records: TransactionRecord[] = [];
        if (fs.existsSync(txFile)) {
            const lines = fs.readFileSync(txFile, 'utf8').split('\n').filter((line: string) => line.trim());
            records = lines.map((line: string) => JSON.parse(line));
        }
        this.transactionCache.set(chatId, records);
        return records;
    }

    writeTransactionLog(chatId: string, records: TransactionRecord[]) {
        this.transactionCache.set(chatId, records);
        this.dirtyTransactions.add(chatId);
    }

    isAllTransactionsCompleted(chatId: string): boolean {
        const records = this.readTransactionLog(chatId);
        return !records.some(r => r.status === 'pending' || r.status === 'running');
    }

    getLastCommittedSeq(records: TransactionRecord[]): number {
        return records.reduce((max, record) => (
            record.status === 'committed' && record.seq > max ? record.seq : max
        ), 0);
    }

    findTransactionById(records: TransactionRecord[], transactionId: string): TransactionRecord | null {
        return records.find(r => r.id === transactionId) || null;
    }

    findTransactionByIdempotency(records: TransactionRecord[], scope: TransactionScope, idempotencyKey: string, payloadDigest: string): TransactionRecord | null {
        return records.find(r => r.scope === scope && r.idempotencyKey === idempotencyKey && r.payloadDigest === payloadDigest && r.status === 'committed') || null;
    }

    findLatestTransaction(records: TransactionRecord[], scope?: TransactionScope, idempotencyKey?: string): TransactionRecord | null {
        for (let i = records.length - 1; i >= 0; i--) {
            if (scope && records[i].scope !== scope) continue;
            if (idempotencyKey && records[i].idempotencyKey !== idempotencyKey) continue;
            return records[i];
        }
        return null;
    }

    findTransactionsAfterSeq(records: TransactionRecord[], afterSeq: number, scope?: TransactionScope, idempotencyKey?: string, limit?: number): TransactionRecord[] {
        const filtered = records
            .filter(r => r.seq > afterSeq)
            .filter(r => !scope || r.scope === scope)
            .filter(r => !idempotencyKey || r.idempotencyKey === idempotencyKey)
            .sort((a, b) => a.seq - b.seq);
        return limit ? filtered.slice(0, limit) : filtered;
    }

    createTransaction(chatId: string, scope: TransactionScope, payloadDigest: string, idempotencyKey: string, seq: number): TransactionRecord {
        const now = Date.now();
        return {
            id: `tx_${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36)}`,
            chatId,
            seq,
            status: 'pending',
            scope,
            payloadDigest,
            idempotencyKey,
            error: null,
            createdAt: now,
            updatedAt: now
        };
    }

    transitionTransaction(chatId: string, record: TransactionRecord, nextStatus: TransactionStatus, error: TransactionError | null = null): TransactionRecord {
        const nextRecord: TransactionRecord = {
            ...record,
            status: nextStatus,
            error,
            updatedAt: Date.now()
        };
        const records = this.readTransactionLog(chatId).filter(r => r.id !== record.id);
        records.push(nextRecord);
        this.writeTransactionLog(chatId, records);
        Logger.info('Transaction', `状态流转: ${record.status} -> ${nextStatus}`, { txId: record.id, chatId });
        return nextRecord;
    }

    // --- 预设管理 ---
    readPresets(): PresetRecord[] {
        if (!fs.existsSync(this.presetsFile)) {
            const seeded = this.seedDefaultPresetsIfNeeded([]);
            this.writePresets(seeded);
            return seeded;
        }
        try {
            const raw = fs.readFileSync(this.presetsFile, 'utf8');
            const records = JSON.parse(raw);
            return this.seedDefaultPresetsIfNeeded(records);
        } catch {
            return this.seedDefaultPresetsIfNeeded([]);
        }
    }

    writePresets(records: PresetRecord[]) {
        const tmp = `${this.presetsFile}.tmp`;
        fs.writeFileSync(tmp, JSON.stringify(records, null, 2), 'utf8');
        fs.renameSync(tmp, this.presetsFile);
    }

    private seedDefaultPresetsIfNeeded(records: PresetRecord[]): PresetRecord[] {
        if (records.some(r => r.isDefault)) return records;
        const now = Date.now();
        const defaultPreset: PresetRecord = {
            id: 'preset_default_forge',
            name: 'Lumina Forge Default',
            isDefault: true,
            createdAt: now,
            updatedAt: now,
            blob: {
                name: 'Lumina Forge Default',
                settings: { temperature: 0.7, max_tokens: 1200 },
                prompts: [{ identifier: 'forge_system', role: 'system', content: '你是 Lumina Forge 的制卡助手。任务是根据设定与需求，生成一张角色卡。回复需结构清晰，保持信息密度。' }],
                prompt_order: [{ identifier: 'forge_system', enabled: true }]
            }
        };
        return [defaultPreset, ...records];
    }

    // --- 工具类 ---
    digestPayload(payload: any): string {
        const text = JSON.stringify(payload) || '';
        let hash = 0;
        for (let i = 0; i < text.length; i++) {
            hash = ((hash << 5) - hash) + text.charCodeAt(i);
            hash |= 0;
        }
        return `dg_${Math.abs(hash).toString(16)}`;
    }

    computeFingerprint(text: string): string {
        if (!text) return 'fp_0';
        const cleaned = text.replace(/[\u200B-\u200D\uFEFF]/g, '').replace(/\s+/g, ' ').trim();
        let hash = 0;
        for (let i = 0; i < cleaned.length; i++) {
            hash = ((hash << 5) - hash) + cleaned.charCodeAt(i);
            hash |= 0;
        }
        return `fp_${Math.abs(hash).toString(16).substring(0, 8)}`;
    }

    listChats(): Array<{
        chatId: string;
        updatedAt: number;
        messageCount: number;
        activeLeafId: string | null;
        previewMessage: string;
    }> {
        const files = fs.existsSync(this.chatsDir)
            ? fs.readdirSync(this.chatsDir).filter(name => /^chat_.+\.jsonl$/.test(name) && !name.endsWith('.tx.jsonl'))
            : [];

        return files.map((fileName) => {
            const chatId = fileName.replace(/^chat_/, '').replace(/\.jsonl$/, '');
            const records = this.readChat(chatId);
            const metadata = records.find(item => item?.type === 'metadata') || null;
            const messages = records.filter(item => item?.type !== 'metadata');
            const latestMessage = [...messages].reverse().find(item => typeof item?.mes === 'string' || typeof item?.message === 'string');
            const stat = fs.statSync(path.join(this.chatsDir, fileName));

            return {
                chatId,
                updatedAt: Number(metadata?.updatedAt || stat.mtimeMs || Date.now()),
                messageCount: messages.length,
                activeLeafId: metadata?.activeLeafId || null,
                previewMessage: String(latestMessage?.mes || latestMessage?.message || latestMessage?.mesRaw || '').slice(0, 160)
            };
        }).sort((a, b) => b.updatedAt - a.updatedAt);
    }

    readForgeSessions(): ForgeSessionRecord[] {
        if (!fs.existsSync(this.forgeSessionsFile)) return [];
        try {
            const raw = fs.readFileSync(this.forgeSessionsFile, 'utf8');
            const records = JSON.parse(raw);
            return Array.isArray(records) ? records : [];
        } catch {
            return [];
        }
    }

    writeForgeSessions(records: ForgeSessionRecord[]) {
        const tmp = `${this.forgeSessionsFile}.tmp`;
        fs.writeFileSync(tmp, JSON.stringify(records, null, 2), 'utf8');
        fs.renameSync(tmp, this.forgeSessionsFile);
    }

    listForgeSessions(): ForgeSessionRecord[] {
        const records = this.readForgeSessions();
        const indexedIds = new Set(records.map(r => r.sessionChatId));
        
        // 孤儿发现机制：扫描 forge 目录下的所有 lw_card 文件
        const files = fs.existsSync(this.forgeDir)
            ? fs.readdirSync(this.forgeDir).filter(name => name.startsWith('chat_lw_card_') && name.endsWith('.jsonl') && !name.endsWith('.tx.jsonl'))
            : [];

        files.forEach(file => {
            const chatId = file.replace(/^chat_/, '').replace(/\.jsonl$/, '');
            if (!indexedIds.has(chatId)) {
                // 发现孤儿，尝试恢复基本信息
                try {
                    const chatPath = path.join(this.forgeDir, file);
                    const firstLine = fs.readFileSync(chatPath, 'utf8').split('\n')[0];
                    const metadata = firstLine ? JSON.parse(firstLine) : {};
                    const stat = fs.statSync(chatPath);
                    
                    records.push({
                        id: `orphan_${chatId}`,
                        sessionChatId: chatId,
                        title: `恢复的会话: ${chatId.slice(8, 16)}`,
                        createdAt: stat.birthtimeMs,
                        updatedAt: metadata.updatedAt || stat.mtimeMs,
                        activeLayer: 'concept',
                        publishState: 'drafting',
                        workspaceMode: 'workspace',
                        // 其余字段留空或默认
                    } as any);
                    Logger.info('Storage', `发现并自动补录 Forge 孤儿会话: ${chatId}`);
                } catch (err) {
                    Logger.warn('Storage', `解析孤儿会话失败: ${chatId}`, { error: (err as Error).message });
                }
            }
        });

        return records.sort((a, b) => b.updatedAt - a.updatedAt);
    }

    getForgeSession(id: string): ForgeSessionRecord | null {
        return this.readForgeSessions().find(session => session.id === id) || null;
    }

    saveForgeSession(session: ForgeSessionRecord): ForgeSessionRecord {
        const sessions = this.readForgeSessions();
        const index = sessions.findIndex(item => item.id === session.id);
        if (index === -1) {
            sessions.push(session);
        } else {
            sessions[index] = session;
        }
        this.writeForgeSessions(sessions);
        return session;
    }
}
