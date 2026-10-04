<template>
  <SettingsSectionPanel class="storage-block" core>
    <SettingsBlockHeader title="存储">
      <template #icon>
        <Database :size="18" :stroke-width="2" aria-hidden="true" />
      </template>
      <template #actions>
        <LuminaIconButton
          class="settings-action-button"
          ariaLabel="刷新存储占用"
          title="刷新"
          size="sm"
          :disabled="loading"
          @click="refresh"
        >
          <RefreshCw :size="14" :stroke-width="2" :class="loading ? 'tw:animate-spin' : undefined" aria-hidden="true" />
        </LuminaIconButton>
      </template>
    </SettingsBlockHeader>

    <div class="storage-content tw:flex tw:flex-col tw:gap-3 tw:pt-1">
      <SettingsInsetPanel
        v-for="item in items"
        :key="item.id"
        class="storage-row tw:flex tw:flex-col tw:gap-3 tw:p-3.5"
      >
        <div class="storage-row-main tw:flex tw:flex-wrap tw:items-start tw:justify-between tw:gap-3">
          <div class="tw:flex tw:min-w-0 tw:flex-1 tw:flex-col tw:gap-1">
            <div class="tw:flex tw:flex-wrap tw:items-center tw:gap-2">
              <span class="tw:text-[length:var(--lw-type-title-small-size)] tw:font-[var(--lw-type-title-small-weight)] tw:leading-[var(--lw-type-title-small-line-height)] tw:text-lw-text">{{ item.title }}</span>
              <SettingsStatusBadge status="idle">{{ formatBytes(item.bytes) }}</SettingsStatusBadge>
            </div>
            <span class="tw:text-[length:var(--lw-type-body-small-size)] tw:font-[var(--lw-type-body-small-weight)] tw:leading-[var(--lw-type-body-small-line-height)] tw:text-lw-text-muted tw:text-pretty">{{ item.description }}</span>
          </div>
          <div class="storage-actions tw:flex tw:flex-wrap tw:gap-2">
            <LuminaIconButton
              class="settings-action-button"
              ariaLabel="导出"
              title="导出"
              size="sm"
              :disabled="!item.canExport || busyId === item.id"
              @click="exportItem(item.id)"
            >
              <Download :size="14" :stroke-width="2" aria-hidden="true" />
            </LuminaIconButton>
            <LuminaIconButton
              class="settings-action-button"
              ariaLabel="导入"
              title="导入"
              size="sm"
              :disabled="!item.canImport || busyId === item.id"
              @click="requestImport(item.id)"
            >
              <Upload :size="14" :stroke-width="2" aria-hidden="true" />
            </LuminaIconButton>
            <LuminaIconButton
              class="settings-action-button"
              ariaLabel="重置"
              title="重置"
              size="sm"
              :disabled="!item.canReset || busyId === item.id"
              @click="resetItem(item)"
            >
              <RotateCcw :size="14" :stroke-width="2" aria-hidden="true" />
            </LuminaIconButton>
          </div>
        </div>
        <div class="storage-meta tw:grid tw:grid-cols-[repeat(auto-fit,minmax(min(100%,180px),1fr))] tw:gap-2">
          <SettingsMetaItem label="后端:">{{ item.backend }}</SettingsMetaItem>
          <SettingsMetaItem label="来源:">{{ item.source }}</SettingsMetaItem>
          <SettingsMetaItem label="记录:">{{ item.recordCount }}</SettingsMetaItem>
          <SettingsMetaItem label="更新时间:">{{ formatUpdatedAt(item.updatedAt) }}</SettingsMetaItem>
        </div>
      </SettingsInsetPanel>
      <SettingsDescription v-if="errorMessage" class="tw:text-lw-danger">
        {{ errorMessage }}
      </SettingsDescription>
      <input ref="importFileInput" class="tw:hidden" type="file" accept=".json,application/json" @change="handleImportFile" />
    </div>
  </SettingsSectionPanel>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { formatDateTime } from '../../api/utils/dateFormat.js';
