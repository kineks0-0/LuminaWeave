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
    ForgeAgentExtensionResource,
    LegacyForgeAgentPromptMode,
    LegacyPromptPresetProfileId,
    ForgeAgentPromptOrchestration,
    ForgeAgentPromptResource,
    ForgeAgentPromptResourceSet,
    ForgeAgentSkillLoadPolicy,
    ForgeAgentSkillResource,
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

/**
 * 预设文件夹资源（Forge agent 目录）由 Core 侧在组合根注入，
 * HAL 不再直接 import forge / agent-runtime。
 */
export interface PresetFolderResources {
    system?: ForgeAgentPromptResource;
    executor?: ForgeAgentPromptResource;
    skills: ForgeAgentSkillResource[];
    extensions: Array<ForgeAgentExtensionResource & { factory?: unknown }>;
}

export type PresetFolderResourceResolver = (presetId: string) => PresetFolderResources;

const EMPTY_PRESET_FOLDER_RESOURCES: PresetFolderResources = { skills: [], extensions: [] };

let presetFolderResourceResolver: PresetFolderResourceResolver = () => EMPTY_PRESET_FOLDER_RESOURCES;

export const configurePresetFolderResources = (resolver: PresetFolderResourceResolver | null): void => {
    presetFolderResourceResolver = resolver ?? (() => EMPTY_PRESET_FOLDER_RESOURCES);
};
type RawPresetModule = Omit<PromptPresetDefinition, 'profileId' | 'forgeAgentResources'> & {
    profileId: PromptPresetProfileId | LegacyPromptPresetProfileId;
    forgeAgentResources?: Partial<Omit<ForgeAgentPromptResourceSet, 'contract' | 'system' | 'executor' | 'skills' | 'extensions'>> & {
        contract?: ForgeAgentPromptResource;
        system?: ForgeAgentPromptResource;
        executor?: ForgeAgentPromptResource;
        modes?: Partial<Record<LegacyForgeAgentPromptMode, ForgeAgentPromptResource>>;
        skills?: ForgeAgentSkillResource[];
        extensions?: ForgeAgentExtensionResource[];
    };
};

// ── 预设加载与解析 ───────────────────────────────────────────────────

const presetModules = import.meta.glob('../../../../resources/presets/*.json', { eager: true });

const resolvePromptText = (text: string | undefined): string | undefined => {
    if (!text || !text.startsWith('@')) return text;
    const key = text.substring(1) as keyof typeof forgePrompts;
    const value = forgePrompts[key];
    return typeof value === 'string' ? value : text;
};

const cloneForgeAgentResource = (resource: ForgeAgentPromptResource): ForgeAgentPromptResource => ({
    ...resource
});

const cloneForgeAgentSkillResource = (resource: ForgeAgentSkillResource): ForgeAgentSkillResource => ({
    ...resource,
    loadPolicy: resource.loadPolicy === 'always' ? 'always' : 'on_demand'
});

const cloneForgeAgentResources = (resources: ForgeAgentPromptResourceSet | undefined): ForgeAgentPromptResourceSet | undefined => {
    if (!resources) return undefined;
    return {
        contract: cloneForgeAgentResource(resources.contract),
        system: cloneForgeAgentResource(resources.system),
        executor: cloneForgeAgentResource(resources.executor),
        skills: resources.skills?.map(cloneForgeAgentSkillResource),
        extensions: resources.extensions?.map(extension => ({ ...extension }))
    };
};

const cloneForgeAgentOrchestration = (orchestration: ForgeAgentPromptOrchestration | undefined): ForgeAgentPromptOrchestration | undefined =>
    orchestration
        ? {
            label: orchestration.label,
            steps: orchestration.steps.map(step => ({ ...step }))
        }
        : undefined;

const resolveForgeAgentResource = (resource: ForgeAgentPromptResource | undefined): ForgeAgentPromptResource | undefined =>
    resource
        ? {
            ...resource,
            content: resolvePromptText(resource.content) ?? resource.content
        }
        : undefined;

