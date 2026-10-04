/** 聊天内弹出菜单（Telegram 式）的菜单项与弹出方向：纯数据，图标由视图层按 icon id 映射。 */

export type ChatMenuIconId =
    | 'copy'
    | 'edit'
    | 'regenerate'
    | 'branch'
    | 'delete'
    | 'newChat'
    | 'openChat'
    | 'search'
    | 'profile'
    | 'prompt'
    | 'timeline'
    | 'lorebook'
    | 'director'
    | 'stats'
    | 'preset'
    | 'regex'
    | 'back';

export interface ChatMenuItem<Id extends string = string> {
    id: Id;
    label: string;
    icon: ChatMenuIconId;
    danger?: boolean;
    disabled?: boolean;
    /** 当前生效项（预设切换等），视图层在行尾显示勾选。 */
    selected?: boolean;
}

/** 提示词预设的菜单展示形态：只保留菜单需要的字段。 */
export interface ChatPromptPresetOption {
    id: string;
    name: string;
    promptCount: number;
}

export type ChatMessageMenuAction = 'copy' | 'edit' | 'regenerate' | 'branch' | 'branch-rerun' | 'delete';

/** 消息动作单一来源：菜单、悬浮操作栏与分发共用同一份 label/icon/danger。 */
const MESSAGE_ACTION_ITEMS: Record<ChatMessageMenuAction, ChatMenuItem<ChatMessageMenuAction>> = {
    copy: { id: 'copy', label: '复制', icon: 'copy' },
    edit: { id: 'edit', label: '编辑', icon: 'edit' },
    regenerate: { id: 'regenerate', label: '重新生成', icon: 'regenerate' },
    branch: { id: 'branch', label: '从此处分支', icon: 'branch' },
    'branch-rerun': { id: 'branch-rerun', label: '从此分支重发', icon: 'branch' },
    delete: { id: 'delete', label: '删除', icon: 'delete', danger: true }
};

const withDisabled = (
    item: ChatMenuItem<ChatMessageMenuAction>,
    disabled: boolean
): ChatMenuItem<ChatMessageMenuAction> => ({ ...item, disabled });

export const buildChatMessageMenu = ({ isUser, disabled }: {
    isUser: boolean;
    disabled: boolean;
}): ChatMenuItem<ChatMessageMenuAction>[] => {
    const items: ChatMenuItem<ChatMessageMenuAction>[] = [
        MESSAGE_ACTION_ITEMS.copy,
        withDisabled(MESSAGE_ACTION_ITEMS.edit, disabled)
    ];
    if (!isUser) {
        items.push(
            withDisabled(MESSAGE_ACTION_ITEMS.regenerate, disabled),
            withDisabled(MESSAGE_ACTION_ITEMS.branch, disabled)
        );
    } else {
        items.push(withDisabled(MESSAGE_ACTION_ITEMS['branch-rerun'], disabled));
    }
    items.push(withDisabled(MESSAGE_ACTION_ITEMS.delete, disabled));
    return items;
};

/** 悬浮操作栏项目：不带复制；user = 编辑/删除；assistant = 编辑/重新生成/分支/删除。 */
export const buildChatMessageToolbar = ({ isUser, disabled }: {
    isUser: boolean;
    disabled: boolean;
}): ChatMenuItem<ChatMessageMenuAction>[] => [
    withDisabled(MESSAGE_ACTION_ITEMS.edit, disabled),
    ...(isUser
        ? []
        : [
            withDisabled(MESSAGE_ACTION_ITEMS.regenerate, disabled),
            withDisabled(MESSAGE_ACTION_ITEMS.branch, disabled)
        ]),
    withDisabled(MESSAGE_ACTION_ITEMS.delete, disabled)
];

export type ChatHeaderMenuAction = 'search' | 'profile' | 'prompt' | 'prompt-presets' | 'regex-scripts';

