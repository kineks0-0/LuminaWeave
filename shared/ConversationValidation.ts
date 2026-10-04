import { z } from 'zod';
import type { ConversationDocument } from './ConversationTypes.js';
import { CONVERSATION_SCHEMA_VERSION, createEmptyConversationDocument } from './ConversationTypes.js';
import { resolveConversationSummary } from './ConversationSummaryResolver.js';

const conversationDocumentSchema = z.object({
    id: z.string(),
    conversationType: z.enum(['chat', 'forge']),
    nodes: z.array(z.unknown()),
    schemaVersion: z.number()
});

export const isConversationDocument = (value: unknown): value is ConversationDocument =>
    conversationDocumentSchema.safeParse(value).success;

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
