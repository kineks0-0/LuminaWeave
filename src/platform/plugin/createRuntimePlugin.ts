import { defineComponent } from 'vue';
import type { LuminaPlugin } from '../../types/plugin.js';
import type { PluginManifestV2 } from './types.js';

// 运行时注册的插件只通过 PluginManifestV2 声明界面（primarySurface / surfaces）；
// LuminaPlugin.component 是旧入口的必填字段，工作区按 primarySurface 渲染，不会使用它。
const RuntimePluginRoot = defineComponent({ name: 'RuntimePluginRoot', render: () => null });

export const createRuntimePlugin = (manifest: PluginManifestV2): LuminaPlugin => ({
    id: manifest.id,
    name: manifest.name,
    icon: manifest.icon ?? '',
    component: RuntimePluginRoot,
    // 运行时插件的设置通过 manifest.settingsSchema 声明，同步到旧入口字段才会显示在设置面板。
    settingsManifest: manifest.settingsSchema,
    platformManifest: manifest
});
