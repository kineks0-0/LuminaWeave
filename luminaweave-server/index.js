"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
/**
 * LUMINAWEAVE SERVER PLUGIN - SOURCE CODE (TS)
 * 重要提示：请直接修改此 index.ts 文件。
 * index.js 仅为编译产物，手动修改将被覆盖。
 */
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
const openai_1 = __importDefault(require("openai"));
class TransactionStateMachine {
    static transitions = {
        pending: ['running'],
        running: ['committed', 'aborted', 'rolled_back'],
        committed: [],
        aborted: [],
        rolled_back: []
    };
    static canTransition(from, to) {
        return this.transitions[from].includes(to);
    }
}
class StreamingManager {
    states = new Map();
    getState(chatId) {
        if (!this.states.has(chatId)) {
            this.states.set(chatId, {
                buffer: '',
                rawBuffer: '',
                isGenerating: false,
                lastChunkTime: 0,
                nodeIndex: 0,
                status: 'idle',
                errorMessage: null,
                finishedAt: 0,
                lastTransactionId: undefined
            });
        }
        return this.states.get(chatId);
    }
    updateBuffer(chatId, chunk, isFull = false, rawChunk) {
        const state = this.getState(chatId);
        if (isFull) {
            state.buffer = chunk;
            if (rawChunk !== undefined)
                state.rawBuffer = rawChunk;
        }
        else {
            state.buffer += chunk;
            if (rawChunk !== undefined)
                state.rawBuffer = (state.rawBuffer || '') + rawChunk;
        }
        state.lastChunkTime = Date.now();
    }
    setGenerating(chatId, val, status, errorMessage, lastTransactionId) {
        const state = this.getState(chatId);
        state.isGenerating = val;
        if (val) {
            state.buffer = '';
            state.rawBuffer = '';
            state.lastChunkTime = Date.now();
            state.status = 'running';
            state.errorMessage = null;
            state.finishedAt = 0;
            state.lastTransactionId = undefined; // 重置事务 ID
        }
        else {
            state.status = status || 'success';
            state.errorMessage = errorMessage || null;
            state.finishedAt = Date.now();
            if (lastTransactionId) {
                state.lastTransactionId = lastTransactionId;
            }
        }
    }
}
/**
 * 核心 XML 拦截器 (后端移植版)
 */
