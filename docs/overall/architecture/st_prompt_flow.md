# SillyTavern 提示词生成全流程深度解析

根据对 SillyTavern (ST) 源码（版本约 1.12+）的分析，提示词从用户点击「生成」到发送至 AI API 的过程是一个高度结构化的组装流水线。以下是详细的技术流程解析。

---

## 1. 入口点：生成触发 (Generate)

当用户在聊天框输入内容或点击「刷新/翻页」按钮时，核心控制器 `public/script.js` 中的 `Generate` 函数被调用。

- **主要职责**：收集当前的 UI 状态、活跃角色、群组信息、世界书设定等。
- **配置下发**：根据当前选择的 API（OpenAI, Claude, KoboldAI 等），调用对应的后端处理器。

---

## 2. 核心调度：PromptManager 与消息准备

对于目前主流的 OpenAI 兼容接口，核心逻辑起始于 `public/scripts/openai.js` 中的 `prepareOpenAIMessages`。

### 2.1 预设与系统提示词合流 (`preparePromptsForChatCompletion`)
在该阶段，ST 会将「预设 (Preset)」中的配置与「角色卡」中的内容进行初步合并：
1. **获取基础集合**：从 `PromptManager` 获取活跃角色/群组的 `PromptCollection`。
2. **注入角色信息**：通过 `promptManager.preparePrompt` 包装以下系统级标记：
   - `worldInfoBefore`: 世界书（在角色描述之前的部分）
   - `charDescription`: 角色描述 ({{char}} Description)
   - `charPersonality`: 角色性格 ({{char}} Personality)
   - `worldInfoAfter`: 世界书（在角色描述之后的部分）
   - `scenario`: 场景设定 (Scenario)
   - `personaDescription`: 用户设定 ({{user}} Persona)
3. **注入控制逻辑**：加入 `nsfw` 提示词、`jailbreak` (PHI) 提示词以及 `main` 主系统提示词。

---

## 3. 宏替换逻辑 (Macro Substitution)

这是 ST 提示词动态化的核心。`substituteParams` 函数（定义于 `script.js`，广泛应用于 `PromptManager` 和 `openai.js`）负责解析所有花括号宏。

- **基础宏**：`{{char}}`, `{{user}}`, `{{persona}}` 等直接从当前上下文替换。
- **高级宏**：调用 `public/scripts/macros.js` 中的 `evaluateMacros`，处理复杂逻辑：
  - **时间/日期**：`{{time}}`, `{{date}}`, `{{weekday}}`。
  - **随机/选择**：`{{random::A,B,C}}`, `{{pick::A,B,C}}`。
  - **逻辑控制**：`{{if ...}}`, `{{else}}`, `{{trim}}`（利用 Handlebars 引擎或正则替换）。
  - **动态输入**：`{{input}}`（获取文本框当前输入）。

---

## 4. 上下文组装与预算管理 (`populateChatCompletion`)

在所有的文本片段准备好并完成宏替换后，程序进入最具技术含量的「拼图」阶段。

### 4.1 预算预留 (Budgeting)
- 系统会首先预留一部分 Token 给「必须渲染」的部分（如回复前缀 `assistant:`）。
- 如果开启了「注入」功能，会计算扩展插件（如 Summary, Author's Note）所需的 Token。

### 4.2 消息排序与位置计算
ST 使用一套基于 `injection_position` 和 `injection_depth` 的索引算法：
1. **绝对位置提示词**：按照预设的深度（距离底部的消息数）插入聊天记录中。
2. **相对位置提示词**：
   - `start`: 放在整个 Prompts 的最开头。
   - `end`: 放在系统提示词区块的末尾。
3. **固定组件顺序**：通常顺序为 `World Info` -> `Main Prompt` -> `Character Info` -> `Scenario` -> `Jailbreak`。

### 4.3 聊天历史与示例 (Chat History & Examples)
- **对话示例 (Dialogue Examples)**：根据设置（是否固定、位置）按需插入。
- **聊天记录 (Chat History)**：从最后一条消息开始向前遍历，直到达到 `Context Size` 限制。ST 会智能截断过长的历史记录，确保最新的消息优先级最高。

---

## 5. 最终合流：发送至接口

所有组件被推入一个 `MessageCollection`（消息集合），最终被转换成 API 所需的标准 JSON 格式。

### 示例输出结构 (OpenAI 模式)：
```json
[
  { "role": "system", "content": "... (Main Prompt + Char Info + Substitution)" },
  { "role": "system", "content": "... (World Info Entry)" },
  { "role": "user", "content": "(Dialogue Example Q)" },
  { "role": "assistant", "content": "(Dialogue Example A)" },
  { "role": "user", "content": "... (Old Chat Message)" },
  { "role": "assistant", "content": "... (Old Chat Message)" },
  { "role": "system", "content": "... (Author's Note / Depth Prompt)" },
  { "role": "user", "content": "... (Current User Input)" }
]
```

### 特殊处理
- **Instruct 模式**：如果不是 OpenAI 模式，会在 `openai.js` 或其他后端脚本中将上述数组转换为单条长字符串，并根据 `Instruct Template` 插入 `### Instruction` 或 `Response:` 等标记。
- **Token 截断**：如果总 Token 超过限制，系统会抛出 `TokenBudgetExceededError` 或按优先级按需舍弃历史记录。

---

## 总结：数据流图示

`User Input` ──> `Generate()` ──> `substituteParams()` ──> `PromptManager (Collect)` ──> `populateChatCompletion (Sort/Budget)` ──> `AI API Request`

- **灵活性源头**：所有的「预设 (Preset)」本质上是 `PromptManager` 中标识符为 `main`, `nsfw`, `jailbreak` 的内容模板。
- **一致性保证**：通过 `PromptManager` 的 `preparePrompt` 统一调用，确保了无论提示词在何处定义，其宏替换逻辑完全一致。

---
*文档更新日期：2026-03-22*
*分析基于 SillyTavern 源码实现*
