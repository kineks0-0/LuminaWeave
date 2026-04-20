import type { ConversationDocument, ConversationSummary } from './ConversationTypes.js';

const cleanPreview = (text: string): string => text.replace(/\s+/g, ' ').trim();

const resolveCharacterMeta = (
    document: ConversationDocument
): Pick<ConversationSummary, 'characterId' | 'characterName' | 'characterAvatarUrl'> => {
    for (let index = document.nodes.length - 1; index >= 0; index -= 1) {
        const node = document.nodes[index];
        if (node.is_user || node.role === 'user') continue;

        return {
            characterId: node.characterId ?? null,
            characterName: cleanPreview(node.name || ''),
            characterAvatarUrl: typeof node.avatarUrl === 'string' ? node.avatarUrl : null
        };
    }

    const persistedCharacterMeta = document.pluginState.chat;
    const persistedCharacterName = cleanPreview(persistedCharacterMeta?.characterName || '');
    if (
        persistedCharacterMeta?.characterId != null
        || persistedCharacterName
        || typeof persistedCharacterMeta?.characterAvatarUrl === 'string'
    ) {
        return {
            characterId: persistedCharacterMeta?.characterId ?? null,
            characterName: persistedCharacterName,
            characterAvatarUrl: typeof persistedCharacterMeta?.characterAvatarUrl === 'string'
                ? persistedCharacterMeta.characterAvatarUrl
                : null
        };
    }

    return {
        characterId: null,
        characterName: '',
        characterAvatarUrl: null
    };
};

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
    messageCount: document.nodes.length,
    ...resolveCharacterMeta(document)
});
