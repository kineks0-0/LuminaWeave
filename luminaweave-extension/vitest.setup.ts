import { vi } from 'vitest';
import Dexie from 'dexie';
import { IDBKeyRange, indexedDB } from 'fake-indexeddb';

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => { store[key] = value.toString(); },
    clear: () => { store = {}; },
    removeItem: (key: string) => { delete store[key]; },
    length: 0,
    key: (index: number) => null,
  };
})();

// 使用 globalThis 及其类型断言
const g = globalThis as unknown as Record<string, unknown>;

g.localStorage = localStorageMock;
g.indexedDB = indexedDB;
g.IDBKeyRange = IDBKeyRange;
Dexie.dependencies.indexedDB = indexedDB;
Dexie.dependencies.IDBKeyRange = IDBKeyRange;

// Mock window and SillyTavern globals
g.window = {
    localStorage: localStorageMock,
    location: {
        hostname: 'localhost',
        port: '8080',
        protocol: 'http:',
        href: 'http://localhost:8080/'
    },
    SillyTavern: {
        getContext: () => ({
            characterId: 'test_char',
            chatId: 'test_chat',
            extensionSettings: {}
        })
    },
    extension_settings: {},
    this_chid: 'test_char',
    selected_chat: 'test_chat'
};

import { HALContext } from './src/api/core/hal/HALContext.js';

// Mock fetch
g.fetch = vi.fn(() =>
  Promise.resolve({
    ok: true,
    status: 200,
    json: () => Promise.resolve({}),
  } as Response)
);

// 初始化 HAL runtime ports
HALContext.instance = new HALContext(
    { resolve: (content: string) => content },
    { normalize: (id: string) => (id === 'default' || !id ? null : id) },
    {
        bindHostEvents: vi.fn(),
        unbindHostEvents: vi.fn(),
        on: vi.fn(),
        off: vi.fn(),
        emit: vi.fn()
    },
    {
        getItem: vi.fn(),
        setItem: vi.fn(),
        removeItem: vi.fn()
    },
    {
        generateStream: vi.fn()
    },
    {
        getCurrentCharacterId: vi.fn(() => 'test_char'),
        getCurrentChatId: vi.fn(() => 'test_chat'),
        getActiveLorebookEntries: vi.fn(() => []),
        getPreset: vi.fn(async () => ({}))
    },
    {
        getItem: vi.fn(),
        setItem: vi.fn(),
        getJson: vi.fn(),
        setJson: vi.fn()
    }
);

HALContext.instance.runtime = {
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
    }
};
