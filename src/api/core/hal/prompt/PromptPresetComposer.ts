import { getPromptPresetProfile, type PromptPresetProfileDefinition } from './PromptPresetProfiles.js';
import { promptPresetRegistry } from './PromptPresetRegistry.js';
import type { CleanedMessage } from '../../../../types/nexus.js';
import type {
    PromptAssemblyResult,
    ForgePromptSlotPolicy,
    PromptSourceKind,
    PromptSourceUnit,
    PromptSourceUnitKind
} from '../../../../types/PromptAssemblyTypes.js';
import type {
    PromptComposeResolvedEntry,
    PromptComposeResult,
    PromptComposeSources,
    PromptWorldbookActivatedEntry,
    PromptWorldbookInsertionPosition,
    PromptPresetDefinition,
    PromptPresetEntry,
    PromptPresetProfileId
} from '../../../../types/PromptPresetTypes.js';
import { PromptAssemblyTracer } from './PromptAssemblyTracer.js';
import { worldbookMessageFor } from './PromptUtils.js';
import {
    FORGE_AGENT_PRESET_SLOT_TO_FORGE_SLOTS,
    getForgePromptSlotPolicy,
    isForgeAgentPresetSlot
} from './ForgePromptSlotPolicies.js';

const trimContent = (value: string | undefined): string => value?.trim() || '';

const normalizeMessages = (messages: CleanedMessage[] | null): CleanedMessage[] => {
    if (!messages || messages.length === 0) {
        return [];
    }
    return messages
        .map(message => ({
            ...message,
            content: trimContent(message.content)
        }))
        .filter(message => message.content);
};

const resolveProfile = (profile: PromptPresetProfileId | PromptPresetProfileDefinition): PromptPresetProfileDefinition =>
    typeof profile === 'string' ? getPromptPresetProfile(profile) : profile;

const resolvePreset = (
    profileId: PromptPresetProfileId,
    preset: string | PromptPresetDefinition
): PromptPresetDefinition => {
    if (typeof preset !== 'string') {
        return {
            ...preset,
            entries: preset.entries.map(entry => ({ ...entry })),
            specials: { ...preset.specials }
        };
    }
    const resolved = promptPresetRegistry.getPreset(profileId, preset);
    if (!resolved) {
        throw new Error(`Prompt preset not found: ${profileId}/${preset}`);
    }
    return resolved;
};

const CHARACTER_SLOT_IDS = new Set([
    'char_system_prompt',
    'char_description',
    'char_personality',
    'scenario'
]);

const worldbookVirtualEntryFor = (
    position: PromptWorldbookInsertionPosition,
    entry: PromptWorldbookActivatedEntry
): PromptPresetEntry => ({
    id: `worldbook:${position}:${entry.uid}`,
    type: 'slot',
    slotId: `worldbook_${position}`,
    enabled: true
});

const FORGE_MAIN_ORCHESTRATION_ENTRIES: PromptPresetEntry[] = [
    { id: 'orchestration:system', type: 'slot', enabled: true, slotId: 'base_system_prompt' },
    { id: 'orchestration:contract', type: 'slot', enabled: true, slotId: 'agent_runtime_contract' },
    { id: 'orchestration:skills', type: 'slot', enabled: true, slotId: 'agent_skill_context' },
    { id: 'orchestration:capabilities', type: 'slot', enabled: true, slotId: 'agent_project_resources' },
    { id: 'orchestration:review', type: 'slot', enabled: true, slotId: 'agent_review_state' },
    { id: 'orchestration:lorebook', type: 'slot', enabled: true, slotId: 'workspace_lorebook' },
    { id: 'orchestration:memory_snapshot', type: 'slot', enabled: true, slotId: 'memory_snapshot' },
    { id: 'orchestration:forge_memory_tree', type: 'slot', enabled: true, slotId: 'forge_memory_tree' },
    { id: 'orchestration:structured_state', type: 'slot', enabled: true, slotId: 'structured_state' },
    { id: 'orchestration:draft_tree', type: 'slot', enabled: true, slotId: 'draft_tree' },
    { id: 'orchestration:workflow_snapshot', type: 'slot', enabled: true, slotId: 'workflow_snapshot' },
    { id: 'orchestration:system_protocol', type: 'slot', enabled: true, slotId: 'system_protocol' },
    { id: 'orchestration:working_statement', type: 'slot', enabled: true, slotId: 'agent_working_statement' },
    { id: 'orchestration:branch_messages', type: 'slot', enabled: true, slotId: 'chat_history' },
    { id: 'orchestration:user_input', type: 'slot', enabled: true, slotId: 'agent_user_input' }
];

