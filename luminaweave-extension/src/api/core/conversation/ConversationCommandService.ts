import type { LuminaChatMessage } from '@shared/LuminaMessage.js';
import { pluginManager } from '../../../core/PluginManager.js';
import { lwStorage } from '../../storage.js';
import { BuiltinXMLTags, globalXMLInterceptor, XMLInterceptor } from '../xml-view/XMLInterceptor.js';
import type { ChatManager } from './ChatManager.js';
import { getChatMessageMutationPort, type ChatMessageMutationPort } from './ChatMessageMutationPort.js';

export type ConversationMessageCommand = 'edit' | 'add' | 'delete';
export type ConversationCommandEvent = 'MESSAGE_RECEIVED' | 'CHAT_UPDATED';

export interface ConversationCommandServiceDependencies {
    chatManager: ChatManager;
    getConversationMessages: () => Promise<LuminaChatMessage[]>;
    applyDisplayRegex: (
        text: string,
        source: 'user_input' | 'ai_output',
        depth: number
    ) => string;
    getUserName: () => string;
    getCharName: () => string;
    syncFromHost: () => Promise<void>;
    messageHost?: ChatMessageMutationPort;
}

export interface ConversationCommandResult {
    success: boolean;
    events: ConversationCommandEvent[];
}

export class ConversationCommandService {
    private readonly chatManager: ChatManager;
    private readonly getConversationMessages: () => Promise<LuminaChatMessage[]>;
    private readonly applyDisplayRegex: ConversationCommandServiceDependencies['applyDisplayRegex'];
    private readonly getUserName: () => string;
    private readonly getCharName: () => string;
    private readonly syncFromHost: () => Promise<void>;
    private readonly messageHostProvider: () => ChatMessageMutationPort;

    constructor(dependencies: ConversationCommandServiceDependencies) {
        this.chatManager = dependencies.chatManager;
        this.getConversationMessages = dependencies.getConversationMessages;
        this.applyDisplayRegex = dependencies.applyDisplayRegex;
        this.getUserName = dependencies.getUserName;
        this.getCharName = dependencies.getCharName;
        this.syncFromHost = dependencies.syncFromHost;
        this.messageHostProvider = () => dependencies.messageHost ?? getChatMessageMutationPort();
    }

    async mutateChatRecord(
        target: number | string,
        action: ConversationMessageCommand,
        newText = '',
        meta: Record<string, any> = {}
    ): Promise<ConversationCommandResult> {
        const chat = await this.getConversationMessages();
        if (!chat) return { success: false, events: [] };

        if (action === 'edit') {
            return this.runWithSyncLock(() => this.editMessage(chat, target, newText));
        }

        if (action === 'delete') {
            return this.runWithSyncLock(() => this.deleteMessage(chat, target));
        }

        if (action === 'add') {
            return this.runWithSyncLock(() => this.addMessage(newText, meta));
        }

        return { success: true, events: [] };
    }

    private async runWithSyncLock(fn: () => Promise<ConversationCommandResult>): Promise<ConversationCommandResult> {
        const syncService = this.chatManager.sync;
        syncService.pauseAutoSync();
        try {
            const result = await fn();
            await this.syncFromHost();
            return result;
        } finally {
            syncService.resumeAutoSync();
        }
    }

    private async editMessage(
        chat: LuminaChatMessage[],
        target: number | string,
        newText: string
    ): Promise<ConversationCommandResult> {
        const index = typeof target === 'number' ? target : chat.findIndex(message => message.id === target);
        if (index < 0 || index >= chat.length) {
            await this.saveIndependentChat();
            return { success: true, events: [] };
        }

        const messageHost = this.messageHostProvider();
        const msg = chat[index];
        const isUser = Boolean(msg.is_user);
        const source = isUser ? 'user_input' : 'ai_output';
        const depth = chat.length - 1 - index;
        const now = Date.now();
        const finalMesRaw = this.resolveMessageBody(newText, isUser);

        msg.mesRaw = finalMesRaw;
        msg.mesST = finalMesRaw;
        msg.mes = this.applyDisplayRegex(finalMesRaw, source, depth);
        msg.fingerprint = messageHost.getFingerprint(finalMesRaw);
        msg.stFingerprint = messageHost.getHostFingerprint(msg.mesST);
        msg.extra = {
            ...msg.extra,
            mesRaw_ts: now,
            mesRaw: finalMesRaw,
            mesST: msg.mesST,
            mes_ts: now,
            fingerprint: msg.fingerprint,
            stFingerprint: msg.stFingerprint
        };

        this.chatManager.activeLeafId = msg.id;

        const hostIndex = await messageHost.getHostIndex(msg.id);
        await messageHost.updateHostMessage({
            index: hostIndex ?? index,
            message: msg,
            content: messageHost.resolveHostWriteText(msg),
            extra: {
                id: msg.id,
                fingerprint: msg.fingerprint,
                stFingerprint: msg.stFingerprint,
                mesRaw: finalMesRaw,
                mesST: msg.mesST
            }
        });

        await this.saveIndependentChat();
        return { success: true, events: [] };
    }

