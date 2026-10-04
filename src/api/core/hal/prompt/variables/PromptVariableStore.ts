import { HALContext } from '../../HALContext.js';
import { lwStorage } from '../../../../storage.js';
import type { MacroVariableSnapshot } from '../macros/MacroTypes.js';

const GLOBAL_STORAGE_KEY = 'lumina.prompt-variables.global';
const CHAT_NAMESPACE = 'lumina.prompt-variables';
const CHAT_TABLE = 'chats';

const asStringRecord = (value: unknown): Record<string, string> => {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
    const result: Record<string, string> = {};
    for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
        if (typeof item === 'string') result[key] = item;
        else if (typeof item === 'number' || typeof item === 'boolean') result[key] = String(item);
    }
    return result;
};

/**
 * 聊天提示词变量的持久层。
 * - 会话变量存 HAL extensionStore（namespace `lumina.prompt-variables`，key = chatId）。
 * - 全局变量存 lwStorage（`lumina.prompt-variables.global`）。
 *
 * 组装期只读快照；生成成功由管线调用 `commit` 写入暂存结果。
 */
export class PromptVariableStore {
    public async getSnapshot(chatId: string | null): Promise<MacroVariableSnapshot> {
        const global = asStringRecord(lwStorage.get(GLOBAL_STORAGE_KEY, {}, 'Global'));
        let local: Record<string, string> = {};
        if (chatId) {
            try {
                const raw = await HALContext.instance.runtime.extensionStore.getJson({
                    namespace: CHAT_NAMESPACE,
                    table: CHAT_TABLE,
                    key: chatId
                });
                local = asStringRecord(raw);
            } catch (error) {
                console.warn('[PromptVariableStore] 读取会话变量失败', error);
            }
        }
        return { local, global };
    }

    public async commit(chatId: string | null, snapshot: MacroVariableSnapshot): Promise<void> {
        try {
            await lwStorage.set(GLOBAL_STORAGE_KEY, snapshot.global, 'Global');
        } catch (error) {
            console.warn('[PromptVariableStore] 写入全局变量失败', error);
        }
        if (!chatId) return;
        try {
            await HALContext.instance.runtime.extensionStore.setJson({
                namespace: CHAT_NAMESPACE,
                table: CHAT_TABLE,
                key: chatId,
                value: snapshot.local
            });
        } catch (error) {
            console.warn('[PromptVariableStore] 写入会话变量失败', error);
        }
    }
}

export const promptVariableStore = new PromptVariableStore();