class ServerXMLInterceptor {
    // 简易版拦截逻辑，仅处理已知标签
    static cleanText(text) {
        if (!text)
            return '';
        let clean = text;
        // 1. 阅后即焚 (Transient): <thinking>
        clean = clean.replace(/<thinking\b[^>]*?>(.*?)<\/thinking>/gis, '');
        clean = clean.replace(/<thinking(?:[^>]*?)$/is, ''); // 处理未闭合
        // 2. 持久化 (Persistent): <Chat_Reply> 剥离标签
        clean = clean.replace(/<Chat_Reply\b[^>]*?>(.*?)<\/Chat_Reply>/gis, '$1');
        return clean.trim();
    }
}
class LuminaWeaveServer {
    dataDir;
    dataFile;
    streaming;
    chatCache = new Map();
    transactionCache = new Map();
    dirtyChats = new Set();
    dirtyTransactions = new Set();
    syncTimer;
    abortControllers = new Map();
    constructor() {
        this.dataDir = path_1.default.join(__dirname, 'data');
        this.dataFile = path_1.default.join(this.dataDir, 'LuminaWeave.json');
        this.streaming = new StreamingManager();
        if (!fs_1.default.existsSync(this.dataDir)) {
            fs_1.default.mkdirSync(this.dataDir, { recursive: true });
        }
        this.syncTimer = setInterval(() => this.syncToDisk(), 5000);
    }
    syncToDisk() {
        for (const chatId of this.dirtyTransactions) {
            const records = this.transactionCache.get(chatId);
            if (records) {
                const txFile = this.getTransactionFile(chatId);
                const jsonl = records.map(record => JSON.stringify(record)).join('\n');
                fs_1.default.writeFileSync(txFile, jsonl ? `${jsonl}\n` : '', 'utf8');
            }
        }
        this.dirtyTransactions.clear();
        for (const chatId of this.dirtyChats) {
            const data = this.chatCache.get(chatId);
            if (data) {
                const chatFile = path_1.default.join(this.dataDir, `chat_${chatId}.jsonl`);
                const jsonl = data.map(item => JSON.stringify(item)).join('\n');
                fs_1.default.writeFileSync(chatFile, jsonl ? `${jsonl}\n` : '', 'utf8');
            }
        }
        this.dirtyChats.clear();
    }
    getTransactionFile(chatId) {
        return path_1.default.join(this.dataDir, `chat_${chatId}.tx.jsonl`);
    }
    readTransactionLog(chatId) {
        if (this.transactionCache.has(chatId)) {
            return this.transactionCache.get(chatId);
        }
        const txFile = this.getTransactionFile(chatId);
        let records = [];
        if (fs_1.default.existsSync(txFile)) {
            const lines = fs_1.default.readFileSync(txFile, 'utf8').split('\n').filter(line => line.trim());
            records = lines.map(line => JSON.parse(line));
        }
        this.transactionCache.set(chatId, records);
        return records;
    }
    writeTransactionLog(chatId, records) {
        this.transactionCache.set(chatId, records);
        this.dirtyTransactions.add(chatId);
    }
    readChat(chatId) {
        if (this.chatCache.has(chatId)) {
            return this.chatCache.get(chatId);
        }
        const chatFile = path_1.default.join(this.dataDir, `chat_${chatId}.jsonl`);
        let data = [];
        if (fs_1.default.existsSync(chatFile)) {
            const lines = fs_1.default.readFileSync(chatFile, 'utf8').split('\n').filter((l) => l.trim());
            data = lines.map(l => JSON.parse(l));
        }
        this.chatCache.set(chatId, data);
        return data;
    }
    writeChat(chatId, data) {
        this.chatCache.set(chatId, data);
        this.dirtyChats.add(chatId);
    }
    isAllTransactionsCompleted(chatId) {
        const records = this.readTransactionLog(chatId);
        return !records.some(r => r.status === 'pending' || r.status === 'running');
    }
    getLastCommittedSeq(records) {
        return records.reduce((max, record) => (record.status === 'committed' && record.seq > max ? record.seq : max), 0);
    }
    digestPayload(payload) {
        const text = JSON.stringify(payload) || '';
        let hash = 0;
        for (let i = 0; i < text.length; i++) {
            hash = ((hash << 5) - hash) + text.charCodeAt(i);
            hash |= 0;
        }
        return `dg_${Math.abs(hash).toString(16)}`;
    }
    generateTransactionId() {
        return `tx_${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36)}`;
    }
    createTransaction(chatId, scope, payloadDigest, idempotencyKey, seq) {
        const now = Date.now();
        return {
            id: this.generateTransactionId(),
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
    findTransactionByIdempotency(records, scope, idempotencyKey, payloadDigest) {
        for (let i = records.length - 1; i >= 0; i--) {
            const record = records[i];
            if (record.scope === scope && record.idempotencyKey === idempotencyKey && record.payloadDigest === payloadDigest && record.status === 'committed') {
                return record;
            }
        }
        return null;
    }
    findTransactionById(records, transactionId) {
        for (let i = records.length - 1; i >= 0; i--) {
            if (records[i].id === transactionId)
                return records[i];
        }
        return null;
    }
    findLatestTransaction(records, scope, idempotencyKey) {
        for (let i = records.length - 1; i >= 0; i--) {
            const record = records[i];
            if (scope && record.scope !== scope)
                continue;
            if (idempotencyKey && record.idempotencyKey !== idempotencyKey)
                continue;
            return record;
        }
        return null;
    }
    findTransactionsAfterSeq(records, afterSeq, scope, idempotencyKey, limit) {
        const filtered = records
            .filter(record => record.seq > afterSeq)
            .filter(record => !scope || record.scope === scope)
            .filter(record => !idempotencyKey || record.idempotencyKey === idempotencyKey)
            .sort((a, b) => {
            if (a.seq === b.seq)
                return a.updatedAt - b.updatedAt;
            return a.seq - b.seq;
        });
        if (typeof limit === 'number' && limit > 0) {
            return filtered.slice(0, limit);
        }
        return filtered;
    }
    rollbackTransaction(chatId, transactionId) {
        const records = this.readTransactionLog(chatId);
        const current = this.findTransactionById(records, transactionId);
        if (!current) {
            throw new Error('transaction_not_found');
        }
        if (current.status === 'rolled_back') {
            return current;
        }
        if (current.status === 'pending') {
            const running = this.transitionTransaction(current, 'running');
            return this.transitionTransaction(running, 'rolled_back');
        }
        if (current.status === 'running') {
            return this.transitionTransaction(current, 'rolled_back');
        }
        throw new Error('invalid_transaction_transition');
    }
    saveTransactionRecord(chatId, nextRecord) {
        const records = this.readTransactionLog(chatId);
        const next = records.filter(record => record.id !== nextRecord.id);
        next.push(nextRecord);
        this.writeTransactionLog(chatId, next);
    }
    transitionTransaction(record, nextStatus, error = null) {
        if (!TransactionStateMachine.canTransition(record.status, nextStatus)) {
            throw new Error('invalid_transaction_transition');
        }
        const nextRecord = {
            ...record,
            status: nextStatus,
            error,
            updatedAt: Date.now()
        };
        this.saveTransactionRecord(record.chatId, nextRecord);
        return nextRecord;
    }
    normalizeTransactionContext(raw) {
        if (!raw || typeof raw !== 'object')
            return {};
        const context = raw;
        const expectedSeq = typeof context.expectedSeq === 'number' ? context.expectedSeq : undefined;
        const idempotencyKey = typeof context.idempotencyKey === 'string' ? context.idempotencyKey : undefined;
        const lastTransactionId = typeof context.lastTransactionId === 'string' ? context.lastTransactionId : undefined;
        return { expectedSeq, idempotencyKey, lastTransactionId };
    }
    ensureMetadataRow(data) {
        const items = data;
        const idx = items.findIndex(item => item.type === 'metadata');
        if (idx >= 0) {
            return items[idx];
        }
        const metadata = { type: 'metadata' };
        items.unshift(metadata);
        return metadata;
    }
    attachTransactionMetadata(data, committedSeq, transactionId) {
        const metadata = this.ensureMetadataRow(data);
        metadata.transaction = {
            lastCommittedSeq: committedSeq,
            lastTransactionId: transactionId,
            updatedAt: Date.now()
        };
    }
    init(router) {
        router.get('/settings', (req, res) => {
            try {
                if (fs_1.default.existsSync(this.dataFile)) {
                    res.json(JSON.parse(fs_1.default.readFileSync(this.dataFile, 'utf8')));
                }
                else {
                    res.json({});
                }
            }
            catch (error) {
                res.status(500).json({ error: 'Failed' });
            }
        });
        router.post('/settings/save', (req, res) => {
            try {
                fs_1.default.writeFileSync(this.dataFile, JSON.stringify(req.body, null, 2), 'utf8');
                res.sendStatus(200);
            }
            catch (error) {
                res.status(500).json({ error: 'Failed' });
            }
        });
        router.get('/chat/:chatId', (req, res) => {
            const chatId = req.params.chatId;
            try {
                const data = this.readChat(chatId);
                if (data.length > 0) {
                    res.json(data);
                }
                else {
                    res.status(404).json({ error: 'Not found' });
                }
            }
            catch (error) {
                res.status(500).json({ error: 'Failed' });
            }
        });
        router.get('/chat/:chatId/sync-status', (req, res) => {
            const chatId = req.params.chatId;
            try {
                const isCompleted = this.isAllTransactionsCompleted(chatId);
                res.status(200).json({ success: true, isTransactionsCompleted: isCompleted });
            }
            catch (error) {
                res.status(500).json({ success: false, error: 'Failed to query sync status' });
            }
        });
        router.get('/chat/:chatId/transactions', (req, res) => {
            const chatId = req.params.chatId;
            try {
                const records = this.readTransactionLog(chatId);
                const transactionId = typeof req.query.transactionId === 'string' ? req.query.transactionId : undefined;
                const scopeQuery = typeof req.query.scope === 'string' ? req.query.scope : undefined;
                const idempotencyKey = typeof req.query.idempotencyKey === 'string' ? req.query.idempotencyKey : undefined;
                const afterSeqRaw = typeof req.query.afterSeq === 'string' ? Number(req.query.afterSeq) : undefined;
                const limitRaw = typeof req.query.limit === 'string' ? Number(req.query.limit) : undefined;
                const afterSeq = typeof afterSeqRaw === 'number' && Number.isFinite(afterSeqRaw) ? Math.max(0, Math.floor(afterSeqRaw)) : undefined;
                const limit = typeof limitRaw === 'number' && Number.isFinite(limitRaw) ? Math.max(0, Math.floor(limitRaw)) : undefined;
                const scope = scopeQuery === 'chat.save' || scopeQuery === 'chat.patch' || scopeQuery === 'nexus.generate'
                    ? scopeQuery
                    : undefined;
                if (transactionId) {
                    const transaction = this.findTransactionById(records, transactionId);
                    if (!transaction) {
                        return res.status(404).json({ success: false, error: { code: 'TXN_STORAGE_WRITE_FAILED', message: 'Transaction not found', retryable: false } });
                    }
                    return res.status(200).json({ success: true, transaction, lastCommittedSeq: this.getLastCommittedSeq(records) });
                }
                if (typeof afterSeq === 'number') {
                    const transactions = this.findTransactionsAfterSeq(records, afterSeq, scope, idempotencyKey, limit);
                    return res.status(200).json({
                        success: true,
                        transactions,
                        transaction: transactions.length > 0 ? transactions[transactions.length - 1] : null,
                        lastCommittedSeq: this.getLastCommittedSeq(records)
                    });
                }
                const latest = this.findLatestTransaction(records, scope, idempotencyKey);
                return res.status(200).json({
                    success: true,
                    transaction: latest,
                    lastCommittedSeq: this.getLastCommittedSeq(records)
                });
            }
            catch (error) {
                return res.status(500).json({ success: false, error: 'Failed to query transactions' });
            }
        });
        router.post('/chat/:chatId/transactions/:transactionId/rollback', (req, res) => {
            const chatId = req.params.chatId;
            const transactionId = req.params.transactionId;
            try {
                const rolledBack = this.rollbackTransaction(chatId, transactionId);
                const records = this.readTransactionLog(chatId);
                return res.status(200).json({ success: true, transaction: rolledBack, lastCommittedSeq: this.getLastCommittedSeq(records) });
            }
            catch (error) {
                const records = this.readTransactionLog(chatId);
                if (error instanceof Error && error.message === 'transaction_not_found') {
                    return res.status(404).json({
                        success: false,
                        error: { code: 'TXN_STORAGE_WRITE_FAILED', message: 'Transaction not found', retryable: false },
                        lastCommittedSeq: this.getLastCommittedSeq(records)
                    });
                }
                return res.status(409).json({
                    success: false,
                    error: { code: 'TXN_INVALID_TRANSITION', message: 'Rollback is only allowed for pending/running transaction', retryable: false },
                    lastCommittedSeq: this.getLastCommittedSeq(records)
                });
            }
        });
        router.post('/chat/save/:chatId', (req, res) => {
            const chatId = req.params.chatId;
            try {
                const records = this.readTransactionLog(chatId);
                const payloadBody = Array.isArray(req.body?.data) ? req.body.data : req.body;
                const payload = Array.isArray(payloadBody) ? payloadBody : [];
                const transactionContext = this.normalizeTransactionContext(req.body?.transactionContext);
                const payloadDigest = this.digestPayload(payload);
                const idempotencyKey = transactionContext.idempotencyKey || `chat.save:${chatId}:${payloadDigest}`;
                const lastCommittedSeq = this.getLastCommittedSeq(records);
                const expectedSeq = transactionContext.expectedSeq;
                if (typeof expectedSeq === 'number' && expectedSeq !== lastCommittedSeq) {
                    let conflictTx = this.createTransaction(chatId, 'chat.save', payloadDigest, idempotencyKey, lastCommittedSeq + 1);
                    this.saveTransactionRecord(chatId, conflictTx);
                    conflictTx = this.transitionTransaction(conflictTx, 'running');
                    conflictTx = this.transitionTransaction(conflictTx, 'aborted', {
                        code: 'TXN_SEQUENCE_CONFLICT',
                        message: `expectedSeq=${expectedSeq}, lastCommittedSeq=${lastCommittedSeq}`,
                        retryable: true
                    });
                    return res.status(409).json({ success: false, error: conflictTx.error, transaction: conflictTx, lastCommittedSeq });
                }
                const idempotentTx = this.findTransactionByIdempotency(records, 'chat.save', idempotencyKey, payloadDigest);
                if (idempotentTx) {
                    return res.status(200).json({ success: true, idempotentReplay: true, transaction: idempotentTx, lastCommittedSeq: this.getLastCommittedSeq(records) });
                }
                let tx = this.createTransaction(chatId, 'chat.save', payloadDigest, idempotencyKey, lastCommittedSeq + 1);
                this.saveTransactionRecord(chatId, tx);
                tx = this.transitionTransaction(tx, 'running');
                this.attachTransactionMetadata(payload, tx.seq, tx.id);
                this.writeChat(chatId, payload);
                tx = this.transitionTransaction(tx, 'committed');
                console.log(`[Nexus Server] writeChat 写入成功: 事务状态: committed, txId: ${tx.id}`);
                res.status(200).json({ success: true, transaction: tx, lastCommittedSeq: tx.seq, lastTransactionId: tx.id });
            }
            catch (error) {
                const records = this.readTransactionLog(chatId);
                const payloadBody = Array.isArray(req.body?.data) ? req.body.data : req.body;
                const payloadDigest = this.digestPayload(payloadBody);
                const idempotencyKey = this.normalizeTransactionContext(req.body?.transactionContext).idempotencyKey || `chat.save:${chatId}:${payloadDigest}`;
                let tx = this.createTransaction(chatId, 'chat.save', payloadDigest, idempotencyKey, this.getLastCommittedSeq(records) + 1);
                this.saveTransactionRecord(chatId, tx);
                tx = this.transitionTransaction(tx, 'running');
                tx = this.transitionTransaction(tx, 'aborted', {
                    code: 'TXN_STORAGE_WRITE_FAILED',
                    message: error instanceof Error ? error.message : 'Failed',
                    retryable: true
                });
                res.status(500).json({ success: false, error: tx.error, transaction: tx, lastTransactionId: tx.id });
            }
        });
        router.patch('/chat/:chatId', (req, res) => {
            const chatId = req.params.chatId;
            const payload = req.body;
            try {
                const records = this.readTransactionLog(chatId);
                const transactionContext = this.normalizeTransactionContext(payload?.transactionContext);
                const transactionPayload = {
                    added: payload?.added || [],
                    updated: payload?.updated || [],
                    deletedIds: payload?.deletedIds || [],
                    metadata: payload?.metadata || {}
                };
                const payloadDigest = this.digestPayload(transactionPayload);
                const idempotencyKey = transactionContext.idempotencyKey || `chat.patch:${chatId}:${payloadDigest}`;
                const lastCommittedSeq = this.getLastCommittedSeq(records);
                const expectedSeq = transactionContext.expectedSeq;
                if (typeof expectedSeq === 'number' && expectedSeq !== lastCommittedSeq) {
                    let conflictTx = this.createTransaction(chatId, 'chat.patch', payloadDigest, idempotencyKey, lastCommittedSeq + 1);
                    this.saveTransactionRecord(chatId, conflictTx);
                    conflictTx = this.transitionTransaction(conflictTx, 'running');
                    conflictTx = this.transitionTransaction(conflictTx, 'aborted', {
                        code: 'TXN_SEQUENCE_CONFLICT',
                        message: `expectedSeq=${expectedSeq}, lastCommittedSeq=${lastCommittedSeq}`,
                        retryable: true
                    });
                    return res.status(409).json({ success: false, error: conflictTx.error, transaction: conflictTx, lastCommittedSeq });
                }
                const idempotentTx = this.findTransactionByIdempotency(records, 'chat.patch', idempotencyKey, payloadDigest);
                if (idempotentTx) {
                    return res.status(200).json({ success: true, idempotentReplay: true, transaction: idempotentTx, lastCommittedSeq: this.getLastCommittedSeq(records) });
                }
                let tx = this.createTransaction(chatId, 'chat.patch', payloadDigest, idempotencyKey, lastCommittedSeq + 1);
                this.saveTransactionRecord(chatId, tx);
                tx = this.transitionTransaction(tx, 'running');
                let data = this.readChat(chatId);
                if (payload.deletedIds) {
                    const deleteSet = new Set(payload.deletedIds);
                    data = data.filter(item => item.type === 'metadata' || !deleteSet.has(item.id));
                }
                if (payload.updated) {
                    const updateMap = new Map(payload.updated.map((u) => [u.id, u]));
                    data = data.map(item => {
                        if (item.type !== 'metadata' && updateMap.has(item.id)) {
                            return Object.assign({}, item, updateMap.get(item.id));
                        }
                        return item;
                    });
                }
                if (payload.metadata) {
                    const metaIdx = data.findIndex(item => item.type === 'metadata');
                    if (metaIdx !== -1) {
                        data[metaIdx] = Object.assign({}, data[metaIdx], payload.metadata);
                    }
                    else {
                        data.unshift(Object.assign({ type: 'metadata' }, payload.metadata));
                    }
                }
                if (payload.added)
                    data.push(...payload.added);
                this.attachTransactionMetadata(data, tx.seq, tx.id);
                this.writeChat(chatId, data);
                tx = this.transitionTransaction(tx, 'committed');
                console.log(`[Nexus Server] patchChat 写入成功: 事务状态: committed, txId: ${tx.id}`);
                res.status(200).json({ success: true, count: data.length, transaction: tx, lastCommittedSeq: tx.seq, lastTransactionId: tx.id });
            }
            catch (error) {
                const records = this.readTransactionLog(chatId);
                const transactionContext = this.normalizeTransactionContext(payload?.transactionContext);
                const transactionPayload = {
                    added: payload?.added || [],
                    updated: payload?.updated || [],
                    deletedIds: payload?.deletedIds || [],
                    metadata: payload?.metadata || {}
                };
                const payloadDigest = this.digestPayload(transactionPayload);
                const idempotencyKey = transactionContext.idempotencyKey || `chat.patch:${chatId}:${payloadDigest}`;
                let tx = this.createTransaction(chatId, 'chat.patch', payloadDigest, idempotencyKey, this.getLastCommittedSeq(records) + 1);
                this.saveTransactionRecord(chatId, tx);
                tx = this.transitionTransaction(tx, 'running');
                tx = this.transitionTransaction(tx, 'aborted', {
                    code: 'TXN_STORAGE_WRITE_FAILED',
                    message: error instanceof Error ? error.message : 'Failed',
                    retryable: true
                });
                res.status(500).json({ success: false, error: tx.error, transaction: tx, lastTransactionId: tx.id });
            }
        });
        // --- Nexus Streaming API ---
        router.post('/nexus/generate', async (req, res) => {
            const { chatId, messages, nodes, settings } = req.body;
            if (!chatId || !messages)
                return res.status(400).json({ error: 'Missing params' });
            const state = this.streaming.getState(chatId);
            if (state.isGenerating)
                return res.status(409).json({ error: 'Already generating' });
            console.log(`[Nexus Server] LLM 请求开始 (Chat ID: ${chatId})`);
            // 如果已有旧任务，先强制掐断，防止内容重叠
            if (this.abortControllers.has(chatId)) {
                console.log(`[Nexus Server] 发现旧任务正在运行，强制掐断: ${chatId}`);
                this.abortControllers.get(chatId)?.abort();
                this.abortControllers.delete(chatId);
            }
            const controller = new AbortController();
            this.abortControllers.set(chatId, controller);
            this.streaming.setGenerating(chatId, true);
            res.json({ success: true }); // 立即返回，生成在后台继续
            // 后端异步生成流程
            (async () => {
                let lastError = null;
                let nodesToTry = nodes || [];
                try {
                    const configFile = path_1.default.join(__dirname, 'data', 'LuminaWeave.json');
                    if (fs_1.default.existsSync(configFile)) {
                        const config = JSON.parse(fs_1.default.readFileSync(configFile, 'utf8'));
                        const customApis = config['nexus.apis'] || [];
                        nodesToTry = nodesToTry.map((node) => {
                            if (node.provider === 'st_current_compatibility')
                                return node; // 前端已透传
                            const api = customApis.find((a) => a.id === node.provider);
                            if (api) {
                                return {
                                    ...node,
                                    url: api.url,
                                    key: api.key
                                };
                            }
                            return node;
                        });
                    }
                    for (let i = 0; i < nodesToTry.length; i++) {
                        const node = nodesToTry[i];
                        try {
                            if (!node.url || !node.key) {
                                console.warn(`[Nexus Server] Node ${i} skipped: Missing URL or Key (Provider: ${node.provider})`);
                                continue;
                            }
                            const client = new openai_1.default({
                                apiKey: node.key,
                                baseURL: node.url
                            });
                            const completionParams = {
                                model: node.model,
                                messages: messages,
                                stream: true,
                                temperature: settings?.temperature ?? 1.0,
                                signal: controller.signal, // 传递信号至 OpenAI SDK
                            };
                            // 修复：仅当 max_tokens 是有效的正整数时才添加该字段
                            if (typeof settings?.max_tokens === 'number' && settings.max_tokens > 0) {
                                completionParams.max_tokens = settings.max_tokens;
                            }
                            const stream = await client.chat.completions.create(completionParams);
                            let fullText = '';
                            let isFirstChunk = true;
                            for await (const chunk of stream) {
                                // 即使 SDK 处理了 signal，由于外部是 for await，双重检查更安全
                                if (controller.signal.aborted) {
                                    console.log(`[Nexus Server] 检测到 Abort 信号，停止 Token 消费: ${chatId}`);
                                    return; // 直接退出 IIFE
                                }
                                if (isFirstChunk) {
                                    console.log(`[Nexus Server] 正在生成中...`);
                                    isFirstChunk = false;
                                }
                                const content = chunk.choices[0]?.delta?.content || '';
                                if (content) {
                                    fullText += content;
                                    const cleaned = ServerXMLInterceptor.cleanText(fullText);
                                    this.streaming.updateBuffer(chatId, cleaned, true, fullText);
                                }
                            }
                            console.log(`[Nexus Server] 输出结束`);
                            const finalCleaned = ServerXMLInterceptor.cleanText(fullText);
                            let data = this.readChat(chatId);
                            const newNodeId = 'node_' + Math.random().toString(36).substring(2, 11) + Date.now().toString(36).substring(4);
                            let hash = 0;
                            const cleanedForHash = finalCleaned.replace(/[\u200B-\u200D\uFEFF]/g, '').replace(/\s+/g, ' ').trim();
                            for (let k = 0; k < cleanedForHash.length; k++) {
                                hash = ((hash << 5) - hash) + cleanedForHash.charCodeAt(k);
                                hash |= 0;
                            }
                            const fingerprint = `fp_${Math.abs(hash).toString(16).substring(0, 8)}`;
                            const metadata = data.find(item => item.type === 'metadata');
                            const nodeIds = new Set(data.filter(item => item.type !== 'metadata').map(item => item.id));
                            const requestedParentId = req.body.parentId || null;
                            const parentId = requestedParentId && nodeIds.has(requestedParentId)
                                ? requestedParentId
                                : (metadata?.activeLeafId || null);
                            const newMsg = {
                                id: newNodeId,
                                parentId: parentId,
                                name: req.body.charName || 'Assistant',
                                role: 'char',
                                is_user: false,
                                mesRaw: finalCleaned,
                                mes: finalCleaned,
                                pluginRaw: fullText,
                                fingerprint: fingerprint,
                                send_date: Date.now(),
                                extra: {}
                            };
                            data.push(newMsg);
                            if (metadata) {
                                metadata.activeLeafId = newNodeId;
                            }
                            else {
                                data.unshift({ type: 'metadata', activeLeafId: newNodeId, version: 2 });
                            }
                            // 为本次生成追加事务记录，确保前端能够获取正确的 lastTransactionId 以免除冗余刷新
                            const txId = 'tx_gen_' + Date.now().toString(36) + Math.random().toString(36).substring(2, 6);
                            let currentSeq = metadata?.lastCommittedSeq || 0;
                            const nextSeq = currentSeq + 1;
                            // 创建并保存一条正式的生成事务记录
                            const idempotencyKey = `chat.generate:${chatId}:${txId}`;
                            let tx = this.createTransaction(chatId, 'chat.generate', txId, idempotencyKey, nextSeq);
                            this.saveTransactionRecord(chatId, tx);
                            tx = this.transitionTransaction(tx, 'running');
                            if (metadata) {
                                metadata.lastTransactionId = tx.id;
                                metadata.lastCommittedSeq = tx.seq;
                            }
                            this.writeChat(chatId, data);
                            tx = this.transitionTransaction(tx, 'committed');
                            console.log(`[Nexus Server] 写入成功: 已持久化节点 ${newNodeId} 到 ${chatId}, 事务状态: committed, txId: ${tx.id}`);
                            this.streaming.setGenerating(chatId, false, 'success', null, tx.id);
                            return;
                        }
                        catch (err) {
                            const errMsg = err?.message || err?.toString?.() || 'Unknown error';
                            console.error(`[Nexus Server] Node ${i} 输出异常（${errMsg}）`);
                            lastError = err;
                        }
                    }
                    const finalErrMsg = lastError?.message || lastError?.toString?.() || '所有节点生成失败';
                    console.error(`[Nexus Server] 输出异常（${finalErrMsg}）`);
                    this.streaming.setGenerating(chatId, false, 'error', finalErrMsg);
                }
                catch (e) {
                    const errMsg = e?.message || e?.toString?.() || '后端生成流程异常';
                    console.error(`[Nexus Server] 输出异常（${errMsg}）`);
                    this.streaming.setGenerating(chatId, false, 'error', errMsg);
                }
                finally {
                    // 无论成功还是失败，都清理控制器
                    if (this.abortControllers.get(chatId) === controller) {
                        this.abortControllers.delete(chatId);
                    }
                }
            })();
        });
        router.get('/nexus/status/:chatId', (req, res) => {
            const state = this.streaming.getState(req.params.chatId);
            res.json(state);
        });
        router.post('/nexus/abort', (req, res) => {
            const { chatId } = req.body;
            console.log(`[Nexus Server] 收到中断请求: ${chatId}`);
            if (this.abortControllers.has(chatId)) {
                this.abortControllers.get(chatId)?.abort();
                this.abortControllers.delete(chatId);
            }
            this.streaming.setGenerating(chatId, false, 'aborted', '已停止生成');
            res.sendStatus(200);
        });
    }
}
const plugin = new LuminaWeaveServer();
module.exports = {
    info: {
        id: 'luminaweave',
        name: 'LuminaStatus Server Storage',
        description: 'Dedicated backend for LuminaWeave'
    },
    init: (router) => plugin.init(router)
};