export const buildChatHeaderMenu = ({ canOpenProfile, showPromptAssets = false }: {
    canOpenProfile: boolean;
    showPromptAssets?: boolean;
}): ChatMenuItem<ChatHeaderMenuAction>[] => [
    { id: 'search', label: '搜索', icon: 'search' },
    ...(canOpenProfile ? [{ id: 'profile' as const, label: '角色资料', icon: 'profile' as const }] : []),
    { id: 'prompt', label: 'Prompt 预览', icon: 'prompt' },
    ...(showPromptAssets ? [
        { id: 'prompt-presets' as const, label: '提示词预设', icon: 'preset' as const },
        { id: 'regex-scripts' as const, label: '正则脚本', icon: 'regex' as const }
    ] : [])
];

export type ChatPromptPresetMenuAction = 'manage-prompt-presets' | `preset:${string}`;

/** 预设切换子菜单：当前项带勾选，末行永远提供管理入口。 */
export const buildPromptPresetMenu = (
    presets: ReadonlyArray<ChatPromptPresetOption>,
    activeId: string
): ChatMenuItem<ChatPromptPresetMenuAction>[] => [
    ...presets.map(preset => ({
        id: `preset:${preset.id}` as ChatPromptPresetMenuAction,
        label: preset.name,
        icon: 'preset' as const,
        selected: preset.id === activeId
    })),
    { id: 'manage-prompt-presets', label: '管理预设…', icon: 'edit' }
];

export type ConversationSessionMenuAction = 'rename' | 'duplicate' | 'delete';

/** 会话管理菜单：聊天列表与角色资料页共用同一套菜单项 */
export const buildConversationSessionMenu = (): ChatMenuItem<ConversationSessionMenuAction>[] => [
    { id: 'rename', label: '重命名', icon: 'edit' },
    { id: 'duplicate', label: '复制', icon: 'copy' },
    { id: 'delete', label: '删除', icon: 'delete', danger: true }
];

/** 会话行菜单弹出方向：下方空间不足（滚动容器 / 资料卡会裁剪）时向上弹 */
export const resolveSessionMenuPlacement = (
    rowRect: Pick<DOMRect, 'bottom'>,
    containerRect: Pick<DOMRect, 'bottom'>,
    menuHeight = 170
): ChatMenuPlacement => (rowRect.bottom + menuHeight > containerRect.bottom ? 'above' : 'below');

/** 输入框“菜单”键里的 Lumina 工具（对应 Telegram 机器人菜单） */
export const CHAT_CONTEXT_TOOLS: ReadonlyArray<ChatMenuItem> = [
    { id: 'lumina-timeline', label: '时间线', icon: 'timeline' },
    { id: 'lumina-lorebook', label: '世界书', icon: 'lorebook' },
    { id: 'lumina-director', label: '导演面板', icon: 'director' },
    { id: 'lumina-stats', label: '状态', icon: 'stats' }
];

export type ChatMenuPlacement = 'above' | 'below';

export interface ChatPopoverAnchorPoint {
    x: number;
    y: number;
}

export interface ChatPopoverBounds {
    left: number;
    top: number;
    right: number;
    bottom: number;
}

export interface ChatPopoverPosition {
    left: number;
    top: number;
}

/** 指针锚定定位：默认落在指针右下方，空间不足时向左/上翻转，最后夹在可用区域内。 */
export const resolveChatPopoverPosition = ({
    anchor,
    size,
    bounds,
    offset = 4,
    margin = 8
}: {
    anchor: ChatPopoverAnchorPoint;
    size: { width: number; height: number };
    bounds: ChatPopoverBounds;
    offset?: number;
    margin?: number;
}): ChatPopoverPosition => {
    let left = anchor.x + offset;
    let top = anchor.y + offset;
    if (left + size.width > bounds.right - margin) left = anchor.x - offset - size.width;
    if (top + size.height > bounds.bottom - margin) top = anchor.y - offset - size.height;
    const minLeft = bounds.left + margin;
    const minTop = bounds.top + margin;
    left = Math.min(Math.max(left, minLeft), Math.max(minLeft, bounds.right - margin - size.width));
    top = Math.min(Math.max(top, minTop), Math.max(minTop, bounds.bottom - margin - size.height));
    return { left, top };
};
