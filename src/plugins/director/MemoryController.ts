import { STBridge } from '../../api/core/STBridge';
import { lwStorage } from '../../api/storage';
import { useDirectorStore } from './DirectorStore';
import { EnvDetector } from '../../api/core/EnvDetector';

/**
 * MemoryController - 负责消息发送范围控制 (Full Content Scope)
 * 通过动态修改 ST 消息的 is_hidden 属性实现非侵入式控制。
 */
export class MemoryController {
    private static _instance: MemoryController;
    private _isProcessing: boolean = false;

    public static getInstance(): MemoryController {
        if (!this._instance) this._instance = new MemoryController();
        return this._instance;
    }

    /**
     * 执行范围同步：根据当前设置，隐藏超出范围的消息
     */
    public async syncVisibility() {
        if (this._isProcessing) return;
        this._isProcessing = true;
        
        try {
            const limitType = lwStorage.get('lumina-director.fullLimitType', 'count', 'Global');
            
            // 根据类型动态获取对应的限制值
            let limitValue = 20;
            if (limitType === 'count') {
                limitValue = lwStorage.get('lumina-director.fullLimitValueCount', 20, 'Global');
            } else if (limitType === 'token') {
                limitValue = lwStorage.get('lumina-director.fullLimitValueToken', 2000, 'Global');
            } else if (limitType === 'char') {
                limitValue = lwStorage.get('lumina-director.fullLimitValueChar', 5000, 'Global');
            }

            const isSplit = lwStorage.get('lumina-director.fullSplit', false, 'Global');
            const floating = lwStorage.get('lumina-director.fullFloating', 10, 'Global') / 100; // 转换为百分比

            // 1. 获取当前所有原始消息 (包含被隐藏的)
            const helper = EnvDetector.stHelper;
            if (!helper || typeof helper.getChatMessages !== 'function') return;

            const allMessages = helper.getChatMessages('0-{{lastMessageId}}', { hide_state: 'all' });
            if (allMessages.length === 0) return;

            // 2. 计算需要保留的消息索引
            let keepStartIndex = 0;

            if (limitType === 'count') {
                keepStartIndex = Math.max(0, allMessages.length - limitValue);
            } else {
                // 按 Token 或 字符计算 (从末尾向前累加)
                let currentTotal = 0;
                const isToken = limitType === 'token';
                
                for (let i = allMessages.length - 1; i >= 0; i--) {
                    const msg = allMessages[i];
                    const content = msg.message || '';
                    const cost = isToken ? await STBridge.getTokenCount(content) : content.length;
                    
                    if (currentTotal + cost > limitValue) {
                        // 发现溢出，检查浮动窗口
                        if (!isSplit && (currentTotal + cost <= limitValue * (1 + floating))) {
                             // 允许轻微浮动，包含这一条
                             keepStartIndex = i;
                             break;
                        } else {
                            // 超过浮动范围或要求强制截断
                            keepStartIndex = i + 1;
                            break;
                        }
                    }
                    currentTotal += cost;
                    keepStartIndex = i;
                }
            }

            // 3. 构建更新列表
            const updates: any[] = [];
            for (let i = 0; i < allMessages.length; i++) {
                const isHidden = i < keepStartIndex;
                // 仅在状态发生变化时更新，减少波动
                if (allMessages[i].is_hidden !== isHidden) {
                    updates.push({
                        message_id: allMessages[i].message_id,
                        is_hidden: isHidden
                    });
                }
            }

            if (updates.length > 0) {
                console.log(`[LuminaDirector] [MemoryController] 执行范围限制同步: 尝试更新 ${updates.length} 条消息的隐藏状态 (共 ${allMessages.length} 条)。`);
                await helper.setChatMessages(updates, { refresh: 'affected' });
                
                // 核心修复：显式触发物理存盘。
                // 虽然 TavernHelper 的 refresh: 'affected' 会更新 UI，但不一定会立即触发 ST 的磁盘写入。
                // 调用 STBridge.flush() 确保 is_hidden 在下次加载时依然有效。
                await STBridge.flush();
                console.log(`[LuminaDirector] [MemoryController] 范围限制同步已物理存盘。`);
            } else {
                console.log(`[LuminaDirector] [MemoryController] 消息范围检查完成，无需更新 (Limit: ${limitType}=${limitValue})。`);
            }

        } catch (e) {
            console.error('[MemoryController] 范围限制同步失败:', e);
        } finally {
            this._isProcessing = false;
        }
    }
}

export const globalMemoryController = MemoryController.getInstance();