const resolveComposableEntries = (preset: PromptPresetDefinition): PromptPresetEntry[] => {
    if (preset.entries.length > 0) return preset.entries;
    if (preset.profileId === 'forge-agent' && preset.forgeAgentOrchestration) {
        return FORGE_MAIN_ORCHESTRATION_ENTRIES.map(entry => ({ ...entry }));
    }
    return [];
};

export class PromptPresetComposer {
    public static compose(
        profile: PromptPresetProfileId | PromptPresetProfileDefinition,
        preset: string | PromptPresetDefinition,
        sources: PromptComposeSources
    ): PromptComposeResult {
        const resolvedProfile = resolveProfile(profile);
        const resolvedPreset = resolvePreset(resolvedProfile.id, preset);

        if (resolvedPreset.profileId !== resolvedProfile.id) {
            throw new Error(`Prompt preset profile mismatch: expected ${resolvedProfile.id}, got ${resolvedPreset.profileId}`);
        }

        if (resolvedPreset.engine === 'st_preset') {
            return {
                messages: [],
                resolvedEntries: []
            };
        }

        const messages: CleanedMessage[] = [];
        const resolvedEntries: PromptComposeResolvedEntry[] = [];

        const enabledEntries = resolveComposableEntries(resolvedPreset).filter(entry => entry.enabled);
        enabledEntries.forEach((entry, entryIndex) => {
            if (!entry.enabled) return;

            this.resolveVirtualWorldbookMessagesBeforeSlot(entry, entryIndex, enabledEntries, sources).forEach(({ entry: virtualEntry, message }) => {
                messages.push(message);
                resolvedEntries.push({
                    id: virtualEntry.id,
                    type: virtualEntry.type,
                    slotId: virtualEntry.slotId,
                    role: message.role,
                    content: message.content
                });
            });

            const entryMessages = this.resolveEntry(resolvedProfile, entry, sources);
            normalizeMessages(entryMessages).forEach((message) => {
                messages.push(message);
                resolvedEntries.push({
                    id: entry.id,
                    type: entry.type,
                    slotId: entry.slotId,
                    role: message.role,
                    content: message.content
                });
            });

            this.resolveVirtualWorldbookMessagesAfterSlot(entry, entryIndex, enabledEntries, sources).forEach(({ entry: virtualEntry, message }) => {
                messages.push(message);
                resolvedEntries.push({
                    id: virtualEntry.id,
                    type: virtualEntry.type,
                    slotId: virtualEntry.slotId,
                    role: message.role,
                    content: message.content
                });
            });
        });

        return {
            messages,
            resolvedEntries
        };
    }

    public static composeWithTrace(
        profile: PromptPresetProfileId | PromptPresetProfileDefinition,
        preset: string | PromptPresetDefinition,
        sources: PromptComposeSources,
        options: { mergeLeadingSystemMessages?: boolean } = {}
    ): PromptAssemblyResult {
        const resolvedProfile = resolveProfile(profile);
        const resolvedPreset = resolvePreset(resolvedProfile.id, preset);

        if (resolvedPreset.profileId !== resolvedProfile.id) {
            throw new Error(`Prompt preset profile mismatch: expected ${resolvedProfile.id}, got ${resolvedPreset.profileId}`);
        }

        if (resolvedPreset.engine === 'st_preset') {
            return {
                messages: [],
                sourceUnits: [],
                plannedUnits: [],
                trace: [],
                diagnostics: sources.resourceDiagnostics ?? []
            };
        }

        const sourceUnits: PromptSourceUnit[] = [];

        const enabledEntries = resolveComposableEntries(resolvedPreset).filter(entry => entry.enabled);
        enabledEntries.forEach((entry, entryIndex) => {
            if (!entry.enabled) return;

            this.resolveVirtualWorldbookMessagesBeforeSlot(entry, entryIndex, enabledEntries, sources).forEach(({ entry: virtualEntry, message }, messageIndex) => {
                sourceUnits.push(this.createSourceUnit({
                    profile: resolvedProfile,
                    entry: virtualEntry,
                    entryIndex,
                    message,
                    messageIndex,
                    sources
                }));
            });

            const agentSourceUnits = this.resolveAgentSourceUnitsForEntry(resolvedProfile, entry, entryIndex, sources);
            if (agentSourceUnits.length > 0) {
                sourceUnits.push(...agentSourceUnits);
            } else {
                const entryMessages = this.resolveEntry(resolvedProfile, entry, sources);
                normalizeMessages(entryMessages).forEach((message, messageIndex) => {
                    sourceUnits.push(this.createSourceUnit({
                        profile: resolvedProfile,
                        entry,
                        entryIndex,
                        message,
                        messageIndex,
                        sources
                    }));
                });
            }

            this.resolveVirtualWorldbookMessagesAfterSlot(entry, entryIndex, enabledEntries, sources).forEach(({ entry: virtualEntry, message }, messageIndex) => {
                sourceUnits.push(this.createSourceUnit({
                    profile: resolvedProfile,
                    entry: virtualEntry,
                    entryIndex,
                    message,
                    messageIndex,
                    sources
                }));
            });
        });

        return PromptAssemblyTracer.assemble(sourceUnits, {
            mergeLeadingSystemMessages: options.mergeLeadingSystemMessages ?? false,
            diagnostics: sources.resourceDiagnostics ?? []
        });
    }

