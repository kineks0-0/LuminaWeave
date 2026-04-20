import { 
    TransactionContextPayload, 
    TransactionScope, 
    TransactionMutationResponse, 
    TransactionErrorPayload 
} from './TransactionTypes.js';

/**
 * 物理存储接口适配
 * 允许 TransactionEngine 在不依赖特定存储实现的情况下工作
 */
export interface ISequenceStorage {
    getSequence(chatId: string): Promise<number>;
    setSequence(chatId: string, seq: number): Promise<void>;
    getTransactionId(chatId: string): Promise<string | null>;
    setTransactionId(chatId: string, txId: string): Promise<void>;
}

/**
 * 事务逻辑引擎 (前后端共享)
 * 负责维护事务序列、构建上下文以及处理响应对齐。
 * 该引擎不直接持有 I/O 状态，而是通过 ISequenceStorage 与外界交互。
 */
export class TransactionEngine {
    constructor(private storage: ISequenceStorage) {}

    /**
     * 构建事务上下文
     */
    public async buildContext(chatId: string, scope: TransactionScope, payloadDigest: string): Promise<TransactionContextPayload> {
        const expectedSeq = await this.storage.getSequence(chatId);
        const lastTransactionId = await this.storage.getTransactionId(chatId) || undefined;
        
        return {
            expectedSeq,
            idempotencyKey: `${scope}:${chatId}:${payloadDigest}`,
            lastTransactionId
        };
    }

    /**
     * 处理事务响应
     */
    public async handleResponse(chatId: string, response: TransactionMutationResponse): Promise<void> {
        // 1. 更新最新提交的序列号
        const committedSeq = typeof response.lastCommittedSeq === 'number'
            ? response.lastCommittedSeq
            : (typeof response.transaction?.seq === 'number' ? response.transaction.seq : null);

        if (typeof committedSeq === 'number') {
            await this.storage.setSequence(chatId, committedSeq);
        }

        // 2. 更新最新集成的事务 ID
        if (response.transaction?.id) {
            await this.storage.setTransactionId(chatId, response.transaction.id);
        }

        // 3. 错误校验
        const txError = response.error as TransactionErrorPayload | undefined;
        if (txError && txError.code === 'TXN_SEQUENCE_CONFLICT') {
            const detail = txError.message || '事务序列冲突';
            throw new Error(`TXN_SEQUENCE_CONFLICT:${detail}`);
        }
    }

    /**
     * 对齐本地序列状态
     */
    public async alignState(chatId: string, remoteSeq: number, remoteTxId?: string): Promise<void> {
        await this.storage.setSequence(chatId, remoteSeq);
        if (remoteTxId) {
            await this.storage.setTransactionId(chatId, remoteTxId);
        }
    }

    /**
     * 计算数据摘要 (简单实现)
     */
    public static digest(payload: unknown): string {
        const text = JSON.stringify(payload) || '';
        let hash = 0;
        for (let i = 0; i < text.length; i++) {
            hash = ((hash << 5) - hash) + text.charCodeAt(i);
            hash |= 0;
        }
        return `dg_${Math.abs(hash).toString(16)}`;
    }
}
