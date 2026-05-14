import { ISessionIdNormalizer } from '../interfaces.js';

/**
 * 默认的会话 ID 规范化实现
 * 适用于独立 Web 模式或基于 UUID 的存储，直接返回原始 ID
 */
export class DefaultSessionIdNormalizer implements ISessionIdNormalizer {
    normalize(id: string | null | undefined): string | null {
        return id || null;
    }
}
