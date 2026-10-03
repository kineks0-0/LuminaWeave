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
    | 'stats';

export interface ChatMenuItem<Id extends string = string> {
    id: Id;
    label: string;
    icon: ChatMenuIconId;
    danger?: boolean;
    disabled?: boolean;
}

export type ChatMessageMenuAction = 'copy' | 'edit' | 'regenerate' | 'branch' | 'delete';

export const buildChatMessageMenu = ({ isUser, disabled }: {
    isUser: boolean;
    disabled: boolean;
}): ChatMenuItem<ChatMessageMenuAction>[] => {
    const items: ChatMenuItem<ChatMessageMenuAction>[] = [
        { id: 'copy', label: '复制', icon: 'copy' },
        { id: 'edit', label: '编辑', icon: 'edit', disabled }
    ];
    if (!isUser) {
        items.push(
            { id: 'regenerate', label: '重新生成', icon: 'regenerate', disabled },
            { id: 'branch', label: '从此处分支', icon: 'branch', disabled }
        );
    }
    items.push({ id: 'delete', label: '删除', icon: 'delete', danger: true, disabled });
    return items;
};

export type ChatHeaderMenuAction = 'search' | 'profile' | 'prompt';

export const buildChatHeaderMenu = ({ canOpenProfile }: {
    canOpenProfile: boolean;
}): ChatMenuItem<ChatHeaderMenuAction>[] => [
    { id: 'search', label: '搜索', icon: 'search' },
    ...(canOpenProfile ? [{ id: 'profile' as const, label: '角色资料', icon: 'profile' as const }] : []),
    { id: 'prompt', label: 'Prompt 预览', icon: 'prompt' }
];

/** 输入框“菜单”键里的 Lumina 工具（对应 Telegram 机器人菜单） */
export const CHAT_CONTEXT_TOOLS: ReadonlyArray<ChatMenuItem> = [
    { id: 'lumina-timeline', label: '时间线', icon: 'timeline' },
    { id: 'lumina-lorebook', label: '世界书', icon: 'lorebook' },
    { id: 'lumina-director', label: '导演面板', icon: 'director' },
    { id: 'lumina-stats', label: '状态', icon: 'stats' }
];

export type ChatMenuPlacement = 'above' | 'below';

/** 下方放得下就放下方，否则放上方；两边都放不下时取空间更大的一侧。 */
export const resolveChatMenuPlacement = ({ anchorTop, anchorBottom, viewport, menuHeight }: {
    anchorTop: number;
    anchorBottom: number;
    viewport: { top: number; bottom: number };
    menuHeight: number;
}): ChatMenuPlacement => {
    const spaceBelow = viewport.bottom - anchorBottom;
    const spaceAbove = anchorTop - viewport.top;
    if (spaceBelow >= menuHeight) return 'below';
    if (spaceAbove >= menuHeight) return 'above';
    return spaceAbove > spaceBelow ? 'above' : 'below';
};
