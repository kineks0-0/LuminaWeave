import { IHostProvider } from "../../interfaces.js";
import { HALContext } from "../../HALContext.js";
import { DefaultSessionIdNormalizer } from "../../defaults/DefaultSessionIdNormalizer.js";
// 暂时复用 ST 的部分实现作为占位，后续 P2/P3 阶段将替换为纯净的 Mock 或独立驱动
import { STMacroResolver } from "../st/STMacroResolver.js";
import { SLEventBridge } from "./SLEventBridge.js";
import { StandaloneHostStorage } from "./StandaloneHostStorage.js";
import { STHostNetwork } from "../st/STHostNetwork.js";
import { STResourceProvider } from "../st/STResourceProvider.js";
import { DefaultBootstrapStorage } from "../../defaults/DefaultBootstrapStorage.js";
import { DefaultTokenCounter } from "../../defaults/DefaultTokenCounter.js";

/**
 * 独立 Web 模式宿主提供者
 * 负责组装脱离特定宿主环境的默认适配器
 */
export class StandaloneHostProvider implements IHostProvider {
  createContext(): HALContext {
    return new HALContext(
      new STMacroResolver(),
      new DefaultSessionIdNormalizer(),
      new SLEventBridge(),
      new StandaloneHostStorage(),
      new STHostNetwork(),
      new STResourceProvider(),
      new DefaultBootstrapStorage(),
      new DefaultTokenCounter(),
    );
  }
}
