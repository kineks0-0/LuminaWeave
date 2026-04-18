import { LuminaChatMessage } from '../../../../../shared/LuminaMessage.js';
import { EnvDetector } from '../EnvDetector.js';
import { STProtocol } from './STProtocol.js';

export interface STMessageUpdate {
    index: number;
    content: string;
    name?: string;
    role?: string;
    is_hidden?: boolean;
    extra?: Record<string, unknown>;
    expectedSwipeId?: number;
    expectedActiveSwipeText?: string;
}

export class STClient {
    private static _csrfToken: string | null = null;
    private static _csrfTime: number = 0;
    private static readonly INVALID_CSRF_ERROR = 'LW_INVALID_CSRF_TOKEN';

    private static get stMain(): typeof SillyTavern | undefined {
        return EnvDetector.stMain;
    }

    private static get stHelper(): typeof TavernHelper | undefined {
        return EnvDetector.stHelper;
    }

    private static get ctx(): typeof SillyTavern | undefined {
        return EnvDetector.ctx;
    }

    private static _fetchPromise: Promise<string> | null = null;

    static invalidateCsrfToken(): void {
        this._csrfToken = null;
        this._csrfTime = 0;
    }

    static async refreshCsrfToken(): Promise<string> {
        this.invalidateCsrfToken();
        return this.getCsrfToken();
    }

    static isInvalidCsrfError(error: unknown): boolean {
        return error instanceof Error && error.message === this.INVALID_CSRF_ERROR;
    }

    static async isInvalidCsrfResponse(response: Response): Promise<boolean> {
        if (response.status !== 403) return false;

        try {
            const text = await response.clone().text();
            return /csrf/i.test(text) || /invalid csrf token/i.test(text);
        } catch {
            return /csrf/i.test(response.statusText);
        }
    }

    static createInvalidCsrfError(): Error {
        return new Error(this.INVALID_CSRF_ERROR);
    }

