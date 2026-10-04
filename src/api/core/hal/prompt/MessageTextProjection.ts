import { MessageUtils, type LuminaChatMessage } from '@shared/LuminaMessage.js';
import { BaseXMLInterceptor } from '@shared/BaseXMLInterceptor.js';
import { lwStorage } from '../../../storage.js';

export type DisplayRegexApplier = (
    text: string,
    source: 'user_input' | 'ai_output',
    options: { depth: number }
) => string;

export type MessageTextExtractor = (message: LuminaChatMessage) => string;

/** 清洗只依赖共享标签注册表；扩展 handler/pattern parser 不影响 cleanText。 */
const interceptor = new BaseXMLInterceptor();

export class MessageTextProjection {
    static normalize(text: string): string {
        return (text || '').replace(/\r\n/g, '\n').trim();
    }

    /**
     * 将本地聊天节点的 pluginRaw/mesRaw 投影为展示用 mes：
     * 依据 mesRaw_ts/mes_ts 时间戳判断是否需要重新生成，并统一应用宿主展示正则。
     * pluginRaw 的重新提取由调用方注入（宿主 port），避免 HAL 反向依赖 Core。
     */
    static projectForDisplay(
        chat: LuminaChatMessage[] | null | undefined,
        applyDisplayRegex: DisplayRegexApplier,
        extractMessageText: MessageTextExtractor
    ): void {
        if (!chat) return;
        chat.forEach((msg, index) => {
            const extra = msg.extra || {};
            const source: 'user_input' | 'ai_output' = msg.is_user ? 'user_input' : 'ai_output';
            const depth = chat.length - 1 - index;

            const mesRawTs = extra.mesRaw_ts || 0;
            const mesTs = extra.mes_ts || 0;

            if (msg.pluginRaw) {
                // 只要有 pluginRaw，我们就重新根据它生成最准确的展示版本
                const finalSourceText = extractMessageText(msg);

                // 强力对齐：确保 mesRaw 包含标签，mes 紧随其后同步
                if (msg.mesRaw !== finalSourceText) {
                    msg.mesRaw = finalSourceText;
                    msg.extra.mesRaw_ts = Date.now();
                }

                // 即使 mes 已经有值，如果其内容过旧或不包含预期标签，也重新生成
                if (!msg.mes || mesRawTs > mesTs || !extra.mes_ts) {
                    msg.mes = applyDisplayRegex(msg.mesRaw, source, { depth });
                    msg.extra.mes_ts = Date.now();
                }
            } else if (!msg.mes || mesRawTs > mesTs || !extra.mes_ts) {
                // 没有 pluginRaw 时，按常规逻辑从 mesRaw 同步到 mes
                msg.mes = applyDisplayRegex(msg.mesRaw, source, { depth });
                msg.extra.mes_ts = Date.now();
            }
        });
    }

    static extractMessageText(message: LuminaChatMessage, useCompressed = false): string {
        let text = '';

        if (useCompressed && message.mesSummary) {
            text = message.mesSummary;
        } else if (message.is_user === false) {
            text = message.pluginRaw ?? message.mesRaw ?? message.extra?.mesRaw ?? message.mes ?? '';
        } else {
            text = message.mes ?? message.mesRaw ?? message.extra?.mesRaw ?? '';
        }

        // 角色卡招呼是作者内容，不经模型生成，跳过内置回复过滤的提纯
        if (MessageUtils.isGreeting(message)) {
            return this.normalize(text);
        }

        const cleaned = interceptor.cleanText(text, {
            filterChatReply: Boolean(lwStorage.get('lumina-chat.filterChatReply', false, 'Global')),
            allowTopLevel: Boolean(lwStorage.get('lumina-chat.allowTopLevelInFilter', true, 'Global')),
            implicitThinking: Boolean(lwStorage.get('lumina-chat.implicitThinkingInFilter', false, 'Global')),
            aggressiveThinking: Boolean(lwStorage.get('lumina-chat.aggressiveThinking', false, 'Global'))
        });

        return this.normalize(cleaned);
    }
}
