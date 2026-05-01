import { defineStore } from 'pinia';
import { computed, ref, onMounted, shallowRef } from 'vue';
import { luminaWeaveApi } from '../../api';
import { llmEngine } from '../../api/llmEngine.js';
import { lwStorage } from '../../api/storage.js';
import { useForgeStore } from '../../stores/useForgeStore';
import { API_BASE, API_ROUTES } from '@shared/ApiEndpoints.js';
import { CleanedMessage } from '../../types/nexus';
import { WorldlineStore } from '../../api/core/WorldlineStore.js';
import { MessageUtils, type LuminaChatMessage } from '@shared/LuminaMessage.js';
import { globalXMLInterceptor } from '../../api/core/XMLInterceptor.js';
import type { ForgeVirtualLorebookEntry, ForgeWorkspaceSession } from '../../types/SessionTypes.js';
import { LorebookTimelineResolver } from '../../api/core/LorebookTimelineResolver.js';
import { MemoryViewResolver } from '../../api/core/MemoryViewResolver.js';
import { promptPresetRegistry } from '../../api/core/PromptPresetRegistry.js';
import type { TimelineNode } from '../../api/core/TimelineManager.js';
import type { MemorySnapshot } from '../../types/MemorySnapshotTypes.js';
import type { ResolvedLorebookViewState } from '../../types/LorebookViewTypes.js';
import type { ForgeMemoryTree } from '../../types/ForgeMemoryTypes.js';
import { FORGE_PLANNER_PROMPT, FORGE_EXECUTOR_SYSTEM_PROMPT } from '../../resources/prompts/forgePrompts.js';
import { ForgePromptContextService } from '../../api/core/ForgePromptContextService.js';
import { ForgeRuntimeOrchestrator } from '../../api/core/ForgeRuntimeOrchestrator.js';
import { clonePromptPresetGenerationSettings } from '../../api/core/utils/promptPresetGenerationSettings.js';
import { applyForgeEffects, type ForgeEffectTarget } from '../../api/core/ForgeEffectReducer.js';
import { ForgeSessionController } from '../../api/core/ForgeSessionController.js';
import { ForgeWorldlineManager } from '../../api/core/ForgeWorldlineManager.js';
import { resolveOriginalContent as _resolveOriginalContent } from '../../api/core/ForgeContextBroker.js';
import {
    ForgeFormController,
    kickoffBlueprint
} from '../../api/core/ForgeFormController.js';
import { ForgeWorkflowGraph } from '../../api/core/ForgeWorkflowGraph.js';
import { BridgeDispatcher } from '@shared/api/BridgeDispatcher.js';
import type { ForgeAuxPanelKind, ForgeWorkflowSnapshot } from '../../types/ForgeWorkflowTypes.js';
import {
    FORGE_FORM_RESULT_SUBMITTED,
    FORGE_LAYER_ADVANCE_REQUESTED,
    FORGE_WORKSPACE_FREEZE_REQUESTED
} from '../../api/core/forgeConstants.js';
import type {
    ForgeExecutionRequest,
    ForgeModelRequestTrace,
    ForgeRequestContextSnapshot,
    ForgeRequestLorebookEntrySummary,
    ForgeRequestNodeSummaryItem,
    ForgeRuntimeContext,
    ForgeRuntimeEffect,
    ForgeRuntimeEvent,
    ForgeUserCommand,
    StagingEntry
} from '../../types/ForgeRuntimeTypes.js';
import type { ForgePromptPreviewBundle } from '../../types/ForgePromptTypes.js';
import type {
    ForgeCollectionMode,
    ForgeDraftTree,
    ForgeDetailMode,
    ForgeEntryMode,
    ForgeLayer,
    ForgeStructuredFieldState,
    ForgeStructuredFormState,
    ForgeStructuredState
} from '../../types/ForgeStructuredTypes.js';
import type { PromptPresetProfileId } from '../../types/PromptPresetTypes.js';
import type {
    ForgeTimelineItem,
    ForgeTimelineMessageItem,
    ForgeTimelineOperationItem
} from '../../types/ForgeTimelineTypes.js';
import {
    cloneForgeMemoryTree,
    createEmptyForgeMemoryTree,
    createEmptyDraftTree,
    createEmptyStructuredState
} from '../../api/core/utils/forgeStateDefaults.js';
import {
    buildFrozenVirtualLorebookContent,
    findVirtualLorebookEntry,
    findVirtualLorebookEntryIndex
} from '../../api/core/utils/forgeVirtualLorebook.js';
import { ForgeTestChatService } from '../../api/core/ForgeTestChatService.js';
export const DEFAULT_PLANNER_PROMPT = FORGE_PLANNER_PROMPT;
export const DEFAULT_EXECUTOR_PROMPT = FORGE_EXECUTOR_SYSTEM_PROMPT;
let forgeControllerBridgeBound = false;

type BackendPresetMeta = {
    id: string;
    name: string;
    isDefault: boolean;
    createdAt: number;
    updatedAt: number;
};

type BackendPresetDetail = {
    preset?: {
        blob?: {
            prompts?: Array<{
                content?: string;
            }>;
        };
    };
};

export type ForgeTimelineFeedItem =
    | {
        id: string;
        kind: 'message';
        timestamp: number;
        item: ForgeTimelineMessageItem;
        message: LuminaChatMessage;
    }
    | {
        id: string;
        kind: 'operation';
        timestamp: number;
        item: ForgeTimelineOperationItem;
    };

const generateSessionChatId = (): string => {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
        return `lw_card_${crypto.randomUUID()}`;
    }
    return `lw_card_${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36)}`;
};

const generateVirtualLorebookEntryId = (): string => {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
        return `forge_lore_${crypto.randomUUID()}`;
    }
    return `forge_lore_${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36)}`;
};

const generateDraftNodeId = (): string => {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
        return `forge_draft_${crypto.randomUUID()}`;
    }
    return `forge_draft_${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36)}`;
};

const generateForgeRequestTraceId = (): string => {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
        return `forge_req_${crypto.randomUUID()}`;
    }
    return `forge_req_${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36)}`;
};

const resolveRuntimePresetId = (preferredPresetId?: string | null): string => (
    preferredPresetId ||
    lwStorage.get('lumina-forge.nexusPreset', '', 'Global') ||
    lwStorage.get('lumina-chat.nexusPreset', 'Global', 'Global')
);

const summarizeRequestNodeSummary = (presetId: string): ForgeRequestNodeSummaryItem[] =>
    llmEngine.resolveNodesFromPreset(presetId).map((node: any) => {
        const provider = String(node?.provider || 'unknown');
        const model = typeof node?.model === 'string' && node.model.trim() ? node.model.trim() : null;
        return {
            provider,
            model,
            label: provider === 'st_current'
                ? '宿主当前模型'
                : [provider, model].filter(Boolean).join(' / ')
        };
    });

const sanitizeHistoryMessages = (input: Array<Pick<LuminaChatMessage, 'role' | 'mes' | 'mesRaw' | 'name'>>): CleanedMessage[] =>
    input
        .filter((message) => (message.mes || message.mesRaw || '').trim() !== '')
        .map((message) => ({
            role: message.role as CleanedMessage['role'],
            content: message.mes || message.mesRaw || '',
            name: message.name
        }));

const summarizeLorebookEntries = (entries: LuminaLorebookEntry[]): ForgeRequestLorebookEntrySummary[] =>
    entries.map((entry: any) => {
        const keywords = Array.isArray(entry?.key)
            ? entry.key
            : Array.isArray(entry?.keywords)
                ? entry.keywords
                : Array.isArray(entry?.keys)
                    ? entry.keys
                    : [];
        return {
            id: String(entry?.uid || entry?.comment || keywords[0] || 'forge_lorebook_entry'),
            title: String(entry?.comment || entry?.uid || keywords[0] || '未命名条目'),
            comment: String(entry?.comment || ''),
            keywords: keywords.map((keyword: unknown) => String(keyword)),
            disabled: Boolean(entry?.disable)
        };
    });

const resolvePromptPresetGenerationSettings = (profileId: PromptPresetProfileId) => (
    clonePromptPresetGenerationSettings(
        promptPresetRegistry.getActivePreset(profileId).generationSettings
    )
);

