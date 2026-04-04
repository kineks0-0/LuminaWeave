import { LuminaChatMessage } from './ChatManager';
import { STClient } from './st-adapter/STClient.js';
import { BuiltinXMLTags, XMLInterceptor } from './XMLInterceptor';
import { SyncUtils, MessageTextResolver } from './SyncUtils';
import { ContextControlSettings } from './types';

/**
 * ContextCompactor - 消息上下文压缩器
 * 负责计算每条消息在发信时的最终呈现形态（全量、概况或隐藏）
 */
export class ContextCompactor {

    /**
     * 对消息链路进行压缩计算 (保持兼容性，但内部逻辑优化)
     * @param trace 按照时间线性排列的消息数组 (parentId 链)
     * @param settings 用户配置
     */
    public static async compact(trace: LuminaChatMessage[], settings: ContextControlSettings): Promise<LuminaChatMessage[]> {
        if (trace.length === 0) return [];
        console.log(`[DCC] 开始上下文压实: 链路长度 ${trace.length}, 模式 [Full:${settings.fullMode}=${this.getLimitValue(settings, 'full')}] [Summary:${settings.summaryMode}=${this.getLimitValue(settings, 'summary')}]`);

        const results: LuminaChatMessage[] = [...trace];
        let currentFullCount = 0;
        let currentFullTokens = 0;
        let currentSummaryCount = 0;
        let currentSummaryTokens = 0;

        // 从后往前遍历处理
        for (let i = trace.length - 1; i >= 0; i--) {
            const msg = results[i];
            
            // 1. 判定是否处于“全量区”
            const fullLimit = this.getLimitValue(settings, 'full');
            const isInFullRange = await this.checkInRange(
                msg, 
                settings.fullMode, 
                fullLimit, 
                currentFullCount, 
                currentFullTokens,
                settings.tokenMaxFloat,
                settings.tokenSplitAllowed,
                false // 强制使用全量代价进行判定
            );

            if (isInFullRange) {
                // 全量区：清除压缩状态，显示原文
                if (msg.extra) {
                    delete msg.extra.compressionState;
                    delete msg.extra.is_hidden; // 显式清除粘性隐藏状态
                }
                msg.is_hidden = false;
                
                // 核心修复：全量区需要设置 mesST 为清洗后的文本，作为后续 ST 同步和差异对比的唯一标准
                msg.mesST = MessageTextResolver.extractMessageText(msg, false);
                
                currentFullCount++;
                if (settings.fullMode !== 'count') {
                     currentFullTokens += await this.getMessageCost(msg, settings.fullMode, false);
                }
                continue;
            }

            // 2. 判定是否处于“概况区”
            const summaryLimit = this.getLimitValue(settings, 'summary');
            
            // 核心修复：判定该消息当前是否“具备被摘要化的条件”
            const canSummarize = !msg.is_user && this.hasSummarySource(msg, settings.enableFallbackSummary);
            
            // 调用判定时，代价参数应取决于该消息是否能被概览
            const isInSummaryRange = await this.checkInRange(
                msg,
                settings.summaryMode,
                summaryLimit,
                currentSummaryCount, 
                currentSummaryTokens,
                settings.tokenMaxFloat,
                settings.tokenSplitAllowed,
                canSummarize 
            );

            if (isInSummaryRange) {
                // 处于概览范围内
                if (canSummarize) {
                    const summary = this.resolveSummary(msg, settings.enableFallbackSummary);
                    msg.extra = msg.extra || {};
                    msg.extra.compressionState = 'summary';
                    delete msg.extra.is_hidden; // 显式清除粘性隐藏状态
                    msg.mesSummary = summary;
                    msg.is_hidden = false;
                    
                    // 核心修复：为了让差异弹窗和 UI 显示正确的摘要内容，我们需要强制更新 ST 侧对应的显示字段
                    msg.mesST = summary.startsWith('剧情概览：') ? summary : `剧情概览：\n${summary}`;
                } else {
                    // 在概览区但不满足摘要条件 (如用户输入) -> 降级为全量可见
                    if (msg.extra) {
                        delete msg.extra.compressionState;
                        delete msg.extra.is_hidden;
                    }
                    msg.is_hidden = false;
                    msg.mesST = MessageTextResolver.extractMessageText(msg, false);
                }

                currentSummaryCount++;
                if (settings.summaryMode !== 'count') {
                    // 累加实际产生的代价（摘要代价或全量代价）
                    currentSummaryTokens += await this.getMessageCost(msg, settings.summaryMode, canSummarize);
                }
            } else {
                // 超出所有显示范围：隐藏
                msg.is_hidden = true;
                if (msg.extra) delete msg.extra.compressionState;
                
                // 核心修复：对于超出显示范围被隐藏的节点，也需要将其设为清洗后的文本。
                // 即使被隐藏，它在 ST 中的形态也不应该带有 <Chat_Reply> 等标签，
                // 因为隐藏只影响模型上下文组装，而不影响本地界面的差异对比或独立存储加载。
                msg.mesST = MessageTextResolver.extractMessageText(msg, false);
            }
        }

        console.log(`[DCC] 压实完成: 全量=${currentFullCount}, 概览=${currentSummaryCount}, 隐藏=${trace.length - currentFullCount - currentSummaryCount}`);
        return results;
    }

