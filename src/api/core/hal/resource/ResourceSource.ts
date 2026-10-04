import type {
    ResourceDocument,
    ResourceListQuery,
    ResourceRef,
    ResourceSaveResult,
    ResourceSourceDescriptor,
    ResourceType,
    ResourceWriteOptions
} from '@shared/resources/index.js';

export interface ResourceSource {
    readonly descriptor: ResourceSourceDescriptor;
    mount?(options?: Record<string, unknown>): Promise<void> | void;
    listResources(query?: ResourceListQuery): Promise<ResourceDocument[]>;
    getResource(ref: ResourceRef): Promise<ResourceDocument | null>;
    saveResource?(ref: ResourceRef, payload: unknown, options?: ResourceWriteOptions): Promise<ResourceSaveResult>;
    deleteResource?(ref: ResourceRef): Promise<boolean>;
    forkResource?(ref: ResourceRef, targetSourceId: string): Promise<ResourceDocument>;
    importResource?(resourceType: ResourceType, payload: unknown): Promise<ResourceDocument>;
    exportResource?(ref: ResourceRef): Promise<unknown>;
}
