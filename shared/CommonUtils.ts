/**
 * CommonUtils - 跨扩展/服务端共享的通用工具。
 * 只放无业务语义、可被任意层安全复用的基础函数。
 */

export const isRecord = (value: unknown): value is Record<string, unknown> =>
    typeof value === 'object' && value !== null && !Array.isArray(value);

export const sleep = (ms: number): Promise<void> =>
    new Promise(resolve => setTimeout(resolve, ms));

export const truncate = (text: string | null | undefined, maxLength: number, suffix = '...'): string => {
    if (!text) return '';
    return text.length > maxLength ? `${text.slice(0, maxLength)}${suffix}` : text;
};

export const escapeRegExp = (value: string): string =>
    value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export const createPrefixedId = (prefix: string): string => {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
        return `${prefix}_${crypto.randomUUID()}`;
    }
    return `${prefix}_${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36)}`;
};

/**
 * 深拷贝结构化数据。优先使用原生 structuredClone；
 * Vue reactive proxy、函数等不可克隆值回退到 JSON 序列化（保持旧行为）。
 */
export const deepClone = <T>(value: T): T => {
    try {
        return structuredClone(value);
    } catch {
        return JSON.parse(JSON.stringify(value)) as T;
    }
};

const BASE64_CHUNK_SIZE = 0x8000;

export const bytesToBase64 = (bytes: Uint8Array): string => {
    let binary = '';
    for (let index = 0; index < bytes.length; index += BASE64_CHUNK_SIZE) {
        const chunk = bytes.subarray(index, index + BASE64_CHUNK_SIZE);
        binary += String.fromCharCode(...chunk);
    }
    return btoa(binary);
};

export const base64ToBytes = (value: string): Uint8Array<ArrayBuffer> => {
    const binary = atob(value);
    const bytes = new Uint8Array(binary.length);
    for (let index = 0; index < binary.length; index += 1) {
        bytes[index] = binary.charCodeAt(index);
    }
    return bytes;
};
