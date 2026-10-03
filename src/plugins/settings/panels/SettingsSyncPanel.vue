<template>
  <SettingsSectionPanel>
    <SettingsBlockHeader title="同步状态">
      <template #icon>
        <RefreshCcw :size="18" :stroke-width="2" aria-hidden="true" />
      </template>
      <template #actions>
        <SettingsStatusBadge :status="syncState.status">{{ statusLabel }}</SettingsStatusBadge>
      </template>
    </SettingsBlockHeader>

    <div class="tw:flex tw:flex-col tw:gap-4 tw:pt-3">
      <SettingsInsetPanel class="tw:grid tw:grid-cols-[repeat(auto-fit,minmax(min(100%,150px),1fr))] tw:gap-3 tw:p-3.5">
        <SettingsMetaItem label="消息:">{{ syncState.details.messageCount }}</SettingsMetaItem>
        <SettingsMetaItem label="ST 侧:">{{ syncState.details.stCount }}</SettingsMetaItem>
        <SettingsMetaItem label="差异:">
          <span :class="diffCount > 0 ? 'sync-panel__diff is-diverged' : 'sync-panel__diff'">{{ diffCount }} 项</span>
        </SettingsMetaItem>
        <SettingsMetaItem label="耗时:">{{ syncState.details.duration }} ms</SettingsMetaItem>
      </SettingsInsetPanel>

      <SettingsDescription>{{ storageDescription }}</SettingsDescription>

      <p v-if="syncState.error" class="sync-panel__error tw:m-0" role="alert">{{ syncState.error }}</p>

      <div class="tw:flex tw:flex-wrap tw:gap-2">
        <LuminaButton tone="primary" :disabled="syncState.status === 'syncing'" @click="forceSync">
          <RefreshCcw :size="14" :stroke-width="2" :class="syncState.status === 'syncing' ? 'tw:animate-spin' : undefined" aria-hidden="true" />
          {{ syncState.status === 'syncing' ? '正在同步…' : '立即全量同步' }}
        </LuminaButton>
        <LuminaButton variant="ghost" @click="openReport">{{ diffCount > 0 ? '查看差异' : '同步报告' }}</LuminaButton>
      </div>

      <div v-if="diffCount > 0" class="sync-panel__divergence tw:flex tw:flex-col tw:gap-3 tw:p-4">
        <SettingsDescription>
          插件数据与 SillyTavern 有 {{ diffCount }} 项不一致，选择以哪一侧为准：
        </SettingsDescription>
        <div class="tw:flex tw:flex-wrap tw:gap-2">
          <LuminaButton variant="ghost" size="sm" @click="overwriteFromST">以 ST 为准</LuminaButton>
          <LuminaButton variant="ghost" size="sm" @click="overwriteToST">以插件为准，回写 ST</LuminaButton>
        </div>
      </div>
      <p v-if="actionMessage" class="tw:m-0 tw:text-[length:var(--lw-type-body-small-size)] tw:text-lw-text-muted" role="status">{{ actionMessage }}</p>
    </div>
  </SettingsSectionPanel>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import { RefreshCcw } from 'lucide-vue-next';
import { HostDetector } from '../../../api/core/host-drivers/HostDetector.js';
import { useModalStore } from '../../../stores/useModalStore.js';
import { LuminaButton } from '../../../ui/primitives';
import {
  SettingsBlockHeader,
  SettingsDescription,
  SettingsInsetPanel,
  SettingsMetaItem,
  SettingsSectionPanel,
  SettingsStatusBadge
} from '../components';
import { getSettingsHostApi } from '../settingsHost.js';
import { useSettingsSyncStatus } from './useSettingsSyncStatus.js';

const { syncState, diffCount, statusLabel, refresh } = useSettingsSyncStatus();
const actionMessage = ref('');

const storageDescription = computed(() => (HostDetector.isTauriTavern
  ? '数据保存在 TauriTavern 应用目录（独立 JSON），不需要 LuminaServer。'
  : '数据保存在 LuminaServer 数据目录（独立 JSONL），支持时间线分支回溯。'));

const forceSync = async (): Promise<void> => {
  await getSettingsHostApi()?.forceSync();
  refresh();
};

const openReport = (): void => {
  const host = getSettingsHostApi();
  const diff = host?.getSyncDiff();
  if (diff?.hasDivergence && diff.diffCount) host?.openConflictViewer();
  else host?.openSyncReportViewer();
};

const overwriteFromST = async (): Promise<void> => {
  await getSettingsHostApi()?.syncFromST({ resolveIntent: 'st' });
  refresh();
  actionMessage.value = '已按 SillyTavern 的数据覆盖插件存储。';
};

const overwriteToST = async (): Promise<void> => {
  const confirmed = await useModalStore().confirm({
    title: '回写到 SillyTavern',
    message: '用插件存储的数据替换 SillyTavern 的消息列表，此操作无法撤销。',
    confirmText: '回写',
    danger: true
  });
  if (!confirmed) return;
  await getSettingsHostApi()?.syncFromST({ resolveIntent: 'lumina' });
  refresh();
  actionMessage.value = '回写完成。';
};
</script>

<style scoped>
.sync-panel__diff {
  color: var(--lw-text-main);
  font-variant-numeric: tabular-nums;
}

.sync-panel__diff.is-diverged {
  color: var(--lw-warning, var(--lw-danger));
  font-weight: 600;
}

.sync-panel__error {
  color: var(--lw-danger);
  font-size: var(--lw-type-body-small-size);
  line-height: var(--lw-type-body-small-line-height);
}

.sync-panel__divergence {
  border: 1px solid color-mix(in srgb, var(--lw-warning, var(--lw-danger)) 24%, transparent);
  border-radius: 16px;
  background: color-mix(in srgb, var(--lw-warning, var(--lw-danger)) 8%, transparent);
}
</style>
