import type { JsonObject, JsonValue } from '@earendil-works/pi-ai';

// pi-ai 1.0 要求工具结果 details 与工具调用参数为可序列化 JSON。
// 在 SDK 边界统一收窄：丢弃函数、undefined 和循环引用等不可序列化值，而不是用类型断言掩盖。
export const toJsonValue = (value: unknown): JsonValue | undefined => {
    if (value === undefined) return undefined;
    try {
        const serialized = JSON.stringify(value);
        return serialized === undefined ? undefined : JSON.parse(serialized) as JsonValue;
    } catch {
        return undefined;
    }
};

export const toJsonObject = (value: unknown): JsonObject => {
    const json = toJsonValue(value);
    if (json === null || json === undefined || typeof json !== 'object' || Array.isArray(json)) {
        return {};
    }
    return json as JsonObject;
};
