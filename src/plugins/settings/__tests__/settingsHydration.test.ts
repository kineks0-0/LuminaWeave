import { describe, expect, it } from 'vitest';
import type { SettingDefinition } from '../../../types/plugin.js';
import { planSettingsHydration, resolveInitialSettingScope } from '../settingsHydration.js';

const definition = (overrides: Partial<SettingDefinition> = {}): SettingDefinition => ({
    default: 1,
    label: '测试',
    type: 'stepper',
    ...overrides
});

describe('settingsHydration', () => {
    it('only plans keys that are not hydrated yet', () => {
        const catalog = {
            'lumina-chat': { a: definition(), b: definition() },
            'acme-runtime': { token: definition({ default: '' }) }
        };

        const plan = planSettingsHydration(catalog, new Set(['lumina-chat.a']));

        expect(plan.map(item => item.storageKey)).toEqual(['lumina-chat.b', 'acme-runtime.token']);
        expect(plan[1].definition.default).toBe('');
    });

    it('returns an empty plan when everything is hydrated', () => {
        expect(planSettingsHydration({ x: { a: definition() } }, new Set(['x.a']))).toEqual([]);
    });

    it('keeps a stored scope only when the schema allows it', () => {
        expect(resolveInitialSettingScope(definition({ allowedScopes: ['Global', 'Character'] }), 'Character')).toBe('Character');
        expect(resolveInitialSettingScope(definition({ allowedScopes: ['Global'] }), 'Character')).toBe('Global');
        expect(resolveInitialSettingScope(definition({ allowedScopes: ['Character', 'Global'] }), null)).toBe('Character');
        expect(resolveInitialSettingScope(definition(), null)).toBe('Global');
    });
});
