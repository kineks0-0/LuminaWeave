import type { Component } from 'vue';
import type { LifecycleType } from '@shared/XMLTagRegistry.js';
import type { PromptFragment } from '../../api/core/hal/prompt/PromptRegistry.js';
import type { InterceptorCallback } from '../../api/core/xml-view/XMLInterceptor.js';
import type { IncrementalProvider, StateProvider } from '../../api/core/runtime-utils/MemoryManager.js';
import type { RegisteredPanelConfig } from '../../api/services/DesktopSurfaceService.js';
import type { PluginRegistrationScope, RegistrationDisposer } from './PluginRegistrationScope.js';

export type PluginMemoryProvider = StateProvider | IncrementalProvider;
export type PluginXMLHandler = InterceptorCallback;
export type PluginEventListener = (...args: unknown[]) => void;

/**
 * 插件 `init(context)` 获得的作用域化注册入口（只含类型，SDK 可导出）。
 * 每个注册方法返回 disposer，并已自动登记进该插件的 PluginRegistrationScope：
 * 插件卸载或 init 失败回滚时一并撤销，插件通常无需自己保存 disposer。
 */
export interface PluginInitContext {
    readonly pluginId: string;
    readonly prompts: {
        /** 注册 Prompt 片段；撤销时只移除本次注册的对象（同 id 被后来者覆盖时不误删）。 */
        register(fragment: PromptFragment): RegistrationDisposer;
    };
    readonly xml: {
        /**
         * 注册 XML 标签解析器；sourceId 固定为 `plugin:<pluginId>`。
         * 定义回收只保证本插件自动补充的那份（该标签最后一个 handler 撤销时回收）；
         * 若他人的定义先存在、之后被撤销，本插件的 handler 会失去定义，这种情况不处理。
         */
        registerParser(tagName: string, lifecycle: LifecycleType, handler: PluginXMLHandler): RegistrationDisposer;
        registerPatternParser(pattern: RegExp, lifecycle: LifecycleType, handler: PluginXMLHandler): RegistrationDisposer;
    };
    readonly memory: {
        registerProvider(provider: PluginMemoryProvider): RegistrationDisposer;
    };
    readonly panels: {
        register(panelId: string, component: Component, options: RegisteredPanelConfig): RegistrationDisposer;
    };
    readonly events: {
        /** 订阅 lwApi 事件；撤销时 off。 */
        on(event: string, listener: PluginEventListener): RegistrationDisposer;
    };
    /** 登记任意清理逻辑（例如单例 setter 复位）。 */
    onDispose(disposer: RegistrationDisposer): void;
}

export type PluginInitContextFactory = (pluginId: string, scope: PluginRegistrationScope) => PluginInitContext;