    private static resolveVirtualWorldbookMessagesBeforeSlot(
        entry: PromptPresetEntry,
        entryIndex: number,
        enabledEntries: PromptPresetEntry[],
        sources: PromptComposeSources
    ): Array<{ entry: PromptPresetEntry; message: CleanedMessage }> {
        const slotId = entry.slotId;
        if (this.isFirstCharacterSlot(slotId, entryIndex, enabledEntries)) {
            return this.resolveWorldbookPlacementMessages(['before'], sources);
        }
        if (slotId === 'chat_history') {
            return this.resolveWorldbookPlacementMessages(['an_top', 'em_top', 'outlet'], sources);
        }
        if (entryIndex === 0 && !enabledEntries.some(item => CHARACTER_SLOT_IDS.has(item.slotId ?? ''))) {
            return this.resolveWorldbookPlacementMessages(['before'], sources);
        }
        return [];
    }

    private static resolveVirtualWorldbookMessagesAfterSlot(
        entry: PromptPresetEntry,
        entryIndex: number,
        enabledEntries: PromptPresetEntry[],
        sources: PromptComposeSources
    ): Array<{ entry: PromptPresetEntry; message: CleanedMessage }> {
        const slotId = entry.slotId;
        if (this.isLastCharacterSlot(slotId, entryIndex, enabledEntries)) {
            return this.resolveWorldbookPlacementMessages(['after'], sources);
        }
        if (slotId === 'chat_history') {
            return this.resolveWorldbookPlacementMessages(['an_bottom', 'em_bottom'], sources);
        }
        return [];
    }

    private static resolveWorldbookPlacementMessages(
        positions: PromptWorldbookInsertionPosition[],
        sources: PromptComposeSources
    ): Array<{ entry: PromptPresetEntry; message: CleanedMessage }> {
        const buckets = sources.worldbookActivation?.insertionBuckets;
        if (!buckets) return [];
        return positions.flatMap(position => {
            const entries = buckets[position] ?? [];
            return [...entries]
                .sort((left, right) => left.order - right.order)
                .map(entry => ({
                    entry: worldbookVirtualEntryFor(position, entry),
                    message: worldbookMessageFor(entry)
                }));
        });
    }

    private static isFirstCharacterSlot(
        slotId: string | undefined,
        entryIndex: number,
        enabledEntries: PromptPresetEntry[]
    ): boolean {
        if (!slotId || !CHARACTER_SLOT_IDS.has(slotId)) return false;
        return enabledEntries.findIndex(entry => CHARACTER_SLOT_IDS.has(entry.slotId ?? '')) === entryIndex;
    }

    private static isLastCharacterSlot(
        slotId: string | undefined,
        entryIndex: number,
        enabledEntries: PromptPresetEntry[]
    ): boolean {
        if (!slotId || !CHARACTER_SLOT_IDS.has(slotId)) return false;
        const lastIndex = enabledEntries.reduce((foundIndex, entry, index) =>
            CHARACTER_SLOT_IDS.has(entry.slotId ?? '') ? index : foundIndex, -1);
        return lastIndex === entryIndex;
    }

