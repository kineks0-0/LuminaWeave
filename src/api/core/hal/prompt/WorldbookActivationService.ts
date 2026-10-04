import type { CleanedMessage } from '../../../../types/nexus.js';
import type { ResourceDiagnostic, ResourceRef } from '@shared/resources/index.js';
import type { PromptWorldbookActivationSnapshot } from '../../../../types/PromptPresetTypes.js';
import { luminaWorldbookTriggerEngine } from '../resource/LuminaWorldbookTriggerEngine.js';
import type { PromptResourceBundle } from '../resource/PromptResourceResolver.js';

export interface WorldbookResourceResolver {
    resolve(refs: ResourceRef[]): Promise<PromptResourceBundle>;
}

export interface WorldbookActivationRequest {
    /** 已通过 binding / source selection 过滤的候选世界书 ref。 */
    refs?: ResourceRef[];
    /** 额外条目（角色卡内嵌 character_book 等）。 */
    entries?: LuminaLorebookEntry[];
    messages: CleanedMessage[];
    inputText?: string;
    maxWorldbookTokens?: number;
    maxTriggeredEntries?: number;
    estimateTokens?: (text: string) => number;
    random?: () => number;
}

export interface WorldbookActivationOutcome {
    activation: PromptWorldbookActivationSnapshot | null;
    diagnostics: ResourceDiagnostic[];
}

/**
 * 聊天管线用的世界书激活入口：
 * 解析 ResourceRef → 合并额外条目 → 触发引擎 → Prompt 组装可消费的 activation snapshot。
 */
export class WorldbookActivationService {
    constructor(private readonly resolver: WorldbookResourceResolver) {}

    public async activate(request: WorldbookActivationRequest): Promise<WorldbookActivationOutcome> {
        const bundle = request.refs && request.refs.length > 0
            ? await this.resolver.resolve(request.refs)
            : null;
        const entries = [...(bundle?.lorebookEntries ?? []), ...(request.entries ?? [])];
        const diagnostics: ResourceDiagnostic[] = [...(bundle?.diagnostics ?? [])];
        if (entries.length === 0) {
            return { activation: null, diagnostics };
        }

        const result = luminaWorldbookTriggerEngine.resolve(entries, {
            messages: request.messages,
            inputText: request.inputText,
            maxTriggeredEntries: request.maxTriggeredEntries,
            maxWorldbookTokens: request.maxWorldbookTokens,
            estimateTokens: request.estimateTokens,
            random: request.random
        });

        return {
            activation: {
                entries: result.activatedEntries,
                insertionBuckets: result.insertionBuckets,
                trace: result.trace,
                diagnostics: result.diagnostics
            },
            diagnostics: [...diagnostics, ...result.diagnostics]
        };
    }
}
