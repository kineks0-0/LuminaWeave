import { ChatConverter } from './ChatConverter';
import { LuminaChatMessage } from './ChatManager';
import { EnvDetector } from './EnvDetector.js';

/**
 * 内部使用的消息更新载荷接口
 */
interface STMessageUpdate {
    index: number;
    content: string;
    name?: string;
    role?: string;
    extra?: Record<string, any>;
}

/**
 * 指令模式设置接口
 */
interface STInstructSettings {
    enabled: boolean;
    template: Record<string, any>;
    settings: Record<string, any>;
}

/**
 * STBridge - 专门负责与 SillyTavern 环境进行物理数据交换与消息列表维护
 * 职责：内存操作、API 适配、差量写入(Delta Sync)
 */
export class STBridge {
    private static _csrfToken: string | null = null;
    private static _csrfTime: number = 0;

    /** 获取 SillyTavern 全局主 API 对象 */
    private static get stMain(): typeof SillyTavern | undefined {
        return EnvDetector.stMain;
    }

    /** 获取 TavernHelper 全局工具集对象 */
    private static get stHelper(): typeof TavernHelper | undefined {
        return EnvDetector.stHelper;
    }

    /** 获取 SillyTavern 上下文镜像 */
    private static get ctx(): typeof SillyTavern | undefined {
        return EnvDetector.ctx;
    }

    /**
     * 获取 CSRF Token (带 5 分钟缓存)
     */
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

    /**
     * 获取当前 ST 环境中的消息列表
     * @returns 消息数组，不返回可变的原生引用
     */
    static getRawMessages(): ChatMessage[] {
        const helper = this.stHelper;
        if (helper && typeof helper.getChatMessages === 'function') {
            try {
                // 明确仅获取 ChatMessage[]，不包含 swipes 信息
                return helper.getChatMessages('0-{{lastMessageId}}', { include_swipes: false });
            } catch (e) {
                console.error('[STBridge] getChatMessages 失败:', e);
                throw new Error('无法从 TavernHelper 获取消息列表，API 调用执行失败');
            }
        }

        console.warn('[STBridge] 无法找到可用或者包含 getChatMessages 方法的 TavernHelper，从 Context 回退...');
        const ctx = this.ctx;
        const messages = ctx?.chat;
        if (!Array.isArray(messages)) {
            throw new Error('STBridge: 无法从上下文获取 chat 数组，环境可能未就绪或获取完全失败');
        }
        
        // 显式从 SillyTavern.ChatMessage[] 转换为 ChatMessage[]
        // 解决 mes -> message 等字段差异
        return messages.map((m, index) => ({
            message_id: (m as any).message_id ?? index,
            name: m.name || '',
            role: (m as any).role || (m.is_user ? 'user' : 'assistant'),
            is_hidden: m.is_system || false,
            message: m.mes || '',
            data: (m as any).data || {},
            extra: m.extra || {}
        } as ChatMessage));
    }

    /**
     * 获取当前 ST 环境中的消息列表并转换为插件内部格式
     * 注意：此方法返回的消息 parentId 为 null。
     * 由于 ST 提供的是扁平数组且不包含树状拓扑信息，parentId 的建立（Stitching）
     * 统一由 STSyncService 在同步流程中根据线性顺序或指纹匹配完成。
     * @returns 已转换的 ChatMessage 数组
     */
    static getMessages(): LuminaChatMessage[] {
        const raw = this.getRawMessages();
        console.log('[STBridge] getMessages raw:', raw);
        const converted = raw.map(m => ChatConverter.fromST(m));
        console.log('[STBridge] getMessages converted:', converted);
        return converted;
    }

    /**
     * 将符合 ST 原生格式的对象包装好
     * @param msg Lumina 传来的基础创建对象
     */
    private static _formatToSTRaw(msg: Partial<LuminaChatMessage> & { message?: string }): ChatMessageCreating {
        const isUser = msg.role === 'user';
        const isSystem = msg.role === 'system';
        const payload: ChatMessageCreating = {
            name: msg.name || (isUser ? 'You' : 'Assistant'),
            role: (msg.role as any) || (isUser ? 'user' : (isSystem ? 'system' : 'assistant')),
            message: msg.mesRaw || msg.mes || msg.message || '',
            extra: { ...msg.extra }
        };

        if (msg.is_user !== undefined) {
            payload.is_hidden = !msg.is_user && msg.role === 'user'; // 示例逻辑，视具体需求调整
        }
        
        return payload;
    }

