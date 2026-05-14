import * as forgePrompts from '../../../../resources/prompts/forgePrompts.js';
import { lwStorage } from '../../../storage.js';
import { getPromptPresetProfile, listPromptPresetProfiles } from './PromptPresetProfiles.js';
import {
    clonePromptPresetGenerationSettings,
    sanitizePromptPresetGenerationSettings
} from '../../utils/promptPresetGenerationSettings.js';
import {
    type ForgeTestChatPreset as LegacyForgeTestChatPreset
} from '../../../../types/ForgeTestChatTypes.js';
import type {
    PromptPresetBindingMap,
    PromptPresetDefinition,
    PromptPresetEntry,
    PromptPresetProfileId
} from '../../../../types/PromptPresetTypes.js';

const STORAGE_KEY_REGISTRY = 'lumina-prompt-presets.registry';
const STORAGE_KEY_BINDINGS = 'lumina-prompt-presets.bindings';
const STORAGE_KEY_BUILTIN_OVERRIDES = 'lumina-prompt-presets.builtin-overrides';
const LEGACY_TEST_CHAT_PRESETS_KEY = 'lumina-forge.testChatPresets';
const LEGACY_TEST_CHAT_ACTIVE_KEY = 'lumina-forge.testChatActivePreset';

type PromptPresetBuiltInOverrideMap = Record<string, Record<string, boolean>>;

// ── 预设加载与解析 ───────────────────────────────────────────────────

const presetModules = import.meta.glob('../../../../resources/presets/*.json', { eager: true });

const resolvePromptText = (text: string | undefined): string | undefined => {
    if (!text || !text.startsWith('@')) return text;
    const key = text.substring(1) as keyof typeof forgePrompts;
    const value = forgePrompts[key];
    return typeof value === 'string' ? value : text;
};

const createBuiltInDefinitions = (): PromptPresetDefinition[] => {
    const current = now();
    const builtIns: PromptPresetDefinition[] = [];

    for (const path in presetModules) {
        const preset = (presetModules[path] as { default: any }).default;
        
        // 解析 specials 中的提示词引用
        const specials: Record<string, string> = {};
        if (preset.specials) {
            for (const key in preset.specials) {
                specials[key] = resolvePromptText(preset.specials[key]) || '';
            }
        }

        // 解析 entries 中的提示词引用
        const entries = (preset.entries || []).map((entry: any) => ({
            ...entry,
            content: resolvePromptText(entry.content)
        }));

        builtIns.push({
            ...preset,
            builtIn: true,
            specials,
            entries,
            createdAt: current,
            updatedAt: current
        });
    }

    return builtIns;
};

const now = () => Date.now();

const createEntry = (
    id: string,
    type: PromptPresetEntry['type'],
    enabled: boolean,
    slotId?: string,
    role?: PromptPresetEntry['role'],
    content?: string
): PromptPresetEntry => ({
    id,
    type,
    slotId,
    enabled,
    role,
    content
});

const createDefaultBindings = (): PromptPresetBindingMap => ({
    'forge-main': getPromptPresetProfile('forge-main').defaultPresetId,
    'forge-executor': getPromptPresetProfile('forge-executor').defaultPresetId,
    'forge-test-chat': getPromptPresetProfile('forge-test-chat').defaultPresetId
});

const clonePreset = (preset: PromptPresetDefinition): PromptPresetDefinition => ({
    ...preset,
    entries: preset.entries.map(entry => ({ ...entry })),
    specials: { ...preset.specials },
    generationSettings: clonePromptPresetGenerationSettings(preset.generationSettings),
    customCharCard: preset.customCharCard ? { ...preset.customCharCard } : undefined
});

const bindingsEqual = (left: PromptPresetBindingMap, right: PromptPresetBindingMap): boolean =>
    left['forge-main'] === right['forge-main']
    && left['forge-executor'] === right['forge-executor']
    && left['forge-test-chat'] === right['forge-test-chat'];

export class PromptPresetRegistry {
    private initialized = false;
    private presets: PromptPresetDefinition[] = [];
    private bindings: PromptPresetBindingMap = createDefaultBindings();
    private builtInOverrides: PromptPresetBuiltInOverrideMap = {};

    public resetForTests(): void {
        this.initialized = false;
        this.presets = [];
        this.bindings = createDefaultBindings();
        this.builtInOverrides = {};
    }

    public reload(): void {
        this.initialized = false;
        this.ensureInitialized();
    }

    public listProfiles() {
        return listPromptPresetProfiles();
    }

    public listPresets(profileId: PromptPresetProfileId): PromptPresetDefinition[] {
        this.ensureInitialized();
        return this.presets
            .filter(preset => preset.profileId === profileId)
            .map(clonePreset);
    }