const normalizeForgeAgentSkillLoadPolicy = (
    loadPolicy: ForgeAgentSkillResource['loadPolicy']
): ForgeAgentSkillLoadPolicy => loadPolicy === 'always' ? 'always' : 'on_demand';

const resolveForgeAgentResources = (
    presetId: string,
    resources: RawPresetModule['forgeAgentResources'] | undefined
): ForgeAgentPromptResourceSet | undefined => {
    if (!resources?.contract) return undefined;
    const folderResources = presetFolderResourceResolver(presetId);
    const system = folderResources.system
        ?? resolveForgeAgentResource(resources.system)
        ?? resolveForgeAgentResource(resources.modes?.conversation);
    const executor = folderResources.executor
        ?? resolveForgeAgentResource(resources.executor)
        ?? resolveForgeAgentResource(resources.modes?.executor);
    if (!system || !executor) return undefined;
    return {
        contract: resolveForgeAgentResource(resources.contract) ?? resources.contract,
        system,
        executor,
        skills: [
            ...(resources.skills?.map(skill => ({
                ...skill,
                content: resolvePromptText(skill.content) ?? skill.content,
                loadPolicy: normalizeForgeAgentSkillLoadPolicy(skill.loadPolicy)
            })) ?? []),
            ...folderResources.skills
        ],
        extensions: [
            ...(resources.extensions?.map(extension => ({ ...extension })) ?? []),
            ...folderResources.extensions.map(({ factory: _factory, ...extension }) => extension)
        ]
    };
};

