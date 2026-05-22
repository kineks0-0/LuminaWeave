# Standalone Resource Runtime

## 目标

沉淀并推进 LuminaWeave 的“运行时与资源来源解绑”方向：插件可以继续运行在 SillyTavern 中，也可以作为独立 Web/桌面应用运行；世界书、角色卡、预设、会话、记忆等资源则通过多源资源域统一挂载和读取。

## 当前状态

第一阶段已进入实现：资源域骨架落在 `luminaweave-extension/shared/resources/` 与 `luminaweave-extension/src/api/core/resource-runtime/`，并开始接入 Prompt 构建链路。当前实现采用 ST 原始格式作为角色卡、世界书与预设的边界格式；上层只派生只读 summary/index，不改写 raw payload。

## 当前概念

- Runtime Host 只描述运行形态与宿主能力，例如 `st-plugin`、`standalone-web`、未来 `desktop-native`。
- Resource Source 只描述资源来源，例如 `st`、`lumina-local`、未来 `subscription`。
- `st-plugin` Runtime 下仍可以使用 standalone-host 的本地资源能力，并读取 ST 端资源。
- 多源资源采用显式挂载优先：不同来源保留自己的命名空间，不自动合并同名角色、世界书或预设。
- 会话、Prompt Preset、Forge 工作区后续应保存稳定 Resource Ref，而不是只保存资源名称。
- 世界书是否参与某次生成不写入资源本身：Resource Ref 只表示候选绑定；会话、Prompt Preset、Forge 工作区保存 `PromptSourceSelection` 作为来源启用策略；ST 世界书条目的 `enabled/disable/selective` 仍保留在 raw entry 中，触发结果进入 prompt trace。
- VFS 将资源映射成虚拟路径，支持 `ls/cat/grep/find/stat` 等只读查询，供用户终端和 Agent 工具共用。
- 外部资源首次编辑时询问写回原源还是 fork 到 Lumina 本地副本；用户可在设置中保存默认策略。
- 网络订阅源首版只用于发现、浏览、搜索和导入，不直接参与生成真相源或自动同步。

## 已落地的第一阶段边界

- 共享契约：`RuntimeHostKind`、`ResourceSourceKind`、`ResourceType`、`ResourceRef`、`ResourceDocument`、VFS stat/search 类型。
- ST 格式 helper：支持 TavernCard/legacy character、ST worldbook `entries` object/array、ST preset 的只读摘要。
- Resource Runtime：`ResourceSourceRegistry`、`ResourceService`、`STResourceSource`、`LocalResourceSource`、`PromptResourceResolver`、`VirtualFileSystemService`、`ResourceWritePolicyService`。
- VFS 路径：`/sources/st/...`、`/sources/local/...`、`/library/characters`、`/library/worldbooks`、`/library/presets`。ST 角色 avatar 的 `*.png` 物理名在 VFS 中暴露为 `*.json` 角色资源路径，旧 `*-png` ID 保留兼容读取。
- Bash Shell 入口：Core 新增 `BashTerminalRuntime`，引入 `just-bash` 作为用户终端与 Agent shell 的执行层。`/sources`、`/library` 通过 Resource-backed FS 映射到 Resource Domain；`/workspaces` 通过 `ShellWorkspaceService` 映射到共享项目/会话工作区，并以独立 extensionStore namespace 持久化快照。`VFSCommandService` 作为旧命令元数据和兼容入口保留，但终端执行优先走 just-bash。
- 会话权限：新增 `ShellPermissionService`，支持 `user-terminal`、`chat-agent`、`forge-agent`、`sub-agent`。用户终端默认全权限；Agent 默认可只读 `/sources`、`/library` 和可见 `/workspaces`；Forge Agent 默认只写 `/workspaces/forge/<projectId>/...`；Chat Agent 默认只写 `/workspaces/chat/<conversationId>/...`。越权写入需通过 `lw-permission request ...` 申请 grant；`TerminalRoot.vue` 已展示 pending request 与 active grant，并支持批准、拒绝和撤销。
- 项目工作区：Forge 工作区路径改为 `/workspaces/forge/<projectId>/...`。项目是制卡长期容器，多个对话/Agent 会话共享同一个项目工作区；`ForgeWorkspaceSession` / `ForgeSessionRepository` 已保存 `forgeProjectId`、`conversationId`、`workspacePath`，并把 `conversationId -> forgeProjectId` 绑定写入 workspace namespace。
- Prompt 接线：`PromptBuilder` 新增 ResourceRef 异步入口；Forge 测试聊天可从 Resource bundle 注入角色卡与世界书。
- ST engine 资源边界：`PromptResourceResolver.resolveSTEngineResources()` 首版把 `st` source 资源标记为 passthrough，把非 ST ResourceRef 标记为 blocked；`filterBundleForSTEngine()` 会在 ST 预设兼容链路中过滤非 ST bundle 内容，并输出 diagnostics，避免本地/订阅资源被静默混入 ST 原生合成。
- Prompt 可追踪合成：新增 `PromptSourceUnit -> InformationPlanner -> PromptAssemblyResult` 骨架，预设、角色卡、世界书、历史等片段可保留 source trace；合并 system message 时记录输出 offset，不丢来源。Forge Prompt Preview 已接入来源页签，可查看每段来源、保留/摘要/隐藏状态、输出位置和 transform。PromptInspector 也已新增 `Messages / 合并 / 来源` 三视图；当 ST dryRun 只返回 raw messages 时，UI 会生成轻量 synthetic trace，明确这些片段来自探针消息而非可追溯 ResourceRef。PromptInspector 来源页签已补充 diagnostics 分组、transform detail、压缩/摘要前后对照与 ResourceRef 明细展开；合并视图按最终 message 分组展示对应来源片段、offset、短摘录，并支持点击来源后在 message 文本内高亮对应 offset。
- 世界书启用分层：参考 ArcTavern 的 active book + character book 组合，以及 TavernHeadless 的 `source_selection.worldbook.enabled`，Lumina 首版将“候选世界书绑定”和“本次/本会话是否启用世界书”分离。资源 raw 只保存 ST 原始字段；会话级 source selection 可禁用全部世界书或排除/包含具体 ResourceRef；Lumina 自合成的触发引擎只消费已通过策略筛选的候选条目，并输出 activated entries trace。
- Core 代码职责边界：`src/api/core/README.md` 已记录 Core Runtime 的功能域目录；`src/api/core/resource-runtime/README.md` 继续固化资源域内部职责，明确 source ports、source adapters、binding/source selection、resolver、worldbook trigger、VFS、write policy 的依赖方向。`resource-runtime` 保持独立资源域边界，不应 import Vue、Pinia store、桌面模式或插件 UI；source adapter 不应 import prompt assembly；trigger engine 必须保持纯计算。BindingService 现在输出结构化 binding resolution，上层应把 `enabledRefs` 传给 resolver，并把 `excludedRefs` 写入 prompt diagnostics/trace。

