import { ILuminaBridge } from './IBridge';

/**
 * 桥接分发器
 * 作为单例模式，为前端提供统一的请求入口。
 * 在 App 初始化时注入具体的实现 (HttpBridge, TauriBridge 等)。
 */
export class BridgeDispatcher {
    private static _bridge: ILuminaBridge | null = null;

    public static inject(bridge: ILuminaBridge) {
        this._bridge = bridge;
        console.log('[BridgeDispatcher] 成功注入宿主适配器:', bridge.constructor.name);
    }

    private static get bridge(): ILuminaBridge {
        if (!this._bridge) {
            throw new Error('[BridgeDispatcher] 尚未注入适配器！请在应用启动时先调用 BridgeDispatcher.inject()。');
        }
        return this._bridge;
    }

    public static get chat() { return this.bridge.chat; }
    public static get nexus() { return this.bridge.nexus; }
    public static get forge() { return this.bridge.forge; }
    public static get conversation() { return this.bridge.conversation; }
    public static get settings() { return this.bridge.settings; }
    public static get presets() { return this.bridge.presets; }
    public static get extensionStore() { return this.bridge.extensionStore; }
}
