import type { ResourceType, VFSPathResolution } from './types.js';

export const RESOURCE_TYPE_SEGMENTS: Record<ResourceType, string> = {
    character: 'characters',
    worldbook: 'worldbooks',
    preset: 'presets',
    regex: 'regex',
    memory: 'memory'
};

const SEGMENT_RESOURCE_TYPES = Object.fromEntries(
    Object.entries(RESOURCE_TYPE_SEGMENTS).map(([type, segment]) => [segment, type])
) as Record<string, ResourceType>;

const cleanPath = (path: string): string => {
    const normalized = `/${path || ''}`.replace(/\\/g, '/').replace(/\/+/g, '/');
    return normalized.length > 1 ? normalized.replace(/\/$/, '') : normalized;
};

export const resourceTypeToPathSegment = (resourceType: ResourceType): string => RESOURCE_TYPE_SEGMENTS[resourceType];

export const pathSegmentToResourceType = (segment: string): ResourceType | null =>
    SEGMENT_RESOURCE_TYPES[segment] ?? null;

export const buildSourceResourcePath = (
    sourceId: string,
    resourceType: ResourceType,
    resourceId?: string
): string => {
    const base = `/sources/${encodeURIComponent(sourceId)}/${resourceTypeToPathSegment(resourceType)}`;
    return resourceId ? `${base}/${encodeURIComponent(resourceId)}` : base;
};

export const buildLibraryPath = (resourceType: ResourceType, resourceId?: string): string => {
    const base = `/library/${resourceTypeToPathSegment(resourceType)}`;
    return resourceId ? `${base}/${encodeURIComponent(resourceId)}` : base;
};

export const parseVFSPath = (path: string): VFSPathResolution => {
    const normalized = cleanPath(path);
    if (normalized === '/') {
        return { kind: 'root', path: normalized };
    }

    const parts = normalized.split('/').filter(Boolean).map(decodeURIComponent);
    if (parts[0] === 'sources') {
        if (parts.length === 1) return { kind: 'source-root', path: normalized };
        const sourceId = parts[1];
        if (parts.length === 2) return { kind: 'source-root', sourceId, path: normalized };
        const resourceType = pathSegmentToResourceType(parts[2]);
        if (!resourceType) {
            throw new Error(`Unknown resource type path segment: ${parts[2]}`);
        }
        if (parts.length === 3) {
            return { kind: 'source-type', sourceId, resourceType, path: normalized };
        }
        return { kind: 'resource', sourceId, resourceType, resourceId: parts.slice(3).join('/'), path: normalized };
    }

    if (parts[0] === 'library') {
        if (parts.length === 1) return { kind: 'library-root', path: normalized };
        const resourceType = pathSegmentToResourceType(parts[1]);
        if (!resourceType) {
            throw new Error(`Unknown library path segment: ${parts[1]}`);
        }
        if (parts.length === 2) {
            return { kind: 'library-type', resourceType, path: normalized };
        }
        return { kind: 'resource', resourceType, resourceId: parts.slice(2).join('/'), path: normalized };
    }

    throw new Error(`Unsupported VFS path: ${path}`);
};
