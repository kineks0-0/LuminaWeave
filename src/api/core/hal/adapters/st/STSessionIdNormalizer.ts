import { ISessionIdNormalizer } from '../../interfaces.js';
import { STClient } from '../../../host-drivers/st/STClient.js';

/**
 * SillyTavern 宿主的会话 ID 规范化实现
 */
export class STSessionIdNormalizer implements ISessionIdNormalizer {
    /**
     * 清理 ST 的 .jsonl 后缀
     */
    normalize(id: string | null | undefined): string | null {
        return STClient.normalizeChatId(id);
    }
}
