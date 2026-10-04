import { registerStandaloneFacadeRuntimeDriver } from '../../../host-drivers/standalone/StandaloneFacadeRuntimeDriver.js';
import { StandaloneChatSessionDirectoryProvider } from '../../../host-drivers/standalone/StandaloneChatHostProvider.js';
import { StandaloneConversationHostFacadePort } from '../../../host-drivers/standalone/StandaloneConversationHostFacadePort.js';
import { configureChatHostProvider } from '../../../conversation/ChatHostPorts.js';
import { configureConversationHostFacadePort } from '../../../facade/ConversationHostFacadePort.js';
import { registerLocalResourceSource } from './LocalResourceSourceProvider.js';

export function registerStandaloneRuntimePorts(): void {
    registerStandaloneFacadeRuntimeDriver();
    registerLocalResourceSource();
    configureChatHostProvider(new StandaloneChatSessionDirectoryProvider());
    configureConversationHostFacadePort(new StandaloneConversationHostFacadePort());
}