export const useCardMakerStore = defineStore('lumina-card-maker', () => {
    const forgeStore = useForgeStore();
    const sessionChatId = ref<string>(generateSessionChatId());
    const workspaceSessionId = ref<string>('');
    const workspaceTitle = ref<string>('Forge Workspace');
    const workspaceCreatedAt = ref<number>(Date.now());
    const workspaceUpdatedAt = ref<number>(Date.now());
    const selectedChatSessionId = ref<string | null>(null);
    const selectedChatSnapshotId = ref<string | null>(null);
    const presets = ref<BackendPresetMeta[]>([]);

    // 层级回退逻辑：制卡专用 -> 聊天全局 (兼容旧版)
    const getInitialPresetId = () => 
        lwStorage.get('lumina-forge.nexusPreset', '', 'Global') ||
        lwStorage.get('lumina-chat.nexusPreset', 'Global', 'Global');

    const selectedPresetId = ref<string>(getInitialPresetId());

    // 核心增强：增加存储监听，确保在【设置】面板修改预设后实时同步 ID
    lwStorage.on('*', (data: any) => {
        if (data?.key === 'lumina-forge.nexusPreset' || data?.key === 'lumina-chat.nexusPreset') {
            const nextId = getInitialPresetId();
            if (selectedPresetId.value !== nextId) {
                selectedPresetId.value = nextId;
                console.log(`[Nexus-Store] 监听到 Nexus 预设配置变更，已同步 ID: ${nextId}`);
            }
        }
    });

    const input = ref<string>('');
    const worldlineStore = shallowRef<WorldlineStore>(new WorldlineStore());
    const timelineRevision = ref(0);

    const isGenerating = ref(false);
    const streamText = ref<string>('');
    const streamThinkingText = ref<string>('');
    const streamingAssistantNodeId = ref<string | null>(null);
    const lastError = ref<string | null>(null);
    const workflowSnapshot = ref<ForgeWorkflowSnapshot | null>(null);
    const isCommitting = ref(false);
    const detailMode = ref<ForgeDetailMode | null>(null);
    const collectionMode = ref<ForgeCollectionMode>('conversation');
    const entryMode = ref<ForgeEntryMode | null>(null);
    const activeLayer = ref<ForgeLayer>('concept');
    const completedLayers = ref<ForgeLayer[]>([]);
    const structuredState = ref<ForgeStructuredState>(createEmptyStructuredState());
    const draftTree = ref<ForgeDraftTree>(createEmptyDraftTree());
    const forgeMemoryTree = ref<ForgeMemoryTree>(createEmptyForgeMemoryTree());
    const publishState = ref<'drafting' | 'workspace_frozen'>('drafting');
    const activeAuxPanel = ref<ForgeAuxPanelKind>('lorebook');
    const auxPresentationMode = ref<'embedded' | 'detached' | 'widget' | 'hidden'>('detached');
    const workspacePage = ref<'workspace' | 'session-browser'>('workspace');
    const virtualLorebookEntries = ref<ForgeVirtualLorebookEntry[]>([]);
    const importedLorebookId = ref<string | null>(null);

    /**
     * 瞬态交互存储：用于收集非表单绑定的零散点击/输入值（即“临时表单”数据）。
     * 键为 fieldKey 或唯一标识，值为用户的选择。
     */
    const transientSelections = ref<Map<string, Map<string, string | string[]>>>(new Map());
    const LEGACY_TRANSIENT_SCOPE = '__legacy__';

    const normalizeTransientScopeId = (scopeId?: string | null): string => {
        const normalized = String(scopeId || '').trim();
        return normalized || LEGACY_TRANSIENT_SCOPE;
    };

    const ensureTransientScope = (scopeId?: string | null): Map<string, string | string[]> => {
        const normalizedScopeId = normalizeTransientScopeId(scopeId);
        const existing = transientSelections.value.get(normalizedScopeId);
        if (existing) {
            return existing;
        }
        const nextScope = new Map<string, string | string[]>();
        transientSelections.value.set(normalizedScopeId, nextScope);
        return nextScope;
    };

    /**
     * 更新瞬态选择值
     */
    const upsertTransientSelection = (key: string, value: string | string[], scopeId?: string | null) => {
        const normalizedScopeId = normalizeTransientScopeId(scopeId);
        console.log(`[Forge-Store] 记入瞬态选值 "${normalizedScopeId}:${key}" ->`, value);
        ensureTransientScope(normalizedScopeId).set(key, value);
        delete structuredState.value.submittedScopes[normalizedScopeId];
        structuredState.value.lastUpdatedAt = Date.now();
    };

    const getTransientSelections = (scopeId?: string | null): Map<string, string | string[]> => (
        transientSelections.value.get(normalizeTransientScopeId(scopeId)) || new Map()
    );

    const getTransientFieldText = (scopeId: string | null | undefined, fieldKey: string): string => {
        const value = getTransientSelections(scopeId).get(fieldKey);
        if (value === undefined) return '';
        return Array.isArray(value) ? value.join(', ') : String(value || '');
    };

    const getTransientFieldList = (scopeId: string | null | undefined, fieldKey: string): string[] => {
        const value = getTransientSelections(scopeId).get(fieldKey);
        if (value === undefined) return [];
        return Array.isArray(value) ? value : (value ? [String(value)] : []);
    };

    const clearTransientSelections = (scopeId?: string | null): void => {
        transientSelections.value.delete(normalizeTransientScopeId(scopeId));
    };

    const hasPendingTransientSelections = (scopeId?: string | null): boolean => (
        getTransientSelections(scopeId).size > 0
    );

    const rememberSubmitConfig = (scopeId: string, label?: string | null): void => {
        const normalizedScopeId = normalizeTransientScopeId(scopeId);
        const normalizedLabel = String(label || '').trim();
        if (!normalizedLabel) return;
        const existing = structuredState.value.submitConfigs[normalizedScopeId];
        if (existing?.label === normalizedLabel) return;
        structuredState.value.submitConfigs[normalizedScopeId] = {
            label: normalizedLabel,
            updatedAt: Date.now()
        };
        structuredState.value.lastUpdatedAt = Date.now();
        void persistWorkspaceSession();
    };

    const resolveSubmitLabel = (scopeId: string, fallbackLabel = '提交并继续'): string => {
        const normalizedScopeId = normalizeTransientScopeId(scopeId);
        return structuredState.value.submitConfigs[normalizedScopeId]?.label || fallbackLabel;
    };

    const markScopeSubmitted = (scopeId: string): void => {
        structuredState.value.submittedScopes[normalizeTransientScopeId(scopeId)] = Date.now();
        structuredState.value.lastUpdatedAt = Date.now();
        void persistWorkspaceSession();
    };

    const isScopeSubmitted = (scopeId: string): boolean => Boolean(
        structuredState.value.submittedScopes[normalizeTransientScopeId(scopeId)]
    );

    let _formController: ForgeFormController | null = null;
    const getFormController = (): ForgeFormController => {
        if (_formController) return _formController;
        _formController = new ForgeFormController({
            getStructuredState: () => structuredState.value,
            getTransientSelections: () => getTransientSelections(),
            upsertTransientSelection: (key, value) => upsertTransientSelection(key, value),
            getActiveLayer: () => activeLayer.value,
            setActiveLayer: (layer) => { activeLayer.value = layer; },
            getCompletedLayers: () => completedLayers.value,
            setCompletedLayers: (layers) => { completedLayers.value = layers; },
            getDetailMode: () => detailMode.value,
            addAssistantViewMessage: (content) => addAssistantViewMessage(content),
            upsertForgeMemory: (path, title, content, source, summary) => upsertForgeMemory(path, title, content, source, summary),
            syncDraftTree: () => syncDraftTree(),
            persistSession: () => persistWorkspaceSession()
        });
        return _formController;
    };

    let _sessionController: ForgeSessionController | null = null;
    const getSessionController = (): ForgeSessionController => {
        if (_sessionController) return _sessionController;
        _sessionController = new ForgeSessionController({
            getSessionChatId: () => sessionChatId.value,
            setSessionChatId: (id) => { sessionChatId.value = id; },
            getWorkspaceSessionId: () => workspaceSessionId.value,
            setWorkspaceSessionId: (id) => { workspaceSessionId.value = id; },
            getWorkspaceTitle: () => workspaceTitle.value,
            setWorkspaceTitle: (title) => { workspaceTitle.value = title; },
            getWorkspaceCreatedAt: () => workspaceCreatedAt.value,
            setWorkspaceCreatedAt: (ts) => { workspaceCreatedAt.value = ts; },
            setWorkspaceUpdatedAt: (ts) => { workspaceUpdatedAt.value = ts; },
            getSelectedPresetId: () => selectedPresetId.value,
            setSelectedPresetId: (id) => { selectedPresetId.value = id; },
            getSelectedChatSessionId: () => selectedChatSessionId.value,
            setSelectedChatSessionId: (id) => { selectedChatSessionId.value = id; },
            getSelectedChatSnapshotId: () => selectedChatSnapshotId.value,
            setSelectedChatSnapshotId: (id) => { selectedChatSnapshotId.value = id; },
            getInput: () => input.value,
            setInput: (text) => { input.value = text; },
            resetStreamState: () => {
                streamText.value = '';
                streamThinkingText.value = '';
                streamingAssistantNodeId.value = null;
                lastError.value = null;
                isGenerating.value = false;
            },
            getWorldlineStore: () => worldlineStore.value,
            setWorldlineStore: (store) => { worldlineStore.value = store; },
            setupWorldlineStoreListeners: (store) => setupWorldlineStoreListeners(store),
            getActiveLeafId: () => worldlineStore.value.activeLeafId,
            getTimelineItems: () => forgeStore.timelineItems,
            replaceTimelineItems: (items) => forgeStore.replaceTimelineItems(items),
            getStagingEntries: () => forgeStore.stagingArea,
            setStagingEntries: (entries) => { forgeStore.stagingArea = entries; },
            getCommitReadyEntries: () => forgeStore.commitReadyEntries,
            setCommitReadyEntries: (entries) => { forgeStore.commitReadyEntries = entries; },
            setCurrentSessionId: (id) => { forgeStore.currentSessionId = id; },
            setIsProcessing: (val) => { forgeStore.isProcessing = val; },
            clearAll: () => forgeStore.clearAll(),
            getVirtualLorebookEntries: () => virtualLorebookEntries.value,
            setVirtualLorebookEntries: (entries) => { virtualLorebookEntries.value = entries; },
            getImportedLorebookId: () => importedLorebookId.value,
            setImportedLorebookId: (id) => { importedLorebookId.value = id; },
            getStructuredState: () => structuredState.value,
            setStructuredState: (state) => { structuredState.value = state; },
            getDraftTree: () => draftTree.value,
            setDraftTree: (tree) => { draftTree.value = tree; },
            getForgeMemoryTree: () => forgeMemoryTree.value,
            setForgeMemoryTree: (tree) => { forgeMemoryTree.value = tree; },
            getDetailMode: () => detailMode.value,
            setDetailMode: (mode) => { detailMode.value = mode; },
            getEntryMode: () => entryMode.value,
            setEntryMode: (mode) => { entryMode.value = mode; },
            getActiveLayer: () => activeLayer.value,
            setActiveLayer: (layer) => { activeLayer.value = layer; },
            getCompletedLayers: () => completedLayers.value,
            setCompletedLayers: (layers) => { completedLayers.value = layers; },
            getPublishState: () => publishState.value,
            setPublishState: (state) => { publishState.value = state; },
            getActiveAuxPanel: () => activeAuxPanel.value,
            setActiveAuxPanel: (panel) => { activeAuxPanel.value = panel; },
            getAuxPresentationMode: () => auxPresentationMode.value,
            setAuxPresentationMode: (mode) => { auxPresentationMode.value = mode; },
            setWorkspacePage: (page) => { workspacePage.value = page; },
            getWorkflowSnapshot: () => workflowSnapshot.value,
            setWorkflowSnapshot: (snapshot) => {
                workflowSnapshot.value = snapshot;
                collectionMode.value = snapshot?.collectionMode || 'conversation';
            },
            syncDraftTree: () => syncDraftTree(),
            bumpTimelineRevision: () => bumpTimelineRevision(),
            generateSessionChatId,
            getWorldlineSnapshotMap: () => getWorldlineManager().getSnapshotMap(),
            setWorldlineSnapshotMap: (map) => getWorldlineManager().setSnapshotMap(map)
        });
        return _sessionController;
    };

    let _worldlineManager: ForgeWorldlineManager | null = null;
    const getWorldlineManager = (): ForgeWorldlineManager => {
        if (_worldlineManager) return _worldlineManager;
        _worldlineManager = new ForgeWorldlineManager({
            getWorldlineStore: () => worldlineStore.value,
            getActiveLeafId: () => worldlineStore.value.activeLeafId,
            bumpTimelineRevision: () => bumpTimelineRevision(),
            refreshWorkflowSnapshot: async () => { await refreshWorkflowSnapshot(); },
            persistWorkspaceSession: async () => { await persistWorkspaceSession(); },
            getTimelineItems: () => forgeStore.timelineItems,
            replaceTimelineItems: (items) => forgeStore.replaceTimelineItems(items),
            getVirtualLorebookEntries: () => virtualLorebookEntries.value,
            getCommitReadyEntries: () => forgeStore.commitReadyEntries,
            getStagingEntries: () => forgeStore.stagingArea,
            getStructuredState: () => structuredState.value,
            getDraftTree: () => draftTree.value,
            getForgeMemoryTree: () => forgeMemoryTree.value,
            getWorkflowSnapshot: () => workflowSnapshot.value!,
            getActiveLayer: () => activeLayer.value,
            getCompletedLayers: () => completedLayers.value,
            setVirtualLorebookEntries: (entries) => { virtualLorebookEntries.value = entries; },
            setCommitReadyEntries: (entries) => { forgeStore.commitReadyEntries = entries; },
            setStagingEntries: (entries) => { forgeStore.stagingArea = entries; },
            setStructuredState: (state) => { structuredState.value = state; },
            setDraftTree: (tree) => { draftTree.value = tree; },
            setForgeMemoryTree: (tree) => { forgeMemoryTree.value = tree; },
            setWorkflowSnapshot: (snapshot) => { workflowSnapshot.value = snapshot; },
            setActiveLayer: (layer) => { activeLayer.value = layer; },
            setCompletedLayers: (layers) => { completedLayers.value = layers; },
            syncDraftTree: () => syncDraftTree()
        });
        return _worldlineManager;
    };

    let runtimeOrchestrator: ForgeRuntimeOrchestrator | null = null;

    const testChatService = new ForgeTestChatService({
        getVirtualLorebookEntries: () => virtualLorebookEntries.value,
        getNexusPresetId: () => selectedPresetId.value,
        getWorkspaceTitle: () => workspaceTitle.value || 'Forge Test',
        getWorkspaceSessionId: () => workspaceSessionId.value || sessionChatId.value,
        createModelRequestTrace: (trace) => forgeStore.createModelRequestTrace(trace),
        markModelRequestFirstResponse: (requestId, firstResponseAt) => forgeStore.markModelRequestFirstResponse(requestId, firstResponseAt),
        updateModelRequestStream: (payload) => forgeStore.updateModelRequestStream(payload),
        completeModelRequestTrace: (payload) => forgeStore.completeModelRequestTrace(payload),
        failModelRequestTrace: (requestId, message) => forgeStore.failModelRequestTrace(requestId, message),
        abortModelRequestTrace: (requestId) => forgeStore.abortModelRequestTrace(requestId),
        setActiveModelRequestTrace: (requestId) => forgeStore.setActiveModelRequestTrace(requestId)
    });


    const activePreset = computed(() => presets.value.find(p => p.id === selectedPresetId.value) || null);
    const activeLeafId = computed(() => {
        // 显式引用修订号以驱动反应性
        timelineRevision.value;
        return worldlineStore.value.activeLeafId;
    });
    
    // 统一繁忙状态判断
    const isBusy = computed(() => isGenerating.value || forgeStore.isProcessing);
    const messages = computed<LuminaChatMessage[]>(() => {
        timelineRevision.value;
        return worldlineStore.value.getTrace(worldlineStore.value.activeLeafId);
    });
    const messageCount = computed(() => {
        timelineRevision.value;
        return worldlineStore.value.nodePool.length;
    });
    const timelineFeed = computed<ForgeTimelineFeedItem[]>(() => {
        // 显式引用修订号以驱动反应性
        timelineRevision.value;

        // 获取当前活跃路径的所有消息 ID
        const activePath = worldlineStore.value.getTrace(worldlineStore.value.activeLeafId);
        const activePathIds = new Set(activePath.map(node => node.id));
        const messageMap = new Map(activePath.map(node => [node.id, node]));

        return forgeStore.timelineItems
            .map<ForgeTimelineFeedItem | null>((item) => {
                if (item.kind === 'message') {
                    const message = messageMap.get(item.messageId);
                    // 如果消息不在当前活跃路径上，则过滤掉
                    if (!message) return null;

                    return {
                        id: item.id,
                        kind: 'message',
                        timestamp: item.createdAt,
                        item,
                        message
                    };
                }

                // 对于操作，如果它关联了某个特定的消息，且该消息不在当前路径上，则也过滤掉
                if (item.relatedMessageId && !activePathIds.has(item.relatedMessageId)) {
                    return null;
                }

                return {
                    id: item.id,
                    kind: 'operation',
                    timestamp: item.createdAt,
                    item
                };
            })
            .filter((item): item is ForgeTimelineFeedItem => Boolean(item))
            .sort((a, b) => {
                if (a.timestamp === b.timestamp) {
                    return a.id.localeCompare(b.id);
                }
                return a.timestamp - b.timestamp;
            });
    });
    const timelineGraph = computed<Record<string, TimelineNode>>(() => {
        timelineRevision.value;
        return worldlineStore.value.nodePool.reduce<Record<string, TimelineNode>>((acc, node) => {
            acc[node.id] = {
                ...node,
                text: node.mes || node.mesRaw || '',
                timestamp: node.extra?.send_date || node.createdAt || Date.now(),
                _original: node
            };
            return acc;
        }, {});
    });

    const bumpTimelineRevision = (): void => {
        timelineRevision.value += 1;
    };

    /**
     * 为当前的 WorldlineStore 实例挂载事件监听。
     * 确保底层数据池（nodePool）或活跃叶子节点变化时，能通知 Pinia 状态更新。
     */
    const setupWorldlineStoreListeners = (store: WorldlineStore): void => getWorldlineManager().setupListeners(store);

    const serializeSession = (): ForgeWorkspaceSession => getSessionController().serializeSession();
    const persistWorkspaceSession = (): Promise<void> => getSessionController().persistWorkspaceSession();
    const flushWorkspaceSession = (): Promise<void> => getSessionController().flushWorkspaceSession();
    const hydrateFromSession = (session: ForgeWorkspaceSession): void => getSessionController().hydrateFromSession(session);
    const createWorkspaceSession = (title?: string): Promise<ForgeWorkspaceSession> => getSessionController().createWorkspaceSession(title);
    const renameWorkspaceSession = (title: string): boolean => getSessionController().renameWorkspaceSession(title);
    const openWorkspaceSession = (id: string): Promise<boolean> => getSessionController().openWorkspaceSession(id);

    const attachChatSessionReference = async (chatSessionId: string | null): Promise<void> => {
        await ensureRuntimeOrchestrator().dispatch({ type: 'attach_reference_chat', chatSessionId });
    };

    const createMessageNode = (role: 'user' | 'assistant', content: string, parentId: string | null): LuminaChatMessage => {
        const isUser = role === 'user';
        const timestamp = Date.now();

        return {
            id: MessageUtils.generateNodeId(),
            parentId,
            name: isUser ? 'You' : 'Forge Assistant',
            role,
            is_user: isUser,
            conversationType: 'forge',
            conversationId: sessionChatId.value,
            nodeKind: 'message',
            mesRaw: content,
            mes: content,
            thinkingText: null,
            pluginRaw: isUser ? null : content,
            fingerprint: MessageUtils.getFingerprint(content),
            extra: {
                send_date: timestamp,
                conversationType: 'forge',
                conversationId: sessionChatId.value,
                nodeKind: 'message'
            },
            createdAt: timestamp,
            syncStatus: 'local'
        };
    };

    const upsertMessage = (node: LuminaChatMessage): void => {
        MessageUtils.syncCore(node, globalXMLInterceptor, { force: true });
        worldlineStore.value.upsertNode(node, { silent: false, source: 'local' });
        forgeStore.ensureMessageTimelineItem(node.id, Number(node.createdAt || node.extra?.send_date || Date.now()));
        bumpTimelineRevision();
    };

    const refreshPresets = async (): Promise<void> => {
        const data = await BridgeDispatcher.presets.listPresets() as { presets: BackendPresetMeta[] };
        presets.value = Array.isArray(data.presets) ? data.presets : [];
        if (!selectedPresetId.value) {
            const def = presets.value.find(p => p.isDefault) || presets.value[0];
            selectedPresetId.value = def?.id || '';
        }
    };

    const importPreset = async (text: string, name?: string): Promise<void> => {
        let blob: unknown = text;
        try { blob = JSON.parse(text); } catch { blob = text; }
        await BridgeDispatcher.presets.importPreset({ name, blob });
        await refreshPresets();
    };

    const exportPreset = async (presetId: string): Promise<string> => {
        const data = await BridgeDispatcher.presets.exportPreset(presetId) as { blob: unknown };
        return JSON.stringify(data.blob, null, 2);
    };

    const restoreDefaultPresets = async (): Promise<void> => {
        await BridgeDispatcher.presets.restoreDefaults();
        await refreshPresets();
    };

    const resolveActiveLorebookView = (): ResolvedLorebookViewState => {
        const manager = luminaWeaveApi.lorebookManager;
        if (!manager) {
            return {
                mode: 'follow-timeline',
                snapshotKey: null,
                versionLabel: 'Forge',
                versionHint: '世界书管理器未就绪，正在使用当前消息上下文。',
                entries: []
            };
        }

        const selectedBookId = manager.selectedBook;
        const snapshots = manager.getSnapshotsForBook(selectedBookId);

        return LorebookTimelineResolver.resolve({
            mode: manager.versionMode,
            context: {
                bookId: selectedBookId,
                sourceId: 'forge',
                activeLeafId: activeLeafId.value,
                sessionId: workspaceSessionId.value || sessionChatId.value || null
            },
            // 核心修复：Forge 的 liveEntries 应严格使用虚拟工作区条目，而非全局同步的 manager.entries
            // 这能防止 ST 激活的世界书（如思维链准则）在没有快照时污染 Forge 提示词
            liveEntries: virtualLorebookEntries.value.map(item => item.entry),
            snapshots,
            pinnedSnapshotKey: manager.pinnedSnapshotKey,
            manualSnapshotKey: manager.manualSnapshotKey
        });
    };

    const buildMemorySnapshot = (): MemorySnapshot => {
        const manager = luminaWeaveApi.lorebookManager;
        const resolvedLorebookView = resolveActiveLorebookView();

        return MemoryViewResolver.buildSnapshot({
            sourceId: 'forge',
            sessionId: workspaceSessionId.value || sessionChatId.value || null,
            activeLeafId: activeLeafId.value,
            messageCount: messages.value.length,
            lorebook: {
                selectedBookId: manager?.selectedBook || null,
                resolvedView: resolvedLorebookView
            },
            forge: {
                workspaceTitle: workspaceTitle.value,
                selectedChatSessionId: selectedChatSessionId.value,
                selectedChatSnapshotId: selectedChatSnapshotId.value
            }
        });
    };

    const buildRuntimeContextSnapshot = (
        context: ForgeRuntimeContext,
        resolvedLorebookView: ResolvedLorebookViewState,
        memorySnapshot: MemorySnapshot,
        selectedPresetIdOverride?: string | null
    ): ForgeRequestContextSnapshot => ({
        kind: 'forge-runtime',
        workspaceTitle: context.workspaceTitle || null,
        detailMode: context.detailMode,
        activeLayer: context.activeLayer,
        sourceCommand: context.latestUserCommand,
        workflowSnapshot: context.workflowSnapshot,
        historyMessages: sanitizeHistoryMessages(context.messages),
        referenceChatSessionId: context.selectedChatSessionId,
        referenceChatSnapshotId: context.selectedChatSnapshotId,
        lorebookEntries: summarizeLorebookEntries(resolvedLorebookView.entries),
        memorySnapshot,
        selectedPresetId: selectedPresetIdOverride ?? context.selectedPresetId ?? null,
        testChatPresetId: null,
        nexusPresetId: null
    });

    const registerRuntimeRequestTrace = (payload: {
        requestId: string;
        source: ForgeModelRequestTrace['source'];
        contextSnapshot: ForgeRequestContextSnapshot;
        requestPrompt: CleanedMessage[];
        requestParameters: ForgeModelRequestTrace['requestParameters'];
        presetId: string | null;
        nodeSummary: ForgeRequestNodeSummaryItem[];
    }): void => {
        forgeStore.createModelRequestTrace({
            id: payload.requestId,
            source: payload.source,
            status: 'queued',
            workspaceSessionId: workspaceSessionId.value || sessionChatId.value,
            requestPrompt: payload.requestPrompt.map((message) => ({ ...message })),
            requestParameters: clonePromptPresetGenerationSettings(payload.requestParameters),
            contextSnapshot: {
                ...payload.contextSnapshot,
                historyMessages: payload.contextSnapshot.historyMessages.map((message) => ({ ...message })),
                lorebookEntries: payload.contextSnapshot.lorebookEntries.map((entry) => ({ ...entry }))
            },
            responseRaw: '',
            responseDisplay: '',
            responseThinking: '',
            requestedAt: Date.now(),
            firstResponseAt: null,
            completedAt: null,
            errorMessage: null,
            presetId: payload.presetId,
            nodeSummary: payload.nodeSummary.map((item) => ({ ...item }))
        });
    };

    const upsertForgeMemory = (
        path: string,
        title: string,
        content: string,
        source: 'user' | 'planner' | 'analyst' | 'system' = 'system',
        summary?: string
    ): void => {
        const normalizedPath = path.trim();
        const normalizedContent = content.trim();
        if (!normalizedPath || !normalizedContent) return;

        const nextEntry = {
            path: normalizedPath,
            title: title.trim() || normalizedPath,
            content: normalizedContent,
            summary: summary?.trim() || normalizedContent.slice(0, 120),
            updatedAt: Date.now(),
            source
        };

        const nextEntries = forgeMemoryTree.value.entries.filter(entry => entry.path !== normalizedPath);
        nextEntries.unshift(nextEntry);
        forgeMemoryTree.value = {
            entries: nextEntries,
            lastUpdatedAt: nextEntry.updatedAt
        };
    };

    const removeForgeMemory = (path: string): void => {
        const normalizedPath = path.trim();
        if (!normalizedPath) return;
        const nextEntries = forgeMemoryTree.value.entries.filter(entry => entry.path !== normalizedPath);
        if (nextEntries.length === forgeMemoryTree.value.entries.length) return;
        forgeMemoryTree.value = {
            entries: nextEntries,
            lastUpdatedAt: Date.now()
        };
    };

    const summarizeFormValues = (formId: string): string => getFormController().summarizeFormValues(formId);
    const buildSubmittedFormUserInput = (formId: string): string => getFormController().buildSubmittedFormUserInput(formId);

    const appendReferenceMemory = (title: string, content: string): void => {
        const referenceId = `参考内容/${Date.now().toString(36)}`;
        upsertForgeMemory(referenceId, title, content, 'user', content.slice(0, 120));
    };

    const inferUserInputMemoryWrites = (text: string): void => {
        const trimmed = text.trim();
        if (!trimmed) return;

        if (/(必须|一定要|务必|只能|保留|不可更改|不要改动|不能改动)/.test(trimmed)) {
            upsertForgeMemory('约束/硬性限制', '硬性限制', trimmed, 'user', trimmed);
        }

        if (/(不要|禁止|避免|不能|不希望|不许|别写|规避)/.test(trimmed)) {
            upsertForgeMemory('约束/禁忌', '禁忌与避让项', trimmed, 'user', trimmed);
        }

        if (/(参考|像|类似|片段|风格参考|灵感|样本|示例|文风|参照)/.test(trimmed) && trimmed.length >= 12) {
            appendReferenceMemory('参考内容', trimmed);
        }

        if (/(偏好|喜欢|更想|倾向|希望|想要|语气|风格|协作方式|先聊|先对话)/.test(trimmed) && trimmed.length >= 8) {
            upsertForgeMemory('启动/用户偏好', '用户偏好', trimmed, 'user', trimmed);
        }

        if (/(就按这个|就这个|确定|确认|采用|定这个|就这么定|最终版|拍板)/.test(trimmed)) {
            upsertForgeMemory('设定决议/核心想法', '核心想法', trimmed, 'user', trimmed.slice(0, 120));
        }
    };

    const ensureFormById = (formId: string): ForgeStructuredFormState => getFormController().ensureFormById(formId);
    const ensureLayerForm = (layerName: ForgeLayer): ForgeStructuredFormState => getFormController().ensureLayerForm(layerName);
    const recomputeMissingFields = (formId: string): string[] => getFormController().recomputeMissingFields(formId);
    const getStructuredFieldText = (formId: string | undefined, fieldKey: string): string => getFormController().getStructuredFieldText(formId, fieldKey);
    const hasStructuredFieldBinding = (formId: string, fieldKey: string): boolean => getFormController().hasStructuredFieldBinding(formId, fieldKey);
    const getStructuredFieldList = (formId: string | undefined, fieldKey: string): string[] => getFormController().getStructuredFieldList(formId, fieldKey);
    const setStructuredFieldValue = (formId: string | undefined, fieldKey: string, nextValue: string | string[], source: ForgeStructuredFieldState['source'] = 'manual'): void =>
        getFormController().setStructuredFieldValue(formId, fieldKey, nextValue, source);

    const setActiveAuxPanel = (panel: ForgeAuxPanelKind): void => {
        activeAuxPanel.value = panel;
        persistWorkspaceSession();
    };

    const setAuxPresentationMode = (mode: 'embedded' | 'detached' | 'widget' | 'hidden'): void => {
        auxPresentationMode.value = mode;
        persistWorkspaceSession();
    };

    const setWorkspacePage = (pageName: 'workspace' | 'session-browser'): void => {
        workspacePage.value = pageName;
    };

    const prefillStructuredForm = (payload: {
        formId?: string | null;
        layer?: ForgeLayer | null;
        fields: Array<{ fieldKey: string; value: string | string[] }>;
        overwrite?: boolean;
        source?: ForgeStructuredFieldState['source'];
    }): void => getFormController().prefillStructuredForm(payload);

    // ─────────────────────────────────────────────────────────────────────
    // 辅助建议池 (Assist Pool)
    // 统一承载 ForgeFormAssist 注入的候选值，各表单组件按 fieldKey 消费
    // ─────────────────────────────────────────────────────────────────────

    /** 候选值条目类型（与 forgeDslUtils.ts 中的同名接口保持同步） */
    interface AssistPoolCandidate {
        value: string;
        description: string | null;
    }

    interface AssistPoolEntry {
        candidates: AssistPoolCandidate[];
        /** 来源 formId，主要用于调试 */
        formId: string | null;
        /** 注入时间戳，用于过期清理 */
        injectedAt: number;
    }

    /** fieldKey → 辅助数据映射 */
    const assistPool = ref<Map<string, AssistPoolEntry>>(new Map());

    /**
     * 读取指定字段的辅助候选值列表
     * @returns 候选值数组，无则返回空数组
     */
    const getAssistCandidates = (fieldKey: string): AssistPoolCandidate[] => {
        return assistPool.value.get(fieldKey)?.candidates ?? [];
    };

    /**
     * 向辅助建议池注入一批字段候选值（由 ForgeFormAssistBlock 在 onMounted 时调用）
     * @param fields 字段列表，每项包含 fieldKey 和 candidates
     * @param formId 来源 formId（可选，仅用于调试）
     */
    const injectAssistCandidates = (
        fields: Array<{ fieldKey: string; candidates: AssistPoolCandidate[] }>,
        formId: string | null = null
    ): void => {
        const now = Date.now();
        for (const field of fields) {
            if (!field.fieldKey || field.candidates.length === 0) continue;
            assistPool.value.set(field.fieldKey, {
                candidates: field.candidates,
                formId,
                injectedAt: now
            });
        }
    };

    /** 获取当前表单辅助模式设置 */
    const formAssistanceMode = computed((): 'prefill' | 'suggestion' | 'off' => {
        const raw = lwStorage.get('lumina-forge.formAssistanceMode', 'prefill', 'Global');
        if (raw === 'suggestion' || raw === 'off') return raw;
        return 'prefill';
    });

    const buildFormResultXml = (formId: string): string => getFormController().buildFormResultXml(formId);
    const buildLayerFormDsl = (layerName: ForgeLayer): string => getFormController().buildLayerFormDsl(layerName);

    const addAssistantViewMessage = (content: string): void => {
        const parentId = worldlineStore.value.activeLeafId;
        const assistantNode = createMessageNode('assistant', content, parentId);
        upsertMessage(assistantNode);
        worldlineStore.value.activeLeafId = assistantNode.id;
        bumpTimelineRevision();
    };

    /**
     * 向对话历史中插入用户消息（用于对话化交互）
     */
    const addUserViewMessage = (content: string): void => {
        const parentId = worldlineStore.value.activeLeafId;
        const userNode = createMessageNode('user', content, parentId);
        upsertMessage(userNode);
        worldlineStore.value.activeLeafId = userNode.id;
        bumpTimelineRevision();
    };

    const syncDraftTree = (): void => {
        const nextNodes = [
            ...forgeStore.stagingArea.map(entry => ({
                id: entry.id,
                title: entry.description || entry.targetEntryId,
                layer: entry.layer || activeLayer.value,
                content: entry.proposedContent,
                status: 'proposal' as const,
                sourceMessageId: entry.sourceMessageId || null,
                sourceEntryId: entry.targetEntryId,
                sourceTag: entry.sourceTag || null,
                sourceSessionId: entry.sourceSessionId || workspaceSessionId.value || null,
                updatedAt: entry.timestamp
            })),
            ...forgeStore.commitReadyEntries.map(entry => ({
                id: entry.id,
                title: entry.description || entry.targetEntryId,
                layer: entry.layer || activeLayer.value,
                content: entry.proposedContent,
                status: 'approved_for_workspace' as const,
                sourceMessageId: entry.sourceMessageId || null,
                sourceEntryId: entry.targetEntryId,
                sourceTag: entry.sourceTag || null,
                sourceSessionId: entry.sourceSessionId || workspaceSessionId.value || null,
                updatedAt: entry.timestamp
            })),
            ...virtualLorebookEntries.value.map(item => ({
                id: item.id,
                title: item.entry.comment || '未命名条目',
                layer: activeLayer.value,
                content: item.entry.content || '',
                status: 'publish_candidate' as const,
                sourceMessageId: null,
                sourceEntryId: typeof item.entry.uid === 'string' ? item.entry.uid : null,
                sourceTag: 'virtual_lorebook',
                sourceSessionId: workspaceSessionId.value || null,
                updatedAt: item.updatedAt
            }))
        ];
        draftTree.value = {
            nodes: nextNodes.map(node => ({
                ...node,
                id: node.id || generateDraftNodeId()
            })),
            lastUpdatedAt: Date.now()
        };
    };

    const applySubmittedFormResult = (formId: string): void => getFormController().applySubmittedFormResult(formId);

    const resolveOriginalContent = (targetEntryId: string | null): string =>
        _resolveOriginalContent(targetEntryId, {
            virtualLorebookEntries: virtualLorebookEntries.value,
            commitReadyEntries: forgeStore.commitReadyEntries,
            stagingEntries: forgeStore.stagingArea,
            draftTree: draftTree.value
        });

    const getRuntimeContext = (command: ForgeUserCommand, latestUserInput?: string): ForgeRuntimeContext => ({
        workspaceSessionId: workspaceSessionId.value || `forge_ws_${Date.now().toString(36)}`,
        sessionChatId: sessionChatId.value,
        workspaceTitle: workspaceTitle.value,
        selectedPresetId: selectedPresetId.value,
        selectedChatSessionId: selectedChatSessionId.value,
        selectedChatSnapshotId: selectedChatSnapshotId.value,
        detailMode: detailMode.value,
        collectionMode: collectionMode.value,
        entryMode: entryMode.value,
        activeLayer: activeLayer.value,
        completedLayers: [...completedLayers.value],
        workflowSnapshot: workflowSnapshot.value,
        publishState: publishState.value,
        activeLeafId: worldlineStore.value.activeLeafId,
        worldlineNodes: worldlineStore.value.nodePool.map(node => ({ ...node })),
        messages: messages.value.map(message => ({ ...message })),
        timelineItems: forgeStore.timelineItems.map(item => ({ ...item })),
        structuredState: structuredState.value,
        draftTree: draftTree.value,
        forgeMemoryTree: cloneForgeMemoryTree(forgeMemoryTree.value),
        stagingEntries: forgeStore.stagingArea.map(entry => ({ ...entry })),
        commitReadyEntries: forgeStore.commitReadyEntries.map(entry => ({ ...entry })),
        virtualLorebookEntries: virtualLorebookEntries.value.map(entry => ({
            ...entry,
            entry: JSON.parse(JSON.stringify(entry.entry))
        })),
        latestUserInput: latestUserInput ?? input.value.trim(),
        latestUserCommand: command
    });

    const handleRuntimeEvent = (event: ForgeRuntimeEvent): void => {
        if (!streamingAssistantNodeId.value) {
            if (event.type === 'stream_error') {
                isGenerating.value = false;
                streamThinkingText.value = '';
                lastError.value = event.message;
            }
            return;
        }

        const assistantNode = worldlineStore.value.getNode(streamingAssistantNodeId.value);
        if (!assistantNode) return;

        if (event.type === 'stream_chunk') {
            streamText.value = event.displayText;
            streamThinkingText.value = event.thinkingText;
            upsertMessage({
                ...assistantNode,
                pluginRaw: event.rawText,
                fingerprint: MessageUtils.getFingerprint(event.rawText),
                syncStatus: 'streaming',
                extra: {
                    ...assistantNode.extra,
                    send_date: assistantNode.extra?.send_date,
                    lastChunkAt: Date.now()
                }
            });
            return;
        }

        if (event.type === 'stream_done') {
            streamText.value = event.displayText;
            streamThinkingText.value = event.thinkingText;
            upsertMessage({
                ...assistantNode,
                pluginRaw: event.rawText,
                fingerprint: MessageUtils.getFingerprint(event.rawText),
                syncStatus: 'local',
                extra: {
                    ...assistantNode.extra,
                    completedAt: Date.now()
                }
            });
            worldlineStore.value.activeLeafId = assistantNode.id;
            bumpTimelineRevision();
            isGenerating.value = false;
            streamingAssistantNodeId.value = null;
            return;
        }

        if (event.type === 'stream_error' || event.type === 'action_completed') {
            isGenerating.value = false;
            if (event.type === 'stream_error') {
                streamThinkingText.value = '';
                lastError.value = event.message;
            }
            streamingAssistantNodeId.value = null;
        }
    };

    const prepareAssistantStream = (): void => {
        const assistantNode = createMessageNode('assistant', '', worldlineStore.value.activeLeafId);
        assistantNode.syncStatus = 'streaming';
        upsertMessage(assistantNode);
        worldlineStore.value.activeLeafId = assistantNode.id;
        streamingAssistantNodeId.value = assistantNode.id;
        isGenerating.value = true;
        bumpTimelineRevision();
    };

    let _effectTarget: ForgeEffectTarget | null = null;
    const getEffectTarget = (): ForgeEffectTarget => {
        if (_effectTarget) return _effectTarget;
        _effectTarget = {
            addAssistantViewMessage,
            createAndAppendUserMessage(content: string) {
                const userNode = createMessageNode('user', content, worldlineStore.value.activeLeafId);
                upsertMessage(userNode);
                worldlineStore.value.activeLeafId = userNode.id;
                bumpTimelineRevision();
            },
            upsertRunningOperation: (p) => forgeStore.upsertRunningOperation(p),
            completeOperationByKey: (p) => forgeStore.completeOperationByKey(p),
            addOperationTimelineItem: (p) => forgeStore.addOperationTimelineItem(p),
            updateOperationPrompt: (k, p) => forgeStore.updateOperationPrompt(k, p),
            setActiveModelRequestTrace: (requestId) => forgeStore.setActiveModelRequestTrace(requestId),
            markModelRequestFirstResponse: (requestId, firstResponseAt) => forgeStore.markModelRequestFirstResponse(requestId, firstResponseAt),
            updateModelRequestStream: (payload) => forgeStore.updateModelRequestStream(payload),
            completeModelRequestTrace: (payload) => forgeStore.completeModelRequestTrace(payload),
            failModelRequestTrace: (requestId, message) => forgeStore.failModelRequestTrace(requestId, message),
            setEntryMode(mode) {
                entryMode.value = mode;
                publishState.value = 'drafting';
            },
            setDetailMode(mode) { detailMode.value = mode; },
            setCollectionMode(mode) { collectionMode.value = mode; },
            setActiveLayerAndEmitForm(layer) {
                activeLayer.value = layer;
                if (collectionMode.value === 'persistent'
                    && !(layer === 'concept' && detailMode.value && !structuredState.value.forms[kickoffBlueprint.formId]?.lastSubmittedAt)) {
                    ensureLayerForm(layer);
                    addAssistantViewMessage(buildLayerFormDsl(layer));
                }
            },
            prefillStructuredForm,
            applySubmittedFormResult,
            upsertForgeMemory,
            removeForgeMemory,
            autoMergeEntryToVirtualLorebook(entry) {
                const entryId = entry.targetEntryId;
                const existingVirtualEntry = findVirtualLorebookEntry(virtualLorebookEntries.value, entryId);
                const nextEntry = buildFrozenVirtualLorebookContent({
                    id: `auto_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
                    timestamp: Date.now(),
                    ...entry
                }, existingVirtualEntry?.entry);
                upsertVirtualLorebookEntry({ id: entryId, entry: nextEntry });
            },
            moveStagingToCommitReady: (id) => forgeStore.moveToCommitReady(id),
            removeStagingEntry: (id) => forgeStore.removeFromStaging(id),
            moveCommitReadyToStaging: (id) => forgeStore.moveBackToStaging(id),
            syncDraftTree,
            freezeWorkspace: async () => { await freezeCommitReadyEntriesToWorkspaceInternal(); },
            setReferenceChat(chatSessionId) {
                selectedChatSessionId.value = chatSessionId;
                selectedChatSnapshotId.value = chatSessionId ? `snapshot_${chatSessionId}` : null;
            },
            refreshWorkflowSnapshot: async (userInput?: string) => { await refreshWorkflowSnapshot(userInput); },
            persistSession: () => persistWorkspaceSession(),
            getActiveLayer: () => activeLayer.value
        };
        return _effectTarget;
    };

    const applyRuntimeEffects = (effects: ForgeRuntimeEffect[]): Promise<void> =>
        applyForgeEffects(effects, getEffectTarget());

    const ensureRuntimeOrchestrator = (): ForgeRuntimeOrchestrator => {
        if (!runtimeOrchestrator) {
            runtimeOrchestrator = new ForgeRuntimeOrchestrator({
                getRuntimeContext,
                applyRuntimeEffects,
                buildPlannerExecutionRequest,
                buildAnalystExecutionRequest,
                buildConversationExecutionRequest,
                buildExecutorExecutionRequest,
                prepareAssistantStream,
                handleRuntimeEvent,
                resolveOriginalContent,
                resolveEntryComment: (targetEntryId: string | null) => {
                    if (!targetEntryId) return null;
                    const entry = findVirtualLorebookEntry(virtualLorebookEntries.value, targetEntryId);
                    return entry?.entry.comment || null;
                }
            });
        }
        return runtimeOrchestrator;
    };

    const dispatchWorkspaceCommand = async (command: import('../../types/ForgeRuntimeTypes').ForgeUserCommand): Promise<any> => {
        console.log(`[Forge-Store] 开始调度命令：${command.type}`, { command, isBusy: isBusy.value });
        forgeStore.isProcessing = true;
        try {
            const result = await ensureRuntimeOrchestrator().dispatch(command);
            console.log(`[Forge-Store] 命令 ${command.type} 执行圆满结束。`);
            return result;
        } finally {
            console.log(`[Forge-Store] 正在清理命令 ${command.type} 的生命周期。`);
            forgeStore.isProcessing = false;
            // 兜底：确保生成标志也被清除
            if (isGenerating.value) {
                console.warn('[Forge-Store] 严重警告：命令调度结束但 isGenerating 仍为 true，正在强制回收。');
                isGenerating.value = false;
            }
            // 兜底：将所有仍处于 running 状态的操作条目标记为 failed，
            // 防止超时或报错时操作状态永远卡在"进行中"
            forgeStore.failRunningOperations();
        }
    };

    const chooseEntryMode = async (mode: ForgeEntryMode): Promise<void> => {
        lastError.value = null;
        try {
            await dispatchWorkspaceCommand({ type: 'choose_entry_mode', mode });
        } catch (e: any) {
            const msg = e?.message || '选择模式失败';
            lastError.value = msg;
            luminaWeaveApi.showToast(msg, 'error');
            console.error('[Forge-Store] chooseEntryMode failed:', e);
        }
    };

    const chooseDetailMode = async (mode: ForgeDetailMode): Promise<void> => {
        lastError.value = null;
        try {
            await dispatchWorkspaceCommand({ type: 'choose_detail_mode', mode });
        } catch (e: any) {
            const msg = e?.message || '选择节奏失败';
            lastError.value = msg;
            luminaWeaveApi.showToast(msg, 'error');
            console.error('[Forge-Store] chooseDetailMode failed:', e);
        }
    };

    const submitStructuredForm = async (formId: string): Promise<void> => {
        const form = structuredState.value.forms[formId];
        const scopeId = form ? null : formId;
        lastError.value = null;

        try {
            const transientEntries = scopeId ? Array.from(getTransientSelections(scopeId).entries()) : [];
            const transientSummary = transientEntries
                .map(([key, val]) => {
                    const displayVal = Array.isArray(val) ? val.join('、') : val;
                    return displayVal ? `${key}: ${displayVal}` : null;
                })
                .filter(Boolean)
                .join('\n');

            if (scopeId && transientSummary) {
                console.log(`[Forge-Store] 将临时选项转化为对话记录:\n${transientSummary}`);
                addUserViewMessage(`【用户选择与意图收集】:\n${transientSummary}`);
            }

            const formResultXml = form ? buildSubmittedFormUserInput(formId) : '';
            const finalUserInput = formResultXml || transientSummary;

            if (!finalUserInput) {
                console.warn('[Forge-Store] 提交中止：没有任何有效数据。');
                return;
            }

            await dispatchWorkspaceCommand({
                type: 'submit_form',
                formId,
                userInput: finalUserInput
            });

            if (scopeId) {
                console.log(`[Forge-Store] 提交完成，清空消息作用域 ${scopeId} 的瞬态选值。`);
                clearTransientSelections(scopeId);
                markScopeSubmitted(scopeId);
            }

        } catch (e: any) {
            const msg = e?.message || '提交表单失败';
            lastError.value = msg;
            luminaWeaveApi.showToast(msg, 'error');
            console.error('[Forge-Store] submitStructuredForm failed:', e);
        }
    };



    const requestLayerAdvance = async (layerName: ForgeLayer): Promise<void> => {
        lastError.value = null;
        await dispatchWorkspaceCommand({ type: 'advance_layer', layer: layerName });
    };

    const addOperation = (payload: {
        operationKind: ForgeTimelineOperationItem['operationKind'];
        status: ForgeTimelineOperationItem['status'];
        title: string;
        summary: string;
        detail?: string | null;
        sourceTag?: string | null;
        targetEntryId?: string | null;
        relatedMessageId?: string | null;
        layer?: ForgeLayer | null;
    }): void => {
        forgeStore.addOperationTimelineItem(payload);
    };

    const refreshWorkflowSnapshot = async (userInputOverride?: string): Promise<ForgeWorkflowSnapshot> => {
        const snapshot = await ForgeWorkflowGraph.routeTurn({
            userInput: (userInputOverride ?? input.value).trim(),
            messageCount: messages.value.length,
            stagingCount: forgeStore.stagingArea.length,
            commitReadyCount: forgeStore.commitReadyEntries.length,
            stagingEntries: forgeStore.stagingArea,
            commitReadyEntries: forgeStore.commitReadyEntries,
            draftCount: draftTree.value.nodes.length,
            hasReferenceChat: Boolean(selectedChatSessionId.value),
            activeLeafId: worldlineStore.value.activeLeafId,
            detailMode: detailMode.value,
            collectionMode: collectionMode.value,
            entryMode: entryMode.value,
            activeLayer: activeLayer.value,
            completedLayers: completedLayers.value,
            structuredState: structuredState.value
        });
        workflowSnapshot.value = snapshot;
        collectionMode.value = snapshot.collectionMode;
        return snapshot;
    };

    const bindForgeControllerBridge = (): void => {
        if (forgeControllerBridgeBound) return;
        forgeControllerBridgeBound = true;

        luminaWeaveApi.on(FORGE_LAYER_ADVANCE_REQUESTED, (layerName: ForgeLayer) => {
            requestLayerAdvance(layerName);
        });

        luminaWeaveApi.on(FORGE_FORM_RESULT_SUBMITTED, (payload: { formId?: string }) => {
            if (!payload?.formId) return;
            submitStructuredForm(payload.formId);
        });

        luminaWeaveApi.on(FORGE_WORKSPACE_FREEZE_REQUESTED, async () => {
            await freezeCommitReadyEntriesToWorkspace();
        });
    };

    const fetchPresetDetail = async (presetId: string): Promise<BackendPresetDetail | null> => {
        if (!presetId) return null;
        try {
            return await BridgeDispatcher.presets.exportPreset(presetId) as BackendPresetDetail;
        } catch {
            return null;
        }
    };

    const buildPlannerExecutionRequest = async (context: ForgeRuntimeContext): Promise<ForgeExecutionRequest> => {
        const presetData = await fetchPresetDetail(context.selectedPresetId);
        const resolvedLorebookView = resolveActiveLorebookView();
        const memorySnapshot = buildMemorySnapshot();
        const requestId = generateForgeRequestTraceId();
        const resolvedPresetId = resolveRuntimePresetId(context.selectedPresetId);
        const nodeSummary = summarizeRequestNodeSummary(resolvedPresetId);
        const generationSettings = resolvePromptPresetGenerationSettings('forge-main');
        const request = ForgePromptContextService.buildPlannerExecutionRequest({
            context,
            presetData,
            memorySnapshot,
            resolvedLorebookEntries: resolvedLorebookView.entries,
            charName: 'Forge Assistant'
        });
        registerRuntimeRequestTrace({
            requestId,
            source: 'planner',
            contextSnapshot: buildRuntimeContextSnapshot(context, resolvedLorebookView, memorySnapshot, resolvedPresetId),
            requestPrompt: request.messages,
            requestParameters: generationSettings,
            presetId: resolvedPresetId,
            nodeSummary
        });
        return {
            ...request,
            requestId,
            traceSource: 'planner',
            contextSnapshot: buildRuntimeContextSnapshot(context, resolvedLorebookView, memorySnapshot, resolvedPresetId),
            nodeSummary,
            generationSettings,
            presetId: resolvedPresetId
        };
    };

    const buildConversationExecutionRequest = async (context: ForgeRuntimeContext): Promise<ForgeExecutionRequest> => {
        const presetData = await fetchPresetDetail(context.selectedPresetId);
        const resolvedLorebookView = resolveActiveLorebookView();
        const memorySnapshot = buildMemorySnapshot();
        const requestId = generateForgeRequestTraceId();
        const resolvedPresetId = resolveRuntimePresetId(context.selectedPresetId);
        const nodeSummary = summarizeRequestNodeSummary(resolvedPresetId);
        const contextSnapshot = buildRuntimeContextSnapshot(context, resolvedLorebookView, memorySnapshot, resolvedPresetId);
        const generationSettings = resolvePromptPresetGenerationSettings('forge-main');
        const request = ForgePromptContextService.buildConversationExecutionRequest({
            context,
            presetData,
            memorySnapshot,
            resolvedLorebookEntries: resolvedLorebookView.entries,
            charName: 'Forge Assistant'
        });
        registerRuntimeRequestTrace({
            requestId,
            source: 'conversation',
            contextSnapshot,
            requestPrompt: request.messages,
            requestParameters: generationSettings,
            presetId: resolvedPresetId,
            nodeSummary
        });
        return {
            ...request,
            requestId,
            traceSource: 'conversation',
            contextSnapshot,
            nodeSummary,
            generationSettings,
            presetId: resolvedPresetId
        };
    };

    const buildAnalystExecutionRequest = async (context: ForgeRuntimeContext): Promise<ForgeExecutionRequest> => {
        const presetData = await fetchPresetDetail(context.selectedPresetId);
        const resolvedLorebookView = resolveActiveLorebookView();
        const memorySnapshot = buildMemorySnapshot();
        const requestId = generateForgeRequestTraceId();
        const resolvedPresetId = resolveRuntimePresetId(context.selectedPresetId);
        const nodeSummary = summarizeRequestNodeSummary(resolvedPresetId);
        const contextSnapshot = buildRuntimeContextSnapshot(context, resolvedLorebookView, memorySnapshot, resolvedPresetId);
        const generationSettings = resolvePromptPresetGenerationSettings('forge-main');
        const request = ForgePromptContextService.buildAnalystExecutionRequest({
            context,
            presetData,
            memorySnapshot,
            resolvedLorebookEntries: resolvedLorebookView.entries,
            charName: 'Forge Assistant'
        });
        registerRuntimeRequestTrace({
            requestId,
            source: 'analyst',
            contextSnapshot,
            requestPrompt: request.messages,
            requestParameters: generationSettings,
            presetId: resolvedPresetId,
            nodeSummary
        });
        return {
            ...request,
            requestId,
            traceSource: 'analyst',
            contextSnapshot,
            nodeSummary,
            generationSettings,
            presetId: resolvedPresetId
        };
    };

    const buildExecutorExecutionRequest = async (params: {
        instruction: string;
        entryId: string;
        originalContent: string;
        sourceCommand: ForgeUserCommand;
    }): Promise<ForgeExecutionRequest> => {
        const requestId = generateForgeRequestTraceId();
        const resolvedPresetId = resolveRuntimePresetId(selectedPresetId.value);
        const nodeSummary = summarizeRequestNodeSummary(resolvedPresetId);
        const generationSettings = resolvePromptPresetGenerationSettings('forge-executor');
        const contextSnapshot: ForgeRequestContextSnapshot = {
            kind: 'forge-runtime',
            workspaceTitle: workspaceTitle.value || null,
            detailMode: detailMode.value,
            activeLayer: activeLayer.value,
            sourceCommand: params.sourceCommand,
            workflowSnapshot: workflowSnapshot.value,
            historyMessages: sanitizeHistoryMessages(messages.value),
            referenceChatSessionId: selectedChatSessionId.value,
            referenceChatSnapshotId: selectedChatSnapshotId.value,
            lorebookEntries: summarizeLorebookEntries(resolveActiveLorebookView().entries),
            memorySnapshot: buildMemorySnapshot(),
            selectedPresetId: resolvedPresetId,
            testChatPresetId: null,
            nexusPresetId: null
        };
        const request = ForgePromptContextService.buildExecutorExecutionRequest({
            instruction: params.instruction,
            entryId: params.entryId,
            originalContent: params.originalContent,
            sessionChatId: sessionChatId.value,
            charName: 'Forge Assistant',
            presetId: resolvedPresetId,
            sourceCommand: params.sourceCommand
        });
        registerRuntimeRequestTrace({
            requestId,
            source: 'executor',
            contextSnapshot,
            requestPrompt: request.messages,
            requestParameters: generationSettings,
            presetId: resolvedPresetId,
            nodeSummary
        });
        return {
            ...request,
            requestId,
            traceSource: 'executor',
            contextSnapshot,
            nodeSummary,
            generationSettings,
            presetId: resolvedPresetId
        };
    };

    const buildPromptPreviewPayload = async (): Promise<ForgePromptPreviewBundle> => {
        if (!selectedPresetId.value) {
            return {
                primary: {
                    key: 'primary',
                    mode: 'planner',
                    title: '主模型 / Planner',
                    subtitle: '当前未选择预设，无法生成主模型提示词预览',
                    payload: [],
                    sourceLabel: null,
                    targetEntryId: null
                },
                executor: {
                    key: 'executor',
                    mode: 'executor',
                    title: '子模型 / Executor',
                    subtitle: '当前未选择预设，执行模型仅能显示空预览',
                    payload: [],
                    sourceLabel: null,
                    targetEntryId: null
                }
            };
        }

        // 核心修复：预览时也尝试初始化 A.U.T.O 清单，确保预览与真实运行一致
        syncAutoChecklistToMemory();

        const presetData = await fetchPresetDetail(selectedPresetId.value);
        const resolvedLorebookView = resolveActiveLorebookView();
        const memorySnapshot = buildMemorySnapshot();
        const primaryMode = workflowSnapshot.value?.promptMode === 'conversation'
            ? 'conversation'
            : workflowSnapshot.value?.promptMode === 'analyst'
                ? 'analyst'
                : 'planner';
        const primaryPayload = ForgePromptContextService.buildPromptPreviewPayload({
            presetData,
            messages: messages.value.map((message) => ({
                role: message.role as CleanedMessage['role'],
                content: message.mesRaw || message.mes || '',
                name: message.name
            })),
            resolvedLorebookEntries: resolvedLorebookView.entries,
            memorySnapshot,
            forgeMemoryTree: forgeMemoryTree.value,
            structuredState: structuredState.value,
            draftTree: draftTree.value,
            workflowSnapshot: workflowSnapshot.value,
            mode: primaryMode
        });

        const latestCommitReady = forgeStore.commitReadyEntries[forgeStore.commitReadyEntries.length - 1] || null;
        const latestStaging = forgeStore.stagingArea[forgeStore.stagingArea.length - 1] || null;
        const executorSeed = latestCommitReady || latestStaging;
        const executorSourceLabel = latestCommitReady
            ? '写回准备条目'
            : latestStaging
                ? '待审修改条目'
                : '模板示例';
        const executorInstruction = executorSeed?.description?.trim()
            || '根据已批准的局部任务重写该条目，保持当前层目标一致。';
        const executorEntryId = executorSeed?.targetEntryId || 'preview.entry';
        const executorOriginalContent = executorSeed?.originalContent?.trim()
            || resolveOriginalContent(executorSeed?.targetEntryId || null)
            || '当前还没有待执行的真实条目。这里展示的是执行模型模板，实际运行时会替换为目标条目原文。';
        const executorPayload = ForgePromptContextService.buildExecutorPreviewPayload({
            instruction: executorInstruction,
            entryId: executorEntryId,
            originalContent: executorOriginalContent,
            sessionChatId: sessionChatId.value,
            charName: 'Forge Assistant',
            presetId: selectedPresetId.value,
            sourceCommand: { type: 'noop' }
        });

        return {
            primary: {
                key: 'primary',
                mode: primaryMode,
                title: primaryMode === 'conversation'
                    ? '主模型 / Conversation'
                    : primaryMode === 'analyst'
                        ? '主模型 / Analyst'
                        : '主模型 / Planner',
                subtitle: primaryMode === 'conversation'
                    ? '展示当前协作对话模式下主模型会收到的完整消息载荷'
                    : primaryMode === 'analyst'
                        ? '展示当前中间态分析模型会收到的隔离上下文载荷'
                        : '展示当前规划模式下主模型会收到的完整消息载荷',
                payload: primaryPayload,
                sourceLabel: workflowSnapshot.value?.reason || '当前工作流快照',
                targetEntryId: null
            },
            executor: {
                key: 'executor',
                mode: 'executor',
                title: '子模型 / Executor',
                subtitle: `展示执行模型的隔离重写载荷。来源：${executorSourceLabel}`,
                payload: executorPayload,
                sourceLabel: executorSourceLabel,
                targetEntryId: executorSeed?.targetEntryId || null
            }
        };
    };

    const syncAutoChecklistToMemory = (): void => {
        const hasChecklist = forgeMemoryTree.value.entries.some(e => e.path === 'AUTO/Checklist');
        if (hasChecklist) return;

        console.log('[Forge-Store] 检测到记忆中缺失 A.U.T.O 清单，正在初始化...');
        const resolvedLorebookView = resolveActiveLorebookView();
        const memorySnapshot = buildMemorySnapshot();
        const heuristicNote = ForgePromptContextService.buildAutoChecklistNote({
            messages: [],
            resolvedLorebookEntries: resolvedLorebookView.entries,
            memorySnapshot,
            forgeMemoryTree: forgeMemoryTree.value,
            structuredState: structuredState.value,
            draftTree: draftTree.value,
            workflowSnapshot: workflowSnapshot.value,
        });

        // 提取清单内容，移除系统指令
        const checklistContent = heuristicNote
            .split('\n**指令')[0]
            .replace('### A.U.T.O 制卡进度清单 (Checklist & Context)\n', '')
            .replace('**[系统自动追踪 (System Heuristics)]**:\n', '')
            .trim();

        upsertForgeMemory(
            'AUTO/Checklist',
            '制卡进度清单',
            checklistContent,
            'system',
            '由系统根据当前工作区状态自动生成的初始进度清单'
        );
    };

    const generate = async (): Promise<void> => {
        lastError.value = null;
        streamText.value = '';
        streamThinkingText.value = '';
        const trimmed = input.value.trim();
        if (!trimmed) return;

        // 确保记忆中存在清单节点
        syncAutoChecklistToMemory();

        input.value = '';
        inferUserInputMemoryWrites(trimmed);
        persistWorkspaceSession();

        try {
            await dispatchWorkspaceCommand({ type: 'send_user_input', input: trimmed });
        } catch (e: any) {
            isGenerating.value = false;
            streamThinkingText.value = '';
            streamingAssistantNodeId.value = null;
            lastError.value = e.message || 'Generation failed';
        }
    };

    const runExecutorRewrite = async (instruction: string, entryId: string, originalContent: string): Promise<void> => {
        lastError.value = null;
        streamText.value = '';
        streamThinkingText.value = '';
        forgeStore.isProcessing = true;
        try {
            await ensureRuntimeOrchestrator().runExecutorRewrite(instruction, entryId, originalContent);
        } finally {
            forgeStore.isProcessing = false;
        }
    };

    const abort = async (): Promise<void> => {
        if (!isGenerating.value) return;
        try {
            ensureRuntimeOrchestrator().abortActiveGeneration();
            await BridgeDispatcher.nexus.stop(sessionChatId.value);
        } finally {
            const activeTrace = forgeStore.modelRequestTraces.find(trace => trace.id === forgeStore.activeModelRequestTraceId);
            if (activeTrace && activeTrace.source !== 'test_chat' && (activeTrace.status === 'queued' || activeTrace.status === 'streaming')) {
                forgeStore.abortModelRequestTrace(activeTrace.id);
            }
            isGenerating.value = false;
            streamingAssistantNodeId.value = null;
        }
    };

    const resetSession = (): void => getSessionController().resetSession();


    const approveStagingEntry = async (id: string): Promise<boolean> => {
        const entry = forgeStore.stagingArea.find(item => item.id === id);
        if (!entry) return false;
        await dispatchWorkspaceCommand({ type: 'approve_staging', stagingId: id });
        return true;
    };

    const rejectStagingEntry = async (id: string): Promise<boolean> => {
        const entry = forgeStore.stagingArea.find(item => item.id === id);
        if (!entry) return false;
        await dispatchWorkspaceCommand({ type: 'reject_staging', stagingId: id });
        return true;
    };

    const returnCommitReadyEntry = async (id: string): Promise<boolean> => {
        const entry = forgeStore.commitReadyEntries.find(item => item.id === id);
        if (!entry) return false;
        await dispatchWorkspaceCommand({ type: 'return_commit_ready', entryId: id });
        return true;
    };

    const importLorebookIntoVirtualWorkspace = async (bookId: string): Promise<boolean> => {
        const normalizedBookId = bookId.trim();
        if (!normalizedBookId) return false;

        const loaded = await luminaWeaveApi.lorebookManager.loadLorebook(normalizedBookId);
        if (!loaded) return false;

        const now = Date.now();
        virtualLorebookEntries.value = luminaWeaveApi.lorebookManager.entries.map((entry, index) => ({
            id: typeof entry.uid === 'string' && entry.uid.trim()
                ? `forge_lore_import_${entry.uid}`
                : `${generateVirtualLorebookEntryId()}_${index}`,
            entry: JSON.parse(JSON.stringify(entry)),
            sourceBookId: normalizedBookId,
            createdAt: now,
            updatedAt: now
        }));
        importedLorebookId.value = normalizedBookId;
        syncDraftTree();
        persistWorkspaceSession();
        return true;
    };

    const upsertVirtualLorebookEntry = (payload: { id?: string; entry: LuminaLorebookEntry; sourceBookId?: string | null }): string => {
        const index = findVirtualLorebookEntryIndex(virtualLorebookEntries.value, payload.id, payload.entry);
        const now = Date.now();
        const existingEntry = index >= 0 ? virtualLorebookEntries.value[index] : null;
        const nextId = existingEntry?.id || payload.id || generateVirtualLorebookEntryId();
        const nextEntry: ForgeVirtualLorebookEntry = {
            id: nextId,
            entry: JSON.parse(JSON.stringify(payload.entry)),
            sourceBookId: payload.sourceBookId ?? existingEntry?.sourceBookId ?? importedLorebookId.value ?? null,
            createdAt: existingEntry?.createdAt ?? now,
            updatedAt: now
        };

        if (index >= 0) {
            virtualLorebookEntries.value.splice(index, 1, nextEntry);
        } else {
            virtualLorebookEntries.value.unshift(nextEntry);
        }
        syncDraftTree();
        persistWorkspaceSession();
        return nextId;
    };

    const removeVirtualLorebookEntry = (id: string): boolean => {
        const before = virtualLorebookEntries.value.length;
        virtualLorebookEntries.value = virtualLorebookEntries.value.filter(item => item.id !== id);
        const changed = virtualLorebookEntries.value.length !== before;
        if (changed) {
            syncDraftTree();
            persistWorkspaceSession();
        }
        return changed;
    };

    const clearImportedLorebookBinding = (): void => {
        importedLorebookId.value = null;
        persistWorkspaceSession();
    };

    const freezeCommitReadyEntriesToWorkspaceInternal = async (): Promise<boolean> => {
        if (isCommitting.value || forgeStore.commitReadyEntries.length === 0) {
            return false;
        }

        isCommitting.value = true;
        lastError.value = null;

        try {
            const pendingEntries = [...forgeStore.commitReadyEntries];
            let successCount = 0;

            for (const stagedEntry of pendingEntries) {
                const existingVirtualEntry = findVirtualLorebookEntry(virtualLorebookEntries.value, stagedEntry.targetEntryId);
                const nextEntry = buildFrozenVirtualLorebookContent(stagedEntry, existingVirtualEntry?.entry);

                upsertVirtualLorebookEntry({ id: stagedEntry.targetEntryId, entry: nextEntry });
                forgeStore.removeFromCommitReady(stagedEntry.id);
                successCount += 1;
            }

            if (successCount > 0) {
                publishState.value = 'workspace_frozen';
                addOperation({
                    operationKind: 'workspace_write',
                    status: 'completed',
                    title: '已冻结到虚拟工作区',
                    summary: `共冻结 ${successCount} 个条目`,
                    sourceTag: 'freeze_workspace',
                    layer: activeLayer.value
                });
            }

            syncDraftTree();
            lastError.value = null;
            await refreshWorkflowSnapshot();
            persistWorkspaceSession();
            return successCount > 0;
        } catch (error: any) {
            lastError.value = error?.message || '冻结到虚拟工作区失败';
            return false;
        } finally {
            isCommitting.value = false;
        }
    };

    const freezeCommitReadyEntriesToWorkspace = async (): Promise<boolean> => {
        if (forgeStore.commitReadyEntries.length === 0) {
            return false;
        }
        await dispatchWorkspaceCommand({ type: 'freeze_workspace' });
        return true;
    };

    const upsertStagingEntry = (entry: Parameters<typeof forgeStore.upsertStagingEntry>[0]) => forgeStore.upsertStagingEntry(entry);
    const removeStagingEntry = (id: string) => forgeStore.removeFromStaging(id);
    const moveStagingToCommitReady = (id: string) => forgeStore.moveToCommitReady(id);
    const moveCommitReadyToStaging = (id: string) => forgeStore.moveBackToStaging(id);

    const commitReadyEntriesToLorebook = async (): Promise<boolean> => freezeCommitReadyEntriesToWorkspace();

    const switchToNode = (targetNodeId: string): void => getWorldlineManager().switchToNode(targetNodeId);
    const branchFromNode = (targetNodeId: string): Promise<boolean> => getWorldlineManager().branchFromNode(targetNodeId);
    const rollbackFromNode = (targetNodeId: string): Promise<boolean> => getWorldlineManager().rollbackFromNode(targetNodeId);
    const getWorldlineStore = (): WorldlineStore => worldlineStore.value;

    const canGenerate = computed(() => !isGenerating.value && Boolean(entryMode.value) && Boolean(selectedPresetId.value) && input.value.trim().length > 0);

    const ensureWorkspaceSession = (): Promise<void> => getSessionController().ensureWorkspaceSession();

    onMounted(() => {
        // 初始化默认实例的监听
        if (worldlineStore.value) {
            setupWorldlineStoreListeners(worldlineStore.value);
        }
    });

    bindForgeControllerBridge();

    return {
        sessionChatId,
        workspaceSessionId,
        workspaceTitle,
        workspaceCreatedAt,
        workspaceUpdatedAt,
        selectedChatSessionId,
        selectedChatSnapshotId,
        presets,
        selectedPresetId,
        activePreset,
        input,
        messages,
        timelineFeed,
        activeLeafId,
        messageCount,
        timelineGraph,
        timelineRevision,
        isGenerating,
        streamText,
        streamThinkingText,
        lastError,
        workflowSnapshot,
        isCommitting,
        detailMode,
        entryMode,
        activeLayer,
        completedLayers,
        structuredState,
        draftTree,
        forgeMemoryTree,
        publishState,
        activeAuxPanel,
        auxPresentationMode,
        workspacePage,
        virtualLorebookEntries,
        importedLorebookId,
        modelRequestTraces: computed(() => forgeStore.modelRequestTraces),
        activeModelRequestTraceId: computed(() => forgeStore.activeModelRequestTraceId),
        canGenerate,
        getStructuredFieldText,
        getStructuredFieldList,
        getTransientFieldText,
        getTransientFieldList,
        hasStructuredFieldBinding,
        setStructuredFieldValue,
        setActiveAuxPanel,
        setAuxPresentationMode,
        setWorkspacePage,
        chooseDetailMode,
        chooseEntryMode,
        upsertTransientSelection,
        getAssistCandidates,
        injectAssistCandidates,
        formAssistanceMode,
        rememberSubmitConfig,
        resolveSubmitLabel,
        hasPendingTransientSelections,
        isScopeSubmitted,
        submitStructuredForm,

        requestLayerAdvance,
        refreshPresets,
        importPreset,
        exportPreset,
        restoreDefaultPresets,
        resolveActiveLorebookView,
        buildMemorySnapshot,
        upsertForgeMemory,
        removeForgeMemory,
        refreshWorkflowSnapshot,
        buildPromptPreviewPayload,
        persistWorkspaceSession,
        flushWorkspaceSession,
        ensureWorkspaceSession,
        createWorkspaceSession,
        renameWorkspaceSession,
        openWorkspaceSession,
        attachChatSessionReference,
        hydrateFromSession,
        serializeSession,
        generate,
        isBusy,
        runExecutorRewrite,
        abort,
        resetSession,
        approveStagingEntry,
        rejectStagingEntry,
        returnCommitReadyEntry,
        freezeCommitReadyEntriesToWorkspace,
        commitReadyEntriesToLorebook,
        importLorebookIntoVirtualWorkspace,
        upsertVirtualLorebookEntry,
        removeVirtualLorebookEntry,
        clearImportedLorebookBinding,
        switchToNode,
        branchFromNode,
        rollbackFromNode,
        getWorldlineStore,
        dispatchWorkspaceCommand,

        // 状态代理
        stagingEntries: computed(() => forgeStore.stagingArea),
        commitReadyEntries: computed(() => forgeStore.commitReadyEntries),

        // 动作代理
        upsertStagingEntry,
        removeStagingEntry,
        moveStagingToCommitReady,
        moveCommitReadyToStaging,

        testChatService
    };
});
