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
        fullLimitType: {
            label: "全量对话限制类型",
            type: "options",
            default: "count",
            common: true,
            options: [
                { label: "按消息条数", value: "count" },
                { label: "按 Token 数量", value: "token" },
                { label: "按字符长度", value: "char" }
            ],
            allowedScopes: ["Global", "Character"]
        },
        fullLimitValueCount: {
            label: "全量对话限制值 (条数)",
            type: "stepper",
            default: 20,
            min: 1,
            max: 500,
            step: 1,
            common: true,
            allowedScopes: ["Global", "Character"],
            showIf: (s) => s['lumina-director.fullLimitType'] === 'count'
        },
        fullLimitValueToken: {
            label: "全量对话限制值 (Token)",
            type: "stepper",
            default: 2000,
            min: 100,
            max: 8000,
            step: 100,
            common: true,
            allowedScopes: ["Global", "Character"],
            showIf: (s) => s['lumina-director.fullLimitType'] === 'token'
        },
        fullLimitValueChar: {
            label: "全量对话限制值 (字符数)",
            type: "stepper",
            default: 5000,
            min: 100,
            max: 20000,
            step: 100,
            common: true,
            allowedScopes: ["Global", "Character"],
            showIf: (s) => s['lumina-director.fullLimitType'] === 'char'
        },
        fullSplit: {
            label: "溢出时强制分割",
            description: "如果关闭，将允许内容在浮动比例内超过限制而不被隐藏",
            type: "boolean",
            default: false,
            common: true,
            allowedScopes: ["Global"]
        },
        fullFloating: {
            label: "非分割模式浮动比例 (%)",
            type: "stepper",
            default: 10,
            min: 0,
            max: 50,
            step: 1,
            common: true,
            allowedScopes: ["Global"],
            showIf: (s) => s['lumina-director.fullLimitType'] !== 'count' && s['lumina-director.fullSplit'] === false
        },
        enableVectorMemory: {
            label: "启用类人向量记忆",
            description: "基于语义搜索动态检索并注入历史瞬间",
            type: "boolean",
            default: true,
            common: true,
            allowedScopes: ["Global", "Character"]
        },
        memoryMode: {
            label: "长线记忆同步模式",
            type: "options",
            default: "async",
            common: true,
            options: [
                { label: "随显挂载 - 快/省Token", value: "piggyback" },
                { label: "独立后台总结 - 极稳", value: "async" }
            ],
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

        globalXMLInterceptor.registerXMLParser('Story_Summary', 'persistent', (content) => {
            useDirectorStore().setStorySummary(content.trim());
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
            }, {
                tag: 'Story_Summary',
                description: '凝练地总结并更新当前的剧情概况。这将作为长线背景通过世界书同步。',
                statusText: '总结剧情中...',
                anchor: 'Next_Plan',
                position: 'after',
                priority: 70
            }],
            getFragment: () => null
        });

        // 注册剧情概况作为虚拟世界书条目 (长线背景)
        globalPromptRegistry.register({
            id: 'director-story-summary',
            slot: PromptSlot.ST_MAIN,
            label: 'Story Summary',
            priority: 100,
            getFragment: () => {
                const summary = useDirectorStore().storySummary;
                if (!summary) return null;
                return `[剧情前情提要]\n${summary}`;
            }
        });

        // --- 5. 监听核心事件与范围控制启动 ---
        if (typeof (window as any).LuminaWeave?.on === 'function') {
            (window as any).LuminaWeave.on('CHAT_CREATED', () => {
                console.log('[LuminaDirector] 监听到新对话创建事件，正在重置引擎状态...');
                const store = useDirectorStore();
                store.reset();
            });
            
            // 启动消息范围同步器
            (window as any).LuminaWeave.on('MESSAGE_RECEIVED', () => {
                import('./MemoryController').then(m => m.globalMemoryController.syncVisibility());
            });
        }

        console.log('[LuminaDirector] Plugin initialized with central memory and scope control.');
    },
    hooks: {
        onMessageAdding(newMsg, currentTrace) {
            // 调度核心记忆管理器的状态捕获 (处理 Deltas 与 Snapshots)
            if (!newMsg.is_user) {
                globalMemoryManager.captureState(newMsg, currentTrace);
            }

            // 额外绑定：将当前规划也存入 extra 方便回溯可视化/调试
            const directorStore = useDirectorStore();
            if (directorStore.currentPlan) newMsg.extra.currentPlan = directorStore.currentPlan;
            if (directorStore.nextPlan) newMsg.extra.nextPlan = directorStore.nextPlan;
            if (directorStore.storySummary) newMsg.extra.storySummary = directorStore.storySummary;
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
            metadata.director_sync_v3 = true;
        }
    }
};
