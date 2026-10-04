import type { Component } from 'vue';
import {
    Activity,
    ArrowLeft,
    BookMarked,
    BookOpen,
    Clapperboard,
    Copy,
    GitBranch,
    MessageCircle,
    MessageCirclePlus,
    Pencil,
    RefreshCw,
    Regex,
    Search,
    SearchCode,
    Trash2,
    UserRound,
    Waypoints
} from 'lucide-vue-next';
import type { ChatMenuIconId } from '../presentation/chatMenus.js';

export const CHAT_MENU_ICONS: Record<ChatMenuIconId, Component> = {
    copy: Copy,
    edit: Pencil,
    regenerate: RefreshCw,
    branch: GitBranch,
    delete: Trash2,
    newChat: MessageCirclePlus,
    openChat: MessageCircle,
    search: Search,
    profile: UserRound,
    prompt: SearchCode,
    timeline: Waypoints,
    lorebook: BookOpen,
    director: Clapperboard,
    stats: Activity,
    preset: BookMarked,
    regex: Regex,
    back: ArrowLeft
};
