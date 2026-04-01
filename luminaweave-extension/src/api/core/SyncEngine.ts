import { ChatConverter } from './ChatConverter';
import { LuminaChatMessage } from './ChatManager';
import { STBridge } from './STBridge';
import { lwStorage } from '../storage.js';
import { BuiltinXMLTags, XMLInterceptor } from './XMLInterceptor.js';

/**
 * 同步引擎 (SyncEngine)
 * 职责：
 * 1. 统一生成消息指纹 (ID)
 * 2. 判定消息内容相等性
 * 3. 规范化 SillyTavern 消息列表并关联指纹
 * 4. 对比影子数据库与 ST 内存状态差异
 * 5. 计算并应用差量更新 (Delta Sync)
 */
export class SyncEngine {
    public static readonly SYNC_SOURCE_KEY = '_lw_sync_source';
    public static readonly SYNC_TS_KEY = '_lw_sync_ts';
    public static readonly SYNC_CHAT_KEY = '_lw_sync_chat_id';
    public static readonly SYNC_SOURCE_LUMINA = 'lumina';

    public static createSyncSourceMeta(): Record<string, any> {
        const { chatId } = lwStorage._getContextIds();
        return {
            [this.SYNC_SOURCE_KEY]: this.SYNC_SOURCE_LUMINA,
            [this.SYNC_TS_KEY]: Date.now(),
            [this.SYNC_CHAT_KEY]: chatId || null
        };
    }

    /**
     * 判断消息是否为 Lumina 同步消息
     
     */
    public static isLuminaSyncMessage(msg: LuminaChatMessage, nowTs: number = Date.now(), windowMs: number = 1600): boolean {
        const extra = msg?.extra || msg || {};
        if (extra?.[this.SYNC_SOURCE_KEY] !== this.SYNC_SOURCE_LUMINA) {
            return false;
        }
        const markedTs = Number(extra?.[this.SYNC_TS_KEY]);
        if (!Number.isFinite(markedTs)) return false;
        const delta = nowTs - markedTs;
        return delta >= 0 && delta <= windowMs;
    }

    /**
     * 提取消息文本
     */
    private static extractMessageText(msg: LuminaChatMessage): string {
        // 用户输入没有 CHAT_REPLY 标签
        if (msg.is_user == false) {
            const rawSource = msg?.pluginRaw ?? msg?.mesRaw ?? msg?.extra?.mesRaw ?? msg?.mes;

            // 优先提取特定标签内容，供插件模块深度比准与访问
            if (rawSource) {
                const chatReplyBlocks = XMLInterceptor.extractTagContent(rawSource, BuiltinXMLTags.CHAT_REPLY);
                if (chatReplyBlocks && chatReplyBlocks.length > 0) {
                    // LLM 可能回复了多个标签块，全部用换行拼接作为完整主体
                    const completeReply = chatReplyBlocks.join('\n\n');
                    //console.log('[SyncEngine] extractMessageText: id', msg.id);
                    return String(completeReply).replace(/[\u200B-\u200D\uFEFF]/g, '');
                }
            }

        }

        // 回退：优先提取 mes 作为最终显示文本
        const text = msg?.mes ?? msg?.mesRaw ?? msg?.extra?.mesRaw ?? '';
        //console.log('[SyncEngine] extractMessageText: id', msg.id, 'text', text);
        return String(text || '').replace(/[\u200B-\u200D\uFEFF]/g, '');
    }


    /**
     * 转换为可比较的消息对象
     */
    private static toComparableMessage(msg: LuminaChatMessage): { id: string; name: string; role: string; mes: string; mesRaw: string; fingerprint: string; is_hidden?: boolean } {
        const mesRaw = this.extractMessageText(msg);
        const fingerprint = msg?.fingerprint || msg?.extra?.fingerprint || this.getFingerprint(mesRaw);
        return {
            id: msg?.id || msg?.extra?.id || this.generateNodeId(),
            name: msg?.name || '',
            role: msg?.role || '',
            mes: mesRaw,
            mesRaw,
            fingerprint,
            is_hidden: msg.is_hidden
        };
    }

