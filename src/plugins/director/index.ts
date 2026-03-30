import { globalXMLInterceptor } from '../../api/core/XMLInterceptor';
import { globalPromptRegistry, PromptSlot, STIdentifier } from '../../api/core/PromptRegistry';
import { globalMemoryManager } from '../../api/core/MemoryManager';

// 导出核心引擎组件
export * from './DirectorStore';
export { globalMutationEngine } from './MutationEngine'; // 增量更新引擎
export { useTier1Store } from './Tier1Store'; // Tier 1 Vue 状态管理 (物品栏等)

import { LuminaPlugin } from '../../types/plugin';
import DirectorPanel from './components/DirectorPanel.vue';
import { useDirectorStore } from './DirectorStore';
import { useTier1Store } from './Tier1Store';
import { globalMutationEngine, MutationCommand } from './MutationEngine';
import { globalAsyncGateway } from './AsyncGateway';

// 注册全局插件并挂载设置项和悬浮面板
export const DirectorPlugin: LuminaPlugin = {
    id: 'lumina-director',
    name: '导演核心引擎',
    icon: '<svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" stroke-width="2" fill="none"><circle cx="12" cy="12" r="10"></circle><polygon points="10 8 16 12 10 16 10 8"></polygon></svg>',
    slots: ['widget'], // 投射到小侧边栏
    component: DirectorPanel,
    settingsManifest: {
        orchestrationMode: {
            label: "请求编排与规划模式",
            type: "options",
            default: "piggyback",
            common: true,
            options: [
                { label: "随显挂载 - 快/省Token", value: "piggyback" },
                { label: "独立后台推演 - 极稳", value: "async" }
            ],
            allowedScopes: ["Global", "Character"]
        },
        enableVectorMemory: {
            label: "启用类人向量记忆",
            description: "基于语义搜索动态检索并注入历史瞬间",
            type: "boolean",
            default: true,
            common: true,
            allowedScopes: ["Global", "Character"]
        }
    },
    init() {
        // --- 1. 确保 Store 激活并绑定 Mutation 模型 ---
        useTier1Store().initializeModels();
        useDirectorStore().initializeModels();

        // --- 2. 注册至核心记忆管理器 (State Management) ---
        globalMemoryManager.registerProvider(useTier1Store() as any);
        globalMemoryManager.registerProvider(useDirectorStore() as any);
        globalMemoryManager.registerProvider({
            id: 'mutation',
            exportSnapshot: () => null,
            importSnapshot: () => { },
            reset: () => globalMutationEngine.clearCache(),
            flushDeltas: () => globalMutationEngine.flushDeltas(),
            applyDelta: (d: unknown) => globalMutationEngine.applyDelta(d as MutationCommand)
        });

        // --- 3. 注册 XML 解析器 ---
        globalXMLInterceptor.registerXMLParser('Current_Plan', 'ephemeral', (content) => {
            useDirectorStore().setCurrentPlan(content.trim());
            return '';
        });

        globalXMLInterceptor.registerXMLParser('Next_Plan', 'ephemeral', (content) => {
            useDirectorStore().setNextPlan(content.trim());
            return '';
        });

        // --- 4. 注册 XML 协议说明 ---
        globalPromptRegistry.register({
            id: 'director-current-plan-protocol',
            slot: PromptSlot.ST_MAIN,
            targetIdentifier: STIdentifier.MAIN,
            priority: 10,
            xmlTags: [{
                tag: 'Current_Plan',
                description: '参考上回合的 <Next_Plan> 指导与本次用户输入，简要说明你对当前回合的短期剧情意图。',
                statusText: '制定意图中...',
                anchor: 'Chat_Reply',
                position: 'before',
                priority: 10
            }],
            getFragment: () => null
        });

        globalPromptRegistry.register({
            id: 'director-next-plan-protocol',
            slot: PromptSlot.ST_MAIN,
            targetIdentifier: STIdentifier.MAIN,
            priority: 20,
            xmlTags: [{
                tag: 'Next_Plan',
                description: '根据当前局势演变，简要说明你对下一轮的剧情伏笔或行动规划指令。这将指导下回合生成。',
                statusText: '制定计划中...',
                anchor: 'Chat_Reply',
                position: 'after',
                priority: 60
            }],
            getFragment: () => null
        });

        // --- 5. 监听核心事件 ---
        // 显式监听新对话创建事件，执行状态重置 (满足用户对“监听处理”的要求)
        if (typeof (window as any).LuminaWeave?.on === 'function') {
            (window as any).LuminaWeave.on('CHAT_CREATED', () => {
                console.log('[LuminaDirector] 监听到新对话创建事件，正在重置引擎状态...');
                const store = useDirectorStore();
                store.reset();
            });
        }

        console.log('[LuminaDirector] Plugin initialized with central memory support.');
    },
    hooks: {
        onMessageAdding(newMsg, currentTrace) {
            // 调度核心记忆管理器的状态捕获 (处理 Deltas 与 Snapshots)
            // 核心修复：仅对 AI 节点执行捕获，用户节点不保存独立记忆快照
            if (!newMsg.is_user) {
                globalMemoryManager.captureState(newMsg, currentTrace);
            }

            // 额外绑定：将当前规划也存入 extra 方便回溯可视化/调试
            const directorStore = useDirectorStore();
            if (directorStore.currentPlan) newMsg.extra.currentPlan = directorStore.currentPlan;
            if (directorStore.nextPlan) newMsg.extra.nextPlan = directorStore.nextPlan;
        },
        onMessageAdded(newMsg, currentTrace) {
            if (!newMsg.is_user) {
                if (globalAsyncGateway.shouldTriggerBackgroundPlanning(currentTrace)) {
                    globalAsyncGateway.triggerPlotPlanning(currentTrace);
                }
            }
        },
        onMessageSelected(nodeId, trace) {
            // 执行核心回溯逻辑
            globalMemoryManager.restoreState(nodeId, trace);
            console.log(`[LuminaDirector] Node ${nodeId} state restored via MemoryManager.`);
        },
        onChatLoaded(activeLeafId, nodePool) {
            console.log(`[LuminaDirector] chat loaded: ${activeLeafId}, nodes: ${nodePool?.length || 0}`);
            
            // 核心增强：如果是新对话（节点池为空），则执行物理重置逻辑
            if (!nodePool || nodePool.length === 0) {
                console.log('[LuminaDirector] New chat detected, resetting all engine states.');
                const store = useDirectorStore();
                const tier1 = useTier1Store();
                store.reset();
                tier1.reset();
                globalMemoryManager.resetAll();
            }
        },
        onMetadataExport(metadata: any) {
            // 已移除：不再导出全量状态，强制依赖 Timeline 节点回溯
            metadata.director_sync_v2 = true;
        },
        onMetadataImport(metadata: any) {
            // 已移除：不再导入全量状态，状态恢复由 ChatManager 触发的 onMessageSelected 处理
        }
    }
};
