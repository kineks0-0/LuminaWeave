import { afterEach, describe, expect, it } from 'vitest';
import { HostDetector } from '@/api/core/host-drivers/HostDetector.js';

type WindowLike = Record<string, unknown> & {
    parent?: unknown;
};

const originalWindowDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'window');
const originalNavigatorDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'navigator');

function installWindow(value: WindowLike): void {
    Object.defineProperty(globalThis, 'window', {
        configurable: true,
        value
    });
}

function installSelfParentWindow(value: Omit<WindowLike, 'parent'>): WindowLike {
    const host: WindowLike = { ...value };
    host.parent = host;
    installWindow(host);
    return host;
}

function installNavigator(userAgent: string): void {
    Object.defineProperty(globalThis, 'navigator', {
        configurable: true,
        value: { userAgent }
    });
}

function restoreGlobal(name: 'window' | 'navigator', descriptor: PropertyDescriptor | undefined): void {
    if (descriptor) {
        Object.defineProperty(globalThis, name, descriptor);
        return;
    }
    Reflect.deleteProperty(globalThis, name);
}

describe('HostDetector', () => {
    afterEach(() => {
        restoreGlobal('window', originalWindowDescriptor);
        restoreGlobal('navigator', originalNavigatorDescriptor);
    });

    it('classifies SillyTavern as a plugin-hosted runtime', () => {
        installSelfParentWindow({
            SillyTavern: { getContext: () => ({}) }
        });

        expect(HostDetector.isSillyTavern).toBe(true);
        expect(HostDetector.isPluginHosted).toBe(true);
        expect(HostDetector.isStandaloneApp).toBe(false);
        expect(HostDetector.physicalHost).toBe('sillytavern');
    });

    it('classifies TauriTavern as plugin-hosted even when a generic Tauri bridge exists', () => {
        installSelfParentWindow({
            __TAURITAVERN__: {
                ready: Promise.resolve(),
                api: {},
                invoke: { safeInvoke: () => undefined }
            },
            __TAURI__: {
                core: { invoke: () => undefined }
            }
        });

        expect(HostDetector.isTauriTavern).toBe(true);
        expect(HostDetector.isGenericTauriApp).toBe(false);
        expect(HostDetector.isPluginHosted).toBe(true);
        expect(HostDetector.isStandaloneApp).toBe(false);
        expect(HostDetector.physicalHost).toBe('tauritavern');
    });

    it('classifies a plain Tauri app as standalone, not TauriTavern', () => {
        installSelfParentWindow({
            __TAURI_RUNNING__: true,
            __TAURI__: {
                core: { invoke: () => undefined }
            }
        });

        expect(HostDetector.isTauriTavern).toBe(false);
        expect(HostDetector.isGenericTauriApp).toBe(true);
        expect(HostDetector.isPluginHosted).toBe(false);
        expect(HostDetector.isStandaloneApp).toBe(true);
        expect(HostDetector.isStandalone).toBe(true);
        expect(HostDetector.physicalHost).toBe('generic-tauri');
    });

    it('classifies a plain web page as a standalone web runtime', () => {
        installSelfParentWindow({});

        expect(HostDetector.isSillyTavern).toBe(false);
        expect(HostDetector.isTauriTavern).toBe(false);
        expect(HostDetector.isGenericTauriApp).toBe(false);
        expect(HostDetector.isPluginHosted).toBe(false);
        expect(HostDetector.isStandaloneApp).toBe(true);
        expect(HostDetector.physicalHost).toBe('web');
    });

    it('detects Android from the user agent independently of host classification', () => {
        installSelfParentWindow({});
        installNavigator('Mozilla/5.0 (Linux; Android 15) AppleWebKit/537.36');

        expect(HostDetector.isAndroid).toBe(true);
        expect(HostDetector.isStandaloneApp).toBe(true);
    });
});