## 待探讨问题

- 插件 Runtime 如何声明自己需要哪些 Resource Source 能力，以及如何在无 ST 环境下降级。
- Resource Ref 的最小字段、版本/修订口径、跨源导入后的 `origin/forkedFrom` 记录方式。
- ST 资源、本地资源与订阅源资源的 canonical DTO 如何设计，避免世界书、角色卡和预设字段差异污染上层。
- Prompt 合成如何从“读取 ST 当前状态”迁移为“读取显式 Resource Ref”：包括 ST 合成、Lumina 自合成、非 ST 资源参与 ST 合成时的限制或转换路径。
- VFS 命令层的边界：首版只读命令、结构化返回格式、Agent 工具调用协议、UI 终端呈现方式。
- 写入策略的设置维度：按来源、资源类型、具体资源或工作区保存默认行为。

## TODO

1. [done] 对齐 TavernHeadless 风格的 Prompt provenance：世界书 activated entry 保留 `ResourceRef/sourceId/resourceId/path`，最终 trace 可从提示词段追回具体资源。
2. [done] 为世界书触发 trace 增加 `firstMatch`：记录消息索引、primary/secondary、plain/regex、命中 key、char range 与 excerpt。
3. [done] 增加世界书插入分桶并接入 Prompt 组装：将 ST `position/role/depth` 归一到 `before/after/an_top/an_bottom/em_top/em_bottom/at_depth/outlet`；`at_depth` 已插入历史 message 流，`before/after/an/em/outlet` 已通过 PromptPresetComposer 的虚拟 worldbook placement message 注入到对应 slot 边界。
4. [done] Prompt preview / PromptInspector 合并视图继续强化来源解释：按最终 message 展示预设、角色、世界书、历史、DCC 摘要段，并保留 offset；来源页展示 ResourceRef 与 source spans。
5. [done] DCC / Information Planner 压缩输出保留 `sourceSpans`，摘要、截断、合并后仍能追踪原始消息或资源段。
6. [in-progress] 为会话、Prompt Preset、Forge 工作区增加 ResourceRef 绑定持久化入口，并暴露世界书总开关与单本 include/exclude。
   - [done] Core API：稳定 owner helper、`setWorldbookEnabled`、`includeWorldbook`、`excludeWorldbook`、`clearWorldbookRefSelection`。
   - [done] Forge 测试聊天：接入 `forge-workspace` binding resolution。
   - [done] UI：Forge 测试聊天面板可为当前 Forge workspace 绑定角色卡/世界书，并配置世界书总开关、单本强制包含或排除。
   - [pending] UI：会话 / Prompt Preset 的资源选择、总开关、单本 include/exclude 控件。
7. [done] 为 PromptInspector 增加 source selection diagnostics 的独立分组、压缩前后内容对比，以及合并视图中的 message 文本内 offset 高亮。
   - [done] 来源页 diagnostics 按来源选择、ST 合成限制、世界书触发、资源读取、写入策略等类别分组，并保留 error/warning/info 级别标签。
   - [done] 来源页对摘要、截断、压缩等 lossy transform 展示处理前 raw 与进入最终提示词后的内容。
   - [done] 合并视图支持点击来源片段，并在对应最终 message 文本中高亮该 trace 的 offset 范围。
   - [done] 来源页支持按来源类型筛选，并可从来源卡片跳转到合并视图定位对应 message。
   - [future] 后续可补更精确的重叠 span 展示。
