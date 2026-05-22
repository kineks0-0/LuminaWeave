import type { ForgeRuntimeContext, ForgeRuntimeEffect } from '../../../../../types/ForgeRuntimeTypes.js';
import {
    forgePiToolBridge,
    type ForgePiAgentTool,
    type ForgePiToolBridge
} from '../tools/ForgePiToolBridge.js';

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

    getLoadedExtensions(): string[] {
        return ['@luminaweave/pi-forge-browser'];
    }
}

export const forgePiExtensionRunner = new ForgePiExtensionRunner();