    /**
     * 更新 ST 中的多条消息 (批量操作，只触发一次刷新)
     */
    static async updateMessages(updates: STMessageUpdate[], skipFlush = false): Promise<void> {
        if (updates.length === 0) return;
        const helper = this.stHelper;
        if (!helper || typeof helper.setChatMessages !== 'function' || typeof helper.getChatMessages !== 'function') {
            console.error('[STBridge] 无法执行 updateMessages: 缺少 TavernHelper API');
            return;
        }

        const targets: ({ message_id: number } & Partial<ChatMessage> & Partial<ChatMessageSwiped>)[] = [];
        for (const update of updates) {
            try {
                // 先通过 TavernHelper 获取现有消息的状态 (包含 swipes 和 extra)
                const existingMsgs = helper.getChatMessages(`${update.index}-${update.index}`, { include_swipes: true });
                const existingMsg = existingMsgs && existingMsgs.length > 0 ? existingMsgs[0] : null;

                if (!existingMsg) {
                    console.warn(`[STBridge] updateMessages: 无法找到索引 ${update.index} 的消息`);
                    continue;
                }

                // 仅保留必要字段
                const targetPayload: { message_id: number } & Partial<ChatMessage> & Partial<ChatMessageSwiped> = { message_id: existingMsg.message_id };
                targetPayload.message = update.content;

                // 修复：如果不显式传递 name 和 role，部分版本 ST (尤其是带有多角色群聊时) 会在 setChatMessages 中意外丢失它们
                if (update.name) {
                    targetPayload.name = update.name;
                }
                if (update.role) {
                    targetPayload.role = update.role as any;
                }

                // 合并 extra 数据
                if (update.extra) {
                    targetPayload.extra = { ...(existingMsg as any).extra, ...update.extra };
                }

                // Swipe 处理：如果在原有消息中存在有效的 swipes 数组 and swipe_id
                if (Array.isArray(existingMsg.swipes) && existingMsg.swipe_id !== undefined && existingMsg.swipe_id >= 0 && existingMsg.swipe_id < existingMsg.swipes.length) {
                    // 深拷贝 swipes 数组
                    targetPayload.swipes = [...existingMsg.swipes];
                    targetPayload.swipes[existingMsg.swipe_id] = update.content;
                }

                targets.push(targetPayload);
            } catch (e) {
                console.error(`[STBridge] updateMessages 处理索引 ${update.index} 异常:`, e);
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

    /**
     * 向 ST 后端发送带有 CSRF 校验的请求
     */
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

    /**
     * 向 ST 追加批量消息
     */
    static async appendMessages(msgs: Partial<LuminaChatMessage>[], skipFlush = false): Promise<void> {
        if (msgs.length === 0) return;

        console.log(`[STBridge] 执行 API 批量追加 (${msgs.length} 条)...`);
        const helper = this.stHelper;

        if (helper && typeof helper.createChatMessages === 'function') {
            const stFormattedMsgs = msgs.map(m => this._formatToSTRaw(m));
            try {
                // 直接传递整个格式化后的数组，利用其批处理能力
                await helper.createChatMessages(stFormattedMsgs, { refresh: 'none' });
            } catch (e) {
                console.error('[STBridge] createChatMessages 失败:', e);
            }
        } else {
            console.error('[STBridge] 无法找到 TavernHelper，追加消息失败');
        }

        if (!skipFlush) await this.flush();
    }

    /**
     * 向 ST 追加单条消息
     */
    static async appendMessage(msg: Partial<LuminaChatMessage>, skipFlush = false): Promise<void> {
        await this.appendMessages([msg], skipFlush);
    }

    /**
     * 从 ST 中删除多条消息
     */
    static async deleteMessages(indices: number[], skipFlush = false): Promise<void> {
        if (indices.length === 0) return;
        const sortedIndices = [...indices].sort((a, b) => b - a);
        const helper = this.stHelper;
        if (!helper || typeof helper.deleteChatMessages !== 'function') {
            console.error('[STBridge] 无法找到 TavernHelper API，删除消息失败');
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
                    // Fallback to using index if message_id is not available
                    idsToDelete.push(Number(idx));
                }
            }

            if (idsToDelete.length > 0) {
                await helper.deleteChatMessages(idsToDelete, { refresh: 'none' });
                if (!skipFlush) await this.flush();
            }
        } catch (e) {
            console.error('[STBridge] deleteChatMessages 失败:', e);
        }
    }

    /**
     * 从 ST 中删除指定索引的消息
     */
    static async deleteMessage(index: number, skipFlush = false): Promise<void> {
        await this.deleteMessages([index], skipFlush);
    }

    /**
     * 强制存盘并重绘
     */
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
                console.error('[STBridge] reloadAndRenderChatWithoutEvents 失败，尝试回退:', e);
            }
        }

        const ctx = this.stMain;
        if (ctx && typeof ctx.reloadCurrentChat === 'function') {
            await ctx.reloadCurrentChat();
        } else if (typeof window !== 'undefined' && typeof (window as any).renderChat === 'function') {
            (window as any).renderChat();
        }
    }

    /**
     * 获取ST的预设
     */
    static async getPreset(name: string): Promise<Record<string, any> | null> {
        const helper = this.stHelper;
        if (helper && typeof helper.getPreset === 'function') {
            return helper.getPreset(name);
        }
        return null;
    }

    /**
     * 调用 ST 原生宏替换引擎
     */
    static substituteMacros(content: string): string {
        if (!content) return '';

        // 1. 尝试使用全局 substituteParams (ST核心导出)
        const glob = EnvDetector.stGlobal;
        const substituteParams = glob?.substituteParams || (typeof window !== 'undefined' && window.substituteParams);
        if (typeof substituteParams === 'function') {
            try {
                // 某些版本的 ST 需要更多参数，尝试传入基础上下文
                return substituteParams(content);
            } catch (e) {
                console.warn('[STBridge] substituteParams 调用失败:', e);
            }
        }

        // 2. 尝试使用 TavernHelper 提供的宏替换
        const helper = this.stHelper;
        if (helper && typeof helper.substitudeMacros === 'function') {
            try {
                return helper.substitudeMacros(content);
            } catch (e) {
                console.warn('[STBridge] substitudeMacros 调用失败:', e);
            }
        }

        // 3. 兜底方案：如果是后端处理宏，或者宏插件在发送前执行，这里返回原内容是正常的
        return content;
    }

    /**
     * 获取当前环境的指令模式 (Instruct Mode) 设置
     */
    static getInstructSettings(): STInstructSettings {
        const st = this.stMain as any;
        return {
            enabled: st?.powerUserSettings?.instruct?.enabled ?? false,
            template: st?.powerUserSettings?.instruct ?? {},
            settings: st?.chatCompletionSettings || {}
        };
    }

    /**
     * 获取当前 API 类型
     */
    static getMainApi(): string {
        return (this.stMain?.mainApi) || 'openai';
    }

    /**
     * 计算 Token 数量 (调用 ST 原生 Tokenizer)
     */
    static async getTokenCount(text: string): Promise<number> {
        const getTokenCountAsync = this.stMain?.getTokenCountAsync;
        if (typeof getTokenCountAsync === 'function') {
            try {
                return await getTokenCountAsync(text);
            } catch (e) {
                console.error('[STBridge] getTokenCountAsync 执行异常:', e);
            }
        }
        // 回退到简单的字符估算
        return Math.ceil(text.length / 4);
    }

    /**
     * 获取当前被激活的世界书条目 (经过 ST 关键词匹配后的)
     */
    static getActiveWorldInfoItems(): { id: string, content: string, role: number }[] {
        // 在 ST 内部，从世界书管理器或全局变量中尝试提取
        const glob = EnvDetector.stGlobal as any;
        const activatedItems: any[] = glob?.world_info_active || (typeof window !== 'undefined' && (window as any).world_info_active) || [];

        if (Array.isArray(activatedItems)) {
            return activatedItems.map(item => ({
                id: item.id || item.uid || 'wi_item',
                content: item.content || '',
                role: item.role ?? 0 // 0-system, 1-user, 2-assistant (ST 枚举)
            }));
        }

        return [];
    }
}