    private async deleteMessage(
        chat: LuminaChatMessage[],
        target: number | string
    ): Promise<ConversationCommandResult> {
        const index = typeof target === 'number' ? target : chat.findIndex(message => message.id === target);
        if (index < 0 || index >= chat.length) {
            await this.saveIndependentChat();
            return { success: true, events: [] };
        }

        const msg = chat[index];
        this.chatManager.store.removeSubtree(msg.id);
        this.chatManager.activeLeafId = index > 0 ? chat[index - 1].id : null;

        const messageHost = this.messageHostProvider();
        const hostIndex = await messageHost.getHostIndex(msg.id);
        await messageHost.deleteHostMessage(hostIndex ?? index);

        await this.saveIndependentChat();
        return { success: true, events: [] };
    }

    private async addMessage(
        newText: string,
        meta: Record<string, any>
    ): Promise<ConversationCommandResult> {
        const isUser = Boolean(meta.is_user);
        const source = isUser ? 'user_input' : 'ai_output';
        const displayText = this.applyDisplayRegex(newText, source, 0);
        const parentId = this.chatManager.activeLeafId;
        const finalMesRaw = this.resolveMessageBody(newText, isUser);
        const contextIds = lwStorage._getContextIds();
        const chatId = contextIds.chatId;
        const messageHost = this.messageHostProvider();

        const newMsg = {
            name: meta.name || (isUser ? this.getUserName() : this.getCharName()),
            is_user: isUser,
            role: isUser ? 'user' : 'assistant',
            pluginRaw: meta.pluginRaw || null,
            mesRaw: finalMesRaw,
            mesST: finalMesRaw,
            mes: displayText,
            characterId: contextIds.charId,
            parentId,
            extra: {}
        } as LuminaChatMessage;

        const currentTrace = this.chatManager.store.getTrace(this.chatManager.activeLeafId);
        const fingerprint = messageHost.getFingerprint(newMsg.mesRaw);
        newMsg.fingerprint = fingerprint;
        newMsg.stFingerprint = messageHost.getHostFingerprint(newMsg.mesST ?? newMsg.mesRaw ?? newMsg.mes ?? '');

        const existingChildren = this.chatManager.store.getChildren(this.chatManager.activeLeafId);
        const matchingNode = existingChildren.find(node => node.fingerprint === fingerprint && node.role === newMsg.role);
        if (matchingNode) {
            console.log('[LuminaWeave API] 检测到同内容子节点，执行复用:', matchingNode.id);
            this.chatManager.activeLeafId = matchingNode.id;
            await this.chatManager.persistence.saveToIndependentChat(chatId);
            await this.chatManager.commitToST();
            return { success: true, events: ['MESSAGE_RECEIVED'] };
        }

        newMsg.id = messageHost.generateNodeId();
        if (newMsg.parentId === undefined) {
            newMsg.parentId = this.chatManager.activeLeafId;
        }

        pluginManager.callHooks('onMessageAdding', newMsg, currentTrace);
        this.chatManager.store.upsertNode(newMsg);
        this.chatManager.activeLeafId = newMsg.id;

        newMsg.extra = {
            ...newMsg.extra,
            id: newMsg.id,
            fingerprint: newMsg.fingerprint,
            stFingerprint: newMsg.stFingerprint,
            mesRaw: finalMesRaw,
            mesST: newMsg.mesST
        };
        await messageHost.appendHostMessage(newMsg);
        await this.chatManager.appendToIndependentChat(newMsg);

        pluginManager.callHooks('onMessageAdded', newMsg, currentTrace);
        return { success: true, events: [] };
    }

    async rebuildCurrentChatMessages(): Promise<{ total: number; rebuilt: number }> {
        const messages = this.chatManager.store.nodePool;
        let rebuilt = 0;
        const messageHost = this.messageHostProvider();
        for (const msg of messages) {
            const oldFingerprint = msg.fingerprint;
            messageHost.syncMessageCalculatedFields(msg, { force: true });
            if (oldFingerprint !== msg.fingerprint) {
                rebuilt += 1;
            }
        }
        if (rebuilt > 0) {
            const { chatId } = lwStorage._getContextIds();
            await this.chatManager.commitToST();
            await this.chatManager.persistence.saveToIndependentChat(chatId);
        }
        return { total: messages.length, rebuilt };
    }

    private resolveMessageBody(text: string, isUser: boolean): string {
        if (isUser) return text;
        return XMLInterceptor.extractTagContent(text, BuiltinXMLTags.CHAT_REPLY).join('\n\n')
            || globalXMLInterceptor.processAndCleanText(text, false);
    }

    private async saveIndependentChat(): Promise<void> {
        const { chatId } = lwStorage._getContextIds();
        await this.chatManager.persistence.saveToIndependentChat(chatId);
    }
}
