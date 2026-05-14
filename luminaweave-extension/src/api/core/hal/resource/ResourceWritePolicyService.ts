import type {
    ResourceDiagnostic,
    ResourceRef,
    ResourceSaveResult,
    ResourceType
} from '@shared/resources/index.js';

export type ResourceWritePolicy = 'ask' | 'write_original' | 'fork_to_local' | 'save_to_local' | 'save_to_st';

const policyKey = (sourceId: string, resourceType: ResourceType): string => `${sourceId}:${resourceType}`;

export class ResourceWritePolicyService {
    private readonly policies = new Map<string, ResourceWritePolicy>();

    setDefaultPolicy(sourceId: string, resourceType: ResourceType, policy: ResourceWritePolicy): void {
        this.policies.set(policyKey(sourceId, resourceType), policy);
    }

    getDefaultPolicy(sourceId: string, resourceType: ResourceType): ResourceWritePolicy | null {
        return this.policies.get(policyKey(sourceId, resourceType)) ?? null;
    }

    resolvePolicy(ref: ResourceRef): ResourceWritePolicy {
        if (ref.sourceId === 'local') return 'write_original';
        if (ref.sourceId.startsWith('subscription')) {
            return this.getDefaultPolicy(ref.sourceId, ref.resourceType) ?? 'ask';
        }
        if (ref.sourceId === 'st') {
            return this.getDefaultPolicy(ref.sourceId, ref.resourceType) ?? 'ask';
        }
        return this.getDefaultPolicy(ref.sourceId, ref.resourceType) ?? 'ask';
    }

    createRequiresPolicyResult(ref: ResourceRef): ResourceSaveResult {
        const diagnostics: ResourceDiagnostic[] = [{
            level: 'info',
            code: 'RESOURCE_WRITE_POLICY_REQUIRED',
            message: `Editing ${ref.sourceId}/${ref.resourceType}/${ref.resourceId} requires an explicit write policy.`
        }];
        return { status: 'requires_policy', diagnostics };
    }

    createReadOnlyResult(ref: ResourceRef): ResourceSaveResult {
        return {
            status: 'rejected',
            diagnostics: [{
                level: 'warning',
                code: 'RESOURCE_SOURCE_READONLY',
                message: `Resource source "${ref.sourceId}" is read-only for ${ref.resourceType}.`
            }]
        };
    }
}

export const resourceWritePolicyService = new ResourceWritePolicyService();
