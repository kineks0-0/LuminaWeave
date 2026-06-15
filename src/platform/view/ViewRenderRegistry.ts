import { defineAsyncComponent, type Component } from 'vue';
import AlertBlock from '../../plugins/chat/components/blocks/AlertBlock.vue';
import BadgeBlock from '../../plugins/chat/components/blocks/BadgeBlock.vue';
import ChoiceBlock from '../../plugins/chat/components/blocks/ChoiceBlock.vue';
import ProgressBlock from '../../plugins/chat/components/blocks/ProgressBlock.vue';
import QuoteBlock from '../../plugins/chat/components/blocks/QuoteBlock.vue';
import SepBlock from '../../plugins/chat/components/blocks/SepBlock.vue';
import StatBlock from '../../plugins/chat/components/blocks/StatBlock.vue';

export type ViewRenderContext = 'chat' | 'forge';

const loadForgeBlockComponents = () => import('../../plugins/forge/blocks/forgeBlockComponents.js');

const ForgeChecklistBlock = defineAsyncComponent(() => loadForgeBlockComponents().then(module => module.ForgeChecklistBlock));
const ForgeChoiceBlock = defineAsyncComponent(() => loadForgeBlockComponents().then(module => module.ForgeChoiceBlock));
const ForgeChoiceGroupBlock = defineAsyncComponent(() => loadForgeBlockComponents().then(module => module.ForgeChoiceGroupBlock));
const ForgeFacetChecklistBlock = defineAsyncComponent(() => loadForgeBlockComponents().then(module => module.ForgeFacetChecklistBlock));
const ForgeFormBlock = defineAsyncComponent(() => loadForgeBlockComponents().then(module => module.ForgeFormBlock));
const ForgeInputBlock = defineAsyncComponent(() => loadForgeBlockComponents().then(module => module.ForgeInputBlock));
const ForgeLayerNavigatorBlock = defineAsyncComponent(() => loadForgeBlockComponents().then(module => module.ForgeLayerNavigatorBlock));
const ForgeMessageSubmitBlock = defineAsyncComponent(() => loadForgeBlockComponents().then(module => module.ForgeMessageSubmitBlock));
const ForgeEntryProposalBlock = defineAsyncComponent(() => loadForgeBlockComponents().then(module => module.ForgeEntryProposalBlock));
const ForgeMemoryProposalBlock = defineAsyncComponent(() => loadForgeBlockComponents().then(module => module.ForgeMemoryProposalBlock));
const ForgeMissingFieldsBlock = defineAsyncComponent(() => loadForgeBlockComponents().then(module => module.ForgeMissingFieldsBlock));
const ForgeModePickerBlock = defineAsyncComponent(() => loadForgeBlockComponents().then(module => module.ForgeModePickerBlock));
const ForgeSelectBlock = defineAsyncComponent(() => loadForgeBlockComponents().then(module => module.ForgeSelectBlock));
const ForgeSummaryCardBlock = defineAsyncComponent(() => loadForgeBlockComponents().then(module => module.ForgeSummaryCardBlock));
const ForgeTextareaBlock = defineAsyncComponent(() => loadForgeBlockComponents().then(module => module.ForgeTextareaBlock));
const ForgeAutoListBlock = defineAsyncComponent(() => loadForgeBlockComponents().then(module => module.ForgeAutoListBlock));
const ForgeFormAssistBlock = defineAsyncComponent(() => loadForgeBlockComponents().then(module => module.ForgeFormAssistBlock));

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
        this.register('forge', 'ForgeFormAssist', ForgeFormAssistBlock);
    }
}

export const viewRenderRegistry = new ViewRenderRegistry();
