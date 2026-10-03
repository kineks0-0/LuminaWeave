import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
import type { SyncState } from '../../../api/core/conversation/ChatManager.js';
import { getSettingsHostApi } from '../settingsHost.js';

const SYNC_STATUS_LABELS: Record<SyncState['status'], string> = {
    idle: '就绪',
    syncing: '同步中',
    success: '已同步',
    error: '同步异常'
};

const createIdleState = (): SyncState => ({
    status: 'idle',
    lastSync: 'never',
    details: { messageCount: 0, stCount: 0, diffCount: 0, duration: 0, source: 'ST' }
});

/** 订阅宿主同步状态；宿主不可用时保持“就绪”空状态 */
export function useSettingsSyncStatus() {
    const syncState = ref<SyncState>(createIdleState());
    const diffCount = ref(0);

    const refresh = (): void => {
        const host = getSettingsHostApi();
        if (!host?.syncState) return;
        syncState.value = { ...host.syncState, details: { ...host.syncState.details } };
        diffCount.value = host.syncState.details.diffCount;
    };

    const statusLabel = computed(() => SYNC_STATUS_LABELS[syncState.value.status] ?? '未知');

    onMounted(() => {
        refresh();
        const host = getSettingsHostApi();
        host?.on('CHAT_UPDATED', refresh);
        host?.on('CHAT_CONFLICT', refresh);
    });

    onBeforeUnmount(() => {
        const host = getSettingsHostApi();
        host?.off('CHAT_UPDATED', refresh);
        host?.off('CHAT_CONFLICT', refresh);
    });

    return { syncState, diffCount, statusLabel, refresh };
}
