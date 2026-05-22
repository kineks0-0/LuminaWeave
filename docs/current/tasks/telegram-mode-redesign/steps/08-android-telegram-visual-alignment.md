# 08 Android Telegram Visual Alignment

## 任务目标

本步骤承接 Telegram Android 截图对齐，但只对齐真实可用的 Shell / Surface 体验，不复制截图中 Lumina 当前没有业务能力的入口。

- 移动端底部 tab 视觉对齐 Telegram Android：深色背景、半透明 blur 胶囊、克制上下打光、active 蓝色胶囊。
- 第二个移动 tab 文案改为 `联系人`，底层仍复用当前 `roles / roleList` stack 与角色聚合数据。
- 会话列表、联系人列表、设置页、个人资料页、角色资料页统一使用 Telegram Android 风格的深蓝黑背景、轻浮层、圆角、间距和密度。
- 所有 Telegram shell 图标统一进入同一套圆角线性图标系统，优先使用 `lucide-vue-next` 映射，不再混用 emoji、字符图标、插件原始 icon 或散落内联 SVG。
- 联系人头像、聊天列表头像、资料页头像和底栏个人头像统一为圆形裁切、同源解析、统一占位渐变和破图隐藏。

## 功能边界

保留真实能力：

- 聊天列表、联系人列表、搜索、筛选 chip、角色聚合、对话文件模式。
- 打开聊天、新建当前角色会话、打开角色资料、打开个人资料。
- 打开设置、桌面模式设置、插件设置入口。
- 打开上下文工具：时间线、状态、导演、世界书、Forge 等已有 surface。
- 桌面端三栏、移动端四 tab、各 tab 独立 stack。

不展示无真实能力入口：

- 电话 / 通话、礼物、添加联系人、邀请朋友、最近通话。
- 动态发布、动态归档。
- 设置照片、编辑 Telegram 账号资料等宿主不支持的账号编辑能力。

## 页面语义

- `联系人` 是 UI 语义，代表角色/会话聚合视图，不新增联系人后端 API。
- 角色资料页不使用 `动态 / 群组`，改为 `历史 / 工具`。
- 个人资料页只展示本人资料、设置、小窗面板和桌面模式/菜单。
- 设置页使用 Telegram Android 风格外壳，但条目必须来自 Lumina 真实设置分类和插件入口。

## 视觉约束

- 浮层不是明显 1px 全包围描边，而是半透明 blur 加上上方微亮、下方微暗的克制打光。
- 底栏、搜索框、筛选 chip、资料卡、菜单、设置分组必须有轻 blur 与上下打光。
- 普通列表行保持清晰，不做强玻璃卡片。
- 设置分类图标使用统一 Telegram 风格彩色圆角方块 + 白色线性图标；插件原始 icon 只作为语义来源，不直接裸露。
- 更多、搜索、返回、关闭、筛选、加号等系统图标统一尺寸、stroke、端点圆角和颜色规则。
- 无头像时使用 Telegram avatar palette 的圆形渐变和首字；破图不得显示浏览器默认破图图标。

## 实现检查清单

- 对照截图检查底栏：半透明 blur 胶囊、active 胶囊、上下打光是否克制。
- 对照截图检查搜索框和筛选 chip：深色浮层、圆角、密度和文字层级。
- 对照截图检查资料卡、菜单、设置分组：浮层感存在，但描边不过重。
- 检查所有图标：同一 stroke、同一尺寸体系、同一 active 颜色规则。
- 检查设置图标和插件工具图标：必须经过 Telegram shell 映射。
- 检查联系人头像、聊天列表头像、资料页头像、底栏头像：圆形裁切、object-fit、占位和来源解析一致。
- 检查无能力入口：电话、礼物、添加联系人、邀请朋友、动态发布等完全不展示。

## 验收项

- Telegram mobile 底栏第二项显示 `联系人`。
- 角色资料页只出现真实动作：消息/新聊天、历史、上下文工具。
- 个人资料页只出现真实动作：设置、小窗面板、桌面模式/菜单。
- 设置页在移动端显示 Telegram 风格小窗口版本，不再直接显示大窗口卡片首页。
- 会话列表角色聚合和对话文件模式仍可切换，工具仅在工具筛选页展示。
- 桌面三栏保持可用，视觉语言与移动端一致。

## 验证

- `npm run type-check`
- `npx vitest run src\theme\__tests__\themeRegistry.test.ts`
- `npx vitest run src\platform\desktop\__tests__\DesktopModeRuntimeRegistry.test.ts`
- `npx vitest run src\platform\plugin\__tests__\officialPluginManifests.test.ts`

## 非目标

- 不新增联系人数据模型。
- 不新增通话、礼物、动态、账号编辑等业务能力。
- 不修改 `ConversationService / STAdapter / STSyncService / PersistenceService / PromptBuilder`。
- 不处理 `dist/`。
