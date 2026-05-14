import { STResourceSource } from '../../../host-drivers/st/STResourceSource.js';
import { resourceSourceRegistry } from '../../resource/index.js';

let registered = false;

export function registerSTResourceSource(): void {
    if (registered) return;
    resourceSourceRegistry.registerSource(new STResourceSource());
    registered = true;
}
