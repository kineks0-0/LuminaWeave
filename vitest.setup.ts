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

(global as any).localStorage = localStorageMock;

// Mock window and SillyTavern globals
(global as any).window = {
    localStorage: localStorageMock,
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
(global as any).fetch = vi.fn(() =>
  Promise.resolve({
    ok: true,
    status: 200,
    json: () => Promise.resolve({}),
  } as Response)
);
