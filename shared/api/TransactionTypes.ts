/**
 * 事务状态定义
 */
export type TransactionStatus = 'pending' | 'running' | 'committed' | 'aborted' | 'rolled_back';

/**
 * 事务作用域
 */
export type TransactionScope = 'chat.save' | 'chat.patch' | 'nexus.generate';

/**
 * 事务错误代码
 */
export type TransactionErrorCode =
    | 'TXN_SEQUENCE_CONFLICT'
    | 'TXN_INVALID_TRANSITION'
    | 'TXN_STORAGE_WRITE_FAILED';

/**
 * 事务错误载荷
 */
export interface TransactionErrorPayload {
    code: TransactionErrorCode;
    message: string;
    retryable: boolean;
}

/**
 * 事务记录模型
 */
export interface TransactionRecord {
    id: string;
    chatId: string;
    seq: number;
    status: TransactionStatus;
    scope: TransactionScope;
    payloadDigest: string;
    idempotencyKey: string;
    error: TransactionErrorPayload | null;
    createdAt: number;
    updatedAt: number;
}

/**
 * 事务上下文请求荷
 */
export interface TransactionContextPayload {
    expectedSeq: number;
    idempotencyKey: string;
    lastTransactionId?: string;
}

/**
 * 事务变更响应
 */
export interface TransactionMutationResponse {
    success: boolean;
    idempotentReplay?: boolean;
    transaction?: TransactionRecord;
    lastCommittedSeq?: number;
    error?: TransactionErrorPayload;
}

/**
 * 事务查询响应
 */
export interface TransactionQueryResponse {
    success: boolean;
    transaction?: TransactionRecord | null;
    transactions?: TransactionRecord[];
    lastCommittedSeq?: number;
    error?: TransactionErrorPayload;
}
