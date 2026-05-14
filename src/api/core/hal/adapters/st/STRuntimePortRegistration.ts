import { registerSTChatHostProvider } from '../../../host-drivers/st/STChatHostProvider.js';
import { registerSTChatMessageMutationPort } from '../../../host-drivers/st/STChatMessageMutationPort.js';
import { registerSTChatSyncPort } from '../../../host-drivers/st/STChatSyncPort.js';
import { registerSTConversationHostFacadePort } from '../../../host-drivers/st/STConversationHostFacadePort.js';
import { registerSTFacadeRuntimeDriver } from '../../../host-drivers/st/STFacadeRuntimeDriver.js';
import { registerSTForgeTestChatHostPort } from '../../../host-drivers/st/STForgeTestChatDriver.js';
import { registerSTLorebookHostPort } from '../../../host-drivers/st/STLorebookHostPort.js';
import { registerSTResourceSource } from './STResourceSourceProvider.js';
import { registerLocalResourceSource } from '../standalone/LocalResourceSourceProvider.js';

export function registerSTRuntimePorts(): void {
    registerSTFacadeRuntimeDriver();
    registerSTChatHostProvider();
    registerSTChatSyncPort();
    registerSTForgeTestChatHostPort();
    registerSTChatMessageMutationPort();
    registerSTConversationHostFacadePort();
    registerSTLorebookHostPort();
    registerSTResourceSource();
    registerLocalResourceSource();
}