const createBuiltInDefinitions = (): PromptPresetDefinition[] => {
    const current = now();
    const builtIns: PromptPresetDefinition[] = [];

    for (const path in presetModules) {
        const preset = (presetModules[path] as { default: RawPresetModule }).default;
        if (preset.profileId === 'forge-main' || preset.profileId === 'forge-executor') {
            continue;
        }
        
        // 解析 specials 中的提示词引用
        const specials: Record<string, string> = {};
        if (preset.specials) {
            for (const key of Object.keys(preset.specials) as Array<keyof typeof preset.specials>) {
                specials[key] = resolvePromptText(preset.specials[key]) || '';
            }
        }

        // 解析 entries 中的提示词引用
        const entries = (preset.entries || []).map((entry: PromptPresetEntry) => ({
            ...entry,
            content: resolvePromptText(entry.content)
        }));

        builtIns.push({
            ...preset,
            builtIn: true,
            specials,
            entries,
            profileId: preset.profileId,
            forgeAgentResources: resolveForgeAgentResources(preset.id, preset.forgeAgentResources),
            forgeAgentOrchestration: preset.forgeAgentOrchestration
                ? cloneForgeAgentOrchestration(preset.forgeAgentOrchestration)
                : undefined,
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
    'forge-agent': getPromptPresetProfile('forge-agent').defaultPresetId,
    'forge-test-chat': getPromptPresetProfile('forge-test-chat').defaultPresetId
});

const clonePreset = (preset: PromptPresetDefinition): PromptPresetDefinition => ({
    ...preset,
    entries: preset.entries.map(entry => ({ ...entry })),
    specials: { ...preset.specials },
    forgeAgentResources: cloneForgeAgentResources(preset.forgeAgentResources),
    forgeAgentOrchestration: cloneForgeAgentOrchestration(preset.forgeAgentOrchestration),
    generationSettings: clonePromptPresetGenerationSettings(preset.generationSettings),
    customCharCard: preset.customCharCard ? { ...preset.customCharCard } : undefined
});

const bindingsEqual = (left: PromptPresetBindingMap, right: PromptPresetBindingMap): boolean =>
    left['forge-agent'] === right['forge-agent']
    && left['forge-test-chat'] === right['forge-test-chat'];

const normalizeLegacyPresetId = (presetId: string | undefined): string | undefined => {
    if (!presetId) return undefined;
    if (
        presetId === 'built-in:forge-main-default'
        || presetId === 'built-in:forge-executor-default'
        || presetId === 'built-in:forge-main-reference-extract'
        || presetId === 'built-in:forge-executor-reference-extract'
    ) {
        return 'built-in:forge-agent-default';
    }
    return presetId;
};

const normalizePresetProfileId = (
    profileId: PromptPresetProfileId | LegacyPromptPresetProfileId
): PromptPresetProfileId =>
    profileId === 'forge-main' || profileId === 'forge-executor'
        ? 'forge-agent'
        : profileId;

const isPromptPresetProfileId = (value: string): value is PromptPresetProfileId =>
    value === 'forge-agent' || value === 'forge-test-chat';

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
            forgeAgentResources: cloneForgeAgentResources(seed?.forgeAgentResources ?? defaultPreset.forgeAgentResources),
            forgeAgentOrchestration: cloneForgeAgentOrchestration(seed?.forgeAgentOrchestration ?? defaultPreset.forgeAgentOrchestration),
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
            forgeAgentResources: preset.forgeAgentResources,
            forgeAgentOrchestration: preset.forgeAgentOrchestration,
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
            forgeAgentResources: changes.forgeAgentResources
                ? cloneForgeAgentResources(changes.forgeAgentResources)
                : cloneForgeAgentResources(this.presets[index].forgeAgentResources),
            forgeAgentOrchestration: changes.forgeAgentOrchestration
                ? cloneForgeAgentOrchestration(changes.forgeAgentOrchestration)
                : cloneForgeAgentOrchestration(this.presets[index].forgeAgentOrchestration),
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
                .map(preset => this.normalizeStoredPreset(preset))
                .filter((preset): preset is PromptPresetDefinition => Boolean(preset))
            : [];

        const normalizedBuiltInOverrides = this.normalizeBuiltInOverrides(builtIns, rawBuiltInOverrides);

        this.presets = [
            ...this.applyBuiltInOverrides(builtIns, normalizedBuiltInOverrides.overrides),
            ...userPresets
        ];
        this.bindings = createDefaultBindings();
        this.builtInOverrides = normalizedBuiltInOverrides.overrides;

        if (rawBindings && typeof rawBindings === 'object' && !Array.isArray(rawBindings)) {
            this.bindings = this.normalizeStoredBindings(rawBindings as Record<string, unknown>);
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
                        forgeAgentResources: undefined,
                        forgeAgentOrchestration: undefined,
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

    private normalizeStoredPreset(rawPreset: PromptPresetDefinition): PromptPresetDefinition | null {
        const rawProfileId = rawPreset.profileId as PromptPresetProfileId | LegacyPromptPresetProfileId;
        const profileId = normalizePresetProfileId(rawProfileId);
        if (!isPromptPresetProfileId(profileId)) return null;
        return {
            ...rawPreset,
            profileId,
            builtIn: false,
            entries: Array.isArray(rawPreset.entries) ? rawPreset.entries.map(entry => ({ ...entry })) : [],
            specials: { ...(rawPreset.specials || {}) },
            generationSettings: sanitizePromptPresetGenerationSettings(rawPreset.generationSettings),
            forgeAgentResources: cloneForgeAgentResources(
                resolveForgeAgentResources(rawPreset.id, rawPreset.forgeAgentResources as RawPresetModule['forgeAgentResources'])
            ),
            forgeAgentOrchestration: cloneForgeAgentOrchestration(rawPreset.forgeAgentOrchestration),
            customCharCard: rawPreset.customCharCard ? { ...rawPreset.customCharCard } : undefined
        };
    }

    private normalizeStoredBindings(rawBindings: Record<string, unknown>): PromptPresetBindingMap {
        const bindings = createDefaultBindings();
        const rawAgentBinding = typeof rawBindings['forge-agent'] === 'string'
            ? rawBindings['forge-agent']
            : (typeof rawBindings['forge-main'] === 'string'
                ? rawBindings['forge-main']
                : (typeof rawBindings['forge-executor'] === 'string' ? rawBindings['forge-executor'] : undefined));
        const normalizedAgentBinding = normalizeLegacyPresetId(rawAgentBinding);
        if (normalizedAgentBinding) {
            bindings['forge-agent'] = normalizedAgentBinding;
        }
        if (typeof rawBindings['forge-test-chat'] === 'string') {
            bindings['forge-test-chat'] = rawBindings['forge-test-chat'];
        }
        return bindings;
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