    public getPreset(profileId: PromptPresetProfileId, presetId: string): PromptPresetDefinition | null {
        this.ensureInitialized();
        const preset = this.presets.find(item => item.profileId === profileId && item.id === presetId);
        return preset ? clonePreset(preset) : null;
    }

    public getActivePresetId(profileId: PromptPresetProfileId): string {
        this.ensureInitialized();
        return this.bindings[profileId];
    }

    public getActivePreset(profileId: PromptPresetProfileId): PromptPresetDefinition {
        this.ensureInitialized();
        const preset = this.getPreset(profileId, this.bindings[profileId]);
        if (preset) {
            return preset;
        }
        const fallback = this.getPreset(profileId, getPromptPresetProfile(profileId).defaultPresetId);
        if (!fallback) {
            throw new Error(`Missing built-in prompt preset for profile: ${profileId}`);
        }
        return fallback;
    }

    public setActivePreset(profileId: PromptPresetProfileId, presetId: string): void {
        this.ensureInitialized();
        const preset = this.presets.find(item => item.profileId === profileId && item.id === presetId);
        if (!preset) return;
        this.bindings = {
            ...this.bindings,
            [profileId]: presetId
        };
        this.persistBindings();
    }

    public createPreset(profileId: PromptPresetProfileId, seed?: Partial<PromptPresetDefinition>): PromptPresetDefinition {
        this.ensureInitialized();
        const current = now();
        const defaultPreset = this.getActivePreset(profileId);
        const preset: PromptPresetDefinition = {
            id: `user:${profileId}:${current}`,
            name: seed?.name || '新预设',
            profileId,
            builtIn: false,
            engine: seed?.engine || defaultPreset.engine,
            charCardMode: seed?.charCardMode ?? defaultPreset.charCardMode,
            customCharCard: seed?.customCharCard ? { ...seed.customCharCard } : (defaultPreset.customCharCard ? { ...defaultPreset.customCharCard } : undefined),
            entries: (seed?.entries || defaultPreset.entries).map(entry => ({ ...entry })),
            specials: { ...defaultPreset.specials, ...seed?.specials },
            generationSettings: clonePromptPresetGenerationSettings(seed?.generationSettings ?? defaultPreset.generationSettings),
            createdAt: current,
            updatedAt: current
        };
        this.presets.push(preset);
        this.persistRegistry();
        return clonePreset(preset);
    }

    public duplicatePreset(profileId: PromptPresetProfileId, presetId: string): PromptPresetDefinition | null {
        const preset = this.getPreset(profileId, presetId);
        if (!preset) return null;
        return this.createPreset(profileId, {
            name: `${preset.name} 副本`,
            engine: preset.engine,
            charCardMode: preset.charCardMode,
            customCharCard: preset.customCharCard,
            entries: preset.entries,
            specials: preset.specials,
            generationSettings: preset.generationSettings
        });
    }

    public updatePreset(profileId: PromptPresetProfileId, presetId: string, changes: Partial<Omit<PromptPresetDefinition, 'id' | 'profileId' | 'builtIn' | 'createdAt'>>): PromptPresetDefinition | null {
        this.ensureInitialized();
        const index = this.presets.findIndex(item => item.profileId === profileId && item.id === presetId);
        if (index === -1 || this.presets[index].builtIn) return null;
        const updated: PromptPresetDefinition = {
            ...this.presets[index],
            ...changes,
            customCharCard: changes.customCharCard
                ? { ...changes.customCharCard }
                : (this.presets[index].customCharCard ? { ...this.presets[index].customCharCard } : undefined),
            entries: changes.entries ? changes.entries.map(entry => ({ ...entry })) : this.presets[index].entries.map(entry => ({ ...entry })),
            specials: changes.specials ? { ...changes.specials } : { ...this.presets[index].specials },
            generationSettings: changes.generationSettings
                ? clonePromptPresetGenerationSettings(changes.generationSettings)
                : clonePromptPresetGenerationSettings(this.presets[index].generationSettings),
            updatedAt: now()
        };
        this.presets.splice(index, 1, updated);
        this.persistRegistry();
        return clonePreset(updated);
    }

    public deletePreset(profileId: PromptPresetProfileId, presetId: string): void {
        this.ensureInitialized();
        const preset = this.presets.find(item => item.profileId === profileId && item.id === presetId);
        if (!preset || preset.builtIn) return;
        this.presets = this.presets.filter(item => !(item.profileId === profileId && item.id === presetId));
        if (this.bindings[profileId] === presetId) {
            this.bindings = {
                ...this.bindings,
                [profileId]: getPromptPresetProfile(profileId).defaultPresetId
            };
            this.persistBindings();
        }
        this.persistRegistry();
    }

    public restoreProfileDefault(profileId: PromptPresetProfileId): void {
        this.setActivePreset(profileId, getPromptPresetProfile(profileId).defaultPresetId);
    }

