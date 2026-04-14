import { LuminaWeaveAPIBase } from './LuminaWeaveAPIBase.js';
import { useForgeStore } from '../../stores/useForgeStore.js';
import { forgeSessionRepository } from './ForgeSessionRepository.js';
import { resolveOriginalContent } from './ForgeContextBroker.js';
import type { ForgeLayer } from '../../types/ForgeStructuredTypes.js';
import type { ForgeTimelineOperationKind } from '../../types/ForgeTimelineTypes.js';
import { parseEntryUpdates } from './utils/forgeEntryParser.js';
import {
    FORGE_LAYER_ADVANCE_REQUESTED,
    FORGE_FORM_RESULT_SUBMITTED,
    FORGE_WORKSPACE_FREEZE_REQUESTED,
    FORGE_PLANNER_INTENT_APPLIED
} from './forgeConstants.js';

export {
    FORGE_LAYER_ADVANCE_REQUESTED,
    FORGE_FORM_RESULT_SUBMITTED,
    FORGE_WORKSPACE_FREEZE_REQUESTED,
    FORGE_PLANNER_INTENT_APPLIED
};

type ParsedEntryUpdateOld = {
    targetEntryId: string | null;
    description: string;
    content: string;
    category?: string;
};

/**
 * ForgeAgentController
 * 负责制卡工坊的 Agent 编排逻辑。
 * 包括实时追踪 (Tracing)、指令过滤与隔离重写执行。
 */
export class ForgeAgentController extends LuminaWeaveAPIBase {
    private get forgeStore() {
        return useForgeStore();
    }
    private parentApi: any;
    private recentEventCache = new Map<string, number>();
    private completedPayloadCache = new Set<string>();

    constructor(parentApi: any) {
        super();
        this.parentApi = parentApi;
        this.initListeners();
    }

    private shouldSkipDuplicate(signature: string, ttlMs: number): boolean {
        const now = Date.now();

        for (const [key, timestamp] of this.recentEventCache.entries()) {
            if (now - timestamp > ttlMs) {
                this.recentEventCache.delete(key);
            }
        }

        const lastSeenAt = this.recentEventCache.get(signature);
        if (typeof lastSeenAt === 'number' && now - lastSeenAt <= ttlMs) {
            return true;
        }

        this.recentEventCache.set(signature, now);
        return false;
    }

