import { registerStandaloneFacadeRuntimeDriver } from '../../../host-drivers/standalone/StandaloneFacadeRuntimeDriver.js';
import { registerLocalResourceSource } from './LocalResourceSourceProvider.js';

export function registerStandaloneRuntimePorts(): void {
    registerStandaloneFacadeRuntimeDriver();
    registerLocalResourceSource();
}