import { Database, Download, RefreshCw, RotateCcw, Upload } from 'lucide-vue-next';
import {
  runtimeStorageAdminService,
  type RuntimeStorageUsageCategoryId,
  type RuntimeStorageUsageItem
} from '../../api/core/storage/RuntimeStorageAdminService.js';
import { SettingsBlockHeader, SettingsDescription, SettingsInsetPanel, SettingsMetaItem, SettingsSectionPanel, SettingsStatusBadge } from './components';
import { LuminaIconButton } from '../../ui/primitives';
import { useModalStore } from '../../stores/useModalStore.js';

type ToastKind = 'success' | 'warning' | 'error' | 'info';

interface LuminaToastHost {
  LuminaWeave?: {
    showToast?: (message: string, kind?: ToastKind) => void;
  };
}

const items = ref<RuntimeStorageUsageItem[]>([]);
const loading = ref(false);
const busyId = ref<RuntimeStorageUsageCategoryId | null>(null);
const importTarget = ref<RuntimeStorageUsageCategoryId | null>(null);
const importFileInput = ref<HTMLInputElement | null>(null);
const errorMessage = ref('');

const showToast = (message: string, kind: ToastKind): void => {
  (window as LuminaToastHost).LuminaWeave?.showToast?.(message, kind);
};

const refresh = async (): Promise<void> => {
  loading.value = true;
  errorMessage.value = '';
  try {
    items.value = await runtimeStorageAdminService.listUsage();
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : '存储占用刷新失败。';
  } finally {
    loading.value = false;
  }
};

const formatBytes = (bytes: number): string => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
};

const formatUpdatedAt = (value: number | null): string => {
  if (!value) return '无记录';
  return formatDateTime(value);
};

const downloadJson = (filename: string, payload: unknown): void => {
  const data = `data:application/json;charset=utf-8,${encodeURIComponent(JSON.stringify(payload, null, 2))}`;
  const anchor = document.createElement('a');
  anchor.setAttribute('href', data);
  anchor.setAttribute('download', filename);
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
};

const exportItem = async (categoryId: RuntimeStorageUsageCategoryId): Promise<void> => {
  busyId.value = categoryId;
  errorMessage.value = '';
  try {
    const payload = await runtimeStorageAdminService.exportCategory(categoryId);
    downloadJson(`LuminaWeave_Storage_${categoryId}_${new Date().toISOString().slice(0, 10)}.json`, payload);
    showToast('存储内容已导出。', 'success');
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : '导出失败。';
    showToast('导出失败。', 'error');
  } finally {
    busyId.value = null;
  }
};

const requestImport = (categoryId: RuntimeStorageUsageCategoryId): void => {
  importTarget.value = categoryId;
  importFileInput.value?.click();
};

const handleImportFile = (event: Event): void => {
  const file = (event.target as HTMLInputElement).files?.[0];
  const categoryId = importTarget.value;
  if (!file || !categoryId) return;

  const reader = new FileReader();
  reader.onload = async (loadEvent) => {
    busyId.value = categoryId;
    errorMessage.value = '';
    try {
      const payload = JSON.parse(String(loadEvent.target?.result ?? ''));
      await runtimeStorageAdminService.importCategory(categoryId, payload);
      await refresh();
      showToast('存储内容已导入。', 'success');
    } catch (error) {
      errorMessage.value = error instanceof Error ? error.message : '导入失败。';
      showToast('导入失败。', 'error');
    } finally {
      busyId.value = null;
      importTarget.value = null;
      if (importFileInput.value) importFileInput.value.value = '';
    }
  };
  reader.readAsText(file);
};

const resetItem = async (item: RuntimeStorageUsageItem): Promise<void> => {
  const confirmed = await useModalStore().confirm({
    title: '重置存储',
    message: `重置「${item.title}」后，这部分数据会被清空，无法撤销。`,
    confirmText: '重置',
    danger: true
  });
  if (!confirmed) return;
  busyId.value = item.id;
  errorMessage.value = '';
  try {
    await runtimeStorageAdminService.resetCategory(item.id);
    await refresh();
    showToast('存储内容已重置。', 'success');
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : '重置失败。';
    showToast('重置失败。', 'error');
  } finally {
    busyId.value = null;
  }
};

onMounted(() => {
  void refresh();
});
</script>