    /**
     * 统一的内容清洗逻辑
     * 1. 移除零宽字符
     * 2. 合并连续空白
     * 3. 首尾 trim
     */
    public static cleanContent(text: string): string {
        return (text || '')
            .replace(/[\u200B-\u200D\uFEFF]/g, '')
            .trim();
    }

    /**
     * 生成内容指纹 (仅基于内容，不含索引)
     * 用于检测消息内容是否发生了改变
     */
    public static getFingerprint(content: string): string {
        const cleaned = this.cleanContent(content);

        let hash = 0;
        for (let i = 0; i < cleaned.length; i++) {
            hash = ((hash << 5) - hash) + cleaned.charCodeAt(i);
            hash |= 0;
        }
        const contentHash = Math.abs(hash);
        return `fp_${contentHash.toString(16).substring(0, 8)}`;
    }

    /**
     * 生成随机稳定的节点 ID
     */
    public static generateNodeId(): string {
        return 'node_' + Math.random().toString(36).substring(2, 11) + Date.now().toString(36).substring(4);
    }



    /**
     * 确保消息数组中的每一条都有指纹 ID (用于加载旧数据时的兼容性)
     */
    public static ensureFingerprints(messages: LuminaChatMessage[]): LuminaChatMessage[] {
        const { charId } = lwStorage._getContextIds();

        return messages.map((m, idx) => {
            // 确保 ID 存在
            if (!m.id) {
                m.id = this.generateNodeId();
            }
            // 始终重新计算指纹，确保其反映当前内容状态
            m.fingerprint = this.getFingerprint(m.mesRaw);
            m.characterId = m.characterId || charId;

            return m;
        });
    }

    /**
     * 对比两个节点池的差异 (Diff Engine)
     * 用于分析本地状态与远程存储状态的不同
     */
    public static comparePools(localNodes: LuminaChatMessage[], remoteNodes: LuminaChatMessage[]): {
        added: LuminaChatMessage[],
        updated: LuminaChatMessage[],
        deletedIds: string[]
    } {
        const remoteMap = new Map(remoteNodes.map(n => [n.id, n]));
        const localMap = new Map(localNodes.map(n => [n.id, n]));

        const added: LuminaChatMessage[] = [];
        const updated: LuminaChatMessage[] = [];
        const deletedIds: string[] = [];

        // 1. 找出新增或修改的
        for (const local of localNodes) {
            const remote = remoteMap.get(local.id);
            if (!remote) {
                added.push(local);
            } else if (local.fingerprint !== remote.fingerprint) {
                updated.push(local);
            }
        }

        // 2. 找出已删除的
        for (const remote of remoteNodes) {
            if (!localMap.has(remote.id)) {
                deletedIds.push(remote.id);
            }
        }

        return { added, updated, deletedIds };
    }

    /**
     * 深度判定两条消息是否在同步语义上相等
     */
    public static isMessageEqual(m1: LuminaChatMessage, m2: LuminaChatMessage): boolean {
        if (!m1 || !m2) return false;

        // 1. 隐藏状态不一致直接视为不相等 (触发更新)
        if (m1.is_hidden !== m2.is_hidden) return false;

        // 2. 统一萃取基准显示文本或扩展层核心标签（如 Chat_Reply），再对比
        const content1 = this.cleanContent(this.extractMessageText(m1));
        const content2 = this.cleanContent(this.extractMessageText(m2));

        return content1 === content2;
    }

