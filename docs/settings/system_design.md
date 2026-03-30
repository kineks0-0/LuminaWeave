# LuminaWeave Settings 子插件 - 系统设计文档 (System Design)

**版本:** v1.0
**所属系统:** LuminaWeave V2

## 一、 组件架构
1. **SettingsRoot.vue (主容器)**
   `PluginManager` 下沉组件，负责整体 UI 的导航。提供返回左向箭头（如果在详情页）与顶栏空间。
2. **SettingsUnified.vue (统一概览页)**
   首屏界面，循环读取各插件向中心宣告为 `common` 的属性节点并提供表单组件。
3. **SettingsDetailed.vue (详情配置页)**
   接受一个 Plugin ID 作为参数，循环渲染该应用内部非 `common`、或者该插件所有专属选项的展示。

## 二、 核心依赖与数据源
- **响应式注入 (StorageCore Inject)**: 摒弃以往的单体 `readingSettings` 对象下发。直接请求核心服务层的 `Storage API(lwStorage)` 进行读写。底层机制会自动处理不同数值的作用域（全局 vs 当前角色）。
- 不直接操作 DOM 元素，所有 CSS 层面通过根绑定的 `style` 或者是动态类名向聊天流下发生效（如 `padding` 变量，`--lw-line-height` 等全局 CSS）。

## 三、 动态绑定策略
- **Range Slider**: 对范围选择输入提供即时双向绑定，如字体大小覆盖 `12px - 24px`。
- **Segmented Control**: 针对主题、视图模式等枚举型使用切片/卡片式的高亮单选布局。

## 四、 扩展规划
- 为各个角色卡片或者全局建立独立的配置。使得进入不同的卡片保留上一次的最佳排版设置。
