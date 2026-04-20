import type { ConversationDocument } from './ConversationTypes.js';
import { CONVERSATION_SCHEMA_VERSION, createEmptyConversationDocument } from './ConversationTypes.js';
import { resolveConversationSummary } from './ConversationSummaryResolver.js';

const asRecord = (value: unknown): Record<string, unknown> =>
    value && typeof value === 'object' ? (value as Record<string, unknown>) : {};

export const isConversationDocument = (value: unknown): value is ConversationDocument => {
    const record = asRecord(value);
    return typeof record.id === 'string'
        && (record.conversationType === 'chat' || record.conversationType === 'forge')
        && Array.isArray(record.nodes)
        && typeof record.schemaVersion === 'number';
};

export const validateConversationDocument = (value: unknown): ConversationDocument => {
    if (!isConversationDocument(value)) {
        throw new Error('Invalid ConversationDocument');
    }

    const record = value as ConversationDocument;
    const normalized = createEmptyConversationDocument({
        id: record.id,
        conversationType: record.conversationType,
        title: record.title,
        createdAt: record.createdAt,
        updatedAt: record.updatedAt,
        activeLeafId: record.activeLeafId,
        nodes: Array.isArray(record.nodes) ? record.nodes : [],
        pluginState: record.pluginState || {},
        transaction: record.transaction || {},
        legacy: record.legacy
    });

    normalized.schemaVersion = typeof record.schemaVersion === 'number'
        ? record.schemaVersion
        : CONVERSATION_SCHEMA_VERSION;
    normalized.summary = resolveConversationSummary(normalized);
    normalized.summary.messageCount = normalized.nodes.length;
    return normalized;
};

export const assertConversationSchemaVersion = (document: ConversationDocument): void => {
    if (document.schemaVersion > CONVERSATION_SCHEMA_VERSION) {
        throw new Error(`Unsupported conversation schema version: ${document.schemaVersion}`);
    }
};