    private static resolveEntry(
        profile: PromptPresetProfileDefinition,
        entry: PromptPresetEntry,
        sources: PromptComposeSources
    ): CleanedMessage[] | null {
        if (entry.type === 'custom') {
            const content = trimContent(entry.content);
            if (!content) return null;
            return [{
                role: entry.role || 'system',
                content
            }];
        }

        const slotId = entry.slotId;
        if (!slotId) {
            throw new Error(`Prompt preset slot entry missing slotId: ${entry.id}`);
        }

        const slotDefinition = profile.slots.find(slot => slot.slot.id === slotId);
        if (!slotDefinition) {
            throw new Error(`Slot "${slotId}" is not compatible with profile "${profile.id}"`);
        }

        const resolved = slotDefinition.resolve(sources);
        const normalized = normalizeMessages(resolved);
        if (normalized.length === 0) {
            return null;
        }

        if (!entry.role || !slotDefinition.slot.supportsRoleOverride) {
            return normalized;
        }

        return normalized.map(message => ({
            ...message,
            role: entry.role || message.role
        }));
    }

    private static createSourceUnit(input: {
        profile: PromptPresetProfileDefinition;
        entry: PromptPresetEntry;
        entryIndex: number;
        message: CleanedMessage;
        messageIndex: number;
        sources: PromptComposeSources;
    }): PromptSourceUnit {
        const slotId = input.entry.slotId;
        const slotDefinition = slotId
            ? input.profile.slots.find(slot => slot.slot.id === slotId)
            : undefined;
        const worldbookActivation = this.resolveWorldbookActivationForMessage(input.message, input.sources);
        const classification = worldbookActivation
            ? { kind: 'information' as const, sourceKind: 'worldbook' as const }
            : this.classifySourceUnit(slotId, input.entry.type);
        const resourceRef = worldbookActivation?.resourceRef ?? this.resolveResourceRefForSlot(slotId, input.sources);
        const slotPolicy = worldbookActivation ? undefined : slotDefinition?.slot.forgeSlotPolicy;
        const id = [
            input.profile.id,
            input.entry.id,
            slotId ?? 'custom',
            worldbookActivation ? `worldbook:${worldbookActivation.uid}` : '',
            input.messageIndex
        ].filter(Boolean).join(':');

        return {
            id,
            kind: classification.kind,
            sourceKind: classification.sourceKind,
            resourceRef,
            sourcePath: worldbookActivation?.sourcePath ?? resourceRef?.path ?? this.resolveSourcePath(slotId, input.entry.id),
            label: worldbookActivation ? `世界书: ${worldbookActivation.comment}` : this.resolveLabel(input.profile, input.entry),
            roleHint: input.message.role,
            priority: input.entryIndex,
            rawContent: input.message.content,
            content: input.message.content,
            summaryContent: undefined,
            budgetPolicy: classification.kind === 'control' ? 'pinned' : 'summary',
            forgeSlot: slotPolicy?.slot,
            forgeRegion: slotPolicy?.region,
            slotPolicy,
            presetEntryId: input.entry.id,
            slotId
        };
    }

    private static resolveAgentSourceUnitsForEntry(
        profile: PromptPresetProfileDefinition,
        entry: PromptPresetEntry,
        entryIndex: number,
        sources: PromptComposeSources
    ): PromptSourceUnit[] {
        const slotId = entry.slotId;
        if (entry.type !== 'slot' || !isForgeAgentPresetSlot(slotId)) {
            return [];
        }
        const forgeSlots = slotId ? FORGE_AGENT_PRESET_SLOT_TO_FORGE_SLOTS[slotId] : undefined;
        if (!forgeSlots?.length) {
            return [];
        }
        const slotDefinition = profile.slots.find(slot => slot.slot.id === slotId);
        if (!slotDefinition) {
            throw new Error(`Slot "${slotId}" is not compatible with profile "${profile.id}"`);
        }
        const matchingUnits = (sources.forgeAgentSourceUnits ?? [])
            .filter(unit => unit.forgeSlot && forgeSlots.includes(unit.forgeSlot));

        return matchingUnits.map((unit, unitIndex) => {
            const slotPolicy = this.resolveAgentSlotPolicy(slotDefinition.slot.forgeSlotPolicy, unit);
            const roleHint = entry.role && slotDefinition.slot.supportsRoleOverride
                ? entry.role
                : unit.roleHint;
            return {
                ...unit,
                id: `${profile.id}:${entry.id}:${unit.id}:${unitIndex}`,
                label: `${slotDefinition.slot.label}: ${unit.label}`,
                roleHint,
                priority: entryIndex,
                rawContent: unit.rawContent || unit.content,
                content: unit.content,
                budgetPolicy: unit.budgetPolicy ?? (slotPolicy.required ? 'pinned' : 'summary'),
                forgeSlot: unit.forgeSlot ?? slotPolicy.slot,
                forgeRegion: unit.forgeRegion ?? slotPolicy.region,
                slotPolicy,
                presetEntryId: entry.id,
                slotId
            };
        });
    }

