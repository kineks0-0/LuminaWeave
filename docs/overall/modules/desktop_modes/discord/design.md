# Discord Desktop Design

## Summary

Discord 是频道式桌面。它服务角色频道、历史会话扫描和快速进入聊天，视觉目标是高密度、快速识别和稳定频道组织。

## Personality

- Channel workspace
- Fast scanning
- Dense but controlled
- Conversation directory first

## Information Architecture

Discord 以角色频道和会话列表为主要导航。用户先定位角色或历史会话，再进入聊天或上下文工具。

## Surface Model

- Guild / mode rail 提供桌面模式和高层入口。
- Character rail 组织角色和会话。
- Main conversation surface 承载聊天或当前插件主任务。
- Widget surface 承载上下文工具。

## Typography

Discord 可使用更紧凑的 token 表达：

- 频道组标题使用 `label-small` 或 `label-medium`，可用 uppercase。
- 角色名、会话名使用 `title-small`。
- 会话预览使用 `body-small`。
- 聊天正文使用桌面模式聊天排版设置，默认略紧凑但不得牺牲中文长文阅读。

## Color, Shape, Motion, Density

- Color: restrained neutral layers, selected channel uses accent background.
- Shape: compact rounded rows, fewer card shells.
- Motion: minimal. State change must feel instant.
- Density: high density for rails and lists; chat正文保持舒适阅读。

## Component States

选中频道、hover 频道、活跃会话和 busy 状态需要能快速区分。不要用展开空块或过重卡片打断列表扫描。

## Mobile Adaptation

移动端 Discord 应以角色 sheet 或单列频道列表呈现，避免桌面多栏挤压。频道历史应分段折叠。

## Relation To Core Design Spec

Discord 可压缩列表 token 的使用密度，但不创建平行字号体系。频道和角色相关扩展 token 使用 `--lw-discord-*` 作用域。
