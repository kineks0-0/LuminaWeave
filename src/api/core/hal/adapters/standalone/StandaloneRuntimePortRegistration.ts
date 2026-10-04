import { registerStandaloneFacadeRuntimeDriver } from '../../../host-drivers/standalone/StandaloneFacadeRuntimeDriver.js';
import { StandaloneChatSessionDirectoryProvider } from '../../../host-drivers/standalone/StandaloneChatHostProvider.js';
import { StandaloneConversationHostFacadePort } from '../../../host-drivers/standalone/StandaloneConversationHostFacadePort.js';
import { LocalLorebookHostPort } from '../../../host-drivers/standalone/LocalLorebookHostPort.js';
import { configureChatHostProvider } from '../../../conversation/ChatHostPorts.js';
import { configureLorebookHostPort } from '../../../lorebook/LorebookHostPort.js';
import { configureConversationHostFacadePort } from '../../../facade/ConversationHostFacadePort.js';
import { registerLocalResourceSource } from './LocalResourceSourceProvider.js';

export function registerStandaloneRuntimePorts(): void {
    registerStandaloneFacadeRuntimeDriver();
    registerLocalResourceSource();
    configureChatHostProvider(new StandaloneChatSessionDirectoryProvider());
    configureLorebookHostPort(new LocalLorebookHostPort());
    configureConversationHostFacadePort(new StandaloneConversationHostFacadePort());
}
