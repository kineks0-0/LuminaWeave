import { afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { PluginManager } from '../../../core/PluginManager.js';
import { createTestInitContextHarness } from '../../../core/__tests__/testInitContext.js';
import { initializeSurfaceRuntime } from '../../../platform/surface/initializeSurfaceRuntime.js';
import { globalXMLTagRegistry } from '@shared/XMLTagRegistry.js';
import { DirectorPlugin, globalMutationEngine, useDirectorStore, useTier1Store } from '../index.js';

const DIRECTOR_FRAGMENT_IDS = [
    'director-current-plan-protocol',
    'director-next-plan-protocol',
    'director-story-summary',
    'director-world-context-unified',
    'director-next-plan',
    'director-long-term-memory',
    'tier4-vector-recall',
    'mutation-engine-xml-docs'
];

describe('director plugin init(context)', () => {
    const manager = new PluginManager();
    const harness = createTestInitContextHarness();
    manager.setInitContextFactory(harness.factory);

    beforeAll(() => {
        initializeSurfaceRuntime();
    });
    beforeEach(() => {
        // 每个用例用全新的 Pinia，并清空全局引擎的模型表，避免依赖单例的初始状态。
        setActivePinia(createPinia());
        globalMutationEngine.models.clear();
    });
    afterEach(() => {
        manager.unregister(DirectorPlugin.id);
    });

    it('moves init to the platform manifest', () => {
        expect(DirectorPlugin.init).toBeUndefined();
        expect(typeof DirectorPlugin.platformManifest?.init).toBe('function');
    });

    it('registers prompts, xml handlers, memory providers, models and events through the context', async () => {
        await manager.registerAndInitialize(DirectorPlugin);

        const fragmentIds = harness.promptRegistry.getAllFragments().map(f => f.id);
        DIRECTOR_FRAGMENT_IDS.forEach(id => expect(fragmentIds).toContain(id));
        expect(fragmentIds.filter(id => id === 'director-story-summary')).toHaveLength(1);
        // 保留的是 init 中原本最后生效的那份（priority 100，chat/director 上下文）。
        const summary = harness.promptRegistry.getAllFragments().find(f => f.id === 'director-story-summary');
        expect(summary).toMatchObject({ priority: 100, contexts: ['chat', 'director'] });

        const providerIds = ['tier1', 'director', 'mutation'];
        const memory = harness.memoryManager as unknown as { providers: Map<string, unknown> };
        providerIds.forEach(id => expect(memory.providers.has(id)).toBe(true));

        ['global', 'characters', 'inventory', 'skills', 'plot', 'outline', 'summary'].forEach(target => {
            expect(globalMutationEngine.models.has(target)).toBe(true);
        });

        useDirectorStore().setStorySummary('old');
        harness.xmlInterceptor.processAndCleanText('<Next_Plan>go</Next_Plan><Story_Summary>new summary</Story_Summary>', true);
        expect(useDirectorStore().storySummary).toBe('new summary');
        expect(useDirectorStore().nextPlan).toBe('go');
        expect(harness.listeners.get('CHAT_CREATED')).toHaveLength(1);
    });

    it('revokes every registration after unregister', async () => {
        await manager.registerAndInitialize(DirectorPlugin);

        manager.unregister(DirectorPlugin.id);

        const fragmentIds = harness.promptRegistry.getAllFragments().map(f => f.id);
        DIRECTOR_FRAGMENT_IDS.forEach(id => expect(fragmentIds).not.toContain(id));
        const memory = harness.memoryManager as unknown as { providers: Map<string, unknown> };
        expect(memory.providers.size).toBe(0);
        expect(globalMutationEngine.models.size).toBe(0);
        expect(harness.listeners.get('CHAT_CREATED')).toHaveLength(0);

        useDirectorStore().setNextPlan('stale');
        harness.xmlInterceptor.processAndCleanText('<Next_Plan>after</Next_Plan>', true);
        expect(useDirectorStore().nextPlan).toBe('stale');
        ['Current_Plan', 'Next_Plan'].forEach(tag => {
            expect(globalXMLTagRegistry.getDefinition(tag)).toBeUndefined();
        });
        // Mutation 标签自带 core-default 定义，撤销后回到该定义。
        expect(globalXMLTagRegistry.getDefinition('Mutation')?.sourceId).toBe('core-default-mutation');
    });

    it('does not re-register global models when the tier1 getter is read after unregister', async () => {
        await manager.registerAndInitialize(DirectorPlugin);
        manager.unregister(DirectorPlugin.id);
        expect(globalMutationEngine.models.size).toBe(0);

        void useTier1Store().getFormattedTier1State;

        expect(globalMutationEngine.models.size).toBe(0);
    });

    it('can be registered again after unregister', async () => {
        await manager.registerAndInitialize(DirectorPlugin);
        manager.unregister(DirectorPlugin.id);

        await manager.registerAndInitialize(DirectorPlugin);

        expect(globalMutationEngine.models.has('inventory')).toBe(true);
        expect(useTier1Store().id).toBe('tier1');
    });
});
