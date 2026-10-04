/**
 * 模式专属 CSS 的注入与卸载。模式包以 `[data-desktop-mode]` / `data-skin-variant`
 * 为选择器根交付自己的设计系统，注销模式时对应 `<style>` 一并移除。
 *
 * 应用运行在 Shadow DOM 隔离层中：宿主可查询时会注入 shadow root；影子根尚不存在
 * （启动早期注册）时先写入 document.head，挂载时由现有样式克隆逻辑带入影子根。
 * 卸载会清理所有已知宿主，避免残留。
 */

export interface DesktopModeStyleElement {
    textContent: string | null;
    setAttribute(name: string, value: string): void;
    remove(): void;
}

export interface DesktopModeStyleHost {
    querySelector(selector: string): DesktopModeStyleElement | null;
    appendToHost(element: DesktopModeStyleElement): void;
}

export const DESKTOP_MODE_STYLE_ATTRIBUTE = 'data-lw-desktop-mode';

const wrapHost = (source: ParentNode): DesktopModeStyleHost => ({
    querySelector: selector => source.querySelector(selector),
    appendToHost: element => {
        // 元素由当前 document 创建，实际是 Node；这里只做接口收窄。
        source.appendChild(element as unknown as Node);
    }
});

const resolveStyleHosts = (): DesktopModeStyleHost[] => {
    if (typeof document === 'undefined') return [];
    const hosts: DesktopModeStyleHost[] = [];
    const appRoot = document.getElementById('lw-vue-app');
    const root = appRoot?.getRootNode();
    if (root instanceof ShadowRoot) {
        hosts.push(wrapHost(root));
    }
    hosts.push(wrapHost(document.head));
    return hosts;
};

export const applyDesktopModeStyles = (
    desktopModeId: string,
    styles: string | undefined,
    hosts: DesktopModeStyleHost[] | null = resolveStyleHosts(),
    createStyleElement: () => DesktopModeStyleElement = () => document.createElement('style')
): void => {
    if (!hosts || hosts.length === 0) return;
    const selector = `style[${DESKTOP_MODE_STYLE_ATTRIBUTE}="${desktopModeId}"]`;
    hosts.forEach(host => host.querySelector(selector)?.remove());
    if (!styles) return;
    const element = createStyleElement();
    element.setAttribute(DESKTOP_MODE_STYLE_ATTRIBUTE, desktopModeId);
    // 启动早期影子根尚未创建：带上该标记，挂载时注入器会把样式克隆进 Shadow DOM。
    element.setAttribute('data-lw-style', 'desktop-mode');
    element.textContent = styles;
    hosts[0].appendToHost(element);
};