    private static async checkInRange(
        msg: LuminaChatMessage,
        mode: 'count' | 'token' | 'char',
        limit: number,
        currentCount: number,
        currentTokens: number,
        maxFloat: number,
        splitAllowed: boolean,
        useSummary: boolean = false
    ): Promise<boolean> {
        if (mode === 'count') {
            return currentCount < limit;
        } else {
            // 核心修复：如果当前已经达到或超过限制，直接禁止后续消息进入（防止 maxFloat 堆叠漏洞）
            if (currentTokens >= limit) return false;

            const cost = await this.getMessageCost(msg, mode, useSummary);
            if (currentTokens + cost <= limit) return true;
            
            // 溢出判定逻辑
            if (!splitAllowed) {
                // 如果不拆分，允许【第一条】跨越边界的消息在 limit + maxFloat 范围内漂浮
                const isWithinFloat = (currentTokens + cost) <= (limit + maxFloat);
                
                if (isWithinFloat) {
                    console.log(`[DCC] 容差判定: 消息跨越边界(${currentTokens + cost} > ${limit})，但处于 maxFloat(${maxFloat}) 内，准予保留且将关闭后续 Full 入口。`);
                }
                
                return isWithinFloat;
            }
            return false;
        }
    }

    private static getLimitValue(settings: ContextControlSettings, type: 'full' | 'summary'): number {
        const mode = type === 'full' ? settings.fullMode : settings.summaryMode;
        if (mode === 'count') return (type === 'full' ? settings.fullValueCount : settings.summaryValueCount) ?? 10;
        if (mode === 'token') return (type === 'full' ? settings.fullValueToken : settings.summaryValueToken) ?? 2000;
        if (mode === 'char') return (type === 'full' ? settings.fullValueChar : settings.summaryValueChar) ?? 5000;
        return 10;
    }

    private static async getMessageCost(msg: LuminaChatMessage, mode: 'token' | 'char', useSummary: boolean = false): Promise<number> {
        // 核心修复：DCC 会提前准备好 mesST（如果已存在），否则回退。
        // 但注意：在计算 cost 的阶段，mesST 可能还没有被赋值（因为是从下往上算），
        // 所以这里依然保留 `MessageTextResolver.extractMessageText` 作为成本预估工具
        const text = msg.mesST || MessageTextResolver.extractMessageText(msg, useSummary);
        
        if (mode === 'token') {
            return await STClient.getTokenCount(text);
        } else {
            return text.length;
        }
    }

    /**
     * 判断当前消息是否具备有效的摘要来源
     */
    private static hasSummarySource(msg: LuminaChatMessage, enableFallback: boolean): boolean {
        // 1. 手动设定的摘要
        if (msg.mesSummary && msg.mesSummary.trim() !== '') return true;
        
        // 2. pluginRaw 或 mesRaw 中的标签
        const rawSource = msg.pluginRaw || msg.mesRaw || msg.extra?.mesRaw;
        if (rawSource && XMLInterceptor.extractTagContent(rawSource, BuiltinXMLTags.STORY_SUMMARY).length > 0) return true;
        
        // 3. 编导计划
        if (msg.extra?.Current_Plan) return true;

        // 4. 兜底逻辑开关判定
        if (enableFallback) {
            return (msg.mesRaw || msg.mes || '').trim().length > 0;
        }

        return false;
    }

    private static resolveSummary(msg: LuminaChatMessage, enableFallback: boolean = false): string {
        // 1. 优先使用专门的概况字段
        if (msg.mesSummary && msg.mesSummary.trim() !== '') {
            return msg.mesSummary;
        }
        
        // 2. 尝试从 pluginRaw 或 mesRaw 中提取 Story_Summary 标签内容
        const rawSource = msg.pluginRaw || msg.mesRaw || msg.extra?.mesRaw;
        if (rawSource) {
             const summaryBlocks = XMLInterceptor.extractTagContent(rawSource, BuiltinXMLTags.STORY_SUMMARY);
             if (summaryBlocks.length > 0) return summaryBlocks.join('\n');
        }

        // 3. 补托：尝试从 Current_Plan 提取
        if (msg.extra?.Current_Plan) {
            return String(msg.extra.Current_Plan);
        }

        // 4. 选择性执行兜底逻辑：截获原文的前 100 字
        if (enableFallback) {
            const raw = (msg.mesRaw || msg.mes || '').trim();
            const fallback = raw.substring(0, 100);
            const final = fallback + (fallback.length >= 100 ? '...' : '');
            if (final.length > 0) {
                console.log(`[DCC] 警告: 消息 ${msg.id.substring(0, 8)} 进入概览区但无摘要，已触发 ${raw.length > 100 ? '截断' : '全量'} 兜底。`);
            }
            return final;
        }

        return '';
    }
}
