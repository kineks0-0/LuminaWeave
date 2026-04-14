import { vi } from 'vitest';

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

// Mock fetch
g.fetch = vi.fn(() =>
  Promise.resolve({
    ok: true,
    status: 200,
    json: () => Promise.resolve({}),
  } as Response)
);
