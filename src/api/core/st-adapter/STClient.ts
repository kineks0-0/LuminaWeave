import { LuminaChatMessage } from '../ChatManager.js';
import { EnvDetector } from '../EnvDetector.js';
import { STProtocol } from './STProtocol.js';

export interface STMessageUpdate {
    index: number;
    content: string;
    name?: string;
    role?: string;
    is_hidden?: boolean;
    extra?: Record<string, unknown>;
}

export class STClient {
    private static _csrfToken: string | null = null;
    private static _csrfTime: number = 0;

    private static get stMain(): typeof SillyTavern | undefined {
        return EnvDetector.stMain;
    }

    private static get stHelper(): typeof TavernHelper | undefined {
        return EnvDetector.stHelper;
    }

    private static get ctx(): typeof SillyTavern | undefined {
        return EnvDetector.ctx;
    }

    static async getCsrfToken(): Promise<string> {
        if (!this._csrfToken || Date.now() - this._csrfTime > 300000) {
            const tokenRes = await fetch('/csrf-token');
            if (!tokenRes.ok) throw new Error('CSRF Token 获取失败');
            const tokenData = await tokenRes.json();
            this._csrfToken = tokenData.token;
            this._csrfTime = Date.now();
        }
        return this._csrfToken || '';
    }

    static getRawMessages(options: { includeSwipes?: boolean } = {}): any[] {
        const helper = this.stHelper;
        if (helper && typeof helper.getChatMessages === 'function') {
            try {
                const res = helper.getChatMessages('0-{{lastMessageId}}', { include_swipes: !!options.includeSwipes });
                if (Array.isArray(res)) {
                    return res.filter(Boolean);
                }
            } catch (e) {
                console.warn('[STClient] getChatMessages 失败，准备回退:', e);
            }
        }

        console.warn('[STClient] 尝试从 Context 回退...');
        const ctx = this.ctx;
        const messages = ctx?.chat;
        
        if (!Array.isArray(messages)) {
            console.warn('STClient: 无法从上下文获取 chat 数组，环境可能未就绪。返回空数组以避免异常。');
            return [];
        }
        
        type STCtxMessageLike = {
            mes?: string;
            role?: string;
            message_id?: number;
            data?: Record<string, unknown>;
        };

        return messages.filter(Boolean).map((m, index) => {
            const extra = this._normalizeExtra((m.extra || {}) as Record<string, unknown>);
            const mLike = m as unknown as STCtxMessageLike;
            let resolvedRole = (extra.role as string | undefined) || mLike.role || (m.is_user ? 'user' : 'assistant');
            if (m.is_user && resolvedRole !== 'user') resolvedRole = 'user';
            
            return {
                message_id: mLike.message_id ?? index,
                name: m.name || '',
                role: resolvedRole,
                is_hidden: m.is_system || false,
                message: mLike.mes || '',
                data: mLike.data || {},
                extra: { 
                    ...extra,
                    id: extra.id
                }
            };
        });
    }

    private static _normalizeExtra(extra: Record<string, unknown>): Record<string, unknown> {
        let out: Record<string, unknown> = { ...extra };
        for (let i = 0; i < 3; i++) {
            const nested = out.extra;
            if (!nested || typeof nested !== 'object' || Array.isArray(nested)) break;
            const nestedObj = nested as Record<string, unknown>;
            const { extra: _ignored, ...rest } = out;
            out = { ...rest, ...nestedObj };
        }
        return out;
    }

    private static _formatToSTRaw(msg: Partial<LuminaChatMessage> & { message?: string }): any {
        const isUser = msg.role === 'user';
        const isSystem = msg.role === 'system';
        const normalizedRole = STProtocol.normalizeRole(msg.role, !!msg.is_user);
        const payload: any = {
            name: msg.name || (isUser ? 'You' : 'Assistant'),
            role: normalizedRole || ((msg.role as ('system' | 'assistant' | 'user') | undefined) || (isUser ? 'user' : (isSystem ? 'system' : 'assistant'))),
            message: msg.mesRaw || msg.mes || msg.message || '',
            extra: this._normalizeExtra({ ...(msg.extra || {}), role: normalizedRole })
        };

        payload.is_hidden = msg.is_hidden ?? false;
        
        return payload;
    }

