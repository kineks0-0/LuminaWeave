export type TransactionStatus = 'pending' | 'running' | 'committed' | 'aborted' | 'rolled_back';

export type TransactionScope = 'chat.save' | 'chat.patch' | 'nexus.generate';

export type TransactionErrorCode =
    | 'TXN_SEQUENCE_CONFLICT'
    | 'TXN_INVALID_TRANSITION'
    | 'TXN_STORAGE_WRITE_FAILED';

export interface TransactionErrorPayload {
    code: TransactionErrorCode;
    message: string;
    retryable: boolean;
}

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

export interface TransactionContextPayload {
    expectedSeq: number;
    idempotencyKey: string;
    lastTransactionId?: string;
}

export interface TransactionMutationResponse {
    success: boolean;
    idempotentReplay?: boolean;
    transaction?: TransactionRecord;
    lastCommittedSeq?: number;
    error?: TransactionErrorPayload;
}

export interface TransactionQueryResponse {
    success: boolean;
    transaction?: TransactionRecord | null;
    transactions?: TransactionRecord[];
    lastCommittedSeq?: number;
    error?: TransactionErrorPayload;
}