    static async getCsrfToken(): Promise<string> {
        // 如果正在请求中，直接复用已有的 Promise
        if (this._fetchPromise) return this._fetchPromise;

        const isExpired = Date.now() - this._csrfTime > 300000;
        if (!this._csrfToken || isExpired) {
            this._fetchPromise = (async () => {
                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), 5000);
                
                try {
                    const tokenRes = await fetch('/csrf-token', { signal: controller.signal });
                    if (!tokenRes.ok) throw new Error(`CSRF Token 获取失败 (HTTP ${tokenRes.status})`);
                    
                    const tokenData = await tokenRes.json();
                    if (!tokenData?.token) throw new Error('CSRF Token 数据格式异常');

                    this._csrfToken = tokenData.token;
                    this._csrfTime = Date.now();
                    return this._csrfToken as string;
                } catch (e: any) {
                    console.error('[STClient] 获取 CSRF Token 异常:', e.name === 'AbortError' ? '请求超时 (5s)' : e.message);
                    // 如果获取失败，但原本已有 Token（即便过期了点点），可能仍可尝试复用，除非是彻底没 Token
                    if (this._csrfToken) return this._csrfToken;
                    throw e;
                } finally {
                    clearTimeout(timeoutId);
                    this._fetchPromise = null;
                }
            })();
            return this._fetchPromise;
        }
        return this._csrfToken || '';
    }

    static getRawMessages(options: { includeSwipes?: boolean } = {}): any[] {
        const helper = this.stHelper;
        if (helper && typeof helper.getChatMessages === 'function') {
            try {
                const res = helper.getChatMessages('0-{{lastMessageId}}', { include_swipes: true });
                if (Array.isArray(res)) {
                    const filtered = res.filter(Boolean);
                    return filtered.map((msg, index) => this._normalizeHelperMessage(msg, index, filtered.length));
                }
            } catch (e) {
                if (!EnvDetector.isSilenceMode) console.warn('[STClient] getChatMessages 失败，准备回退:', e);
            }
        }

        if (!EnvDetector.isSilenceMode) console.warn('[STClient] 尝试从 Context 回退...');
        const ctx = this.ctx;
        const messages = ctx?.chat;
        console.log(`[STClient] 从上下文获取 chat 数组，长度: ${Array.isArray(messages) ? messages.length : 'null/undefined'}`);
        
        if (!Array.isArray(messages)) {
            if (!EnvDetector.isSilenceMode) console.warn('STClient: 无法从上下文获取 chat 数组，环境可能未就绪。返回空数组以避免异常。');
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
                mes: mLike.mes || '',
                data: mLike.data || {},
                extra: { 
                    ...extra,
                    message_id: mLike.message_id ?? index,
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

    private static _resolveActiveSwipeIndex(msg: any): number | undefined {
        const swipeId = typeof msg?.swipe_id === 'number' ? msg.swipe_id : undefined;
        if (!Array.isArray(msg?.swipes) || msg.swipes.length === 0) {
            return swipeId;
        }
        if (swipeId === undefined || swipeId < 0 || swipeId >= msg.swipes.length) {
            return undefined;
        }
        return swipeId;
    }

    private static _resolveActiveSwipeText(msg: any): string {
        const swipeId = this._resolveActiveSwipeIndex(msg);
        if (swipeId !== undefined && Array.isArray(msg?.swipes)) {
            const swipeText = msg.swipes[swipeId];
            if (typeof swipeText === 'string') {
                return swipeText;
            }
        }
        if (typeof msg?.message === 'string') return msg.message;
        if (typeof msg?.mes === 'string') return msg.mes;
        return '';
    }

    private static _resolveActiveSwipeExtra(msg: any): Record<string, unknown> {
        const swipeId = this._resolveActiveSwipeIndex(msg);
        if (swipeId === undefined || !Array.isArray(msg?.swipes_info)) {
            return {};
        }
        const swipeInfo = msg.swipes_info[swipeId];
        if (!swipeInfo || typeof swipeInfo !== 'object') {
            return {};
        }
        const rawExtra = (swipeInfo as Record<string, unknown>).extra;
        if (!rawExtra || typeof rawExtra !== 'object' || Array.isArray(rawExtra)) {
            return {};
        }
        return this._normalizeExtra(rawExtra as Record<string, unknown>);
    }

    private static _applyTavernRegex(
        text: string,
        source: 'user_input' | 'ai_output' | 'slash_command' | 'world_info' | 'reasoning',
        destination: 'display' | 'prompt',
        options: { depth?: number } = {}
    ): string {
        const helper = this.stHelper;
        if (helper && typeof helper.formatAsTavernRegexedString === 'function') {
            try {
                return helper.formatAsTavernRegexedString(text, source, destination, options);
            } catch (e) {
                console.warn('[STClient] formatAsTavernRegexedString 调用失败，回退原文:', e);
            }
        }
        return text;
    }

    private static _normalizeHelperMessage(msg: any, index: number, total: number): any {
        const baseExtra = this._normalizeExtra(((msg as Record<string, unknown>).extra || {}) as Record<string, unknown>);
        const activeSwipeIndex = this._resolveActiveSwipeIndex(msg);
        const activeSwipeText = this._resolveActiveSwipeText(msg);
        const activeSwipeExtra = this._resolveActiveSwipeExtra(msg);
        const swipeCount = Array.isArray(msg?.swipes) ? msg.swipes.length : 0;
        const hasSwipeVariants = swipeCount > 1 && activeSwipeIndex !== undefined;

        const mergedExtra: Record<string, unknown> = {
            ...baseExtra,
            ...activeSwipeExtra
        };

        if (hasSwipeVariants) {
            const branchScopedKeys = ['id', 'fingerprint', 'stFingerprint', 'mesRaw', 'mesST', 'pluginRaw', 'thinkingText', 'mesSummary'];
            for (const key of branchScopedKeys) {
                if (!(key in activeSwipeExtra)) {
                    delete mergedExtra[key];
                }
            }
        }

        if (typeof msg?.message_id === 'number') {
            mergedExtra.message_id = msg.message_id;
        }
        if (activeSwipeIndex !== undefined) {
            mergedExtra.swipe_id = activeSwipeIndex;
        }
        if (swipeCount > 0) {
            mergedExtra.swipeCount = swipeCount;
        }
        mergedExtra.activeSwipeText = activeSwipeText;

        const normalizedRole = STProtocol.normalizeRole(mergedExtra.role ?? msg?.role, msg?.role === 'user');
        const source = normalizedRole === 'user' ? 'user_input' : 'ai_output';
        const depth = Math.max(total - 1 - index, 0);
        const displayText = this._applyTavernRegex(activeSwipeText, source, 'display', { depth });

        return {
            ...msg,
            role: normalizedRole,
            message: activeSwipeText,
            mes: displayText,
            extra: {
                ...mergedExtra,
                role: normalizedRole
            }
        };
    }

    private static _formatToSTRaw(msg: Partial<LuminaChatMessage> & { message?: string }): any {
        const isUser = msg.role === 'user';
        const isSystem = msg.role === 'system';
        const normalizedRole = STProtocol.normalizeRole(msg.role, !!msg.is_user);
        const normalizedExtra = this._normalizeExtra({ ...(msg.extra || {}), role: normalizedRole });
        const stWritePayload = {
            ...msg,
            extra: normalizedExtra,
            mesST: msg.mesST ?? (typeof normalizedExtra.mesST === 'string' ? normalizedExtra.mesST as string : undefined),
            mesRaw: msg.mesRaw ?? (typeof normalizedExtra.mesRaw === 'string' ? normalizedExtra.mesRaw as string : undefined)
        };
        const payload: any = {
            name: msg.name || (isUser ? 'You' : 'Assistant'),
            role: normalizedRole || ((msg.role as ('system' | 'assistant' | 'user') | undefined) || (isUser ? 'user' : (isSystem ? 'system' : 'assistant'))),
            message: msg.message ?? STProtocol.resolveForSTWrite(stWritePayload),
            extra: normalizedExtra
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
                const currentSwipeId = this._resolveActiveSwipeIndex(existingMsg);
                const currentActiveSwipeText = this._resolveActiveSwipeText(existingMsg);
                const expectSwipeMatched =
                    update.expectedSwipeId === undefined
                    || currentSwipeId === update.expectedSwipeId;
                const expectTextMatched =
                    update.expectedActiveSwipeText === undefined
                    || currentActiveSwipeText === update.expectedActiveSwipeText;
                const allowBodyWrite = expectSwipeMatched && expectTextMatched;
                const isBodyChange = update.content !== currentActiveSwipeText;

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

                if (allowBodyWrite) {
                    targetPayload.message = update.content;
                } else if (isBodyChange) {
                    console.warn(
                        `[STClient] 检测到 swipe 已切换，跳过对 message_id=${existingMsg.message_id} 的正文覆写 ` +
                        `(expectedSwipe=${String(update.expectedSwipeId)}, currentSwipe=${String(currentSwipeId)})`
                    );
                    continue;
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

                if (Array.isArray(existingMsg.swipes) && currentSwipeId !== undefined && currentSwipeId >= 0 && currentSwipeId < existingMsg.swipes.length) {
                    targetPayload.swipes = [...existingMsg.swipes];
                    if (allowBodyWrite) {
                        targetPayload.swipes[currentSwipeId] = update.content;
                    }

                    const existingSwipesInfo = Array.isArray(existingMsg.swipes_info) ? [...existingMsg.swipes_info] : [];
                    while (existingSwipesInfo.length < targetPayload.swipes.length) {
                        existingSwipesInfo.push({});
                    }
                    const currentSwipeInfo = existingSwipesInfo[currentSwipeId];
                    const currentSwipeInfoRecord =
                        currentSwipeInfo && typeof currentSwipeInfo === 'object' && !Array.isArray(currentSwipeInfo)
                            ? { ...(currentSwipeInfo as Record<string, unknown>) }
                            : {};
                    const currentSwipeExtra = this._normalizeExtra((currentSwipeInfoRecord.extra || {}) as Record<string, unknown>);
                    const nextSwipeExtra = {
                        ...currentSwipeExtra,
                        ...(targetPayload.extra || {}),
                        message_id: existingMsg.message_id,
                        swipe_id: currentSwipeId,
                        swipeCount: targetPayload.swipes.length,
                        activeSwipeText: allowBodyWrite ? update.content : currentActiveSwipeText
                    };
                    currentSwipeInfoRecord.extra = nextSwipeExtra;
                    existingSwipesInfo[currentSwipeId] = currentSwipeInfoRecord;
                    targetPayload.swipes_info = existingSwipesInfo;
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
        return await this.fetchWithCsrf(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(body)
        });
    }

    static async fetchWithCsrf(url: string, options: RequestInit = {}, allowRetry = true): Promise<Response> {
        const performFetch = async (csrfToken: string) => {
            const headers = new Headers(options.headers || {});
            headers.set('X-CSRF-Token', csrfToken);
            return await fetch(url, {
                ...options,
                headers
            });
        };

        let response = await performFetch(await this.getCsrfToken());
        if (!allowRetry) return response;

        if (await this.isInvalidCsrfResponse(response)) {
            console.warn('[STClient] 检测到失效 CSRF Token，自动刷新后重试请求');
            response = await performFetch(await this.refreshCsrfToken());
        }

        return response;
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

    // --- 预设管理桥接 (ST 原生) ---

    static getPresets(type: string): string[] {
        const glob = typeof window !== 'undefined' ? (window as any) : {};
        const manager = glob.getPresetManager?.(type);
        return manager?.getAllPresets() || [];
    }

    static getActivePresetName(type: string): string | null {
        const glob = typeof window !== 'undefined' ? (window as any) : {};
        const manager = glob.getPresetManager?.(type);
        return manager?.getSelectedPresetName() || null;
    }

    static selectPreset(type: string, name: string): void {
        const glob = typeof window !== 'undefined' ? (window as any) : {};
        const manager = glob.getPresetManager?.(type);
        if (manager && typeof manager.selectPreset === 'function') {
            manager.selectPreset(name);
        }
    }
}
