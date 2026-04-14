import type { Component } from 'vue';
import AlertBlock from '../../plugins/chat/components/blocks/AlertBlock.vue';
import BadgeBlock from '../../plugins/chat/components/blocks/BadgeBlock.vue';
import ChoiceBlock from '../../plugins/chat/components/blocks/ChoiceBlock.vue';
import ProgressBlock from '../../plugins/chat/components/blocks/ProgressBlock.vue';
import QuoteBlock from '../../plugins/chat/components/blocks/QuoteBlock.vue';
import SepBlock from '../../plugins/chat/components/blocks/SepBlock.vue';
import StatBlock from '../../plugins/chat/components/blocks/StatBlock.vue';
import ForgeChecklistBlock from '../../plugins/forge/blocks/ForgeChecklistBlock.vue';
import ForgeChoiceBlock from '../../plugins/forge/blocks/ForgeChoiceBlock.vue';
import ForgeChoiceGroupBlock from '../../plugins/forge/blocks/ForgeChoiceGroupBlock.vue';
import ForgeFacetChecklistBlock from '../../plugins/forge/blocks/ForgeFacetChecklistBlock.vue';
import ForgeFormBlock from '../../plugins/forge/blocks/ForgeFormBlock.vue';
import ForgeInputBlock from '../../plugins/forge/blocks/ForgeInputBlock.vue';
import ForgeLayerNavigatorBlock from '../../plugins/forge/blocks/ForgeLayerNavigatorBlock.vue';
import ForgeMessageSubmitBlock from '../../plugins/forge/blocks/ForgeMessageSubmitBlock.vue';
import ForgeEntryProposalBlock from '../../plugins/forge/blocks/ForgeEntryProposalBlock.vue';
import ForgeMemoryProposalBlock from '../../plugins/forge/blocks/ForgeMemoryProposalBlock.vue';
import ForgeMissingFieldsBlock from '../../plugins/forge/blocks/ForgeMissingFieldsBlock.vue';
import ForgeModePickerBlock from '../../plugins/forge/blocks/ForgeModePickerBlock.vue';
import ForgeSelectBlock from '../../plugins/forge/blocks/ForgeSelectBlock.vue';
import ForgeSummaryCardBlock from '../../plugins/forge/blocks/ForgeSummaryCardBlock.vue';
import ForgeTextareaBlock from '../../plugins/forge/blocks/ForgeTextareaBlock.vue';
import ForgeAutoListBlock from '../../plugins/forge/blocks/ForgeAutoListBlock.vue';

export type ViewRenderContext = 'chat' | 'forge';

class ViewRenderRegistry {
    private readonly registry = new Map<string, Map<ViewRenderContext, Component>>();

    constructor() {
        this.registerDefaults();
    }

    register(context: ViewRenderContext, componentName: string, component: Component): void {
        const normalizedName = componentName.trim();
        const contextMap = this.registry.get(normalizedName) || new Map<ViewRenderContext, Component>();
        contextMap.set(context, component);
        this.registry.set(normalizedName, contextMap);
    }

    resolve(context: ViewRenderContext, componentName: string): Component | null {
        const contextMap = this.registry.get(componentName);
        if (!contextMap) return null;
        return contextMap.get(context) || contextMap.get('chat') || null;
    }

    private registerDefaults(): void {
        this.register('chat', 'Stat', StatBlock);
        this.register('chat', 'Progress', ProgressBlock);
        this.register('chat', 'Choices', ChoiceBlock);
        this.register('chat', 'Badge', BadgeBlock);
        this.register('chat', 'Alert', AlertBlock);
        this.register('chat', 'Quote', QuoteBlock);
        this.register('chat', 'Sep', SepBlock);

        this.register('forge', 'Stat', StatBlock);
        this.register('forge', 'Progress', ProgressBlock);
        this.register('forge', 'Choices', ForgeChoiceBlock);
        this.register('forge', 'Badge', BadgeBlock);
        this.register('forge', 'Alert', AlertBlock);
        this.register('forge', 'Quote', QuoteBlock);
        this.register('forge', 'Sep', SepBlock);
        this.register('forge', 'ForgeModePicker', ForgeModePickerBlock);
        this.register('forge', 'ForgeForm', ForgeFormBlock);
        this.register('forge', 'ForgeInput', ForgeInputBlock);
        this.register('forge', 'ForgeTextarea', ForgeTextareaBlock);
        this.register('forge', 'ForgeSelect', ForgeSelectBlock);
        this.register('forge', 'ForgeChecklist', ForgeChecklistBlock);
        this.register('forge', 'ForgeChoiceGroup', ForgeChoiceGroupBlock);
        this.register('forge', 'ForgeFacetChecklist', ForgeFacetChecklistBlock);
        this.register('forge', 'ForgeMessageSubmit', ForgeMessageSubmitBlock);
        this.register('forge', 'ForgeLayerNavigator', ForgeLayerNavigatorBlock);
        this.register('forge', 'ForgeSummaryCard', ForgeSummaryCardBlock);
        this.register('forge', 'ForgeMissingFields', ForgeMissingFieldsBlock);
        this.register('forge', 'ForgeEntryProposal', ForgeEntryProposalBlock);
        this.register('forge', 'ForgeMemoryProposal', ForgeMemoryProposalBlock);
        this.register('forge', 'ForgeAutoList', ForgeAutoListBlock);
    }
}

export const viewRenderRegistry = new ViewRenderRegistry();