8. [in-progress] 继续完善 Lumina 自合成世界书触发规则：概率、预算、角色/深度位置、递归限制与 activated entries trace。
   - [done] Probability：支持 `probability/useProbability`，可注入 deterministic `random()`，并在 trace 中记录概率跳过。
   - [done] Skipped trace：记录 disabled、empty-content、delay-until-recursion、no-key-match 等未触发原因。
   - [done] Trigger budget：支持 `maxTriggeredEntries`，预算跳过写入 trace；selected trace 记录 position/depth/order。
   - [done] Recursion trace：记录 recursive content 是否参与后续扫描、`excludeRecursion/preventRecursion` 阻断原因、递归 pass 数与 limit diagnostics。
   - [done] Activated entries projection：输出 prompt-consumable DTO，包含 role、position、depth、order、content、reason、matchedKeys 与递归贡献信息。
   - [done] 角色/深度位置归一与插入分桶。
   - [done] 角色/深度位置实际 message 插入语义首版：`at_depth` 按距离最新消息的 depth 插入，插入消息保留 worldbook ResourceRef trace；`before/after/an_top/an_bottom/em_top/em_bottom/outlet` 按 slot 边界生成独立虚拟 worldbook message。
   - [done] ST key matching parity 首版：从 ST raw 派生 entry 时保留 `caseSensitive/case_sensitive`、`matchWholeWords/match_whole_words`、`useRegex/use_regex`，触发器按大小写、整词和 regex/plain 语义匹配，并在 `firstMatch.matchedKeyType` 标记来源。
   - [done] Token budget hook 首版：触发上下文支持 `maxWorldbookTokens` 与同步 `estimateTokens` 注入，预算跳过 trace 标记 `budgetType='token'`、已用量与当前条目成本；默认使用字符估算，后续可接 ST tokenizer。
   - [done] ST position/outlet parity 首版：对齐 ST numeric `position` 0-7，补齐 `EMTop/EMBottom/outlet` 映射；从 `extensions.outlet_name` / `outletName` / `outlet_name` 派生 outlet 名称，并在 activated entry insertion trace 中记录 `anchor/anchorPosition/outletName`。
   - [pending] 对齐 ST 更细的 tokenizer 口径，以及 example message/outlet 在完整 ST prompt builder 中的最终落点细节。
9. [done] 设计 ST engine 遇到非 ST 资源时的转换路径：虚拟世界书、宏注入或阻断提示。
   - [done] 首版策略：`st` source 资源允许 passthrough；非 ST ResourceRef 在 `st` engine / `st_preset` 路径中默认 blocked，不静默注入。
   - [done] `PromptResourceResolver` 输出结构化 decision、blocked diagnostics，并提供 ST engine bundle filter。
   - [done] `PromptBuilder` 与 Forge 测试聊天 `st_preset` 链路使用过滤后的 bundle，diagnostics 进入 Prompt trace / console。
   - [future] 虚拟世界书、宏注入、fork/import 到 ST 的实际转换动作后续作为显式用户选择实现。
10. [done] 接入只读命令 UI：`ls/cat/grep/find/stat` 调用 VFS service。
   - [done] Core 暴露 `vfsCommandService` singleton，UI 不直接访问资源真相源。
   - [done] 开发者工具新增资源 VFS 终端，支持输入命令、快捷命令、输出历史与错误展示。
   - [done] `ResourceRuntime.test.ts` 覆盖 `ls/grep/cat/stat` 命令路径。
11. [done] 增加编辑资源文件命令和管道符支持。
   - [done] `VFSCommandService.executeLine()` 支持 `|` 管道，前一段 stdout 作为后一段 stdin。
   - [done] `grep` 可处理 piped stdin，也可继续搜索 VFS 路径。
   - [done] `write/edit/tee` 只接受 JSON payload，并通过 `VirtualFileSystemService.writeFile()` -> `ResourceService.saveResource()` 保存，不绕过 source 写入策略。
   - [done] 本地资源可直接写入；ST/外部资源继续返回写入策略结果，不静默改写。
   - [done] `ResourceRuntime.test.ts` 覆盖 `cat | grep` 与 `echo JSON | write path`。
12. [done] 新增正式资源终端子插件。
   - [done] `lumina-terminal` 注册 `terminal.root` surface 与 widget navigation。
   - [done] `TerminalRoot.vue` 使用 wterm 渲染终端，支持中文输入、Enter、Backspace、Up/Down 历史、Tab 补全、Ctrl+C、Ctrl+L、`help` 与 `clear`。
   - [done] 终端命令执行复用 `vfsCommandService.executeLine()`，保持 VFS/ResourceService/写入策略为唯一业务边界。
