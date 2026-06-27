import { beforeEach, describe, expect, it, vi } from 'vitest';
import { HALBootstrap } from '@/api/core/hal/HALBootstrap.js';
import { HALContext } from '@/api/core/hal/HALContext.js';

const state = vi.hoisted(() => ({
    host: {
        isTauriTavern: false,
        isSillyTavern: false,
        isGenericTauriApp: false,
        isStandaloneApp: true,
        runtimeEnvelope: 'standalone-app',
        physicalHost: 'web'
    },
    stProbeFails: false,
    standaloneRuntimeOptions: [] as unknown[],
    bindHostEvents: vi.fn(),
    waitForReady: vi.fn(async () => undefined)
}));

const createContext = () => ({
    eventBridge: {
        bindHostEvents: state.bindHostEvents
    },
    runtime: null
});

const createRuntime = (mode: string) => ({
    mode,
    conversation: {},
    generation: {},
    settings: {
        getSettings: vi.fn(async () => {
            if (mode === 'st-plugin-enhanced' && state.stProbeFails) {
                throw new Error('backend unavailable');
            }
            return {};
        })
    },
    presets: {},
    extensionStore: {}
});

vi.mock('@/api/core/host-drivers/HostDetector.js', () => ({
    HostDetector: state.host
}));

vi.mock('@/api/core/facade/HostRuntimePort.js', () => ({
    getHostRuntimePort: () => ({
        waitForReady: state.waitForReady
    })
}));

vi.mock('@/api/core/hal/adapters/st/STRuntimePortRegistration.js', () => ({
    registerSTRuntimePorts: vi.fn()
}));

vi.mock('@/api/core/hal/adapters/standalone/StandaloneRuntimePortRegistration.js', () => ({
    registerStandaloneRuntimePorts: vi.fn()
}));

vi.mock('@/api/core/hal/adapters/standalone/LocalResourceSourceProvider.js', () => ({
    registerLocalResourceSource: vi.fn()
}));

vi.mock('@/api/core/hal/adapters/st/STHostProvider.js', () => ({
    STHostProvider: class {
        createContext() {
            return createContext();
        }
    }
}));

vi.mock('@/api/core/hal/adapters/tauri/TauriHostProvider.js', () => ({
    TauriHostProvider: class {
        createContext() {
            return createContext();
        }
    }
}));

vi.mock('@/api/core/hal/adapters/standalone/StandaloneHostProvider.js', () => ({
    StandaloneHostProvider: class {
        createContext() {
            return createContext();
        }
    }
}));

vi.mock('@/api/core/hal/adapters/st/STPluginEnhancementRuntime.js', () => ({
    STPluginEnhancementRuntime: class {
        readonly mode = 'st-plugin-enhanced';
        readonly conversation = {};
        readonly generation = {};
        readonly settings = createRuntime('st-plugin-enhanced').settings;
        readonly presets = {};
        readonly extensionStore = {};
    }
}));

vi.mock('@/api/core/hal/adapters/tauri/TauriNativeRuntime.js', () => ({
    TauriNativeRuntime: class {
        readonly mode = 'tauri-native';
        readonly conversation = {};
        readonly generation = {};
        readonly settings = {};
        readonly presets = {};
        readonly extensionStore = {};
    }
}));

vi.mock('@/api/core/hal/adapters/tauri/TauriSqliteExtensionStore.js', () => ({
    TauriSqliteExtensionStore: class {
        readonly backend = 'tauri-sqlite';
    }
}));

vi.mock('@/api/core/hal/adapters/standalone/StandaloneLocalRuntime.js', () => ({
    StandaloneLocalRuntime: class {
        constructor(options?: unknown) {
            state.standaloneRuntimeOptions.push(options ?? {});
        }

        readonly mode = 'standalone-local';
        readonly conversation = {};
        readonly generation = {};
        readonly settings = {};
        readonly presets = {};
        readonly extensionStore = {};
    }
}));

describe('HALBootstrap runtime port selection', () => {
    beforeEach(() => {
        state.host.isTauriTavern = false;
        state.host.isSillyTavern = false;
        state.host.isGenericTauriApp = false;
        state.host.isStandaloneApp = true;
        state.host.runtimeEnvelope = 'standalone-app';
        state.host.physicalHost = 'web';
        state.stProbeFails = false;
        state.standaloneRuntimeOptions = [];
        state.bindHostEvents.mockClear();
        state.waitForReady.mockClear();
        (HALBootstrap as any)._initialized = false;
        (HALBootstrap as any)._initPromise = null;
        (HALBootstrap as any)._lastProgress = '';
        (HALContext as any)._instance = null;
    });

    it('uses tauri-native runtime in TauriTavern', async () => {
        state.host.isTauriTavern = true;
        state.host.isStandaloneApp = false;
        state.host.runtimeEnvelope = 'plugin-hosted';
        state.host.physicalHost = 'tauritavern';

        await HALBootstrap.init();

        expect(HALContext.instance.runtime.mode).toBe('tauri-native');
        expect(state.waitForReady).toHaveBeenCalled();
        expect(state.bindHostEvents).toHaveBeenCalled();
    });

    it('uses st-plugin-enhanced runtime when ST backend probe succeeds', async () => {
        state.host.isSillyTavern = true;
        state.host.isStandaloneApp = false;
        state.host.runtimeEnvelope = 'plugin-hosted';
        state.host.physicalHost = 'sillytavern';

        await HALBootstrap.init();

        expect(HALContext.instance.runtime.mode).toBe('st-plugin-enhanced');
        expect(state.waitForReady).toHaveBeenCalled();
    });

    it('falls back to standalone-local runtime when ST backend probe fails', async () => {
        state.host.isSillyTavern = true;
        state.host.isStandaloneApp = false;
        state.host.runtimeEnvelope = 'plugin-hosted';
        state.host.physicalHost = 'sillytavern';
        state.stProbeFails = true;

        await HALBootstrap.init();

        expect(HALContext.instance.runtime.mode).toBe('standalone-local');
    });

    it('uses standalone-local runtime with Tauri SQLite store in a generic Tauri app', async () => {
        state.host.isGenericTauriApp = true;
        state.host.isStandaloneApp = true;
        state.host.runtimeEnvelope = 'standalone-app';
        state.host.physicalHost = 'generic-tauri';

        await HALBootstrap.init();

        expect(HALContext.instance.runtime.mode).toBe('standalone-local');
        expect(state.standaloneRuntimeOptions).toEqual([
            {
                extensionStore: expect.objectContaining({
                    backend: 'tauri-sqlite'
                })
            }
        ]);
        expect(state.waitForReady).not.toHaveBeenCalled();
    });

    it('uses standalone-local runtime outside known hosts', async () => {
        await HALBootstrap.init();

        expect(HALContext.instance.runtime.mode).toBe('standalone-local');
    });
});
