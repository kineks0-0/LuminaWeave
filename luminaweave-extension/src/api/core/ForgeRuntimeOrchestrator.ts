import type {
    ForgeExecutionRequest,
    ForgeRuntimeContext,
    ForgeRuntimeDecision,
    ForgeRuntimeEffect,
    ForgeRuntimeEvent,
    ForgeUserCommand
} from '../../types/ForgeRuntimeTypes.js';
import type { ForgeLayer } from '../../types/ForgeStructuredTypes.js';
import type { ForgeTimelineOperationKind } from '../../types/ForgeTimelineTypes.js';
import { ForgeExecutionGateway } from './ForgeExecutionGateway.js';
import { ForgeWorkflowGraph } from './ForgeWorkflowGraph.js';
import { extractBlocks } from '@shared/TagTokenizer.js';
import { parseEntryUpdates } from './utils/forgeEntryParser.js';
import { lwStorage } from '../storage.js';

export interface ForgeRuntimePort {
    getRuntimeContext(command: ForgeUserCommand, latestUserInput?: string): ForgeRuntimeContext;
    applyRuntimeEffects(effects: ForgeRuntimeEffect[]): Promise<void>;
    buildPlannerExecutionRequest(context: ForgeRuntimeContext): Promise<ForgeExecutionRequest>;
    buildAnalystExecutionRequest(context: ForgeRuntimeContext): Promise<ForgeExecutionRequest>;
    buildConversationExecutionRequest(context: ForgeRuntimeContext): Promise<ForgeExecutionRequest>;
    buildExecutorExecutionRequest(params: {
        instruction: string;
        entryId: string;
        originalContent: string;
        sourceCommand: ForgeUserCommand;
    }): Promise<ForgeExecutionRequest>;
    prepareAssistantStream(): void;
    handleRuntimeEvent(event: ForgeRuntimeEvent): void;
    resolveOriginalContent(targetEntryId: string | null): string;
    resolveEntryComment(targetEntryId: string | null): string | null;
}

type ParsedEntryUpdate = {
    targetEntryId: string | null;
    description: string;
    content: string;
};

type ParsedXmlAction = {
    attributes: Record<string, string>;
    content: string;
};

type ParsedFormPrefill = {
    formId: string | null;
    layer: ForgeLayer | null;
    fields: Array<{
        fieldKey: string;
        value: string | string[];
    }>;
};

export class ForgeRuntimeOrchestrator {
    constructor(
        private readonly port: ForgeRuntimePort,
        private readonly executionGateway: ForgeExecutionGateway = new ForgeExecutionGateway()
    ) {}

    private isModelFormPrefillEnabled(): boolean {
        return lwStorage.get('lumina-forge.enableModelFormPrefill', true, 'Global') !== false;
    }

