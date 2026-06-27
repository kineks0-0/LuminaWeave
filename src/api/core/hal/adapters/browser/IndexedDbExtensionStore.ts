import Dexie, { type Table } from 'dexie';
import type {
    RuntimeExtensionStorePort,
    RuntimeStorageExportEnvelope,
    RuntimeStorageImportRecord,
    RuntimeStorageImportResult,
    RuntimeStorageRecordInfo,
    RuntimeStorageRecordKind,
    RuntimeStorageRecordLocation,
    RuntimeStorageScope
} from '@shared/api/HALRuntimePorts.js';

interface IndexedDbExtensionStoreOptions {
    databaseName?: string;
}

interface ExtensionStoreRecord {
    id: string;
    namespace: string;
    table: string;
    key: string;
    kind: RuntimeStorageRecordKind;
    value: unknown;
    bytes: number;
    updatedAt: number;
}

class ExtensionStoreDatabase extends Dexie {
    records!: Table<ExtensionStoreRecord, string>;

    constructor(databaseName: string) {
        super(databaseName);
        this.version(1).stores({
            records: 'id, namespace, [namespace+table], [namespace+table+kind], updatedAt'
        });
    }
}

const DEFAULT_TABLE = 'main';
const DEFAULT_DATABASE_NAME = 'luminaweave-runtime-store';

const normalizeTable = (table: string | undefined): string => table || DEFAULT_TABLE;
const recordId = (
    namespace: string,
    table: string,
    key: string,
    kind: RuntimeStorageRecordKind
): string => `${kind}\u0000${namespace}\u0000${table}\u0000${key}`;

const bytesOfText = (text: string): number => new TextEncoder().encode(text).byteLength;

const estimateBytes = (value: unknown, kind: RuntimeStorageRecordKind): number => {
    if (kind === 'json') return bytesOfText(JSON.stringify(value));
    if (value instanceof ArrayBuffer) return value.byteLength;
    if (ArrayBuffer.isView(value)) return value.byteLength;
    if (value instanceof Blob) return value.size;
    if (typeof value === 'string') return bytesOfText(value);
    return bytesOfText(JSON.stringify(value));
};

const bytesToArrayBuffer = (bytes: Uint8Array): ArrayBuffer => {
    const buffer = new ArrayBuffer(bytes.byteLength);
    new Uint8Array(buffer).set(bytes);
    return buffer;
};

const blobValueToBlob = (value: unknown): Blob | null => {
    if (value instanceof Blob) return value;
    if (value instanceof ArrayBuffer) return new Blob([value]);
    if (ArrayBuffer.isView(value)) {
        return new Blob([bytesToArrayBuffer(new Uint8Array(value.buffer, value.byteOffset, value.byteLength))]);
    }
    if (typeof value === 'string') return new Blob([value]);
    return null;
};

export class IndexedDbExtensionStore implements RuntimeExtensionStorePort {
    private readonly db: ExtensionStoreDatabase;
    private readonly migratedScopes = new Set<string>();

    constructor(options: IndexedDbExtensionStoreOptions = {}) {
        this.db = new ExtensionStoreDatabase(options.databaseName ?? DEFAULT_DATABASE_NAME);
    }

    async getJson(params: { namespace: string; key: string; table?: string }): Promise<unknown> {
        const table = normalizeTable(params.table);
        await this.migrateLegacyScope(params.namespace, table);
        const record = await this.db.records.get(recordId(params.namespace, table, params.key, 'json'));
        return record?.value ?? null;
    }

    async setJson(params: { namespace: string; key: string; value: unknown; table?: string }): Promise<void> {
        await this.putRecord(params.namespace, normalizeTable(params.table), params.key, 'json', params.value);
    }

    async updateJson(params: { namespace: string; key: string; value: unknown; table?: string }): Promise<void> {
        const table = normalizeTable(params.table);
        const current = await this.getJson({
            namespace: params.namespace,
            table,
            key: params.key
        });
        const next = this.mergeJson(current, params.value);
        await this.putRecord(params.namespace, table, params.key, 'json', next);
    }

    async deleteJson(params: { namespace: string; key: string; table?: string }): Promise<void> {
        await this.db.records.delete(recordId(params.namespace, normalizeTable(params.table), params.key, 'json'));
    }

    async listKeys(params: { namespace: string; table?: string }): Promise<string[]> {
        const table = normalizeTable(params.table);
        await this.migrateLegacyScope(params.namespace, table);
        const records = await this.db.records
            .where('[namespace+table+kind]')
            .equals([params.namespace, table, 'json'])
            .toArray();
        return records.map(record => record.key).sort((left, right) => left.localeCompare(right));
    }

