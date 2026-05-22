import { describe, expect, it } from 'vitest';
import {
    clampSettingNumber,
    getActiveSettingOptionDescription,
    getSettingControlBodyClass,
    getSettingControlClass,
    getSettingScope,
    getSettingStorageKey,
    getSettingValue,
    hasSettingScopeSelector,
    isRowToggleSetting,
    isSettingVisible,
    resolveSettingOptions,
    shouldUseVerticalSettingLayout,
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

    it('derives layout metadata that desktop renderers can reuse', () => {
        expect(hasSettingScopeSelector(createConfig({ allowedScopes: ['Global', 'Character'] }))).toBe(true);
        expect(shouldUseVerticalSettingLayout(createConfig({ type: 'slider' }), 'volume')).toBe(true);
        expect(shouldUseVerticalSettingLayout(createConfig({ type: 'stepper' }), 'count')).toBe(false);
        expect(isRowToggleSetting(createConfig({ type: 'boolean' }), 'discord-channel-mark')).toBe(true);
        expect(getSettingControlClass(createConfig({ type: 'theme' }), true)).toBe('theme-options tw:flex-wrap tw:gap-2.5 full-width');
        expect(getSettingControlBodyClass(createConfig({ type: 'options' }))).toBe('options-control');
    });

    it('clamps numeric input through schema limits', () => {
        expect(clampSettingNumber('12', { min: 1, max: 10 })).toBe(10);
        expect(clampSettingNumber('-4', { min: 1, max: 10 })).toBe(1);
        expect(clampSettingNumber('4.5', { min: 1, max: 10 })).toBe(4.5);
        expect(clampSettingNumber('not-a-number', { min: 1, max: 10 })).toBeNull();
    });
});
