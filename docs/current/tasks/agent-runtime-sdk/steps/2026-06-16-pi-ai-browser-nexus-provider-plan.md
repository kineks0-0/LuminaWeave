# Pi AI Browser Nexus Provider Planning

## 背景

Forge pi runtime 早期把 Nexus preset / API 配置解析放在 `ForgePiNexusProvider` 中。该实现能让 Forge 前端直接使用 `@earendil-works/pi-ai`，但也让 Forge adapter 同时承担模型身份解析、API key 读取、generation settings 映射和请求 trace 包装。

`PiAiBrowserTransport` 不再作为独立设计推进。当前边界收敛为 `PiAiBrowserNexusProvider`：它只负责把 Nexus 设置解析为 pi-ai `Model<Api>` 与 `SimpleStreamOptions`，不负责 transport、SSE、代理路由、Forge session tree 或模型请求 trace。

## 目标

- Forge 创建 pi-agent-core `Agent` 时继续保持 quickstart 风格：`initialState.model` 接收一个已解析的 pi-ai `Model<Api>`。
- Forge 引用模型时只传 `presetId` 与 request header，不直接读取 `nexus.apis`。
- API key 只进入 `SimpleStreamOptions.apiKey`，不进入 Forge adapter 的 Nexus 配置解析逻辑。
- 模型发现通过 Agent Runtime model provider 暴露 `listModels(providerId)`，不让 Forge UI 或 session 直接绑定 Nexus 细节。

## 设计

```text
ForgePiAgentSession
  -> ForgePiModelRegistry
      -> ForgePiNexusProvider
          -> AgentRuntimeModelProvider
              -> PiAiBrowserNexusProvider
                  -> getModel({ presetId, headers })
                  -> getStreamOptions({ presetId, generationSettings })
                  -> listModels(providerId)
```

`ForgePiNexusProvider` 继续负责 Forge 模型请求 trace、pi-ai stream 包装、cache usage 和同一 Forge turn 的多次模型调用归并。`PiAiBrowserNexusProvider` 不记录 Forge trace，也不持有 Forge runtime context。

## 接口

```ts
interface AgentRuntimeModelProvider {
    getModel(input?: AgentRuntimeModelRequest): Model<Api>;
    getStreamOptions(input?: AgentRuntimeModelRequest): SimpleStreamOptions;
    listModels(providerId: string): Promise<string[]>;
}
```

`getModel()` 对应 pi-agent-core README quickstart 中的 `getModel("anthropic", "...")` 位置；`getStreamOptions()` 承载 pi-ai 请求 options 中的 `apiKey`、`temperature` 和 `maxTokens`。

## 边界

- `PiAiBrowserNexusProvider` 是浏览器直连 provider，不是默认安全代理层。
- 如果后续需要隐藏 API key，应新增 server-backed `AgentRuntimeModelProvider` 实现同一接口，而不是恢复 `PiAiBrowserTransport`。
- Forge adapter 不拥有 Nexus API key 读取逻辑；它只消费 Agent Runtime model provider 输出。
- `@earendil-works/pi-coding-agent`、`pi-agent-core/node`、`node:fs` 和 `node:child_process` 仍不得进入前端 Forge runtime。

## 验证

- `PiAiBrowserNexusProvider.test.ts` 覆盖 preset 到 pi-ai model/options 的映射、Anthropic / Google API id 映射和模型发现委托。
- `ForgePiNexusProvider.test.ts` 覆盖 Forge provider 委托 Agent Runtime model provider，并确认 API key 通过 stream options 进入 pi-ai 请求。