13. [done] 命令注册表、结构化 help 与 JSON 命令。
   - [done] `VFSCommandService` 改为 command registry，`listCommands()` 暴露 `name/summary/usage/examples`，其中 `summary` 为 `zh-CN/en-US` 本地化文本，`examples` 为结构化 `{ command, output }`。
   - [done] `getHelpText()` 从 registry 生成终端手册，默认中文，可通过 `help en-US` 输出英文；每个命令按 `<command> - 一句话说明 / Usage / Example / Output` 固定格式输出。
   - [done] 命令解析改用 `shell-quote`，只支持普通参数、引号/转义与单向管道；不实现真实 bash 的重定向、任务控制、subshell 或环境变量展开。
   - [done] 新增 `jq <jsonpath> [path]`，使用 `jsonpath-plus` 对 VFS 文件或 piped stdin 做 JSONPath 查询。
   - [done] 新增 `json-set <path> <jsonpath> <json-value>`，只允许确定单点 JSONPath，并继续通过 `VirtualFileSystemService.writeFile()` -> `ResourceService.saveResource()` 和写入策略保存。
   - [done] `ResourceRuntime.test.ts` 覆盖命令元数据、help 格式、shell-style 解析拒绝项、`jq` 查询、`json-set` local 写入与 ST 写入策略保护。
14. [done] 终端 Tab 补全。
   - [done] `VFSCommandService.completeLine()` 提供命令名补全和路径参数补全。
   - [done] 路径候选来自 VFS `listDir()`，支持 `/sources/...`、`/library/...` 以及管道后命令片段中的路径补全。
   - [done] 补全候选以未转义 Unicode 路径显示和插入，中文资源名不会显示为 URL 编码。
   - [done] 终端输入层可直接输入中文资源名和路径，Backspace 删除中文宽字符时重绘当前输入行，避免终端显示残留。
   - [done] `TerminalRoot.vue` 消费补全结果：单一候选直接补齐，多候选展示候选列表并保留当前输入。
   - [done] `ResourceRuntime.test.ts` 覆盖 command/path/library/pipeline completion。
15. [done] 增加目录树浏览命令。
   - [done] 新增 `tree [path] [--info]`，递归列出输入目录下的目录和文件。
   - [done] `--info` 输出 ResourceSummary 中的名称/描述、条目数、格式、ResourceRef 和大小等简要信息，不新增资源真相源。
   - [done] `ResourceRuntime.test.ts` 覆盖 tree 基础输出与 info 输出。