    /**
     * 计算并汇总 Lumina 与 ST 的同步分歧
     */
    public static compareStates(localChat: LuminaChatMessage[], stChat: LuminaChatMessage[]): any {
        const onlyInIndependent: any[] = [];
        const onlyInST: any[] = [];
        const localSequence = localChat.map((m) => this.toComparableMessage(m));
        const stSequence = stChat.map((m) => this.toComparableMessage(m));
        const localFingerprints = new Set(localSequence.map(m => m.fingerprint));
        const stFingerprints = new Set(stSequence.map(m => m.fingerprint));
        const rows = [];
        const maxLen = Math.max(localSequence.length, stSequence.length);
        let leftLineNo = 1;
        let rightLineNo = 1;

        localSequence.forEach(m => {
            if (!stFingerprints.has(m.fingerprint)) {
                onlyInIndependent.push(m);
            }
        });

        stSequence.forEach(m => {
            if (!localFingerprints.has(m.fingerprint)) {
                onlyInST.push(m);
            }
        });

        for (let i = 0; i < maxLen; i++) {
            const left = localSequence[i];
            const right = stSequence[i];
            const leftExists = !!left;
            const rightExists = !!right;
            // 优先基于最终显示文本判定是否在视觉上实质相同
            const isSame = leftExists && rightExists && (left.fingerprint === right.fingerprint || left.mes === right.mes);
            const isModified = leftExists && rightExists && !isSame;
            const onlyLocal = leftExists && !rightExists;
            const onlySt = !leftExists && rightExists;

            rows.push({
                index: i,
                leftLine: leftExists ? String(leftLineNo++) : '',
                rightLine: rightExists ? String(rightLineNo++) : '',
                leftSign: isSame ? ' ' : onlyLocal || isModified ? '+' : ' ',
                rightSign: isSame ? ' ' : onlySt || isModified ? '+' : ' ',
                // 对比差异优先显示最终显示文本
                leftText: leftExists ? left.mes : '',
                rightText: rightExists ? right.mes : '',
                leftClass: onlyLocal ? 'is-add' : isModified ? 'is-mod' : leftExists ? 'is-same' : 'is-empty',
                rightClass: onlySt ? 'is-add' : isModified ? 'is-mod' : rightExists ? 'is-same' : 'is-empty'
            });
        }

        return {
            onlyInIndependent,
            onlyInST,
            independentSequence: localSequence,
            stSequence,
            rows,
            diffCount: onlyInIndependent.length + onlyInST.length,
            hasConflict: onlyInIndependent.length > 0 || onlyInST.length > 0,
            hasDivergence: onlyInIndependent.length > 0 && onlyInST.length > 0 // 真正的物理发散
        };
    }

