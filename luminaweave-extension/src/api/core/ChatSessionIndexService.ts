import type { ChatSessionRef } from '../../types/SessionTypes.js';
import { lwStorage } from '../storage.js';
import { BridgeDispatcher } from '../../../../shared/api/BridgeDispatcher.js';

type ServerChatSessionItem = {
    id: string;
    conversationType: 'chat' | 'forge';
    updatedAt: number;
    createdAt: number;
    messageCount: number;
    activeLeafId: string | null;
    previewMessage: string;
};

const sanitizePreviewText = (text: string): string => {
    return text
        .replace(/\s+/g, ' ')
        .replace(/^[:\-\s]+|[:\-\s]+$/g, '')
        .trim();
};

const buildTitleAndSummary = (chatId: string, previewMessage: string): { title: string; summary: string } => {
    const cleaned = sanitizePreviewText(previewMessage);
    if (!cleaned) {
        const suffix = chatId.slice(0, 10);
        return {
            title: `聊天 ${suffix}`,
            summary: '暂无预览内容'
        };
    }

    const titleCandidate = cleaned.slice(0, 22);
    const title = titleCandidate.length < cleaned.length ? `${titleCandidate}...` : titleCandidate;
    const summarySource = cleaned.length > titleCandidate.length ? cleaned.slice(titleCandidate.length).trim() : cleaned;
    const summary = summarySource.length > 72 ? `${summarySource.slice(0, 72)}...` : summarySource;

    return {
        title: title || `聊天 ${chatId.slice(0, 10)}`,
        summary: summary || cleaned
    };
};

export class ChatSessionIndexService {
    async listChatSessions(): Promise<ChatSessionRef[]> {
        try {
            const data = await BridgeDispatcher.conversation.listConversations() as { conversations?: ServerChatSessionItem[] };
            const chats = Array.isArray(data.conversations) ? data.conversations : [];

            return chats
                .filter(chat => chat.conversationType === 'chat')
                .sort((a, b) => b.updatedAt - a.updatedAt)
                .map((chat) => {
                    const previewMessage = chat.previewMessage || '';
                    const derived = buildTitleAndSummary(chat.id, previewMessage);
                    return {
                        id: chat.id,
                        title: derived.title,
                        source: 'lumina-server',
                        createdAt: chat.createdAt,
                        updatedAt: chat.updatedAt,
                        messageCount: chat.messageCount,
                        summary: derived.summary,
                        previewMessage,
                        activeLeafId: chat.activeLeafId
                    };
                });
        } catch {
            const { chatId } = lwStorage._getContextIds();
            if (!chatId || chatId === 'null' || chatId === 'undefined') return [];
            return [{
                id: chatId,
                title: `当前聊天 ${chatId.slice(0, 10)}`,
                source: 'st-current',
                createdAt: Date.now(),
                updatedAt: Date.now(),
                messageCount: 0,
                summary: '当前聊天会话',
                previewMessage: '',
                activeLeafId: null
            }];
        }
    }
}

export const chatSessionIndexService = new ChatSessionIndexService();