    private static resolveAgentSlotPolicy(
        presetPolicy: ForgePromptSlotPolicy | undefined,
        unit: PromptSourceUnit
    ): ForgePromptSlotPolicy {
        if (unit.slotPolicy) {
            return unit.slotPolicy;
        }
        if (unit.forgeSlot) {
            return getForgePromptSlotPolicy(unit.forgeSlot);
        }
        if (presetPolicy) {
            return presetPolicy;
        }
        return getForgePromptSlotPolicy('project_resources');
    }

    private static resolveWorldbookActivationForMessage(
        message: CleanedMessage,
        sources: PromptComposeSources
    ): PromptWorldbookActivatedEntry | undefined {
        if (!sources.worldbookActivation?.entries.length) return undefined;
        const match = /^\[World Info: (.+?)\]\n/.exec(message.content);
        if (!match) return undefined;
        const uid = match[1];
        return sources.worldbookActivation.entries.find(entry => String(entry.uid) === uid);
    }

    private static classifySourceUnit(
        slotId: string | undefined,
        entryType: PromptPresetEntry['type']
    ): { kind: PromptSourceUnitKind; sourceKind: PromptSourceKind } {
        if (entryType === 'custom') {
            return { kind: 'control', sourceKind: 'preset' };
        }
        if (!slotId) {
            return { kind: 'control', sourceKind: 'preset' };
        }
        if (slotId.startsWith('char_') || slotId === 'scenario') {
            return { kind: 'information', sourceKind: 'character' };
        }
        if (slotId === 'world_info' || slotId === 'workspace_lorebook') {
            return { kind: 'information', sourceKind: 'worldbook' };
        }
        if (slotId === 'chat_history') {
            return { kind: 'information', sourceKind: 'history' };
        }
        if (slotId.includes('memory')) {
            return { kind: 'information', sourceKind: 'memory' };
        }
        if (slotId === 'structured_state' || slotId === 'draft_tree' || slotId === 'workflow_snapshot') {
            return { kind: 'state', sourceKind: 'forge' };
        }
        if (slotId === 'system_protocol' || slotId === 'base_system_prompt') {
            return { kind: 'control', sourceKind: 'system_protocol' };
        }
        if (slotId === 'executor_task' || slotId === 'original_entry') {
            return { kind: 'control', sourceKind: 'forge' };
        }
        if (isForgeAgentPresetSlot(slotId)) {
            return { kind: 'control', sourceKind: 'forge' };
        }
        return { kind: 'control', sourceKind: 'preset' };
    }

    private static resolveResourceRefForSlot(slotId: string | undefined, sources: PromptComposeSources) {
        if (!slotId || !sources.resourceRefs?.length) return undefined;
        const type = slotId.startsWith('char_') || slotId === 'scenario'
            ? 'character'
            : (slotId === 'world_info' || slotId === 'workspace_lorebook')
                ? 'worldbook'
                : undefined;
        return type ? sources.resourceRefs.find(ref => ref.resourceType === type) : undefined;
    }

    private static resolveSourcePath(slotId: string | undefined, entryId: string): string {
        return slotId ? `prompt.slot.${slotId}` : `prompt.entry.${entryId}`;
    }

    private static resolveLabel(profile: PromptPresetProfileDefinition, entry: PromptPresetEntry): string {
        if (!entry.slotId) {
            return entry.id;
        }
        const slot = profile.slots.find(item => item.slot.id === entry.slotId);
        return slot?.slot.label ?? entry.slotId;
    }
}
