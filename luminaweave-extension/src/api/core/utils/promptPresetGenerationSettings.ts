import type { PromptPresetGenerationSettings } from '../../../types/PromptPresetTypes.js';

export const PROMPT_PRESET_GENERATION_SETTING_KEYS = [
    'temperature',
    'top_p',
    'top_k',
    'presence_penalty',
    'frequency_penalty',
    'max_tokens',
    'max_length',
    'seed'
] as const satisfies ReadonlyArray<keyof PromptPresetGenerationSettings>;

export const clonePromptPresetGenerationSettings = (
    settings?: PromptPresetGenerationSettings | null
): PromptPresetGenerationSettings => sanitizePromptPresetGenerationSettings(settings);

export const sanitizePromptPresetGenerationSettings = (
    settings?: PromptPresetGenerationSettings | Record<string, unknown> | null
): PromptPresetGenerationSettings => {
    if (!settings || typeof settings !== 'object' || Array.isArray(settings)) {
        return {};
    }

    const sanitized: PromptPresetGenerationSettings = {};
    PROMPT_PRESET_GENERATION_SETTING_KEYS.forEach((key) => {
        const rawValue = settings[key];
        if (typeof rawValue === 'number' && Number.isFinite(rawValue)) {
            sanitized[key] = rawValue;
        }
    });

    if (typeof sanitized.seed === 'number' && sanitized.seed < 0) {
        delete sanitized.seed;
    }

    return sanitized;
};

export const hasPromptPresetGenerationSettings = (
    settings?: PromptPresetGenerationSettings | null
): boolean => PROMPT_PRESET_GENERATION_SETTING_KEYS.some((key) => typeof settings?.[key] === 'number');