16. [in-progress] just-bash 终端替换、项目工作区与 Agent 权限。
   - [done] 新增 `BashTerminalRuntime`，用 `just-bash` 执行 shell 命令，并挂载 `/sources`、`/library`、`/workspaces`。
   - [done] 新增 `ResourceBackedBashFs`，读取 Resource Domain 路径，写入资源时走 `VirtualFileSystemService.writeFile()` 与 Resource 写入策略。
   - [done] 新增 `ShellPermissionService`，提供会话级默认读权限、项目工作区写权限、pending request、approve/revoke grant。
   - [done] 新增 `lw-permission` shell 命令，支持 `request/status/list/revoke`。
   - [done] `TerminalRoot.vue` 改为调用 `BashTerminalRuntime` 执行命令；当前仍保留轻量 wterm 输入层，因为 `@wterm/just-bash` 首版公开 API 尚未暴露 `fs/customCommands` 注入点。
   - [done] `ResourceRuntime.test.ts` 覆盖 just-bash 管道读取、资源路径直写、本地资源 grant、项目工作区写权限、中文内容。
   - [done] 新增运行态 `ShellSessionState`：连续 `exec()` 之间显式保留 `cwd/env`，修正 just-bash 默认每次执行重置 shell 状态导致的 `cd/export` 不连续问题。
   - [done] 网络配置入口对齐 just-bash 官方模型：用户终端使用官方 `network` 配置注册 `curl`；Agent session 继续通过 permissioned fetch 叠加 grant 检查，网络未配置时 `curl` 保持不可用。
   - [done] 新增 `AgentBashToolService`，按 bash-tool 推荐的 `bash/readFile/writeFile` 三工具契约为 AI SDK Agent 暴露 shell 能力；底层仍调用 `BashTerminalRuntime`，不绕过 Resource-backed FS、ShellPermissionService 或 Resource Write Policy。
   - [done] 构建边界：`bash-tool.createBashTool` 当前会静态拉入 Node-only/transform 代码，且浏览器条件下依赖 `just-bash/browser` 未导出的 `BashTransformPipeline/TeePlugin`，因此前端首版采用 bash-tool 兼容 adapter，而不是直接打包官方 create 函数。
   - [done] Skills experimental 语义兼容：`AgentBashToolService` 支持传入 `AgentSkillDefinition[]`，将 `SKILL.md` 与可选 `scripts/*` 安装到当前 workspace 的 `skills/<skillName>/...`，并返回 `skill` tool；Agent 可先加载 skill instructions，再用 bash/readFile/writeFile 运行或读取 skill 脚本。
   - [done] Agent 工具提示词会从同一份 manual 输出已安装 skills 的名称、说明、workspace 路径和文件列表，后续模型提示词可直接拼装，不再另写一份 skill 能力说明。
   - [done] 新增 `ShellSessionRuntime` 薄会话层，包装 `BashTerminalRuntime` 的 `exec/completeLine`，记录 viewport、cwd/env snapshot 与 exec/complete/resize trace，供终端 UI 与 Agent trace 后续共用。
   - [done] 构建警告处理：为浏览器构建显式 alias `node:zlib` 到本地 shim，避免 `just-bash` 内置 gzip/rg 相关路径触发 Vite externalized Node module 警告；浏览器端调用 `gunzipSync` 会得到明确 unsupported error。
   - [done] Resource-backed FS 写入语义补强：`/sources/local` 可通过 just-bash `>`、`tee`、`cp` 写入完整 JSON，缺失资源路径会按 path 中的 source/type/id 创建本地资源；`/sources/st` 仍返回 Resource Write Policy required；资源 mount 的 `>>/rm/mv/mkdir/link/symlink` 首版返回结构化 unsupported/readonly/policy/grant/invalid-json 错误，不静默制造第二资源状态。
   - [done] Shell command manual 合流：新增 `ShellCommandManual`，记录 Lumina 推荐的 just-bash 命令、`lw-permission`、`lw-help`、路径、权限与 jq 语义说明；Agent tool prompt 与终端 `lw-help` 共用同一份 metadata。just-bash 原生 `help` 保留为 bash 内建帮助，不覆盖。
   - [done] Network policy 最小闭环：新增 `ShellNetworkPolicyService`，统一 network allow-list、method 检查与 Agent grant 检查；`lw-permission request network ...` 只能申请 allow-list 内 URL 前缀；Agent `curl` 必须同时满足 allow-list 与 network grant，未配置网络、URL 不在 allow-list、缺少 grant 会给出不同错误原因。
   - [done] 项目级 workspace 持久化：新增 `ShellWorkspaceService`，共享 `/workspaces` 的 just-bash FS，写入后快照到 `lumina.resource-runtime / shell-workspaces`；Forge Agent 多会话共享 `/workspaces/forge/<projectId>`，重建 runtime 后仍能读取已保存文件。
   - [done] Forge 项目绑定：`ForgeWorkspaceSession`、Conversation `pluginState.forge` 与 `ForgeSessionRepository` 保存 `forgeProjectId / conversationId / workspacePath`，并在保存会话时登记 `conversationId -> forgeProjectId`。
   - [done] Agent 权限审批 UI：`ShellPermissionService` 增加订阅事件和 reject reason；`TerminalRoot.vue` 展示 pending permission requests 与 active grants，支持批准、拒绝、撤销。
   - [pending] 后续将终端行编辑完全切换到 `@wterm/just-bash`，前提是 adapter 支持注入自定义 FS 与 custom commands，或项目内复制/封装其 BashShell。
   - [done] 将 Forge 长期项目实体与 `projectId -> workspace` 持久化绑定接入真实 Forge 项目模型。

## 下一步规划：Agent Shell 1-6

1. [pending] Shell UI 完整接入。
   - 目标：把当前 `wterm 输入层 + just-bash 执行层` 收敛为稳定终端组件，补齐命令名、路径、中文路径、历史、快捷键与多行脚本体验。
   - 输入：用户终端、聊天 Agent 终端、Forge Agent 终端、子 Agent 终端的 `ShellSessionRef` 与 Resource-backed FS。
   - 处理流程：优先评估 `@wterm/just-bash` 是否能复用；若其公开 API 仍不能注入自定义 FS/custom commands，则保留 wterm 渲染并实现项目内 `BashTerminalAdapter`。
   - 状态变化：终端 UI 不保存业务资源真相，只保存 display buffer、history、completion state 与 shell session。
   - 输出：统一的 Bash 输出、错误、exit code、metadata/trace。
   - 上下游影响：Agent 工具层后续直接复用同一 runtime；旧 `VFSCommandService` 只保留命令元数据/兼容入口。
   - 进展：`BashTerminalRuntime` 已保存 `cwd/env`，`TerminalRoot.vue` prompt 会显示当前 cwd；完整 wterm/just-bash adapter、补全和多行脚本体验仍待做。

2. [done] 项目级 Forge Workspace 落地。
   - 目标：把 `/workspaces/forge/<projectId>/...` 从运行态内存 workspace 接入真实 Forge 项目模型。
   - 输入：`forgeProjectId`、`conversationId`、Forge 项目设置、虚拟世界书、项目记忆、草稿、素材与审阅输出。
   - 处理流程：建立 `conversationId -> forgeProjectId` 绑定；项目下多个对话和 Agent shell 共用同一 workspace；workspace 持久化落到独立 namespace。
   - 状态变化：长期真相绑定 `projectId`，对话只保存项目引用和本轮协作状态。
   - 输出：项目级 workspace 路径、资源 ref、项目记忆摘要、对话绑定关系。
   - 上下游影响：Forge Prompt、测试聊天、导入/导出、审阅中心都应读取项目 workspace，而不是单次 `sessionId`。
   - 进展：`ShellWorkspaceService` 负责 `/workspaces` 共享 FS 与快照持久化；`ForgeWorkspaceSession` / Conversation forge plugin state 已保存 `forgeProjectId`、`conversationId`、`workspacePath`；`ForgeSessionRepository.saveSession()` 会登记 `conversationId -> forgeProjectId` 绑定。

