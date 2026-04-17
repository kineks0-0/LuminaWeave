import fs from 'fs';
import path from 'path';
import {
    ConversationDocument,
    ConversationMutation,
    ConversationMutationResult,
    ConversationSummary,
    createEmptyConversationDocument
} from '../../shared/ConversationTypes.js';
import { applyConversationMutation } from '../../shared/ConversationReducer.js';
import { migrateLegacyChatArray, migrateLegacyForgeSession } from '../../shared/ConversationMigration.js';
import {
    assertConversationSchemaVersion,
    validateConversationDocument
} from '../../shared/ConversationValidation.js';
import { resolveConversationSummary } from '../../shared/ConversationSummaryResolver.js';
import { LuminaChatMessage } from '../../shared/LuminaMessage.js';
import {
    ForgeSessionRecord,
    PresetRecord,
    TransactionError,
    TransactionRecord,
    TransactionScope,
    TransactionStatus
} from './types.js';
import { Logger } from './logger.js';

const CONVERSATION_FILE_PREFIX = 'conversation_';
const CONVERSATION_FILE_SUFFIX = '.json';
const TRANSACTION_FILE_SUFFIX = '.tx.jsonl';

export class StorageService {
    private readonly dataDir: string;
    private readonly chatsDir: string;
    private readonly forgeDir: string;
    private readonly conversationsDir: string;
    private readonly transactionsDir: string;
    private readonly presetsFile: string;
    private readonly forgeSessionsFile: string;

    private readonly conversationCache = new Map<string, ConversationDocument>();
    private readonly conversationAliasCache = new Map<string, string>();
    private readonly transactionCache = new Map<string, TransactionRecord[]>();
    private readonly dirtyConversations = new Set<string>();
    private readonly dirtyTransactions = new Set<string>();

    constructor(dataDir: string) {
        this.dataDir = dataDir;
        this.chatsDir = path.join(this.dataDir, 'chats');
        this.forgeDir = path.join(this.dataDir, 'forge');
        this.conversationsDir = path.join(this.dataDir, 'conversations');
        this.transactionsDir = path.join(this.dataDir, 'transactions');
        this.presetsFile = path.join(this.dataDir, 'presets.json');
        this.forgeSessionsFile = path.join(this.forgeDir, 'forge_sessions.json');

        this.ensureDirectories();
        this.migrateLegacyData();
    }

