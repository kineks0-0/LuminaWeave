/**
 * 显示层正则集合变更通知。
 *
 * 全局正则库编辑、预设/角色绑定缓存刷新、本机禁用覆盖变化都会派发；
 * 组合根订阅后按新规则重投影历史消息的 mes，让已显示的消息即时跟上变化。
 */
export type RegexDisplayChangeListener = () => void;

const listeners = new Set<RegexDisplayChangeListener>();

export const onRegexDisplayChanged = (listener: RegexDisplayChangeListener): (() => void) => {
    listeners.add(listener);
    return () => {
        listeners.delete(listener);
    };
};

export const notifyRegexDisplayChanged = (): void => {
    listeners.forEach(listener => listener());
};
