import type { LuminaWeaveAPI } from '../../api/index.js';

/** 设置面板用到的宿主 API 子集；在扩展未挂载（例如独立预览）时为 undefined */
export type SettingsHostApi = Pick<
    LuminaWeaveAPI,
    | 'syncState'
    | 'getSyncDiff'
    | 'forceSync'
    | 'syncFromST'
    | 'openConflictViewer'
    | 'openSyncReportViewer'
    | 'getPresets'
    | 'getActivePresetName'
    | 'selectPreset'
    | 'getCurrentApiType'
    | 'getPhysicalHost'
    | 'on'
    | 'off'
>;

export const getSettingsHostApi = (): SettingsHostApi | undefined =>
    (window as unknown as { LuminaWeave?: SettingsHostApi }).LuminaWeave;
