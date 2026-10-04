import { describe, expect, it } from 'vitest';
import {
    clampSettingNumber,
    getActiveSettingOptionDescription,
    getSettingScope,
    getSettingStorageKey,
    getSettingValue,
    hasSettingScopeSelector,
    isRowToggleSetting,
    isSettingAtDefault,
    isSettingVisible,
    resolveControlKind,
    resolveDisplayedOptionValue,
    resolveSelectedOptionValue,
    resolveSettingOptions,
    type SettingControlConfig
} from '../settingControlModel.js';

const createConfig = (overrides: Partial<SettingControlConfig> = {}): SettingControlConfig => ({
    label: '测试设置',
    type: 'options',
    default: 'default',
    ...overrides
});

describe('settingControlModel', () => {
    it('derives stable storage keys, values and scopes from schema state', () => {
        expect(getSettingStorageKey('lumina-settings', 'appearance')).toBe('lumina-settings.appearance');
        expect(getSettingValue({ 'x.y': 'stored' }, 'x.y', 'fallback')).toBe('stored');
        expect(getSettingValue({ 'x.y': null }, 'x.y', 'fallback')).toBe('fallback');
        expect(getSettingScope({}, 'x.y', ['Character', 'Global'])).toBe('Character');
        expect(getSettingScope({ 'x.y': 'Chat' }, 'x.y', ['Character', 'Global'])).toBe('Chat');
    });

    it('resolves visibility, options and active option descriptions without depending on Vue UI', () => {
        const config = createConfig({
            options: () => [
                { value: 'compact', label: '紧凑' },
                { value: 'roomy', label: '宽松', description: '更大的间距' }
            ],
            showIf: settings => settings['enabled'] === true
        });

        const options = resolveSettingOptions(config);

        expect(isSettingVisible(config, { enabled: false })).toBe(false);
        expect(isSettingVisible(config, { enabled: true })).toBe(true);
        expect(options.map(option => option.value)).toEqual(['compact', 'roomy']);
        expect(getActiveSettingOptionDescription(options, 'roomy')).toBe('更大的间距');
        expect(getActiveSettingOptionDescription(options, 'missing')).toBeNull();
    });

    it('derives scope metadata that desktop renderers can reuse', () => {
        expect(hasSettingScopeSelector(createConfig({ allowedScopes: ['Global', 'Character'] }))).toBe(true);
        expect(hasSettingScopeSelector(createConfig({ allowedScopes: ['Global'] }))).toBe(false);
        expect(isRowToggleSetting(createConfig({ type: 'boolean' }), 'discord-channel-mark')).toBe(true);
    });

    it('clamps numeric input through schema limits', () => {
        expect(clampSettingNumber('12', { min: 1, max: 10 })).toBe(10);
        expect(clampSettingNumber('-4', { min: 1, max: 10 })).toBe(1);
        expect(clampSettingNumber('4.5', { min: 1, max: 10 })).toBe(4.5);
        expect(clampSettingNumber('not-a-number', { min: 1, max: 10 })).toBeNull();
    });

    it('compares the current value with the schema default structurally', () => {
        expect(isSettingAtDefault(true, true)).toBe(true);
        expect(isSettingAtDefault(4, 5)).toBe(false);
        expect(isSettingAtDefault({ a: [1, 2] }, { a: [1, 2] })).toBe(true);
        expect(isSettingAtDefault({ a: [1, 2] }, { a: [2, 1] })).toBe(false);
        expect(isSettingAtDefault(undefined, '')).toBe(true);
        expect(isSettingAtDefault(null, 'x')).toBe(true);
    });

    it('picks a control kind from the schema type and option count', () => {
        const option = (value: string) => ({ value, label: value });
        expect(resolveControlKind(createConfig({ type: 'boolean' }))).toBe('toggle');
        expect(resolveControlKind(createConfig({ options: [option('a'), option('b'), option('c')] }))).toBe('segmented');
        expect(resolveControlKind(createConfig({ options: [option('a'), option('b'), option('c'), option('d')] }))).toBe('select');
        expect(resolveControlKind(createConfig({ type: 'slider', min: 0, max: 1 }))).toBe('slider');
        expect(resolveControlKind(createConfig({ type: 'stepper' }))).toBe('stepper');
        expect(resolveControlKind(createConfig({ type: 'nexus-select' }))).toBe('nexus-select');
        expect(resolveControlKind(createConfig({ type: 'password' }))).toBe('password');
    });

    it('shows the default option when the stored value is not a registered option', () => {
        const options = [{ value: 'classic', label: '经典' }, { value: 'telegram', label: 'Telegram' }];
        expect(resolveDisplayedOptionValue(options, 'telegram', 'classic')).toBe('telegram');
        expect(resolveDisplayedOptionValue(options, 'uninstalled-mode', 'classic')).toBe('classic');
        expect(resolveDisplayedOptionValue([], 'anything', 'classic')).toBe('anything');
    });

    it('restores numeric option values from native select strings', () => {
        const options = [{ value: 0, label: '关闭' }, { value: 2, label: '适中' }];
        expect(resolveSelectedOptionValue(options, '2')).toBe(2);
        expect(resolveSelectedOptionValue(options, 'unknown')).toBe('unknown');
    });
});