    private parseAttributes(xmlOpenTag: string): Record<string, string> {
        const attributes: Record<string, string> = {};
        const attributeRegex = /([a-zA-Z_][\w:-]*)\s*=\s*(?:"([^"]*)"|'([^']*)'|(\S+))/g;
        let match: RegExpExecArray | null = null;
        while ((match = attributeRegex.exec(xmlOpenTag)) !== null) {
            attributes[match[1]] = match[2] ?? match[3] ?? match[4] ?? '';
        }
        return attributes;
    }

    private isForgeLayer(value: string | null | undefined): value is ForgeLayer {
        return value === 'concept'
            || value === 'entity'
            || value === 'state_machine'
            || value === 'description'
            || value === 'variables'
            || value === 'summary'
            || value === 'output';
    }

    private extractEntryUpdate(xmlContent: string): any[] {
        return parseEntryUpdates(xmlContent);
    }

    private extractXmlAction(xmlContent: string, tagName: string): ParsedXmlAction {
        const openTagMatch = xmlContent.match(new RegExp(`^<${tagName}\\b[^>]*>`, 'i'));
        const openTag = openTagMatch?.[0] || '';
        const attributes = this.parseAttributes(openTag);
        const content = xmlContent
            .replace(new RegExp(`^<${tagName}\\b[^>]*>`, 'i'), '')
            .replace(new RegExp(`</${tagName}>$`, 'i'), '')
            .trim();

        return {
            attributes,
            content
        };
    }

    private normalizePrefillValue(rawValue: string, attributes: Record<string, string>): string | string[] {
        const normalized = rawValue.trim();
        const valueType = String(attributes.type || attributes.value_type || '').toLowerCase();
        const shouldSplitList = valueType === 'array' || valueType === 'list' || attributes.multiple === 'true';
        if (!shouldSplitList) {
            return normalized;
        }

        if (!normalized) {
            return [];
        }

        return normalized.split('|').map(item => item.trim()).filter(Boolean);
    }

    private extractFormPrefill(xmlContent: string, fallbackLayer: ForgeLayer): ParsedFormPrefill {
        const openTagMatch = xmlContent.match(/^<form_prefill\b[^>]*>/i);
        const openTag = openTagMatch?.[0] || '';
        const attributes = this.parseAttributes(openTag);
        const content = xmlContent
            .replace(/^<form_prefill\b[^>]*>/i, '')
            .replace(/<\/form_prefill>$/i, '')
            .trim();
        const layer = this.isForgeLayer(attributes.layer) ? attributes.layer : fallbackLayer;
        const fieldBlocks = extractBlocks(content, new Set(['field']));
        const fields = fieldBlocks
            .map((block) => {
                const fieldOpenTag = content.slice(block.outerStart, block.innerStart);
                const fieldAttributes = this.parseAttributes(fieldOpenTag);
                const fieldKey = fieldAttributes.key || fieldAttributes.field || fieldAttributes.name || '';
                if (!fieldKey) {
                    return null;
                }

                return {
                    fieldKey,
                    value: this.normalizePrefillValue(block.content, fieldAttributes)
                };
            })
            .filter((item): item is NonNullable<typeof item> => Boolean(item));

        return {
            formId: attributes.form || attributes.form_id || attributes.formId || null,
            layer,
            fields
        };
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
        if (normalized === 'memory_update') {
            return {
                operationKind: 'memory_update',
                title: '正在整理 Forge 记忆'
            };
        }
        if (normalized === 'context_read') {
            return {
                operationKind: 'context_read',
                title: '正在读取上下文'
            };
        }
        if (normalized === 'analysis_handoff') {
            return {
                operationKind: 'plan',
                title: '正在整理分析回执'
            };
        }
        if (normalized === 'form_prefill') {
            return {
                operationKind: 'plan',
                title: '正在预填结构化表单'
            };
        }
        return {
            operationKind: 'system',
            title: '正在处理 Forge 操作'
        };
    }

    private buildEventEffects(event: ForgeRuntimeEvent, context: ForgeRuntimeContext): ForgeRuntimeEffect[] {
        if (event.type === 'trace') {
            const presentation = this.resolveRunningOperationPresentation(event.tag);
            return [{
                type: 'upsert_running_operation',
                dedupeKey: this.getOperationDedupeKey(event.tag),
                operationKind: presentation.operationKind,
                title: presentation.title,
                summary: event.status || 'Forge 正在执行中',
                sourceTag: event.tag,
                layer: context.activeLayer
            }];
        }

        if (event.type === 'prompt_ready') {
            const promptMode = context.workflowSnapshot?.promptMode || 'planner';
            let dedupeTag = 'draft_plan';
            if (promptMode === 'analyst') dedupeTag = 'analysis_handoff';
            if (promptMode === 'executor') dedupeTag = 'entry_update';
            if (promptMode === 'conversation') dedupeTag = 'forge';

            return [{
                type: 'log_operation_prompt',
                dedupeKey: this.getOperationDedupeKey(dedupeTag),
                prompt: event.prompt
            }];
        }

        if (event.type !== 'action_completed') {
            return [];
        }

        if (event.actionType === 'skill') {
            const openTagMatch = event.raw.match(/^<([a-zA-Z_][\w:-]*)\b[^>]*>/i);
            const attrs = this.parseAttributes(openTagMatch?.[0] || '');
            const skillName = attrs.name || attrs.skill || attrs.title || '未命名技能';
            return [{
                type: 'complete_operation',
                dedupeKey: this.getOperationDedupeKey('forge_skill'),
                operationKind: 'execution',
                title: `已执行技能 · ${skillName}`,
                summary: event.content.trim() || '技能执行完成',
                detail: event.raw,
                sourceTag: openTagMatch?.[1] || 'forge_skill',
                layer: context.activeLayer
            }];
        }

        if (event.actionType === 'plan') {
            return [{
                type: 'complete_operation',
                dedupeKey: this.getOperationDedupeKey('draft_plan'),
                operationKind: 'plan',
                title: '已生成下一步规划',
                summary: event.content.trim() || '规划结果已生成',
                detail: event.raw,
                sourceTag: 'draft_plan',
                layer: context.activeLayer
            }];
        }

        if (event.actionType === 'memory') {
            const parsed = this.extractXmlAction(event.raw, 'memory_update');
            const path = parsed.attributes.path || '规划/待确认问题';
            const title = parsed.attributes.title || path.split('/').slice(-1)[0] || 'Forge 记忆';
            const summary = parsed.attributes.summary || event.content.trim() || path;
            const remove = parsed.attributes.action === 'remove' || parsed.attributes.remove === 'true';

            return remove
                ? [{ type: 'memory_remove', path, dedupeKey: this.getOperationDedupeKey('memory_update') }]
                : [{
                    type: 'memory_upsert',
                    path,
                    title,
                    content: parsed.content || event.content.trim(),
                    summary,
                    source: 'analyst',
                    dedupeKey: this.getOperationDedupeKey('memory_update')
                }];
        }

        if (event.actionType === 'context') {
            const parsed = this.extractXmlAction(event.raw, 'context_read');
            const target = parsed.attributes.target || 'unknown';
            const summary = parsed.attributes.summary || event.content.trim() || target;
            const kind = (parsed.attributes.kind || parsed.attributes.scope || '').toLowerCase();
            const contextDedupeKey = this.getOperationDedupeKey('context_read');

            if (kind === 'memory') {
                return [{ type: 'memory_read', path: target, summary, dedupeKey: contextDedupeKey }];
            }

            if (kind === 'lorebook') {
                return [{ type: 'lorebook_read', target, summary, dedupeKey: contextDedupeKey }];
            }

            return [{ type: 'history_read', target, summary, dedupeKey: contextDedupeKey }];
        }

        if (event.actionType === 'handoff') {
            const parsed = this.extractXmlAction(event.raw, 'analysis_handoff');
            const summary = parsed.attributes.summary || parsed.content || '分析阶段已整理出下一步建议。';
            return [{
                type: 'memory_upsert',
                path: '规划/待确认问题',
                title: '分析阶段回执',
                content: parsed.content || summary,
                summary,
                source: 'analyst',
                dedupeKey: this.getOperationDedupeKey('analysis_handoff')
            }];
        }

        if (event.actionType === 'prefill') {
            if (!this.isModelFormPrefillEnabled()) {
                return [];
            }

            const parsed = this.extractFormPrefill(event.raw, context.activeLayer);
            if (parsed.fields.length === 0) {
                return [];
            }

            return [
                {
                    type: 'complete_operation',
                    dedupeKey: this.getOperationDedupeKey('form_prefill'),
                    operationKind: 'plan',
                    title: '已预填结构化表单',
                    summary: `已生成 ${parsed.fields.length} 个字段建议值`,
                    detail: event.raw,
                    sourceTag: 'form_prefill',
                    layer: parsed.layer || context.activeLayer
                },
                {
                    type: 'prefill_structured_form',
                    formId: parsed.formId,
                    layer: parsed.layer,
                    fields: parsed.fields
                }
            ];
        }


        const updates = this.extractEntryUpdate(event.raw);
        if (updates.length === 0) {
            return [];
        }

        const effects: ForgeRuntimeEffect[] = [
            {
                type: 'complete_operation',
                dedupeKey: this.getOperationDedupeKey('entry_update'),
                operationKind: 'workspace_write',
                title: updates.length === 1 ? `已生成条目修改 · ${updates[0].targetEntryId}` : `已生成批量条目修改 (${updates.length})`,
                summary: updates[0].description || '条目修改建议已生成',
                detail: event.raw,
                sourceTag: 'entry_update',
                targetEntryId: updates.length === 1 ? updates[0].targetEntryId : null,
                layer: (updates[0].layer as any) || context.activeLayer
            }
        ];

        for (const update of updates) {
            if (!update.targetEntryId) continue;

            if (update.action === 'delete') {
                // TODO: 需寻找 stagingId 而非 targetEntryId。此处暂根据 targetEntryId 标记移除需求。
                // 暂时利用已有的 remove_staging_entry，后续可能需要根据 targetEntryId 匹配。
                const existing = context.stagingEntries.find(s => s.targetEntryId === update.targetEntryId);
                if (existing) {
                    effects.push({ type: 'remove_staging_entry', stagingId: existing.id });
                }
                continue;
            }

            effects.push({
                type: 'upsert_staging_entry',
                entry: {
                    targetEntryId: update.targetEntryId,
                    proposedContent: update.content,
                    description: update.description,
                    originalContent: this.port.resolveOriginalContent(update.targetEntryId),
                    layer: (update.layer as any) || context.activeLayer,
                    sourceTag: 'entry_update',
                    sourceMessageId: context.activeLeafId,
                    sourceSessionId: context.workspaceSessionId
                }
            });
        }

        return effects;
    }

    private getCommandInput(command: ForgeUserCommand): string | undefined {
        if (command.type === 'send_user_input') {
            return command.input;
        }
        if (command.type === 'submit_form') {
            return command.userInput;
        }
        if (command.type === 'refresh_workflow') {
            return command.userInput;
        }
        return undefined;
    }

    private async runPlanner(command: ForgeUserCommand): Promise<void> {
        this.port.prepareAssistantStream();
        const commandInput = this.getCommandInput(command);
        const context = this.port.getRuntimeContext(command, commandInput);
        const request = await this.port.buildPlannerExecutionRequest(context);
        
        console.log('[Orchestrator] 启动 Planner 阶段:', {
            mode: request.mode,
            contextLeafId: context.activeLeafId,
            presetId: request.presetId
        });

        await this.runRequest(command, request);
    }

    private async runConversation(command: ForgeUserCommand): Promise<void> {
        this.port.prepareAssistantStream();
        const commandInput = this.getCommandInput(command);
        const context = this.port.getRuntimeContext(command, commandInput);
        const request = await this.port.buildConversationExecutionRequest(context);
        await this.runRequest(command, request);
    }

    private async runAnalyst(command: ForgeUserCommand): Promise<void> {
        const commandInput = this.getCommandInput(command);
        const context = this.port.getRuntimeContext(command, commandInput);
        const request = await this.port.buildAnalystExecutionRequest(context);

        // trace 效果（upsertRunningOperation）即发即忘，提供流式过程中的实时 UI 反馈。
        // action_completed 效果（completeOperationByKey / memory_upsert 等）收集起来，
        // 在 gateway 结束后统一 await，确保所有"读取上下文"等操作在 Planner 启动前
        // 已经完成状态更新，避免 timeline 显示 running 而 Planner 已开始回复的竞态。
        const pendingCompletionEffects: Array<() => Promise<void>> = [];

        await this.executionGateway.run(request, {
            onEvent: (event) => {
                if (event.type !== 'trace' && event.type !== 'action_completed') {
                    return;
                }
                const latestContext = this.port.getRuntimeContext(command, commandInput);
                const effects = this.buildEventEffects(event, latestContext);
                if (effects.length === 0) return;

                if (event.type === 'trace') {
                    // trace 事件：即时刷新 UI，不阻塞流式回调
                    void this.port.applyRuntimeEffects(effects);
                } else {
                    // action_completed 事件：延迟到 gateway 返回后统一 await
                    pendingCompletionEffects.push(() => this.port.applyRuntimeEffects(effects));
                }
            }
        });

        // 按序 await 所有 action_completed 效果，保证 Planner 启动前状态已落定
        for (const apply of pendingCompletionEffects) {
            await apply();
        }

        await this.port.applyRuntimeEffects([
            { type: 'refresh_workflow', userInput: commandInput },
            { type: 'persist_session' }
        ]);

        await this.runPlanner(command);
    }

    private async runRequest(command: ForgeUserCommand, request: ForgeExecutionRequest): Promise<void> {
        await this.executionGateway.run(request, {
            onEvent: (event) => {
                this.port.handleRuntimeEvent(event);
                const latestContext = this.port.getRuntimeContext(command, this.getCommandInput(command));
                const effects = this.buildEventEffects(event, latestContext);
                if (effects.length > 0) {
                    void this.port.applyRuntimeEffects(effects);
                }
            }
        });
        await this.port.applyRuntimeEffects([
            { type: 'refresh_workflow', userInput: this.getCommandInput(command) },
            { type: 'persist_session' }
        ]);
    }

    async dispatch(command: ForgeUserCommand): Promise<ForgeRuntimeDecision> {
        const commandInput = this.getCommandInput(command);
        const context = this.port.getRuntimeContext(command, commandInput);
        const decision = await ForgeWorkflowGraph.resolveDecision(context);
        
        console.log('[Orchestrator] 调度决策结果:', {
            command: command.type,
            detailMode: context.detailMode,
            requiresGeneration: decision.requiresGeneration,
            executionMode: decision.executionRequest?.mode,
            effectsCount: decision.effects.length
        });

        if (decision.effects.length > 0) {
            await this.port.applyRuntimeEffects(decision.effects);
        }

        if (decision.requiresGeneration && command.type !== 'noop') {
            if (decision.executionRequest?.mode === 'conversation') {
                await this.runConversation(command);
            } else if (decision.executionRequest?.mode === 'analyst') {
                await this.runAnalyst(command);
            } else {
                await this.runPlanner(command);
            }
        } else if (!decision.requiresGeneration && (command.type === 'submit_form' || command.type === 'advance_layer')) {
            console.warn('[Orchestrator] 表单已提交但被决策判定为不需要生成模型回复。可能原因：kickoff 尚未完成或 detailMode 为空。');
        }

        return decision;
    }

    async runExecutorRewrite(instruction: string, entryId: string, originalContent: string): Promise<void> {
        const command: ForgeUserCommand = { type: 'noop' };
        const request = await this.port.buildExecutorExecutionRequest({
            instruction,
            entryId,
            originalContent,
            sourceCommand: command
        });

        await this.executionGateway.run(request, {
            onEvent: (event) => {
                this.port.handleRuntimeEvent(event);
                const context = this.port.getRuntimeContext(command);
                const effects = this.buildEventEffects(event, context);
                if (effects.length > 0) {
                    void this.port.applyRuntimeEffects(effects);
                }
            }
        });

        await this.port.applyRuntimeEffects([
            { type: 'refresh_workflow' },
            { type: 'persist_session' }
        ]);
    }
}
