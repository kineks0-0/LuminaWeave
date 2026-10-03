import { reactive, ref } from 'vue';
import type { SettingsCategoryId } from '../../types/plugin.js';
import { currentDetailedView } from './useSettings.js';

/** 每个分类页是否展开高级选项（在设置页开关之间保持） */
export const showAdvancedByCategory = reactive<Partial<Record<SettingsCategoryId, boolean>>>({});

/** 搜索跳转后需要滚动定位并高亮的行（data-setting-anchor） */
export const pendingSettingsAnchor = ref<string | null>(null);

export const openSettingsCategory = (categoryId: SettingsCategoryId, anchor: string | null = null): void => {
    currentDetailedView.value = categoryId;
    pendingSettingsAnchor.value = anchor;
};