    /**
     * 执行差量写入 (Delta Apply)
     * 采用基于 ID/指纹的对齐算法，支持中间插入/删除
     * 自动识别增、删、改并调用 STBridge 的原子操作
     */
    public static async applyDelta(localTrace: LuminaChatMessage[], stChat: LuminaChatMessage[]): Promise<void> {
        console.log(`[SyncEngine] 开始计算差量更新 (Lumina:${localTrace.length} vs ST:${stChat.length})...`);

        // 1. 无需再进行规范化，因为现在的 ChatMessage 已经是标准化后的
        const stProcessed = stChat;

        const updates: { index: number, content: string, name?: string, role?: string, is_hidden?: boolean, extra: any }[] = [];
        const messagesToAppend: any[] = [];
        const indicesToDelete: number[] = [];

        const maxLen = Math.max(localTrace.length, stProcessed.length);

        for (let i = 0; i < maxLen; i++) {
            if (i < localTrace.length && i < stProcessed.length) {
                // 两边都存在该索引，判断是否需要更新
                const localMsg = localTrace[i];
                const stMsg = stProcessed[i];

                const needUpdate = !this.isMessageEqual(localMsg, stMsg)
                    || stMsg.fingerprint !== localMsg.fingerprint
                    || stMsg.name !== localMsg.name
                    || stMsg.role !== localMsg.role
                    || stMsg.id !== localMsg.id; // 关键：ID 不匹配也属于冲突，必须强制覆盖 ST 原材料以对齐

                if (needUpdate) {
                    console.log(`[SyncEngine] 节点索引 ${i} (ID: ${localMsg.id}) 内容或指纹不一致，加入原地更新队列`);
                    updates.push({
                        index: i,
                        content: localMsg.mes,
                        name: localMsg.name,
                        role: localMsg.role,
                        is_hidden: localMsg.is_hidden || false,
                        extra: {
                            ...localMsg.extra,
                            ...this.createSyncSourceMeta(),
                            id: localMsg.id,
                            fingerprint: localMsg.fingerprint,
                            mesRaw: localMsg.mesRaw,
                            pluginRaw: localMsg.pluginRaw,
                            send_date: localMsg.send_date,
                            is_hidden: localMsg.is_hidden // 双重保险：同时写在 extra 中
                        }
                    });
                }
            } else if (i < localTrace.length) {
                // ST 短了，需要追加新生成的节点
                const localMsg = localTrace[i];
                console.log(`[SyncEngine] 节点索引 ${i} (ID: ${localMsg.id}) 在 ST 中缺失，加入追加队列...`);
                messagesToAppend.push({
                    role: localMsg.role,
                    name: localMsg.name,
                    message: localMsg.mes,
                    is_hidden: localMsg.is_hidden || false,
                    extra: {
                        ...localMsg.extra,
                        ...this.createSyncSourceMeta(),
                        id: localMsg.id,
                        fingerprint: localMsg.fingerprint,
                        mesRaw: localMsg.mesRaw,
                        pluginRaw: localMsg.pluginRaw,
                        send_date: localMsg.send_date,
                        is_hidden: localMsg.is_hidden
                    }
                });
            } else if (i < stProcessed.length) {
                // ST 长了，多余的历史分支或未来截断分支，必须强行裁切掉
                indicesToDelete.push(i);
            }
        }

        // 2. 依次按操作顺序执行 (务必保证顺序：先更新 -> 删除尾部 -> 后追加)
        if (updates.length > 0) {
            console.log(`[SyncEngine] 执行批量更新 (${updates.length} 条)...`);
            await STBridge.updateMessages(updates, true);
        }

        if (indicesToDelete.length > 0) {
            console.log(`[SyncEngine] 检测到 ${indicesToDelete.length} 条 ST 尾部多余消息，执行物理移除 (截断)...`);
            // STBridge.deleteMessages 会从后往前删（自动被排序），不会导致还在队列里的索引受损失效
            await STBridge.deleteMessages(indicesToDelete, true);
        }

        if (messagesToAppend.length > 0) {
            console.log(`[SyncEngine] 执行批量追加 (${messagesToAppend.length} 条)...`);
            await STBridge.appendMessages(messagesToAppend, true);
        }

        // 3. 最后统一重绘，避免多次触发 CHAT_CHANGED 或跳视窗
        await STBridge.flush();

        console.log('[SyncEngine] 差量同步算法执行完毕。');
    }

    /**
     * 合并节点池 (去重并链入新节点)
     * @param pool 当前 Lumina 节点池
     * @param stPath 当前 ST 的线性路径
     */
    public static mergeNodePool(pool: LuminaChatMessage[], stPath: LuminaChatMessage[]): LuminaChatMessage[] {
        const poolMap = new Map(pool.map(m => [m.id, m]));
        const result = [...pool];

        let parentId: string | null = null;
        stPath.forEach((m, idx) => {
            // 确保指纹生成策略一致
            if (!m.id) {
                m.id = this.generateNodeId();
                m.fingerprint = this.getFingerprint(m.mesRaw);
            }

            // 链接逻辑
            m.parentId = parentId;
            parentId = m.id;

            if (!poolMap.has(m.id)) {
                console.log('[SyncEngine] 合并新节点至池中:', m.id);
                result.push(m);
                poolMap.set(m.id, m);
            }
        });

        return result;
    }
}