    static async updateMessages(updates: STMessageUpdate[], skipFlush = false): Promise<void> {
        if (updates.length === 0) return;
        const helper = this.stHelper;
        if (!helper || typeof helper.setChatMessages !== 'function' || typeof helper.getChatMessages !== 'function') {
            console.error('[STClient] 无法执行 updateMessages: 缺少 TavernHelper API');
            return;
        }

        const targets: any[] = [];
        for (const update of updates) {
            try {
                const existingMsgs = helper.getChatMessages(`${update.index}-${update.index}`, { include_swipes: true });
                const existingMsg = existingMsgs && existingMsgs.length > 0 ? existingMsgs[0] : null;

                if (!existingMsg) {
                    console.warn(`[STClient] updateMessages: 无法找到索引 ${update.index} 的消息`);
                    continue;
                }

                const targetPayload: any = { message_id: existingMsg.message_id };
                targetPayload.message = update.content;

                if (update.name) {
                    targetPayload.name = update.name;
                }
                if (update.role) {
                    targetPayload.role = STProtocol.normalizeRole(update.role, update.role === 'user');
                }
                if (update.is_hidden !== undefined) {
                    targetPayload.is_hidden = update.is_hidden;
                    targetPayload.is_system = update.is_hidden;
                }

                if (update.extra) {
                    const existingExtra = this._normalizeExtra(((existingMsg as any).extra || {}) as Record<string, unknown>);
                    const nextExtra = this._normalizeExtra(update.extra);
                    const merged = { ...existingExtra, ...nextExtra };
                    if (merged.role !== undefined) {
                        merged.role = STProtocol.normalizeRole(merged.role, merged.role === 'user');
                    }
                    targetPayload.extra = merged;
                }

                if (Array.isArray(existingMsg.swipes) && existingMsg.swipe_id !== undefined && existingMsg.swipe_id >= 0 && existingMsg.swipe_id < existingMsg.swipes.length) {
                    targetPayload.swipes = [...existingMsg.swipes];
                    targetPayload.swipes[existingMsg.swipe_id] = update.content;
                }

                targets.push(targetPayload);
            } catch (e) {
                console.error(`[STClient] updateMessages 处理索引 ${update.index} 异常:`, e);
            }
        }

        if (targets.length > 0) {
            await helper.setChatMessages(targets, { refresh: 'none' });
            if (!skipFlush) await this.flush();
        }
    }

    static async updateMessage(index: number, msgContent: string, name?: string, role?: string, extraData: Record<string, any> = {}, skipFlush = false): Promise<void> {
        await this.updateMessages([{ index, content: msgContent, name, role, extra: extraData }], skipFlush);
    }

