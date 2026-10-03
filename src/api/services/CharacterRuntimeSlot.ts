import type { DesktopCharacterRuntime } from './DesktopExperienceRuntime.js';

/**
 * lwApi.services.character 的挂载槽。
 * 实例依赖 Pinia store，只能在 app.use(pinia) 之后由应用入口创建；api 层不能反向 import store，
 * 所以由入口挂载。读取早于挂载时抛错，避免调用方拿到 undefined 后在别处才崩。
 */
export class CharacterRuntimeSlot {
    private runtime: DesktopCharacterRuntime | null = null;

    attach(runtime: DesktopCharacterRuntime): void {
        if (this.runtime) {
            throw new Error('[LuminaWeave] Character runtime is already installed');
        }
        this.runtime = runtime;
    }

    get(): DesktopCharacterRuntime {
        if (!this.runtime) {
            throw new Error('[LuminaWeave] Character runtime is not installed yet');
        }
        return this.runtime;
    }
}
