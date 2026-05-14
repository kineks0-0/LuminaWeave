import { vi } from 'vitest';
import { HALContext } from '../hal/HALContext.js';

/**
 * 初始化单元测试用的 Mock HAL 上下文
 * @param overrides 可选的覆盖项
 */
export function initMockHAL(overrides: any = {}) {
    const mockHAL = new HALContext(
        { resolve: (c: string) => c, ...(overrides.macroResolver || {}) } as any,
        {
            normalize: (id: string) => (id === 'default' || !id) ? null : id,
            ...(overrides.sessionIdNormalizer || {})
        } as any,
        {
            bindHostEvents: vi.fn(),
            unbindHostEvents: vi.fn(),
            on: vi.fn(),
            off: vi.fn(),
            emit: vi.fn(),
            ...(overrides.eventBridge || {})
        } as any,
        {
            getItem: vi.fn(),
            setItem: vi.fn(),
            removeItem: vi.fn(),
            ...(overrides.storage || {})
        } as any,
        {
            generateStream: vi.fn(),
            ...(overrides.network || {})
        } as any,
        {
            getCurrentCharacterId: vi.fn(() => 'char_1'),
            getCurrentChatId: vi.fn(() => 'chat_1'),
            getActiveLorebookEntries: vi.fn(() => []),
            getPreset: vi.fn(async () => ({})),
            ...(overrides.resourceProvider || {})
        } as any,
        {
            getItem: vi.fn(),
            setItem: vi.fn(),
            getJson: vi.fn(),
            setJson: vi.fn(),
            ...(overrides.bootstrapStorage || {})
        } as any
    );
    HALContext.instance = mockHAL;
    return mockHAL;
}
