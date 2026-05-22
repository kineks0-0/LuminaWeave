# Classic Desktop Design

## Summary

Classic 是 LuminaWeave 的稳定工作台桌面。它优先服务常规插件操作、设置管理和多面板切换，视觉目标是安静、可信、低学习成本。

## Personality

- Quiet productivity
- Familiar navigation
- Low ornament
- Strong continuity between panels

## Information Architecture

Classic 使用传统顶部导航、主内容区和辅助面板。它适合用户在多个官方插件之间切换，不强调单一聊天模式的沉浸包装。

## Surface Model

- Header 承载桌面模式、全局会话上下文和主要入口。
- Main surface 承载当前插件主任务。
- Widget surface 承载辅助工具、上下文插件或临时面板。

## Typography

Classic 使用全局 Typography token 的中性表达：

- 页面标题使用 `title-large`。
- 面板标题使用 `title-medium`。
- 设置说明和表单辅助文本使用 `body-medium`。
- 控件、tabs、菜单项使用 `label-large`。

Classic 不强调 display 级别文字。它通过稳定层级和适度留白建立秩序。

## Color, Shape, Motion, Density

- Color: light-first neutral with sparse blue-violet accent.
- Shape: restrained rounded rectangles, no decorative shape language.
- Motion: short state transitions only.
- Density: medium density, suited to repeated tool work.

## Component States

状态表达应清晰但克制。选中态、hover、focus 使用背景层级和少量 accent，不依赖重阴影或强色块。

## Mobile Adaptation

Classic 在窄屏下优先保持任务连续性，辅助面板应转为单列临时页或 tab，而不是挤压主任务。

## Relation To Core Design Spec

Classic 是全局设计规范的默认中性实现。它不扩展额外 token，优先验证基础 token 是否足够支撑稳定产品 UI。
