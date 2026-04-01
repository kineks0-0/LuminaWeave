import { luminaWeaveApi } from './api/index';
import { lwStorage } from './api/storage';
import { createApp } from 'vue';
import { createPinia } from 'pinia';
import App from './App.vue';
import './style.css';

// ======= 1. 向外部全局环境暴露 LuminaWeave API =======
(window as any).LuminaWeave = luminaWeaveApi;

    // ======= 2. 插件的入口生命周期 =======
    export async function init() {
        console.log('[LuminaWeave] 初始化开始...');

    // 获取/创建挂载点容器
    const containerId = 'luminaweave-root';
    let container = document.getElementById(containerId);

    if (!container) {
        container = document.createElement('div');
        container.id = containerId;
        // z-index 设高，保证在其他界面上方
        container.style.position = 'fixed';
        container.style.top = '0';
        container.style.left = '0';
        container.style.width = '100%';
        container.style.height = '100%';
        container.style.pointerEvents = 'none'; // 透传鼠标事件，App.vue 内部交互元素再设为 auto
        container.style.zIndex = '99999';
        document.body.appendChild(container);
    }

    // ======= 3. 决定是否启用 Shadow DOM 隔离 (CSS Isolation) =======
    // 强制先拉取一次全局设置 (Shadow DOM 状态)
    await lwStorage.loadIndependentGlobalData();
    const useShadowDom = lwStorage.get('lumina-settings.useShadowDom', true, 'Global');

    let renderTarget: HTMLElement | ShadowRoot;

    if (useShadowDom) {
        console.log('[LuminaWeave] 正在启用 Shadow DOM 隔离层...');
        renderTarget = container.attachShadow({ mode: 'open' });
    } else {
        console.log('[LuminaWeave] Shadow DOM 已禁用，直接挂载到原生 DOM。');
        renderTarget = container;
        // 如果不使用 Shadow DOM，容器本身的 pointerEvents 可能会干扰下面元素的交互，如果是 none 的话。
        // 原本 container 就是 pointer-events: none; 这里保持不变，App.vue 内部会设置 auto。
    }

    // 创建应用挂载点
    const appRoot = document.createElement('div');
    appRoot.id = 'lw-vue-app';
    appRoot.style.width = '100%';
    appRoot.style.height = '100%';
    renderTarget.appendChild(appRoot);

    // 创建 Teleport 目标点（用于隔离环境内的弹窗渲染）
    const teleportTarget = document.createElement('div');
    teleportTarget.id = 'lw-teleport-target';
    renderTarget.appendChild(teleportTarget);

    // 样式注入辅助函数 (辅助实现 Shadow DOM 彻底隔离)
    const injectStyles = () => {
        if (!useShadowDom) return;

        const isLuminaStyle = (node: Node): boolean => {
            // 1. 开发模式下 Vite 注入的样式通常带有 data-vite-dev-id
            if (node instanceof HTMLElement && node.hasAttribute('data-vite-dev-id')) {
                return true;
            }

            // 2. 带有显式自定义标识的样式
            if (node instanceof HTMLElement && node.hasAttribute('data-lw-style')) {
                return true;
            }

            // 3. 生产模式或全局 CSS，检查其内容或链接地址是否包含 LuminaWeave
            if (node instanceof HTMLStyleElement) {
                const content = node.textContent || '';
                // Vue SFC 样式包含 data-v-，插件全局样式包含 LuminaWeave
                return content.includes('LuminaWeave') || content.includes('data-v-');
            }

            if (node instanceof HTMLLinkElement) {
                const href = node.href || '';
                
                // 优先排除已知的不属于插件的全局样式
                // 用户反馈：禁止导入 127.0.0.1:800/styles.css (ST 主样式)
                const isRootStyle = href.endsWith('/styles.css') || href.endsWith('/style.css');
                if (isRootStyle && !href.includes('/extensions/')) {
                    return false;
                }

                // 检查 href 是否明确指向 LuminaWeave 插件目录
                return href.includes('LuminaWeave') && href.includes('style.css');
            }

            return false;
        };

        // 1. 尝试克隆已存在的符合条件的样式
        const styleNodes = document.head.querySelectorAll('style, link[rel="stylesheet"]');
        styleNodes.forEach(node => {
            if (isLuminaStyle(node)) {
                console.log('[LuminaWeave] Cloning plugin style to Shadow DOM:', (node as any).href || 'inline block');
                renderTarget.appendChild(node.cloneNode(true));
            }
        });

        // 2. 监听后续动态注入的样式（针对 Vite HMR 或异步组件加载）
        const observer = new MutationObserver((mutations) => {
            mutations.forEach(mutation => {
                mutation.addedNodes.forEach(node => {
                    if ((node.nodeName === 'STYLE' || (node.nodeName === 'LINK' && (node as HTMLLinkElement).rel === 'stylesheet')) && isLuminaStyle(node)) {
                        console.log('[LuminaWeave] Dynamic plugin style detected and cloned:', (node as any).href || 'inline');
                        renderTarget.appendChild(node.cloneNode(true));
                    }
                });
            });
        });
        observer.observe(document.head, { childList: true });
    };

    injectStyles();

    const app = createApp(App);
    const pinia = createPinia();
    app.use(pinia);
    // 双 key 注入：$lw (旧) 和 lwApi (新组件使用)，保持兼容
    app.provide('$lw', luminaWeaveApi);
    app.provide('lwApi', luminaWeaveApi);
    app.mount(appRoot);

    console.log(`[LuminaWeave] 挂载完成。Shadow DOM 状态: ${useShadowDom ? '开启' : '关闭'}`);
}


// 立即执行初始化
init().catch(console.error);
