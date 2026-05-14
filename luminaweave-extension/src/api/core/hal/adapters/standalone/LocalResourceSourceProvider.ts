import { LocalResourceSource } from '../../../host-drivers/standalone/LocalResourceSource.js';
import { resourceSourceRegistry } from '../../resource/index.js';

let registered = false;

export function registerLocalResourceSource(): void {
    if (registered) return;
    resourceSourceRegistry.registerSource(new LocalResourceSource());
    registered = true;
}
