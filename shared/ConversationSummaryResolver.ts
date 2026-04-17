import type { ConversationDocument, ConversationSummary } from './ConversationTypes.js';

const cleanPreview = (text: string): string => text.replace(/\s+/g, ' ').trim();

export const resolveConversationPreview = (document: ConversationDocument): string => {
    for (let index = document.nodes.length - 1; index >= 0; index -= 1) {
        const node = document.nodes[index];
        const text = cleanPreview(node.mes || node.mesRaw || '');
        if (text) return text.slice(0, 160);
    }
    return '';
};

export const resolveConversationSummary = (document: ConversationDocument): ConversationSummary => ({
    id: document.id,
    schemaVersion: document.schemaVersion,
    conversationType: document.conversationType,
    title: document.title,
    createdAt: document.createdAt,
    updatedAt: document.updatedAt,
    activeLeafId: document.activeLeafId,
    previewMessage: resolveConversationPreview(document),
    messageCount: document.nodes.length
});
