import { LuminaPlugin } from '../../types/plugin';
import MemoryPanel from './components/MemoryPanel.vue';

export const MemoryPlugin: LuminaPlugin = {
    id: 'lumina-memory',
    name: '记忆概况引擎',
    icon: '<svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" stroke-width="2" fill="none"><path d="M4 22h14a2 2 0 0 0 2-2V7l-5-5H6a2 2 0 0 0-2 2v4"></path><path d="M14 2v4a2 2 0 0 0 2 2h4"></path><path d="M2 15h10"></path><path d="M6 12l-4 3 4 3"></path></svg>',
    slots: ['widget'],
    component: MemoryPanel,
    settingsManifest: {
        memoryMode: {
            label: "长线宏观记忆模式",
            type: "options",
            default: "async",
            common: true,
            options: [
                { label: "随显挂载 - 快/省Token", value: "piggyback" },
                { label: "独立后台总结 - 极稳", value: "async" }
            ],
            allowedScopes: ["Global", "Character"]
        },
        asyncInterval: {
            label: "Async 触发轮数间隔",
            type: "stepper",
            default: 10,
            min: 5,
            max: 50,
            step: 5,
            common: false,
            allowedScopes: ["Global"]
        }
    },
    init() {
        console.log('[LuminaMemory] Plugin initialized.');
    }
};