    public setBuiltInEntryEnabled(
        profileId: PromptPresetProfileId,
        presetId: string,
        entryId: string,
        enabled: boolean
    ): PromptPresetDefinition | null {
        this.ensureInitialized();
        const preset = this.presets.find(item => item.profileId === profileId && item.id === presetId && item.builtIn);
        if (!preset) return null;

        const entry = preset.entries.find(item => item.id === entryId);
        if (!entry) return null;

        const defaultPreset = createBuiltInDefinitions().find(item => item.profileId === profileId && item.id === presetId);
        const defaultEntry = defaultPreset?.entries.find(item => item.id === entryId);
        if (!defaultEntry) return null;

        const normalizedEnabled = Boolean(enabled);
        const currentEnabled = Boolean(entry.enabled);
        if (currentEnabled === normalizedEnabled) {
            return clonePreset(preset);
        }

        const nextOverrides: PromptPresetBuiltInOverrideMap = {
            ...this.builtInOverrides,
            [presetId]: {
                ...(this.builtInOverrides[presetId] || {})
            }
        };

        if (normalizedEnabled === defaultEntry.enabled) {
            delete nextOverrides[presetId][entryId];
            if (Object.keys(nextOverrides[presetId]).length === 0) {
                delete nextOverrides[presetId];
            }
        } else {
            nextOverrides[presetId][entryId] = normalizedEnabled;
        }

        this.builtInOverrides = nextOverrides;
        entry.enabled = normalizedEnabled;
        this.persistBuiltInOverrides();
        return clonePreset(preset);
    }

    private ensureInitialized(): void {
        if (this.initialized) return;

        const builtIns = createBuiltInDefinitions();
        const rawRegistry = lwStorage.get(STORAGE_KEY_REGISTRY, [], 'Global');
        const rawBindings = lwStorage.get(STORAGE_KEY_BINDINGS, null, 'Global');
        const rawBuiltInOverrides = lwStorage.get(STORAGE_KEY_BUILTIN_OVERRIDES, {}, 'Global');

        const userPresets = Array.isArray(rawRegistry)
            ? rawRegistry
                .filter((preset): preset is PromptPresetDefinition => Boolean(preset && typeof preset === 'object' && !preset.builtIn))
                .map(preset => ({
                    ...preset,
                    builtIn: false,
                    entries: Array.isArray(preset.entries) ? preset.entries.map(entry => ({ ...entry })) : [],
                    specials: { ...(preset.specials || {}) },
                    generationSettings: sanitizePromptPresetGenerationSettings(preset.generationSettings),
                    customCharCard: preset.customCharCard ? { ...preset.customCharCard } : undefined
                }))
            : [];

        const normalizedBuiltInOverrides = this.normalizeBuiltInOverrides(builtIns, rawBuiltInOverrides);

        this.presets = [
            ...this.applyBuiltInOverrides(builtIns, normalizedBuiltInOverrides.overrides),
            ...userPresets
        ];
        this.bindings = createDefaultBindings();
        this.builtInOverrides = normalizedBuiltInOverrides.overrides;

        if (rawBindings && typeof rawBindings === 'object') {
            this.bindings = {
                ...this.bindings,
                ...(rawBindings as Partial<PromptPresetBindingMap>)
            };
        }

        this.applyLegacyMigrationIfNeeded();
        this.normalizeBindings();
        this.initialized = true;

        if (normalizedBuiltInOverrides.changed) {
            this.persistBuiltInOverrides();
        }
    }

    private applyLegacyMigrationIfNeeded(): void {
        const hasNewTestChatPresets = this.presets.some(preset => preset.profileId === 'forge-test-chat' && !preset.builtIn);
        if (hasNewTestChatPresets) {
            return;
        }

        const legacyUserPresets = lwStorage.get(LEGACY_TEST_CHAT_PRESETS_KEY, [], 'Global');
        const legacyActivePresetId = lwStorage.get(LEGACY_TEST_CHAT_ACTIVE_KEY, '', 'Global');
        const builtInLookup = new Map<string, string>([
            ['built-in:st-preset', 'built-in:forge-test-chat-st-preset'],
            ['built-in:roleplay', 'built-in:forge-test-chat-roleplay'],
            ['built-in:world-only', 'built-in:forge-test-chat-world-only']
        ]);

        const migratedUsers = Array.isArray(legacyUserPresets)
            ? (legacyUserPresets as LegacyForgeTestChatPreset[])
                .filter(preset => !preset.builtIn)
                .map<PromptPresetDefinition>((preset) => {
                    const engine: PromptPresetDefinition['engine'] = preset.promptMode === 'st_preset' ? 'st_preset' : 'composed';
                    return {
                        id: preset.id,
                        name: preset.name,
                        profileId: 'forge-test-chat',
                        builtIn: false,
                        engine,
                        charCardMode: preset.charCardMode,
                        customCharCard: preset.customCharCard ? { ...preset.customCharCard } : undefined,
                        entries: (preset.promptEntries || []).map((entry, index) => entry.type === 'slot'
                            ? createEntry(
                                `${preset.id}:slot:${entry.slot}:${index}`,
                                'slot',
                                entry.enabled,
                                this.mapLegacySlot(entry.slot)
                            )
                            : createEntry(
                                entry.id || `${preset.id}:custom:${index}`,
                                'custom',
                                entry.enabled,
                                undefined,
                                entry.prompt.role,
                                entry.prompt.content
                            )),
                        specials: {},
                        generationSettings: {},
                        createdAt: preset.createdAt,
                        updatedAt: preset.updatedAt
                    };
                })
            : [];

        if (migratedUsers.length > 0) {
            this.presets.push(...migratedUsers);
            this.persistRegistry();
        }

        if (typeof legacyActivePresetId === 'string' && legacyActivePresetId) {
            this.bindings['forge-test-chat'] = builtInLookup.get(legacyActivePresetId) || legacyActivePresetId;
            this.persistBindings();
        }
    }

