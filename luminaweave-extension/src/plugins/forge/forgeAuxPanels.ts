import type { ForgeAuxPanelKind } from '../../types/ForgeWorkflowTypes.js';

export interface ForgeAuxPanelMeta {
    id: string;
    title: string;
    shortLabel: string;
    icon: string;
}

export const FORGE_AUX_PANEL_ORDER: ForgeAuxPanelKind[] = [
    'lorebook',
    'memory',
    'export',
    'post_tracks',
    'test_chat'
];

export const FORGE_AUX_PANEL_META: Record<ForgeAuxPanelKind, ForgeAuxPanelMeta> = {
    lorebook: {
        id: 'forge_lorebook',
        title: '虚拟世界书',
        shortLabel: '世界书',
        icon: '📚'
    },
    memory: {
        id: 'forge_memory',
        title: '记忆管理',
        shortLabel: '记忆',
        icon: '🧠'
    },
    review: {
        id: 'forge_review',
        title: '审阅与暂存',
        shortLabel: '审阅',
        icon: '⚖️'
    },
    export: {
        id: 'forge_export',
        title: '导出发布',
        shortLabel: '导出',
        icon: '📦'
    },
    post_tracks: {
        id: 'forge_post_tracks',
        title: '后置轨',
        shortLabel: '后置轨',
        icon: '🪄'
    },
    test_chat: {
        id: 'forge_test_chat',
        title: '测试聊天',
        shortLabel: '测试聊天',
        icon: '💬'
    }
};
