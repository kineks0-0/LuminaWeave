import type { ForgeRuntimeContext, ForgeRuntimeEffect } from '../../../../../types/ForgeRuntimeTypes.js';
import type {
    AgentRuntimeBeforeAgentStartEvent,
    AgentRuntimeBeforeAgentStartResult
} from '../../../agent-runtime/extensions/AgentRuntimeExtensionRunner.js';
import {
    forgePiToolBridge,
    type ForgePiAgentTool,
    type ForgePiToolBridge
} from '../tools/ForgePiToolBridge.js';
import { promptPresetRegistry } from '../../../hal/prompt/PromptPresetRegistry.js';
import { forgeAgentPresetResourceRegistry } from '../../presets/ForgeAgentPresetResourceRegistry.js';

export interface ForgePiExtensionRunnerDeps {
    toolBridge?: ForgePiToolBridge;
}

export class ForgePiExtensionRunner {
    private readonly toolBridge: ForgePiToolBridge;

    constructor(deps: ForgePiExtensionRunnerDeps = {}) {
        this.toolBridge = deps.toolBridge ?? forgePiToolBridge;
    }

    loadTools(context: ForgeRuntimeContext, onEffects?: (effects: ForgeRuntimeEffect[]) => void): ForgePiAgentTool[] {
        return this.toolBridge.getTools(context, onEffects);
    }

    async emitBeforeAgentStart(
        event: AgentRuntimeBeforeAgentStartEvent
    ): Promise<AgentRuntimeBeforeAgentStartResult> {
        return { systemPrompt: event.systemPrompt };
    }

    getLoadedExtensions(): string[] {
        const presetId = promptPresetRegistry.getActivePresetId('forge-agent');
        return forgeAgentPresetResourceRegistry
            .resolve(presetId)
            .extensions
            .map(extension => `${extension.source}:${extension.id}`);
    }
}

export const forgePiExtensionRunner = new ForgePiExtensionRunner();