    private mapLegacySlot(slot: string): string {
        switch (slot) {
            case 'char_system_prompt':
            case 'char_description':
            case 'char_personality':
            case 'scenario':
            case 'world_info':
            case 'chat_history':
                return slot;
            default:
                return 'chat_history';
        }
    }

    private normalizeBindings(): void {
        const previousBindings = { ...this.bindings };
        (Object.keys(this.bindings) as PromptPresetProfileId[]).forEach((profileId) => {
            const exists = this.presets.some(preset => preset.profileId === profileId && preset.id === this.bindings[profileId]);
            if (!exists) {
                this.bindings[profileId] = getPromptPresetProfile(profileId).defaultPresetId;
            }
        });
        if (!bindingsEqual(previousBindings, this.bindings)) {
            this.persistBindings();
        }
    }

    private normalizeBuiltInOverrides(
        builtIns: PromptPresetDefinition[],
        rawOverrides: unknown
    ): { overrides: PromptPresetBuiltInOverrideMap; changed: boolean } {
        const rawMap = rawOverrides && typeof rawOverrides === 'object'
            ? rawOverrides as Record<string, unknown>
            : {};
        const overrides: PromptPresetBuiltInOverrideMap = {};
        let changed = rawOverrides !== undefined && (rawOverrides === null || Array.isArray(rawOverrides) || typeof rawOverrides !== 'object');

        builtIns.forEach((preset) => {
            const rawPresetOverrides = rawMap[preset.id];
            if (!rawPresetOverrides || typeof rawPresetOverrides !== 'object' || Array.isArray(rawPresetOverrides)) {
                if (rawPresetOverrides !== undefined) {
                    changed = true;
                }
                return;
            }

            const defaultEntryMap = new Map(preset.entries.map(entry => [entry.id, Boolean(entry.enabled)]));
            Object.entries(rawPresetOverrides as Record<string, unknown>).forEach(([entryId, rawEnabled]) => {
                if (!defaultEntryMap.has(entryId) || typeof rawEnabled !== 'boolean') {
                    changed = true;
                    return;
                }
                const defaultEnabled = defaultEntryMap.get(entryId);
                if (defaultEnabled === rawEnabled) {
                    changed = true;
                    return;
                }
                overrides[preset.id] = overrides[preset.id] || {};
                overrides[preset.id][entryId] = rawEnabled;
            });
        });

        Object.keys(rawMap).forEach((presetId) => {
            if (!builtIns.some(preset => preset.id === presetId)) {
                changed = true;
            }
        });

        return { overrides, changed };
    }

    private applyBuiltInOverrides(
        builtIns: PromptPresetDefinition[],
        overrides: PromptPresetBuiltInOverrideMap
    ): PromptPresetDefinition[] {
        return builtIns.map((preset) => {
            const presetOverrides = overrides[preset.id];
            if (!presetOverrides) {
                return preset;
            }
            return {
                ...preset,
                entries: preset.entries.map((entry) => ({
                    ...entry,
                    enabled: presetOverrides[entry.id] ?? entry.enabled
                }))
            };
        });
    }

    private persistRegistry(): void {
        const userPresets = this.presets.filter(preset => !preset.builtIn).map(clonePreset);
        void lwStorage.set(STORAGE_KEY_REGISTRY, userPresets, 'Global');
    }

    private persistBindings(): void {
        void lwStorage.set(STORAGE_KEY_BINDINGS, { ...this.bindings }, 'Global');
    }

    private persistBuiltInOverrides(): void {
        void lwStorage.set(STORAGE_KEY_BUILTIN_OVERRIDES, { ...this.builtInOverrides }, 'Global');
    }
}

export const promptPresetRegistry = new PromptPresetRegistry();
