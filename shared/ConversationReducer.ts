import type {
    ConversationDocument,
    ConversationMutation,
    ConversationPluginState
} from './ConversationTypes.js';
import { validateConversationDocument } from './ConversationValidation.js';
import { resolveConversationSummary } from './ConversationSummaryResolver.js';

const mergePluginState = (
    current: ConversationPluginState,
    patch: Partial<ConversationPluginState> | undefined
): ConversationPluginState => {
    if (!patch) return current;
    return {
        chat: patch.chat ? { ...(current.chat || {}), ...patch.chat } : current.chat,
        forge: patch.forge ? { ...(current.forge || {}), ...patch.forge } : current.forge
    };
};

export const applyConversationMutation = (
    document: ConversationDocument,
    mutation: ConversationMutation
): ConversationDocument => {
    const next = validateConversationDocument({
        ...document,
        title: mutation.title ?? document.title,
        activeLeafId: mutation.activeLeafId ?? document.activeLeafId,
        updatedAt: mutation.updatedAt ?? Date.now(),
        pluginState: mergePluginState(document.pluginState, mutation.pluginState),
        transaction: {
            ...document.transaction,
            ...(mutation.transaction || {})
        }
    });

    if (mutation.nodes?.replace) {
        next.nodes = mutation.nodes.replace.map((node) => ({ ...node }));
    } else {
        const nodeMap = new Map(next.nodes.map((node) => [node.id, { ...node }]));
        mutation.nodes?.updated?.forEach((node) => {
            nodeMap.set(node.id, { ...nodeMap.get(node.id), ...node });
        });
        mutation.nodes?.added?.forEach((node) => {
            nodeMap.set(node.id, { ...node });
        });
        if (mutation.nodes?.deletedIds?.length) {
            mutation.nodes.deletedIds.forEach((id) => nodeMap.delete(id));
        }
        next.nodes = Array.from(nodeMap.values());
    }

    if (!next.activeLeafId) {
        next.activeLeafId = next.nodes[next.nodes.length - 1]?.id || null;
    }

    next.summary = resolveConversationSummary(next);
    next.summary.messageCount = next.nodes.length;
    return next;
};
