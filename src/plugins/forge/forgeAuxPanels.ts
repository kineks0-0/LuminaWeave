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
    'test_chat',
    'dev_requests',
    'agent_inspector',
    'semantic_vfs',
    'workspace_versions'
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
        title: '历史暂存',
        shortLabel: '暂存',
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
    },
    dev_requests: {
        id: 'forge_dev_requests',
        title: '模型请求调试',
        shortLabel: '调试请求',
        icon: '🧪'
    },
    agent_inspector: {
        id: 'forge_agent_inspector',
        title: 'Agent 检视器',
        shortLabel: 'Agent',
        icon: '🔍'
    },
    semantic_vfs: {
        id: 'forge_semantic_vfs',
        title: '项目 VFS',
        shortLabel: 'VFS',
        icon: '🗂️'
    },
    workspace_versions: {
        id: 'forge_workspace_versions',
        title: '文件版本',
        shortLabel: '版本',
        icon: '🧾'
    }
};