    async setBlob(params: { namespace: string; key: string; data: unknown; table?: string }): Promise<void> {
        await this.putRecord(params.namespace, normalizeTable(params.table), params.key, 'blob', params.data);
    }

    async getBlob(params: { namespace: string; key: string; table?: string }): Promise<Blob | null> {
        const table = normalizeTable(params.table);
        await this.migrateLegacyScope(params.namespace, table);
        const record = await this.db.records.get(recordId(params.namespace, table, params.key, 'blob'));
        return record ? blobValueToBlob(record.value) : null;
    }

    async listRecords(): Promise<RuntimeStorageRecordInfo[]> {
        const records = await this.db.records.toArray();
        return records
            .map(record => ({
                backend: 'indexeddb' as const,
                namespace: record.namespace,
                table: record.table,
                key: record.key,
                kind: record.kind,
                bytes: record.bytes,
                updatedAt: record.updatedAt
            }))
            .sort((left, right) =>
                left.namespace.localeCompare(right.namespace)
                || left.table.localeCompare(right.table)
                || left.key.localeCompare(right.key)
                || left.kind.localeCompare(right.kind)
            );
    }

    async deleteRecord(location: RuntimeStorageRecordLocation): Promise<void> {
        await this.db.records.delete(recordId(
            location.namespace,
            normalizeTable(location.table),
            location.key,
            location.kind
        ));
    }

    async importRecords(records: RuntimeStorageImportRecord[]): Promise<RuntimeStorageImportResult> {
        for (const record of records) {
            await this.putRecord(
                record.namespace,
                normalizeTable(record.table),
                record.key,
                record.kind,
                record.value
            );
        }
        return { imported: records.length };
    }

    async exportRecords(scope: RuntimeStorageScope = {}): Promise<RuntimeStorageExportEnvelope> {
        const records = (await this.db.records.toArray())
            .filter(record => !scope.namespace || record.namespace === scope.namespace)
            .filter(record => !scope.table || record.table === scope.table)
            .filter(record => !scope.kind || record.kind === scope.kind)
            .map(record => ({
                namespace: record.namespace,
                table: record.table,
                key: record.key,
                kind: record.kind,
                value: record.value
            }));
        return {
            version: 1,
            exportedAt: Date.now(),
            records
        };
    }

    private async putRecord(
        namespace: string,
        table: string,
        key: string,
        kind: RuntimeStorageRecordKind,
        value: unknown
    ): Promise<void> {
        await this.db.records.put({
            id: recordId(namespace, table, key, kind),
            namespace,
            table,
            key,
            kind,
            value,
            bytes: estimateBytes(value, kind),
            updatedAt: Date.now()
        });
    }

    private mergeJson(current: unknown, patch: unknown): unknown {
        if (
            current
            && patch
            && typeof current === 'object'
            && typeof patch === 'object'
            && !Array.isArray(current)
            && !Array.isArray(patch)
        ) {
            return {
                ...(current as Record<string, unknown>),
                ...(patch as Record<string, unknown>)
            };
        }
        return patch;
    }

    private async migrateLegacyScope(namespace: string, table: string): Promise<void> {
        const scopeKey = `${namespace}\u0000${table}`;
        if (this.migratedScopes.has(scopeKey)) return;
        this.migratedScopes.add(scopeKey);
        if (typeof localStorage === 'undefined') return;

        const jsonPrefix = `tt_ext_store_${namespace}_${table}_`;
        const blobPrefix = `tt_ext_store_blob_${namespace}_${table}_`;
        const keys = Array.from({ length: localStorage.length }, (_, index) => localStorage.key(index))
            .filter((key): key is string => Boolean(key));

        for (const storageKey of keys) {
            if (storageKey.startsWith(jsonPrefix)) {
                const key = storageKey.slice(jsonPrefix.length);
                const raw = localStorage.getItem(storageKey);
                if (raw !== null) {
                    await this.putRecord(namespace, table, key, 'json', JSON.parse(raw));
                    localStorage.removeItem(storageKey);
                }
            }
            if (storageKey.startsWith(blobPrefix)) {
                const key = storageKey.slice(blobPrefix.length);
                const raw = localStorage.getItem(storageKey);
                if (raw !== null) {
                    await this.putRecord(namespace, table, key, 'blob', raw);
                    localStorage.removeItem(storageKey);
                }
            }
        }
    }
}