    private parseAttributes(xmlOpenTag: string): Record<string, string> {
        const attributes: Record<string, string> = {};
        const attributeRegex = /([a-zA-Z_][\w:-]*)="([^"]*)"/g;
        let match: RegExpExecArray | null = null;
        while ((match = attributeRegex.exec(xmlOpenTag)) !== null) {
            attributes[match[1]] = match[2];
        }
        return attributes;
    }

    private async extractEntryUpdate(xmlContent: string): Promise<any[]> {
        return parseEntryUpdates(xmlContent);
    }

    private async resolveOriginalContentForEntry(targetEntryId: string | null): Promise<string> {
        if (!targetEntryId || !this.forgeStore.currentSessionId) {
            return '';
        }

        const session = await forgeSessionRepository.loadSession(this.forgeStore.currentSessionId);
        if (!session) return '';

        return resolveOriginalContent(targetEntryId, {
            virtualLorebookEntries: session.virtualLorebookEntries || [],
            commitReadyEntries: session.commitReadyEntries || [],
            stagingEntries: session.stagingEntries || [],
            draftTree: session.draftTree || { nodes: [], lastUpdatedAt: 0 }
        });
    }

    private mapTagToOperationKind(tagOrType: string | null | undefined): ForgeTimelineOperationKind {
        const normalized = String(tagOrType || '').toLowerCase();
        if (normalized === 'draft_plan' || normalized === 'plan') return 'plan';
        if (normalized === 'entry_update' || normalized === 'update') return 'workspace_write';
        if (normalized === 'forge_skill' || normalized === 'skill') return 'execution';
        return 'system';
    }

    private getOperationDedupeKey(tagOrType: string | null | undefined): string {
        const normalized = String(tagOrType || 'forge').toLowerCase();
        return `forge-operation:${normalized}`;
    }

    private resolveRunningOperationPresentation(tagName: string): {
        operationKind: ForgeTimelineOperationKind;
        title: string;
    } {
        const normalized = tagName.toLowerCase();
        if (normalized === 'forge_skill') {
            return {
                operationKind: 'execution',
                title: '正在执行技能'
            };
        }
        if (normalized === 'draft_plan') {
            return {
                operationKind: 'plan',
                title: '正在规划下一步'
            };
        }
        if (normalized === 'entry_update') {
            return {
                operationKind: 'workspace_write',
                title: '正在生成条目修改'
            };
        }
        return {
            operationKind: 'system',
            title: '正在处理 Forge 操作'
        };
    }

    private resolveCompletedOperationPresentation(type: string, rawContent: string, content: string): {
        operationKind: ForgeTimelineOperationKind;
        title: string;
        summary: string;
        detail: string | null;
        sourceTag: string;
        targetEntryId: string | null;
    } {
        const normalized = type.toLowerCase();
        const openTagMatch = rawContent.match(/^<([a-zA-Z_][\w:-]*)\b[^>]*>/i);
        const attributes = this.parseAttributes(openTagMatch?.[0] || '');
        const targetEntryId = attributes.id || attributes.entry_id || attributes.target || attributes.uid || null;
        const compactContent = (content || '').trim();
        const sourceTag = openTagMatch?.[1] || normalized;

        if (normalized === 'skill') {
            const skillName = attributes.name || attributes.skill || attributes.title || '未命名技能';
            return {
                operationKind: 'execution',
                title: `已执行技能 · ${skillName}`,
                summary: compactContent || '技能执行完成',
                detail: rawContent || compactContent || null,
                sourceTag,
                targetEntryId
            };
        }

        if (normalized === 'plan') {
            return {
                operationKind: 'plan',
                title: '已生成下一步规划',
                summary: compactContent || '规划结果已生成',
                detail: rawContent || compactContent || null,
                sourceTag,
                targetEntryId
            };
        }

        if (normalized === 'update') {
            return {
                operationKind: 'workspace_write',
                title: `已生成条目修改${targetEntryId ? ` · ${targetEntryId}` : ''}`,
                summary: attributes.description || compactContent || '条目修改建议已生成',
                detail: rawContent || compactContent || null,
                sourceTag,
                targetEntryId
            };
        }

        return {
            operationKind: this.mapTagToOperationKind(type),
            title: '已完成 Forge 操作',
            summary: compactContent || '操作已完成',
            detail: rawContent || compactContent || null,
            sourceTag,
            targetEntryId
        };
    }

    private initListeners() {
        // 1. 监听来自 XMLInterceptor 的实时追踪事件
        this.parentApi.on('FORGE_TRACE', (data: any) => {
            const traceSignature = `trace:${data?.tag || 'unknown'}:${data?.status || ''}`;
            if (this.shouldSkipDuplicate(traceSignature, 1200)) {
                return;
            }

            const presentation = this.resolveRunningOperationPresentation(String(data?.tag || ''));
            this.forgeStore.upsertRunningOperation({
                dedupeKey: this.getOperationDedupeKey(data?.tag),
                operationKind: presentation.operationKind,
                title: presentation.title,
                summary: data?.status || 'Forge 正在执行中',
                sourceTag: data?.tag || null
            });
        });

        // 2. 监听来自 XMLInterceptor 的动作完成事件 (拦截到全量标签内容)
        this.parentApi.on('FORGE_ACTION_COMPLETED', async (data: any) => {
            const { type, content, raw } = data;
            const completionSignature = `completed:${type || 'unknown'}:${raw || content || ''}`;
            if (this.completedPayloadCache.has(completionSignature) || this.shouldSkipDuplicate(completionSignature, 5000)) {
                return;
            }
            this.completedPayloadCache.add(completionSignature);
            if (this.completedPayloadCache.size > 200) {
                const firstKey = this.completedPayloadCache.values().next().value;
                if (firstKey) this.completedPayloadCache.delete(firstKey);
            }
            
            const presentation = this.resolveCompletedOperationPresentation(type, raw || content || '', content || '');
            this.forgeStore.completeOperationByKey({
                dedupeKey: this.getOperationDedupeKey(type === 'skill' ? 'forge_skill' : type === 'plan' ? 'draft_plan' : 'entry_update'),
                operationKind: presentation.operationKind,
                title: presentation.title,
                summary: presentation.summary,
                detail: presentation.detail,
                sourceTag: presentation.sourceTag,
                targetEntryId: presentation.targetEntryId
            });

            // 核心逻辑：如果是规划完成，自动在 UI 展示（由 Store 驱动）
            // 如果是 ENTRY_UPDATE，通常意味着执行模型已完成重写，直接进入 StagingArea
            if (type === 'update') {
                this.stageDraftEntry(raw || content);
            }
        });
    }

    /**
     * 处理条目更新指令
     * <entry_update id="entry-123" description="重写性格描述">...新内容...</entry_update>
     */
    public async stageDraftEntry(xmlContent: string) {
        const updates = await this.extractEntryUpdate(xmlContent);
        
        for (const update of updates) {
            if (!update.targetEntryId) continue;

            if (update.action === 'delete') {
                // 如果是删除动作，且存在于暂存区，则直接移除；如果在工作区，则视为占位待确认（此处暂简处理为从暂存移除）
                const existingInStaging = this.forgeStore.stagingArea.find(s => s.targetEntryId === update.targetEntryId);
                if (existingInStaging) {
                    this.forgeStore.removeFromStaging(existingInStaging.id);
                }
                // 后续可扩展显式的 "marked_for_deletion" 状态
                continue;
            }

            this.forgeStore.upsertStagingEntry({
                targetEntryId: update.targetEntryId,
                proposedContent: update.content,
                description: update.description,
                category: update.category,
                originalContent: await this.resolveOriginalContentForEntry(update.targetEntryId),
                layer: (update.layer as any) || null,
                sourceTag: 'entry_update',
                sourceMessageId: null,
                sourceSessionId: this.forgeStore.currentSessionId
            });
        }
    }

    public requestLayerAdvance(targetLayer: ForgeLayer): void {
        this.forgeStore.addOperationTimelineItem({
            operationKind: 'user_action',
            status: 'completed',
            title: '请求推进设计层',
            summary: `请求切换到 ${targetLayer} 层`,
            sourceTag: 'forge_step_request',
            layer: targetLayer
        });
        this.parentApi.emit(FORGE_LAYER_ADVANCE_REQUESTED, targetLayer);
    }

    public submitFormResult(formId: string, digest: string): void {
        this.forgeStore.addOperationTimelineItem({
            operationKind: 'user_action',
            status: 'completed',
            title: '已提交表单结果',
            summary: `${formId} 已提交`,
            detail: digest,
            sourceTag: 'forge_form_result'
        });
        this.parentApi.emit(FORGE_FORM_RESULT_SUBMITTED, { formId, digest });
    }

    public applyPlannerIntent(intent: string): void {
        this.forgeStore.addOperationTimelineItem({
            operationKind: 'plan',
            status: 'completed',
            title: 'Planner 产出控制意图',
            summary: intent.trim() ? `规划意图：${intent}` : '收到空的规划意图',
            sourceTag: 'planner_intent'
        });

        const normalizedIntent = intent.trim();
        const layerMatch = normalizedIntent.match(/^(?:advance_layer|layer):([\w_]+)$/i);
        if (layerMatch) {
            this.requestLayerAdvance(layerMatch[1] as ForgeLayer);
            return;
        }

        if (/^freeze_workspace$/i.test(normalizedIntent)) {
            this.freezeWorkspaceDraft();
            return;
        }

        this.parentApi.emit(FORGE_PLANNER_INTENT_APPLIED, normalizedIntent);
    }

    public freezeWorkspaceDraft(): void {
        this.forgeStore.addOperationTimelineItem({
            operationKind: 'workspace_write',
            status: 'completed',
            title: '请求冻结虚拟工作区',
            summary: '控制层已请求冻结当前 commit-ready 草案',
            sourceTag: 'freeze_workspace'
        });
        this.parentApi.emit(FORGE_WORKSPACE_FREEZE_REQUESTED);
    }

    /**
     * 隔离执行重写任务 (Executor Role)
     * 发起一个不包含上下文历史的独立生成请求
     */
    public async runIsolatedRewrite(instruction: string, entryId: string, originalContentContent: string): Promise<void> {
        console.log(`[ForgeAgent] 启动隔离重写任务: ${entryId}`);
        this.forgeStore.isProcessing = true;
        try {
            const { useCardMakerStore } = await import('../../plugins/forge/CardMakerStore.js');
            await useCardMakerStore().runExecutorRewrite(instruction, entryId, originalContentContent);
        } finally {
            this.forgeStore.isProcessing = false;
        }
    }
}