    private static async stFetch(url: string, body: Record<string, any>): Promise<Response> {
        const token = await this.getCsrfToken();
        return await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-CSRF-Token': token
            },
            body: JSON.stringify(body)
        });
    }

    static async appendMessages(msgs: Partial<LuminaChatMessage>[], skipFlush = false): Promise<void> {
        if (msgs.length === 0) return;

        console.log(`[STClient] 执行 API 批量追加 (${msgs.length} 条)...`);
        const helper = this.stHelper;

        if (helper && typeof helper.createChatMessages === 'function') {
            const stFormattedMsgs = msgs.map(m => this._formatToSTRaw(m));
            try {
                await helper.createChatMessages(stFormattedMsgs, { refresh: 'none' });
            } catch (e) {
                console.error('[STClient] createChatMessages 失败:', e);
            }
        } else {
            console.error('[STClient] 无法找到 TavernHelper，追加消息失败');
        }

        if (!skipFlush) await this.flush();
    }

    static async appendMessage(msg: Partial<LuminaChatMessage>, skipFlush = false): Promise<void> {
        await this.appendMessages([msg], skipFlush);
    }

    static async deleteMessages(indices: number[], skipFlush = false): Promise<void> {
        if (indices.length === 0) return;
        const sortedIndices = [...indices].sort((a, b) => b - a);
        const helper = this.stHelper;
        if (!helper || typeof helper.deleteChatMessages !== 'function') {
            console.error('[STClient] 无法找到 TavernHelper API，删除消息失败');
            return;
        }

        try {
            const currentRaw = this.getRawMessages();
            const idsToDelete: number[] = [];

            for (const idx of sortedIndices) {
                const msg = currentRaw[idx];
                if (msg && typeof msg.message_id === 'number') {
                    idsToDelete.push(msg.message_id);
                } else {
                    idsToDelete.push(Number(idx));
                }
            }

            if (idsToDelete.length > 0) {
                await helper.deleteChatMessages(idsToDelete, { refresh: 'none' });
                if (!skipFlush) await this.flush();
            }
        } catch (e) {
            console.error('[STClient] deleteChatMessages 失败:', e);
        }
    }

    static async deleteMessage(index: number, skipFlush = false): Promise<void> {
        await this.deleteMessages([index], skipFlush);
    }

    static async flush(): Promise<void> {
        const st = this.stMain;
        if (st && typeof st.saveChat === 'function') {
            await st.saveChat();
        }

        const helper = this.stHelper;
        if (helper && helper.builtin && typeof helper.builtin.reloadAndRenderChatWithoutEvents === 'function') {
            try {
                await helper.builtin.reloadAndRenderChatWithoutEvents();
                return;
            } catch (e) {
                console.error('[STClient] reloadAndRenderChatWithoutEvents 失败，尝试回退:', e);
            }
        }

        const ctx = this.stMain;
        if (ctx && typeof ctx.reloadCurrentChat === 'function') {
            await ctx.reloadCurrentChat();
        } else if (typeof window !== 'undefined' && typeof (window as any).renderChat === 'function') {
            (window as any).renderChat();
        }
    }

    static async getPreset(name: string): Promise<Record<string, any> | null> {
        const helper = this.stHelper;
        if (helper && typeof helper.getPreset === 'function') {
            return helper.getPreset(name);
        }
        return null;
    }

    static substituteMacros(content: string): string {
        if (!content) return '';

        const glob = EnvDetector.stGlobal;
        const substituteParams = glob?.substituteParams || (typeof window !== 'undefined' && (window as any).substituteParams);
        if (typeof substituteParams === 'function') {
            try {
                return substituteParams(content);
            } catch (e) {
                console.warn('[STClient] substituteParams 调用失败:', e);
            }
        }

        const helper = this.stHelper;
        if (helper && typeof helper.substitudeMacros === 'function') {
            try {
                return helper.substitudeMacros(content);
            } catch (e) {
                console.warn('[STClient] substitudeMacros 调用失败:', e);
            }
        }

        return content;
    }

    static getInstructSettings(): any {
        const st = this.stMain as any;
        return {
            enabled: st?.powerUserSettings?.instruct?.enabled ?? false,
            template: st?.powerUserSettings?.instruct ?? {},
            settings: st?.chatCompletionSettings || {}
        };
    }

    static getMainApi(): string {
        return (this.stMain as any)?.mainApi || 'openai';
    }

    static async getTokenCount(text: string): Promise<number> {
        const getTokenCountAsync = (this.stMain as any)?.getTokenCountAsync;
        if (typeof getTokenCountAsync === 'function') {
            try {
                return await getTokenCountAsync(text);
            } catch (e) {
                console.error('[STClient] getTokenCountAsync 执行异常:', e);
            }
        }
        return Math.ceil(text.length / 4);
    }

    static getActiveWorldInfoItems(): { id: string, content: string, role: number }[] {
        const glob = EnvDetector.stGlobal as any;
        const activatedItems: any[] = glob?.world_info_active || (typeof window !== 'undefined' && (window as any).world_info_active) || [];

        if (Array.isArray(activatedItems)) {
            return activatedItems.map(item => ({
                id: item.id || item.uid || 'wi_item',
                content: item.content || '',
                role: item.role ?? 0
            }));
        }

        return [];
    }
}
