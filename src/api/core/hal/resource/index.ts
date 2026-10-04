import { ResourceService } from './ResourceService.js';
import { ResourceSourceRegistry } from './ResourceSourceRegistry.js';
import { PromptResourceResolver } from './PromptResourceResolver.js';
import { VirtualFileSystemService } from './VirtualFileSystemService.js';
import { CharacterImportService } from './CharacterImportService.js';

export * from './ResourceSource.js';
export * from './ResourceSourceRegistry.js';
export * from './ResourceService.js';
export * from './CharacterImportService.js';
export * from './PromptResourceResolver.js';
export * from './VirtualFileSystemService.js';
export * from './ResourceWritePolicyService.js';
export * from './PromptResourceBindingService.js';
import { PromptResourceBindingService, promptResourceBindingService } from './PromptResourceBindingService.js';
export { promptResourceBindingService };
export * from './LuminaWorldbookTriggerEngine.js';

export const resourceSourceRegistry = new ResourceSourceRegistry();
export const resourceService = new ResourceService(resourceSourceRegistry);
export const characterImportService = new CharacterImportService(resourceService);
export const promptResourceResolver = new PromptResourceResolver(resourceService);
export const virtualFileSystemService = new VirtualFileSystemService(resourceSourceRegistry, resourceService);