3. [done] Agent 权限申请闭环。
   - 目标：把 `lw-permission request` 的 pending request 接到用户可见审批 UI。
   - 输入：shell session、owner、operation、path/ref/url、reason、suggested duration。
   - 处理流程：Agent 越权时生成 request；用户在终端/设置页批准、拒绝、撤销；grant 过期或撤销后恢复拒绝。
   - 状态变化：grant 首版运行态保存；后续再决定是否持久化。
   - 输出：shell 风格授权结果、拒绝原因、trace 记录。
   - 上下游影响：grant 不绕过 Resource Write Policy；ST/订阅源写入仍需 fork/write-back 策略。
   - 进展：`ShellPermissionService` 支持订阅权限状态变化、保存拒绝原因；Terminal surface 增加审批列表，可批准/拒绝 pending request，也可撤销 active grant。

4. [done] Resource-backed FS 写入能力增强。
   - 目标：让 just-bash 的 `cp/mv/rm/mkdir/touch/tee/>/>>` 在资源域和 workspace 中按权限工作。
   - 输入：Bash FS 操作、Resource Ref、source kind、write policy、ShellPermissionDecision。
   - 处理流程：workspace 内走项目可写 FS；`/sources/local` 走 `ResourceService.saveResource/importResource`；`/sources/st` 进入写入策略；`/sources/subscriptions` 拒绝直接写回并提示 import/fork。
   - 状态变化：workspace 文件可变；Resource Domain 仍是业务真相源，不复制另一份资源状态。
   - 输出：更新后的文件内容、ResourceDocument、写入策略结果或权限错误。
   - 上下游影响：Prompt 绑定应继续保存 Resource Ref；shell 写入不能静默改变外部源。
   - 进展：`/sources/local` 的 `>`、`tee`、`cp` 写入完整 JSON 时统一进入 `VirtualFileSystemService.writeFile()` -> `ResourceService.saveResource()`；新资源路径按 path 中的 `resourceId` 创建本地资源。资源 mount 不支持 append/delete/move/directory mutation，返回 `unsupported_operation`；权限拒绝返回 `requires_grant`，外部源写入返回 `requires_policy` 或 readonly 结果。workspace 的常规文件命令继续由 permissioned `InMemoryFs` 承载。

5. [done] Shell 命令与 Agent 工具说明统一。
   - 目标：让 `help`、中文/英文手册、Agent system prompt 中的工具说明都来自同一份命令 metadata。
   - 输入：just-bash built-in command list、Lumina custom commands、权限需求、示例输入输出。
   - 处理流程：为 Lumina custom commands 定义 `name/summary/usage/examples/permissions/input/output/i18n`；built-in command 只记录被 Lumina 支持和推荐的子集。
   - 状态变化：命令说明不写死在 Vue 组件或 Agent prompt 中。
   - 输出：终端 `help`、Agent tool prompt、可测试 command manual snapshot。
   - 上下游影响：未来新增命令必须先进入 registry，避免 UI 文案、Agent 提示词与真实能力漂移。
   - 进展：新增 `ShellCommandManual`，Agent `getToolPrompt()` 与终端 `lw-help` 共用命令 metadata；metadata 覆盖 `cat/cp/mv/rm/mkdir/touch/tee/ls/tree/find/grep/jq/curl/lw-permission/lw-help`，并明确 just-bash `jq` 不是旧 VFS JSONPath `jq`。just-bash 原生 `help` 保留给 bash 内建命令，不覆盖。

6. [done] 网络能力最小闭环。
   - 目标：让 `curl` 只在 allow-list 与 grant 同时满足时可用。
   - 输入：URL allow-list、HTTP method、ShellSessionRef、network grant、可选 header transform。
   - 处理流程：用户终端或设置页管理 allow-list；Agent 只能申请 allow-list 内网络访问；Runtime 将网络配置注入 just-bash。
   - 状态变化：网络能力默认关闭；grant 不扩大 allow-list。
   - 输出：`curl` 输出、网络拒绝原因、trace。
   - 上下游影响：订阅源发现/浏览可以复用这套网络边界，但订阅源导入后仍生成本地 Resource Ref。
   - 进展：`ShellNetworkPolicyService` 统一 network config、allow-list、method 和 grant 检查。未配置网络时 `curl` 不存在；Agent session 命中 allow-list 后仍需 `lw-permission request network <url-prefix> --reason ...` 并批准 grant；allow-list 外 request 会直接拒绝，grant 不扩大 allow-list。

## just-bash 官方文档评估：任务 1 / 4 / 6

参考文档：

- `https://github.com/vercel-labs/just-bash/blob/main/packages/just-bash/README.md`
- `https://github.com/vercel-labs/just-bash/blob/main/packages/just-bash/src/transform/README.md`

