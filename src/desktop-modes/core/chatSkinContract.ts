/**
 * chat.main 皮肤变量契约：桌面模式只能通过这些变量影响聊天外观，聊天组件也只读取这些变量。
 * 新增变量时同时更新 base 皮肤（builtins/shared.ts）与消费组件，chatSkinContract.test.ts 会校验三者一致。
 */

/** 由 CSS 消费的样式变量 */
export const CHAT_SKIN_STYLE_VARS = {
    // 版面
    '--lw-chat-stream-bg': '聊天面板背景',
    '--lw-chat-scroll-bg': '消息区图案层（如 Telegram 壁纸）',
    '--lw-chat-scroll-bg-size': '消息区图案层平铺尺寸',
    '--lw-chat-header-bg': '聊天顶栏背景',
    '--lw-chat-input-area-bg': '输入区背景',
    '--lw-chat-scroll-padding': '消息区内边距',
    '--lw-chat-content-gap': '消息组之间的间距',
    '--lw-chat-group-gap': '同一发言组内连续消息的间距',
    '--lw-chat-page-width': '消息区与输入区的最大宽度（合法 CSS 长度）',
    '--lw-chat-color': '消息正文颜色',
    // 消息
    '--lw-chat-bubble': 'AI 气泡背景',
    '--lw-chat-user-bubble': '用户气泡背景',
    '--lw-chat-border': 'AI 气泡边框颜色',
    '--lw-chat-user-bubble-border': '用户气泡边框颜色',
    '--lw-chat-bubble-radius': '气泡圆角',
    '--lw-chat-bubble-shadow': '气泡阴影',
    '--lw-chat-message-max-width': '气泡最大宽度',
    '--lw-chat-message-hover-bg': '消息行悬停背景',
    '--lw-chat-avatar-size': '头像尺寸',
    '--lw-chat-avatar-radius': '头像圆角',
    '--lw-chat-avatar-shadow': '头像阴影',
    // 排版
    '--lw-chat-font': '正文字体族',
    '--lw-chat-font-weight': '正文字重',
    '--lw-chat-font-size': '正文字号',
    '--lw-chat-line-height': '正文行高',
    '--lw-chat-paragraph-spacing': '段落间距',
    '--lw-chat-letter-spacing': '正文字距',
    '--lw-chat-assistant-font-size': 'AI 消息字号',
    '--lw-chat-assistant-line-height': 'AI 消息行高',
    '--lw-chat-assistant-letter-spacing': 'AI 消息字距',
    '--lw-chat-user-font-size': '用户消息字号',
    '--lw-chat-user-line-height': '用户消息行高',
    '--lw-chat-user-letter-spacing': '用户消息字距',
    // 输入区
    '--lw-chat-input-surface': '输入框背景',
    '--lw-chat-input-border': '输入框边框颜色',
    '--lw-chat-input-radius': '输入框圆角',
    '--lw-chat-input-shadow': '输入框阴影',
    '--lw-chat-input-focus-border': '输入框聚焦边框颜色',
    '--lw-chat-input-focus-shadow': '输入框聚焦阴影',
    '--lw-chat-menu-shadow': '聊天菜单阴影',
    // 空状态
    '--lw-chat-empty-mark-bg': '空会话标记背景',
    '--lw-chat-empty-mark-shadow': '空会话标记阴影'
} as const;

/** 由 JS 解析为展示偏好（不直接参与 CSS）的值 */
export const CHAT_SKIN_PRESENTATION_KEYS = {
    '--lw-chat-layout': '消息呈现布局：classic | discord | telegram',
    '--lw-chat-assistant-shape': 'AI 消息形态：bubble | document',
    '--lw-chat-user-shape': '用户消息形态：bubble | document',
    '--lw-chat-assistant-avatar-placement': 'AI 头像位置',
    '--lw-chat-user-avatar-placement': '用户头像位置',
    '--lw-chat-user-name-display': '是否显示发言者名称：inline-flex | none'
} as const;

export type ChatSkinStyleVar = keyof typeof CHAT_SKIN_STYLE_VARS;
export type ChatSkinPresentationKey = keyof typeof CHAT_SKIN_PRESENTATION_KEYS;

export const CHAT_SKIN_VARS: ReadonlyArray<ChatSkinStyleVar | ChatSkinPresentationKey> = [
    ...(Object.keys(CHAT_SKIN_STYLE_VARS) as ChatSkinStyleVar[]),
    ...(Object.keys(CHAT_SKIN_PRESENTATION_KEYS) as ChatSkinPresentationKey[])
];

/** 把设置值转换为合法的 CSS 宽度：'auto' → 100%，数字 → px。 */
export const resolveChatPageWidth = (value: unknown): string => {
    const numeric = typeof value === 'number' ? value : Number(value);
    if (value === 'auto' || value === undefined || value === null || value === '' || !Number.isFinite(numeric) || numeric <= 0) {
        return '100%';
    }
    return `${numeric}px`;
};