    private ensureDirectories(): void {
        [this.dataDir, this.chatsDir, this.forgeDir, this.conversationsDir, this.transactionsDir].forEach((dir) => {
            if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir, { recursive: true });
            }
        });
    }

    private migrateLegacyData(): void {
        if (!fs.existsSync(this.dataDir)) return;

        const oldForgeSessions = path.join(this.dataDir, 'forge_sessions.json');
        if (fs.existsSync(oldForgeSessions) && !fs.existsSync(this.forgeSessionsFile)) {
            try {
                fs.renameSync(oldForgeSessions, this.forgeSessionsFile);
                Logger.info('Storage', '已迁移 legacy forge_sessions.json 到 forge 目录');
            } catch (error) {
                Logger.warn('Storage', '迁移 forge_sessions.json 失败', { error: (error as Error).message });
            }
        }

        const rootFiles = fs.readdirSync(this.dataDir);
        for (const file of rootFiles) {
            if (!file.startsWith('chat_') || (!file.endsWith('.jsonl') && !file.endsWith('.tx.jsonl'))) {
                continue;
            }

            const chatId = file.replace(/^chat_/, '').replace(/\.(tx\.)?jsonl$/, '');
            const targetDir = chatId.startsWith('lw_card_') ? this.forgeDir : this.chatsDir;
            const sourcePath = path.join(this.dataDir, file);
            const targetPath = path.join(targetDir, file);

            try {
                if (!fs.existsSync(targetPath)) {
                    fs.renameSync(sourcePath, targetPath);
                } else {
                    fs.unlinkSync(sourcePath);
                }
            } catch (error) {
                Logger.warn('Storage', `迁移 legacy 文件失败: ${file}`, { error: (error as Error).message });
            }
        }
    }

    syncToDisk(): void {
        try {
            for (const conversationId of this.dirtyConversations) {
                this.flushConversationToDisk(conversationId);
            }
            this.dirtyConversations.clear();

            for (const conversationId of this.dirtyTransactions) {
                this.flushTransactionsToDisk(conversationId);
            }
            this.dirtyTransactions.clear();
        } catch (error) {
            Logger.error('Storage', '后台持久化失败', { error: (error as Error).message });
        }
    }

    private getConversationFilePath(id: string): string {
        return path.join(this.conversationsDir, `${CONVERSATION_FILE_PREFIX}${id}${CONVERSATION_FILE_SUFFIX}`);
    }

    private getTransactionFilePath(id: string): string {
        return path.join(this.transactionsDir, `${CONVERSATION_FILE_PREFIX}${id}${TRANSACTION_FILE_SUFFIX}`);
    }

    private getLegacyChatFilePath(chatId: string, extension: '.jsonl' | '.tx.jsonl' = '.jsonl'): string {
        const dir = chatId.startsWith('lw_card_') ? this.forgeDir : this.chatsDir;
        return path.join(dir, `chat_${chatId}${extension}`);
    }

    private normalizeConversation(document: ConversationDocument): ConversationDocument {
        const normalized = validateConversationDocument(document);
        assertConversationSchemaVersion(normalized);
        normalized.summary = resolveConversationSummary(normalized);
        normalized.summary.messageCount = normalized.nodes.length;
        return normalized;
    }

    private cloneConversation(document: ConversationDocument): ConversationDocument {
        return this.normalizeConversation(JSON.parse(JSON.stringify(document)) as ConversationDocument);
    }

    private cacheConversation(document: ConversationDocument): ConversationDocument {
        const normalized = this.normalizeConversation(document);
        this.conversationCache.set(normalized.id, normalized);
        this.cacheConversationAliases(normalized);
        return normalized;
    }

    private cacheConversationAliases(document: ConversationDocument): void {
        this.conversationAliasCache.set(document.id, document.id);

        const legacyChatId = document.legacy?.legacyChatId;
        if (legacyChatId) {
            this.conversationAliasCache.set(legacyChatId, document.id);
        }

        const forgeSessionChatId = document.pluginState.forge?.sessionChatId;
        if (forgeSessionChatId) {
            this.conversationAliasCache.set(forgeSessionChatId, document.id);
        }
    }

    private readJsonlFile(filePath: string): any[] {
        if (!fs.existsSync(filePath)) return [];
        return fs.readFileSync(filePath, 'utf8')
            .split('\n')
            .filter((line) => line.trim())
            .map((line) => JSON.parse(line));
    }

    private readLegacyForgeSessions(): ForgeSessionRecord[] {
        if (!fs.existsSync(this.forgeSessionsFile)) return [];
        try {
            const raw = fs.readFileSync(this.forgeSessionsFile, 'utf8');
            const records = JSON.parse(raw);
            return Array.isArray(records) ? records : [];
        } catch {
            return [];
        }
    }

    private getLegacyForgeSessionById(sessionId: string): ForgeSessionRecord | null {
        return this.readLegacyForgeSessions().find((session) => session.id === sessionId) || null;
    }

    private getLegacyForgeSessionByChatId(sessionChatId: string): ForgeSessionRecord | null {
        return this.readLegacyForgeSessions().find((session) => session.sessionChatId === sessionChatId) || null;
    }

    private resolveCanonicalConversationId(id: string): string | null {
        if (!id) return null;

        const cached = this.conversationAliasCache.get(id);
        if (cached) return cached;

        if (fs.existsSync(this.getConversationFilePath(id))) {
            this.conversationAliasCache.set(id, id);
            return id;
        }

        const legacyForgeSession = this.getLegacyForgeSessionByChatId(id);
        if (legacyForgeSession?.id) {
            this.conversationAliasCache.set(id, legacyForgeSession.id);
            return legacyForgeSession.id;
        }

        if (fs.existsSync(this.getLegacyChatFilePath(id))) {
            this.conversationAliasCache.set(id, id);
            return id;
        }

        const conversationFiles = this.listConversationFileIds();
        for (const conversationId of conversationFiles) {
            const document = this.readConversation(conversationId);
            if (!document) continue;
            const resolved = this.conversationAliasCache.get(id);
            if (resolved) return resolved;
        }

        return null;
    }

    private listConversationFileIds(): string[] {
        if (!fs.existsSync(this.conversationsDir)) return [];
        return fs.readdirSync(this.conversationsDir)
            .filter((fileName) => fileName.startsWith(CONVERSATION_FILE_PREFIX) && fileName.endsWith(CONVERSATION_FILE_SUFFIX))
            .map((fileName) => fileName.slice(CONVERSATION_FILE_PREFIX.length, -CONVERSATION_FILE_SUFFIX.length));
    }

    private hydrateLegacyConversation(id: string): ConversationDocument | null {
        const legacyForgeSession = this.getLegacyForgeSessionById(id) || this.getLegacyForgeSessionByChatId(id);
        if (legacyForgeSession) {
            const legacyChatPayload = legacyForgeSession.sessionChatId
                ? this.readJsonlFile(this.getLegacyChatFilePath(legacyForgeSession.sessionChatId))
                : [];
            const migrated = migrateLegacyForgeSession(legacyForgeSession, legacyChatPayload);
            return this.applyLegacyTransactionState(migrated, legacyForgeSession.sessionChatId || id);
        }

        const legacyChatPath = this.getLegacyChatFilePath(id);
        if (fs.existsSync(legacyChatPath)) {
            const migrated = migrateLegacyChatArray(id, this.readJsonlFile(legacyChatPath));
            return this.applyLegacyTransactionState(migrated, id);
        }

        return null;
    }

    private applyLegacyTransactionState(document: ConversationDocument, transactionKey: string): ConversationDocument {
        const records = this.readLegacyTransactionLog(transactionKey);
        const lastCommitted = [...records]
            .filter((record) => record.status === 'committed')
            .sort((left, right) => right.seq - left.seq)[0];

        if (lastCommitted) {
            document.transaction.lastCommittedSeq = lastCommitted.seq;
            document.transaction.lastTransactionId = lastCommitted.id;
        }

        document.summary = resolveConversationSummary(document);
        document.summary.messageCount = document.nodes.length;
        return document;
    }

    private readLegacyTransactionLog(chatId: string): TransactionRecord[] {
        const txFile = this.getLegacyChatFilePath(chatId, '.tx.jsonl');
        if (!fs.existsSync(txFile)) return [];
        try {
            return fs.readFileSync(txFile, 'utf8')
                .split('\n')
                .filter((line) => line.trim())
                .map((line) => JSON.parse(line) as TransactionRecord);
        } catch {
            return [];
        }
    }

    readConversation(id: string): ConversationDocument | null {
        const canonicalId = this.resolveCanonicalConversationId(id) || id;
        const cached = this.conversationCache.get(canonicalId);
        if (cached) return this.cloneConversation(cached);

        const conversationFile = this.getConversationFilePath(canonicalId);
        if (fs.existsSync(conversationFile)) {
            try {
                const raw = JSON.parse(fs.readFileSync(conversationFile, 'utf8'));
                const document = this.cacheConversation(raw as ConversationDocument);
                return this.cloneConversation(document);
            } catch (error) {
                Logger.error('Storage', `读取 ConversationDocument 失败: ${canonicalId}`, { error: (error as Error).message });
                return null;
            }
        }

        const migrated = this.hydrateLegacyConversation(canonicalId);
        if (!migrated) return null;

        this.cacheConversation(migrated);
        return this.cloneConversation(migrated);
    }

    writeConversation(document: ConversationDocument): ConversationDocument {
        const normalized = this.cacheConversation(document);
        this.dirtyConversations.add(normalized.id);
        return this.cloneConversation(normalized);
    }

    saveConversation(id: string, document: ConversationDocument): ConversationMutationResult {
        const normalized = this.writeConversation({
            ...document,
            id
        });
        return {
            success: true,
            document: normalized,
            summary: resolveConversationSummary(normalized),
            lastCommittedSeq: normalized.transaction.lastCommittedSeq
        };
    }

    mutateConversation(id: string, mutation: ConversationMutation): ConversationMutationResult {
        const current = this.readConversation(id) || createEmptyConversationDocument({
            id,
            conversationType: id.startsWith('lw_card_') ? 'forge' : 'chat'
        });
        const next = applyConversationMutation(current, mutation);
        const normalized = this.writeConversation(next);
        return {
            success: true,
            document: normalized,
            summary: resolveConversationSummary(normalized),
            lastCommittedSeq: normalized.transaction.lastCommittedSeq
        };
    }

    listConversations(): ConversationSummary[] {
        const conversations = new Map<string, ConversationDocument>();

        for (const conversationId of this.listConversationFileIds()) {
            const document = this.readConversation(conversationId);
            if (document) conversations.set(document.id, document);
        }

        if (fs.existsSync(this.chatsDir)) {
            for (const fileName of fs.readdirSync(this.chatsDir)) {
                if (!/^chat_.+\.jsonl$/.test(fileName) || fileName.endsWith('.tx.jsonl')) continue;
                const chatId = fileName.replace(/^chat_/, '').replace(/\.jsonl$/, '');
                if (conversations.has(chatId)) continue;
                const document = this.readConversation(chatId);
                if (document) conversations.set(document.id, document);
            }
        }

        for (const session of this.readLegacyForgeSessions()) {
            if (conversations.has(session.id)) continue;
            const document = this.readConversation(session.id);
            if (document) conversations.set(document.id, document);
        }

        if (fs.existsSync(this.forgeDir)) {
            for (const fileName of fs.readdirSync(this.forgeDir)) {
                if (!/^chat_lw_card_.+\.jsonl$/.test(fileName) || fileName.endsWith('.tx.jsonl')) continue;
                const chatId = fileName.replace(/^chat_/, '').replace(/\.jsonl$/, '');
                const session = this.getLegacyForgeSessionByChatId(chatId);
                if (session?.id) continue;
                if (conversations.has(chatId)) continue;
                const document = this.readConversation(chatId);
                if (document) conversations.set(document.id, document);
            }
        }

        return Array.from(conversations.values())
            .map((document) => resolveConversationSummary(document))
            .sort((left, right) => right.updatedAt - left.updatedAt);
    }

    private flushConversationToDisk(id: string): void {
        const conversation = this.conversationCache.get(id);
        if (!conversation) return;

        const filePath = this.getConversationFilePath(id);
        const tmpPath = `${filePath}.tmp`;
        fs.writeFileSync(tmpPath, JSON.stringify(conversation, null, 2), 'utf8');
        fs.renameSync(tmpPath, filePath);
        this.dirtyConversations.delete(id);
    }

    private resolveTransactionOwnerId(id: string): string {
        return this.resolveCanonicalConversationId(id) || id;
    }

    readTransactionLog(id: string): TransactionRecord[] {
        const ownerId = this.resolveTransactionOwnerId(id);
        const cached = this.transactionCache.get(ownerId);
        if (cached) return [...cached];

        const filePath = this.getTransactionFilePath(ownerId);
        let records: TransactionRecord[] = [];

        if (fs.existsSync(filePath)) {
            records = this.readJsonlFile(filePath) as TransactionRecord[];
        } else {
            const conversation = this.readConversation(ownerId);
            const legacyCandidates = [
                id,
                ownerId,
                conversation?.legacy?.legacyChatId,
                conversation?.pluginState.forge?.sessionChatId
            ].filter((candidate): candidate is string => Boolean(candidate));

            for (const candidate of legacyCandidates) {
                records = this.readLegacyTransactionLog(candidate);
                if (records.length > 0) break;
            }
        }

        this.transactionCache.set(ownerId, records);
        return [...records];
    }

    writeTransactionLog(id: string, records: TransactionRecord[]): void {
        const ownerId = this.resolveTransactionOwnerId(id);
        this.transactionCache.set(ownerId, [...records]);
        this.dirtyTransactions.add(ownerId);
    }

    private flushTransactionsToDisk(id: string): void {
        const records = this.transactionCache.get(id);
        if (!records) return;
        const filePath = this.getTransactionFilePath(id);
        const jsonl = records.map((record) => JSON.stringify(record)).join('\n');
        fs.writeFileSync(filePath, jsonl ? `${jsonl}\n` : '', 'utf8');
        this.dirtyTransactions.delete(id);
    }

    isAllTransactionsCompleted(id: string): boolean {
        return !this.readTransactionLog(id).some((record) => record.status === 'pending' || record.status === 'running');
    }

    getLastCommittedSeq(records: TransactionRecord[]): number {
        return records.reduce((max, record) => (
            record.status === 'committed' && record.seq > max ? record.seq : max
        ), 0);
    }

    findTransactionById(records: TransactionRecord[], transactionId: string): TransactionRecord | null {
        return records.find((record) => record.id === transactionId) || null;
    }

    findTransactionByIdempotency(
        records: TransactionRecord[],
        scope: TransactionScope,
        idempotencyKey: string,
        payloadDigest: string
    ): TransactionRecord | null {
        return records.find((record) => (
            record.scope === scope
            && record.idempotencyKey === idempotencyKey
            && record.payloadDigest === payloadDigest
            && record.status === 'committed'
        )) || null;
    }

    findLatestTransaction(records: TransactionRecord[], scope?: TransactionScope, idempotencyKey?: string): TransactionRecord | null {
        for (let index = records.length - 1; index >= 0; index -= 1) {
            const record = records[index];
            if (scope && record.scope !== scope) continue;
            if (idempotencyKey && record.idempotencyKey !== idempotencyKey) continue;
            return record;
        }
        return null;
    }

    findTransactionsAfterSeq(
        records: TransactionRecord[],
        afterSeq: number,
        scope?: TransactionScope,
        idempotencyKey?: string,
        limit?: number
    ): TransactionRecord[] {
        const filtered = records
            .filter((record) => record.seq > afterSeq)
            .filter((record) => !scope || record.scope === scope)
            .filter((record) => !idempotencyKey || record.idempotencyKey === idempotencyKey)
            .sort((left, right) => left.seq - right.seq);
        return limit ? filtered.slice(0, limit) : filtered;
    }

    createTransaction(id: string, scope: TransactionScope, payloadDigest: string, idempotencyKey: string, seq: number): TransactionRecord {
        const ownerId = this.resolveTransactionOwnerId(id);
        const now = Date.now();
        return {
            id: `tx_${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36)}`,
            chatId: ownerId,
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

    transitionTransaction(
        id: string,
        record: TransactionRecord,
        nextStatus: TransactionStatus,
        error: TransactionError | null = null
    ): TransactionRecord {
        const ownerId = this.resolveTransactionOwnerId(id);
        const nextRecord: TransactionRecord = {
            ...record,
            chatId: ownerId,
            status: nextStatus,
            error,
            updatedAt: Date.now()
        };
        const records = this.readTransactionLog(ownerId).filter((item) => item.id !== record.id);
        records.push(nextRecord);
        this.writeTransactionLog(ownerId, records);

        const conversation = this.readConversation(ownerId);
        if (conversation && nextStatus === 'committed') {
            conversation.transaction.lastCommittedSeq = nextRecord.seq;
            conversation.transaction.lastTransactionId = nextRecord.id;
            conversation.updatedAt = Date.now();
            this.writeConversation(conversation);
        }

        return nextRecord;
    }

    private conversationToLegacyChatArray(document: ConversationDocument): any[] {
        const metadata = {
            type: 'metadata',
            activeLeafId: document.activeLeafId,
            updatedAt: document.updatedAt,
            version: 3.0,
            pluginData: document.pluginState.chat?.pluginData || null,
            transaction: {
                lastCommittedSeq: document.transaction.lastCommittedSeq,
                lastTransactionId: document.transaction.lastTransactionId
            }
        };
        return [metadata, ...document.nodes.map((node) => ({ ...node }))];
    }

    readChat(chatId: string): any[] {
        const document = this.readConversation(chatId);
        return document ? this.conversationToLegacyChatArray(document) : [];
    }

    writeChat(chatId: string, data: any[]): void {
        const existing = this.readConversation(chatId);
        const migrated = migrateLegacyChatArray(existing?.id || chatId, data, existing?.conversationType || (chatId.startsWith('lw_card_') ? 'forge' : 'chat'));

        if (existing?.conversationType === 'forge') {
            migrated.pluginState.forge = {
                ...(existing.pluginState.forge || {}),
                ...(migrated.pluginState.forge || {}),
                sessionChatId: existing.pluginState.forge?.sessionChatId || existing.legacy?.legacyChatId || chatId
            };
            migrated.legacy = {
                ...(existing.legacy || {}),
                ...(migrated.legacy || {})
            };
        }

        if (existing?.conversationType === 'chat') {
            migrated.pluginState.chat = {
                ...(existing.pluginState.chat || {}),
                ...(migrated.pluginState.chat || {})
            };
        }

        migrated.transaction = existing?.transaction || migrated.transaction;
        this.writeConversation(migrated);
    }

    appendChatRecord(chatId: string, item: any): void {
        const current = this.readConversation(chatId) || createEmptyConversationDocument({
            id: chatId,
            conversationType: chatId.startsWith('lw_card_') ? 'forge' : 'chat'
        });
        const next = applyConversationMutation(current, {
            nodes: {
                added: [{ ...item } as LuminaChatMessage]
            },
            updatedAt: Date.now()
        });
        this.writeConversation(next);
        this.flushConversationToDisk(next.id);
    }

    updateChatMetadata(chatId: string, updates: Record<string, any>): void {
        const current = this.readConversation(chatId) || createEmptyConversationDocument({
            id: chatId,
            conversationType: chatId.startsWith('lw_card_') ? 'forge' : 'chat'
        });

        const patch: ConversationMutation = {
            activeLeafId: updates.activeLeafId ?? current.activeLeafId,
            updatedAt: typeof updates.updatedAt === 'number' ? updates.updatedAt : Date.now(),
            transaction: updates.transaction ? {
                lastCommittedSeq: typeof updates.transaction.lastCommittedSeq === 'number'
                    ? updates.transaction.lastCommittedSeq
                    : current.transaction.lastCommittedSeq,
                lastTransactionId: typeof updates.transaction.lastTransactionId === 'string'
                    ? updates.transaction.lastTransactionId
                    : current.transaction.lastTransactionId
            } : undefined
        };

        if (updates.pluginData) {
            patch.pluginState = {
                chat: {
                    pluginData: updates.pluginData
                }
            };
        }

        const next = applyConversationMutation(current, patch);
        this.writeConversation(next);
        this.flushConversationToDisk(next.id);
    }

    private conversationToForgeSession(document: ConversationDocument): ForgeSessionRecord {
        const forgeState = document.pluginState.forge || {};
        return {
            id: document.id,
            sessionChatId: forgeState.sessionChatId || document.legacy?.legacyChatId || document.id,
            title: document.title,
            createdAt: document.createdAt,
            updatedAt: document.updatedAt,
            presetId: forgeState.presetId || '',
            activeLeafId: document.activeLeafId,
            worldlineNodes: document.nodes.map((node) => ({ ...node })),
            selectedChatSessionId: forgeState.selectedChatSessionId || null,
            selectedChatSnapshotId: forgeState.selectedChatSnapshotId || null,
            draftInput: forgeState.draftInput || '',
            stagingEntries: (forgeState.stagingEntries || []) as any[],
            commitReadyEntries: (forgeState.commitReadyEntries || []) as any[],
            virtualLorebookEntries: (forgeState.virtualLorebookEntries || []) as any[],
            importedLorebookId: forgeState.importedLorebookId || null,
            workflowSnapshot: forgeState.workflowSnapshot as any,
            structuredState: forgeState.structuredState,
            draftTree: forgeState.draftTree,
            forgeMemoryTree: forgeState.forgeMemoryTree,
            completedLayers: forgeState.completedLayers || [],
            publishState: (forgeState.publishState || 'drafting') as 'drafting' | 'workspace_frozen',
            workspaceMode: 'workspace'
        };
    }

    listChats(): Array<{
        chatId: string;
        updatedAt: number;
        messageCount: number;
        activeLeafId: string | null;
        previewMessage: string;
    }> {
        return this.listConversations()
            .filter((conversation) => conversation.conversationType === 'chat')
            .map((conversation) => ({
                chatId: conversation.id,
                updatedAt: conversation.updatedAt,
                messageCount: conversation.messageCount,
                activeLeafId: conversation.activeLeafId,
                previewMessage: conversation.previewMessage
            }));
    }

    readForgeSessions(): ForgeSessionRecord[] {
        return this.listForgeSessions();
    }

    writeForgeSessions(records: ForgeSessionRecord[]): void {
        records.forEach((record) => {
            this.saveForgeSession(record);
        });
    }

    listForgeSessions(): ForgeSessionRecord[] {
        return this.listConversations()
            .filter((conversation) => conversation.conversationType === 'forge')
            .map((conversation) => {
                const document = this.readConversation(conversation.id);
                return document ? this.conversationToForgeSession(document) : null;
            })
            .filter((session): session is ForgeSessionRecord => Boolean(session))
            .sort((left, right) => right.updatedAt - left.updatedAt);
    }

    getForgeSession(id: string): ForgeSessionRecord | null {
        const document = this.readConversation(id);
        if (!document || document.conversationType !== 'forge') return null;
        return this.conversationToForgeSession(document);
    }

    saveForgeSession(session: ForgeSessionRecord): ForgeSessionRecord {
        const existing = this.readConversation(session.id);
        const document = migrateLegacyForgeSession(session, session.worldlineNodes);
        document.transaction = existing?.transaction || document.transaction;
        document.updatedAt = session.updatedAt || Date.now();
        this.writeConversation(document);
        this.flushConversationToDisk(document.id);
        return this.conversationToForgeSession(document);
    }

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

    writePresets(records: PresetRecord[]): void {
        const tmp = `${this.presetsFile}.tmp`;
        fs.writeFileSync(tmp, JSON.stringify(records, null, 2), 'utf8');
        fs.renameSync(tmp, this.presetsFile);
    }

    private seedDefaultPresetsIfNeeded(records: PresetRecord[]): PresetRecord[] {
        if (records.some((record) => record.isDefault)) return records;
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

    digestPayload(payload: any): string {
        const text = JSON.stringify(payload) || '';
        let hash = 0;
        for (let index = 0; index < text.length; index += 1) {
            hash = ((hash << 5) - hash) + text.charCodeAt(index);
            hash |= 0;
        }
        return `dg_${Math.abs(hash).toString(16)}`;
    }

    computeFingerprint(text: string): string {
        if (!text) return 'fp_0';
        const cleaned = text.replace(/[\u200B-\u200D\uFEFF]/g, '').replace(/\s+/g, ' ').trim();
        let hash = 0;
        for (let index = 0; index < cleaned.length; index += 1) {
            hash = ((hash << 5) - hash) + cleaned.charCodeAt(index);
            hash |= 0;
        }
        return `fp_${Math.abs(hash).toString(16).substring(0, 8)}`;
    }
}
