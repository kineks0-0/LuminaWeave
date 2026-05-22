import { vi } from 'vitest';
import { HALContext } from '@/api/core/hal/HALContext.js';

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
    mockHAL.runtime = {
        mode: 'standalone-local',
        conversation: {
            listConversations: vi.fn(),
            getConversation: vi.fn(),
            saveConversation: vi.fn(),
            mutateConversation: vi.fn(),
            deleteConversation: vi.fn(),
            getTransactions: vi.fn(),
            rollbackTransaction: vi.fn()
        },
        generation: {
            generateStream: vi.fn(),
            attachStream: vi.fn(),
            stop: vi.fn(),
            fetchModels: vi.fn(),
            getStatus: vi.fn()
        },
        settings: {
            getSettings: vi.fn(),
            saveSettings: vi.fn()
        },
        presets: {
            listPresets: vi.fn(),
            importPreset: vi.fn(),
            exportPreset: vi.fn(),
            restoreDefaults: vi.fn()
        },
        extensionStore: {
            getJson: vi.fn(),
            setJson: vi.fn(),
            updateJson: vi.fn(),
            deleteJson: vi.fn(),
            listKeys: vi.fn(),
            setBlob: vi.fn(),
            getBlob: vi.fn()
        },
        ...(overrides.runtime || {})
    } as any;
    HALContext.instance = mockHAL;
    return mockHAL;
}