### 任务 1：Shell UI 完整接入

结论：执行层应继续使用 `just-bash`，UI 层是否完全切到 `@wterm/just-bash` 需要继续受它的 adapter 扩展点约束；本项目不应退回自研 shell parser。

- 官方 `Bash` 已支持 custom commands，`defineCommand()` 可拿到 `fs/cwd/env/stdin/exec`，且能参与管道、重定向和 shell 特性，适合承载 `lw-permission`、后续 `lw-resource` 等 Lumina 命令。
- 官方 README 明确每次 `exec()` 的 env、函数和 cwd 会重置，只有文件系统跨调用共享。因此终端交互如果需要“连续 cd 后保持目录”，不能只依赖默认 `Bash.exec()` 状态；当前 `BashTerminalRuntime` 已在外层保存 cwd/env，并在每次 exec 后同步 `result.env`，后续 Shell UI adapter 只消费该 runtime state。
- just-bash 已内建 `help/history/clear` 等 shell utilities，但我们的终端 UI 仍需拦截显示层清屏、快捷键和补全；这些属于 UI adapter，不应重新解析 bash。
- transform API 的 `CommandCollectorPlugin` 可从 AST 收集命令名，适合为 Agent trace、安全审计、执行前权限预检查服务；不适合替代终端行编辑。

任务 1 更新后的最小正确方案：

1. 保持 `BashTerminalRuntime` 为唯一执行入口。
2. 保持 `ShellSessionState` 显式保存 cwd/env；`ShellSessionRuntime` 负责 viewport 和 exec/complete/resize trace。
3. 评估并封装 `@wterm/just-bash`：若不能注入自定义 `Bash`/FS/custom commands，则继续维护项目内 `BashShell.ts` + wterm 渲染组合。
4. 用 just-bash parser/transform 做执行前 command collection，而不是手写 parser。

### 任务 4：Resource-backed FS 写入能力增强

结论：任务 4 与 just-bash 官方 FS 模型高度匹配，应继续沿用 `MountableFs + 自定义 Resource-backed FS + workspace FS`，不要把资源导出成一份临时 JSON 树再让 shell 改。

- 官方 README 明确支持 `InMemoryFs`、`OverlayFs`、`ReadWriteFs` 与 `MountableFs`；`MountableFs` 可把只读知识库和可写 workspace 挂到同一命名空间。这与 `/sources`、`/library`、`/workspaces` 的架构完全一致。
- just-bash 已内建 `cat/cp/file/ln/ls/mkdir/mv/rm/rmdir/stat/touch/tree`，也支持 `>`、`>>`、`2>`、`<` 等重定向。因此任务 4 不应重复实现 Linux 文件命令，而应补齐自定义 FS 的方法语义和权限钩子。
- `/sources/local` 写入必须在 FS 层转译为 ResourceService 写入；`/sources/st` 与 `/sources/subscriptions` 即使 shell 命令语义允许写，也必须被 Resource Write Policy 拦住或引导 fork/import。
- 官方安全模型强调 shell 只能访问提供的 filesystem；这支持我们把敏感区直接不挂载或在 FS 层拒绝，而不是在命令层补丁式过滤。

任务 4 更新后的最小正确方案：

1. 补齐 `WorkspaceBashFs` 的 `mkdir/rmdir/rm/rename/link/symlink/touch` 语义，并全部经过 `ShellPermissionService`。
2. 补齐 `ResourceBackedBashFs` 的写入错误类型：readonly、requires_policy、requires_grant、unsupported_operation。
3. 对跨 mount `cp /sources/... /workspaces/...` 做重点测试，确认导入素材路径不绕过 ResourceService。
4. 对 `/sources/local` 的 `>`、`tee`、`cp` 写入统一进入 `VirtualFileSystemService.writeFile()`。

### 任务 6：网络能力最小闭环

结论：应优先使用 just-bash 官方 `network` 配置，而不是自造 `fetch` 形状；Agent grant 作为 allow-list 之外的第二道门。

- 官方 README 明确网络默认关闭；只有配置 `network` 后才存在 `curl`，否则 `curl` 会表现为 command not found。
- 官方 allow-list 支持 URL origin + path prefix、HTTP method 限制、redirect protection，以及 header transform；这些能力比当前手写 permissioned fetch 更完整。
- 本项目的权限模型应叠在官方 allow-list 之上：用户/设置页管理 allow-list，Agent 只能申请 allow-list 内的 `network` grant，grant 不能扩大 allow-list。
- 浏览器环境下 just-bash core 可用，但 Python、sqlite、js-exec、OverlayFs/ReadWriteFs 等部分能力不可用；网络与 Resource-backed FS 要按浏览器可用能力设计，不依赖 Node-only FS。

任务 6 更新后的最小正确方案：

1. 新增 `ShellNetworkPolicyService` 或扩展 `ShellPermissionService`，输出 just-bash `network.allowedUrlPrefixes/allowedMethods` 配置。
2. `BashTerminalRuntime` 构造时注入官方 `network` 配置；Agent session 在执行前检查 grant，必要时动态收窄 allow-list。
3. `lw-permission request network <url> --reason ...` 只允许申请已在 allow-list 内的 URL 前缀。
4. `curl` 失败时区分三类错误：未配置网络、URL 不在 allow-list、缺少 Agent grant。

