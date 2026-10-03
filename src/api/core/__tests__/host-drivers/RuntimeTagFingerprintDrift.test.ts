import { afterEach, describe, expect, it } from 'vitest';
import { globalXMLTagRegistry, type LifecycleType } from '@shared/XMLTagRegistry.js';
import type { LuminaChatMessage } from '@shared/LuminaMessage.js';
import { globalXMLInterceptor } from '../../xml-view/XMLInterceptor.js';
import { STProtocol } from '../../host-drivers/st/STProtocol.js';

const SOURCE_ID = 'plugin:drift-probe';
const RAW = '前文<driftprobe>payload</driftprobe>后文';

const probe = (): { cleaned: string; fingerprintText: string; fingerprint: string; stFingerprint: string } => {
    const msg: LuminaChatMessage = {
        id: 'drift-probe',
        parentId: null,
        name: 'user',
        role: 'user',
        is_user: true,
        mesRaw: RAW,
        mes: RAW,
        fingerprint: '',
        extra: {}
    };
    STProtocol.syncMessageCalculatedFields(msg, { force: true });
    return {
        cleaned: globalXMLInterceptor.processAndCleanText(RAW, false),
        fingerprintText: STProtocol.resolveForFingerprint(msg),
        fingerprint: msg.fingerprint ?? '',
        stFingerprint: msg.stFingerprint ?? ''
    };
};

describe('runtime XML tag registration vs sync cleaning (characterization)', () => {
    const disposers: Array<() => void> = [];
    afterEach(() => {
        disposers.splice(0).reverse().forEach(dispose => dispose());
        globalXMLTagRegistry.unregister(SOURCE_ID, 'driftprobe');
    });

    const registerWith = (lifecycle: LifecycleType): void => {
        disposers.push(globalXMLInterceptor.registerXMLParser('driftprobe', lifecycle, () => undefined, SOURCE_ID));
    };

    // 特征测试：记录当前实际行为，不是对“应当如此”的断言。
    // 结论：注册新标签后，processAndCleanText(raw, false) 与 resolveForFingerprint（canonical 文本）的结果会变；
    // 但落盘的 fingerprint / stFingerprint 取自原始文本（pluginRaw/mesRaw/mesST），不受影响。
    it('transient registration strips the tag from cleaned text but keeps stored fingerprints', () => {
        const before = probe();
        registerWith('transient');
        const after = probe();

        expect(before.cleaned).toBe(RAW);
        expect(after.cleaned).toBe('前文后文');
        expect(after.fingerprintText).not.toBe(before.fingerprintText);
        expect(after.fingerprint).toBe(before.fingerprint);
        expect(after.stFingerprint).toBe(before.stFingerprint);
    });

    it('restores the original cleaning once the registration is revoked', () => {
        const before = probe();
        registerWith('transient');
        disposers.splice(0).reverse().forEach(dispose => dispose());
        globalXMLTagRegistry.unregister(SOURCE_ID, 'driftprobe');

        expect(probe()).toEqual(before);
    });

    it('persistent registration unwraps the tag in cleaned text but keeps stored fingerprints', () => {
        const before = probe();
        registerWith('persistent');
        const after = probe();

        expect(after.cleaned).toBe('前文payload后文');
        expect(after.fingerprintText).not.toBe(before.fingerprintText);
        expect(after.fingerprint).toBe(before.fingerprint);
        expect(after.stFingerprint).toBe(before.stFingerprint);
    });
});
