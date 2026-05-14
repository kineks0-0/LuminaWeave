import {
    buildLibraryPath,
    buildSourceResourcePath,
    parseVFSPath,
    RESOURCE_TYPE_SEGMENTS,
    type ResourceDocument,
    type ResourceSearchParams,
    type ResourceType,
    type ResourceWriteOptions,
    type ResourceSaveResult,
    type VFSDirEntry,
    type VFSPathResolution,
    type VFSSearchResult,
    type VFSStat
} from '@shared/resources/index.js';
import type { ResourceService } from './ResourceService.js';
import type { ResourceSourceRegistry } from './ResourceSourceRegistry.js';

const RESOURCE_TYPES = Object.keys(RESOURCE_TYPE_SEGMENTS) as ResourceType[];

export class VirtualFileSystemService {
    constructor(
        private readonly registry: ResourceSourceRegistry,
        private readonly resources: ResourceService
    ) {}

    resolvePath(path: string): VFSPathResolution {
        return parseVFSPath(path);
    }

    async listDir(path: string): Promise<VFSDirEntry[]> {
        const resolved = parseVFSPath(path);
        if (resolved.kind === 'root') {
            return [
                this.dir('sources', '/sources'),
                this.dir('library', '/library')
            ];
        }
        if (resolved.kind === 'source-root' && !resolved.sourceId) {
            return this.registry.listSources().map(source => this.dir(source.id, `/sources/${source.id}`));
        }
        if (resolved.kind === 'source-root' && resolved.sourceId) {
            return RESOURCE_TYPES.map(type => this.dir(RESOURCE_TYPE_SEGMENTS[type], buildSourceResourcePath(resolved.sourceId!, type)));
        }
        if (resolved.kind === 'library-root') {
            return RESOURCE_TYPES.map(type => this.dir(RESOURCE_TYPE_SEGMENTS[type], buildLibraryPath(type)));
        }
        if (resolved.kind === 'source-type' && resolved.sourceId && resolved.resourceType) {
            const docs = await this.resources.listResources({ sourceId: resolved.sourceId, resourceType: resolved.resourceType });
            return docs.map(doc => this.file(doc.summary.name, doc));
        }
        if (resolved.kind === 'library-type' && resolved.resourceType) {
            const docs = await this.resources.listResources({ resourceType: resolved.resourceType });
            return docs.map(doc => this.file(`${doc.summary.name} [${doc.ref.sourceId}]`, doc));
        }
        throw new Error(`Not a directory: ${path}`);
    }

    async readFile(path: string): Promise<string> {
        const document = await this.readDocument(path);
        return JSON.stringify(document.raw, null, 2);
    }

    async writeFile(path: string, payload: unknown, options?: ResourceWriteOptions): Promise<ResourceSaveResult> {
        const document = await this.readDocument(path).catch(() => null);
        if (document) {
            return this.resources.saveResource(document.ref, payload, options);
        }

        const resolved = parseVFSPath(path);
        if (resolved.kind !== 'resource' || !resolved.sourceId || !resolved.resourceType || !resolved.resourceId) {
            throw new Error(`Path does not resolve to a writable resource: ${path}`);
        }

        const source = this.registry.getSource(resolved.sourceId);
        if (!source) {
            throw new Error(`Resource source not found: ${resolved.sourceId}`);
        }

        return this.resources.saveResource({
            sourceId: resolved.sourceId,
            resourceType: resolved.resourceType,
            resourceId: resolved.resourceId,
            revision: null,
            path,
            writable: source.descriptor.capabilities.writable,
            origin: source.descriptor.kind
        }, payload, options);
    }

    async stat(path: string): Promise<VFSStat> {
        const resolved = parseVFSPath(path);
        if (resolved.kind === 'resource') {
            const document = await this.readDocument(path);
            return {
                path,
                type: 'file',
                readable: true,
                writable: document.ref.writable,
                size: JSON.stringify(document.raw).length,
                ref: document.ref,
                summary: document.summary
            };
        }
        return {
            path,
            type: 'directory',
            readable: true,
            writable: false
        };
    }

    async search(params: ResourceSearchParams): Promise<VFSSearchResult[]> {
        const pathQuery = params.path ? this.queryFromPath(params.path) : {};
        const docs = await this.resources.listResources({
            ...params,
            ...pathQuery
        });
        const needle = params.content?.trim().toLowerCase() || params.search?.trim().toLowerCase();
        if (!needle) {
            return docs.map(doc => ({
                path: doc.ref.path,
                ref: doc.ref,
                preview: doc.summary.description || doc.summary.name,
                summary: doc.summary
            }));
        }
        return docs.flatMap(doc => this.searchDocument(doc, needle));
    }

    private async readDocument(path: string): Promise<ResourceDocument> {
        const resolved = parseVFSPath(path);
        if (resolved.kind !== 'resource' || !resolved.resourceType || !resolved.resourceId) {
            throw new Error(`Path does not resolve to a resource: ${path}`);
        }
        const candidates = resolved.sourceId
            ? await this.resources.listResources({
                sourceId: resolved.sourceId,
                resourceType: resolved.resourceType
            })
            : await this.resources.listResources({ resourceType: resolved.resourceType });
        const document = candidates.find(doc => this.matchesResourcePathName(doc, resolved.resourceId!, Boolean(resolved.sourceId)));
        if (document) return document;
        if (resolved.sourceId) {
            const direct = await this.resources.getResource({
                sourceId: resolved.sourceId,
                resourceType: resolved.resourceType,
                resourceId: resolved.resourceId,
                revision: null,
                path,
                writable: false
            });
            if (direct) return direct;
        }
        throw new Error(`Resource not found: ${path}`);
    }

    private queryFromPath(path: string): Partial<ResourceSearchParams> {
        const resolved = parseVFSPath(path);
        if (resolved.kind === 'source-type' || resolved.kind === 'resource') {
            return {
                sourceId: resolved.sourceId,
                resourceType: resolved.resourceType
            };
        }
        if (resolved.kind === 'library-type') {
            return {
                resourceType: resolved.resourceType
            };
        }
        if (resolved.kind === 'source-root' && resolved.sourceId) {
            return {
                sourceId: resolved.sourceId
            };
        }
        return {};
    }

    private searchDocument(document: ResourceDocument, needle: string): VFSSearchResult[] {
        const lines = JSON.stringify(document.raw, null, 2).split('\n');
        return lines
            .map((line, index) => ({ line, index }))
            .filter(item => item.line.toLowerCase().includes(needle))
            .slice(0, 20)
            .map(item => ({
                path: document.ref.path,
                ref: document.ref,
                line: item.index + 1,
                preview: item.line.trim(),
                summary: document.summary
            }));
    }

    private dir(name: string, path: string): VFSDirEntry {
        return { name, path, type: 'directory', readable: true, writable: false };
    }

    private file(name: string, document: ResourceDocument): VFSDirEntry {
        return {
            name,
            path: document.ref.path,
            type: 'file',
            readable: true,
            writable: document.ref.writable,
            size: JSON.stringify(document.raw).length,
            ref: document.ref,
            summary: document.summary
        };
    }

    private matchesResourcePathName(document: ResourceDocument, resourceId: string, isSourcePath: boolean): boolean {
        if (document.ref.resourceId === resourceId) return true;
        if (isSourcePath) return document.summary.name === resourceId;
        return `${document.summary.name} [${document.ref.sourceId}]` === resourceId;
    }
}