## 任务 1/4/6 风险与未验证前提

- `@wterm/just-bash` 的公开 API 是否能接收项目内自定义 `Bash` 实例、FS 或 custom commands，仍需继续看包源码确认；目前仅确认 `just-bash` 本体支持这些扩展点。
- just-bash 的 `jq` 语法是 jq-like/built-in JSON command，不等同于之前 `VFSCommandService` 的 JSONPath 语法；Agent help 需要明确差异，避免旧示例误导。
- 官方 transform API 标注为 experimental；可用于 trace/审计和命令收集，但首版不应把安全边界完全建立在 transform 插件上。
- 浏览器环境下 Node-only FS 不可用；`/workspaces` 首版仍应使用自定义/in-memory/persistent bridge FS，而不是 `ReadWriteFs`。

## 新线程交接快照（2026-05-08）

当前主线：继续做 Agent Shell / Resource-backed FS，而不是回到早期 VFSCommandService 解析器路线。核心边界已经稳定为：

- `BashTerminalRuntime`：唯一 shell 执行入口，负责 just-bash、Resource-backed FS、cwd/env 连续性、`lw-permission` 与网络配置。
- `ShellSessionRuntime`：薄会话观测层，负责 `ShellSessionRef`、viewport、cwd/env snapshot、exec/complete/resize trace；不实现 shell、不持有资源真相。
- `TerminalRoot.vue`：wterm/Vue UI 层，处理渲染、输入法候选框锚点、选区/右键粘贴、resize 显示；不直接访问 ResourceService。
- `BashShell.ts`：项目内行编辑 adapter，负责方向键、历史、Tab 展示、中文/粘贴输入；底层只调用 runtime 的 `exec/completeLine/getCwd`。
- `AgentBashToolService`：bash-tool 兼容 adapter，给 Agent 暴露 `bash/readFile/writeFile` 和可选 `skill` tool；浏览器端不直接打包 bash-tool 的 Node/transform 实现。

最近完成：

- 新增 `ShellSessionRuntime` 与 `ShellSessionRuntime.test.ts`。
- `BashTerminalRuntime` 新增 `getSession()`，方便上层会话 runtime 读取稳定身份。
- 为 Vite 增加 `node:zlib` 浏览器 shim，清理 just-bash bundle 的 Node externalized 构建警告；若浏览器触发 `gzipSync/gunzipSync`，会得到明确 unsupported error。
- 完成任务 4/5/6：Resource-backed FS 写入错误类型、`/sources/local` path-based JSON 写入、`ShellCommandManual` / `lw-help` / Agent prompt metadata 合流，以及 `ShellNetworkPolicyService` 的 allow-list + Agent grant 闭环。
- PDR/System Design 已补充 Shell Session Runtime 边界。

已验证：

- `cd D:\LuminaWeave\luminaweave-extension; npm run test -- --run src/api/core/__tests__/ShellSessionRuntime.test.ts`
- `cd D:\LuminaWeave\luminaweave-extension; npm run test -- --run src/plugins/terminal/__tests__/BashShell.test.ts`
- `cd D:\LuminaWeave\luminaweave-extension; npm run test -- --run src/api/core/__tests__/ResourceRuntime.test.ts`
- `cd D:\LuminaWeave\luminaweave-extension; npm run type-check`
- `cd D:\LuminaWeave\luminaweave-extension; npm run build`

最新 build 结果：通过；`node:zlib externalized` 警告已消失，只剩既有 chunk size warning。

P2 判断：暂缓 DOM harness。当前 BashShell 行编辑和 ShellSessionRuntime 已有单测；IME 候选框、选中文本、resize 属于 `wterm + DOM + WASM` 真实交互问题，等继续修改 `TerminalRoot.vue` 或有稳定复现时，再用浏览器/组件级验证补 P2。

下一步优先级：

1. 继续任务 1：回到 Shell UI，真实验证 IME 候选框锚点、文本选中、右键粘贴和 resize 行列同步。
2. 继续任务 2：将 Forge 长期项目实体与 `projectId -> workspace` 持久化绑定接入真实 Forge 项目模型。
3. 后续补强：若订阅源 source adapter 落地，再把 `/sources/subscriptions` 的 import/fork 引导接入同一套 FS 错误与写入策略。

## 恢复方式

先读：

- `docs/index.md`
- `docs/overall/PDR.md`
- `docs/overall/system_design.md`
- `docs/current/tasks/standalone-resource-runtime/README.md`
- `luminaweave-extension/src/api/core/resource-runtime/README.md`
- `luminaweave-extension/src/plugins/terminal/README.md`

然后根据本 README 的“下一步优先级”继续实现。若目标仍是 Agent Shell，优先从任务 4/5/6 选一项推进；若目标切回 Prompt/资源绑定，再回到 TODO 6/8/9。
