import { IMacroResolver } from '../../interfaces.js';
import { STClient } from '../../../host-drivers/st/STClient.js';

/**
 * SillyTavern 宿主的宏替换实现
 */
export class STMacroResolver implements IMacroResolver {
    /**
     * 委托给 STClient 进行宏替换
     * 以后可以进一步下沉到直接访问 TavernHelper，但目前包装既有逻辑以最小化改动
     */
    resolve(content: string): string {
        return STClient.substituteMacros(content);
    }
}
