import Database from '@tauri-apps/plugin-sql';
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

interface TauriSqliteExtensionStoreOptions {
    databasePath?: string;
}

interface RuntimeStoreRow {
    namespace: string;
    table_name: string;
    record_key: string;
    kind: RuntimeStorageRecordKind;
    value_json: string | null;
    value_blob_base64: string | null;
    bytes: number;
    updated_at: number;
}

const DEFAULT_TABLE = 'main';
const DEFAULT_DATABASE_PATH = 'sqlite:luminaweave-runtime-store.db';

const normalizeTable = (table: string | undefined): string => table || DEFAULT_TABLE;
const recordId = (
    namespace: string,
    table: string,
    key: string,
    kind: RuntimeStorageRecordKind
): string => `${kind}\u0000${namespace}\u0000${table}\u0000${key}`;

const bytesOfText = (text: string): number => new TextEncoder().encode(text).byteLength;

const bytesToBase64 = (bytes: Uint8Array): string => {
    let binary = '';
    for (const byte of bytes) {
        binary += String.fromCharCode(byte);
    }
    return btoa(binary);
};

const base64ToBytes = (value: string): Uint8Array => {
    const binary = atob(value);
    const bytes = new Uint8Array(binary.length);
    for (let index = 0; index < binary.length; index += 1) {
        bytes[index] = binary.charCodeAt(index);
    }
    return bytes;
};

const bytesToArrayBuffer = (bytes: Uint8Array): ArrayBuffer => {
    const buffer = new ArrayBuffer(bytes.byteLength);
    new Uint8Array(buffer).set(bytes);
    return buffer;
};

const arrayBufferToBytes = (value: ArrayBuffer): Uint8Array => new Uint8Array(value);

const viewToBytes = (value: ArrayBufferView): Uint8Array => {
    const bytes = new Uint8Array(value.byteLength);
    bytes.set(new Uint8Array(value.buffer, value.byteOffset, value.byteLength));
    return bytes;
};

const mergeJson = (current: unknown, patch: unknown): unknown => {
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
};

export class TauriSqliteExtensionStore implements RuntimeExtensionStorePort {
    public readonly backend = 'tauri-sqlite' as const;
    private readonly databasePath: string;
    private dbPromise: Promise<Database> | null = null;

    constructor(options: TauriSqliteExtensionStoreOptions = {}) {
        this.databasePath = options.databasePath ?? DEFAULT_DATABASE_PATH;
    }

    async getJson(params: { namespace: string; key: string; table?: string }): Promise<unknown> {
        const row = await this.getRecord(params.namespace, normalizeTable(params.table), params.key, 'json');
        return row?.value_json ? JSON.parse(row.value_json) : null;
    }

    async setJson(params: { namespace: string; key: string; value: unknown; table?: string }): Promise<void> {
        await this.putJsonRecord(params.namespace, normalizeTable(params.table), params.key, params.value);
    }

    async updateJson(params: { namespace: string; key: string; value: unknown; table?: string }): Promise<void> {
        const table = normalizeTable(params.table);
        const current = await this.getJson({
            namespace: params.namespace,
            table,
            key: params.key
        });
        await this.putJsonRecord(params.namespace, table, params.key, mergeJson(current, params.value));
    }

    async deleteJson(params: { namespace: string; key: string; table?: string }): Promise<void> {
        await this.deleteRecord({
            namespace: params.namespace,
            table: normalizeTable(params.table),
            key: params.key,
            kind: 'json'
        });
    }

    async listKeys(params: { namespace: string; table?: string }): Promise<string[]> {
        const db = await this.getDb();
        const rows = await db.select<Array<{ record_key: string }>>(
            `SELECT record_key
             FROM extension_store_records
             WHERE namespace = $1 AND table_name = $2 AND kind = $3
             ORDER BY record_key ASC`,
            [params.namespace, normalizeTable(params.table), 'json']
        );
        return rows.map(row => row.record_key);
    }

    async setBlob(params: { namespace: string; key: string; data: unknown; table?: string }): Promise<void> {
        await this.putBlobRecord(params.namespace, normalizeTable(params.table), params.key, params.data);
    }

    async getBlob(params: { namespace: string; key: string; table?: string }): Promise<Blob | null> {
        const row = await this.getRecord(params.namespace, normalizeTable(params.table), params.key, 'blob');
        if (!row?.value_blob_base64) return null;
        return new Blob([bytesToArrayBuffer(base64ToBytes(row.value_blob_base64))]);
    }

    async listRecords(): Promise<RuntimeStorageRecordInfo[]> {
        const db = await this.getDb();
        const rows = await db.select<RuntimeStoreRow[]>(
            `SELECT namespace, table_name, record_key, kind, value_json, value_blob_base64, bytes, updated_at
             FROM extension_store_records
             ORDER BY namespace ASC, table_name ASC, record_key ASC, kind ASC`
        );
        return rows.map(row => ({
            backend: this.backend,
            namespace: row.namespace,
            table: row.table_name,
            key: row.record_key,
            kind: row.kind,
            bytes: row.bytes,
            updatedAt: row.updated_at
        }));
    }

    async deleteRecord(location: RuntimeStorageRecordLocation): Promise<void> {
        const db = await this.getDb();
        await db.execute(
            `DELETE FROM extension_store_records
             WHERE id = $1`,
            [recordId(location.namespace, normalizeTable(location.table), location.key, location.kind)]
        );
    }

    async importRecords(records: RuntimeStorageImportRecord[]): Promise<RuntimeStorageImportResult> {
        for (const record of records) {
            if (record.kind === 'json') {
                await this.putJsonRecord(record.namespace, normalizeTable(record.table), record.key, record.value);
            } else {
                await this.putBlobRecord(record.namespace, normalizeTable(record.table), record.key, record.value);
            }
        }
        return { imported: records.length };
    }

    async exportRecords(scope: RuntimeStorageScope = {}): Promise<RuntimeStorageExportEnvelope> {
        const rows = await this.selectRows(scope);
        const records: RuntimeStorageImportRecord[] = rows.map(row => ({
            namespace: row.namespace,
            table: row.table_name,
            key: row.record_key,
            kind: row.kind,
            value: row.kind === 'json'
                ? JSON.parse(row.value_json ?? 'null')
                : row.value_blob_base64 ?? ''
        }));
        return {
            version: 1,
            exportedAt: Date.now(),
            records
        };
    }

    private async getDb(): Promise<Database> {
        if (!this.dbPromise) {
            this.dbPromise = (async () => {
                const db = await Database.load(this.databasePath);
                await db.execute(
                    `CREATE TABLE IF NOT EXISTS extension_store_records (
                        id TEXT PRIMARY KEY,
                        namespace TEXT NOT NULL,
                        table_name TEXT NOT NULL,
                        record_key TEXT NOT NULL,
                        kind TEXT NOT NULL,
                        value_json TEXT,
                        value_blob_base64 TEXT,
                        bytes INTEGER NOT NULL,
                        updated_at INTEGER NOT NULL
                    )`
                );
                await db.execute(
                    `CREATE INDEX IF NOT EXISTS extension_store_records_scope_idx
                     ON extension_store_records (namespace, table_name, kind, record_key)`
                );
                return db;
            })();
        }
        return this.dbPromise;
    }

    private async getRecord(
        namespace: string,
        table: string,
        key: string,
        kind: RuntimeStorageRecordKind
    ): Promise<RuntimeStoreRow | null> {
        const db = await this.getDb();
        const rows = await db.select<RuntimeStoreRow[]>(
            `SELECT namespace, table_name, record_key, kind, value_json, value_blob_base64, bytes, updated_at
             FROM extension_store_records
             WHERE id = $1
             LIMIT 1`,
            [recordId(namespace, table, key, kind)]
        );
        return rows[0] ?? null;
    }

    private async putJsonRecord(
        namespace: string,
        table: string,
        key: string,
        value: unknown
    ): Promise<void> {
        const valueJson = JSON.stringify(value);
        await this.upsertRecord(namespace, table, key, 'json', valueJson, null, bytesOfText(valueJson));
    }

    private async putBlobRecord(
        namespace: string,
        table: string,
        key: string,
        value: unknown
    ): Promise<void> {
        const bytes = await this.blobValueToBytes(value);
        await this.upsertRecord(namespace, table, key, 'blob', null, bytesToBase64(bytes), bytes.byteLength);
    }

    private async upsertRecord(
        namespace: string,
        table: string,
        key: string,
        kind: RuntimeStorageRecordKind,
        valueJson: string | null,
        valueBlobBase64: string | null,
        bytes: number
    ): Promise<void> {
        const db = await this.getDb();
        await db.execute(
            `INSERT INTO extension_store_records
                (id, namespace, table_name, record_key, kind, value_json, value_blob_base64, bytes, updated_at)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
             ON CONFLICT(id) DO UPDATE SET
                value_json = excluded.value_json,
                value_blob_base64 = excluded.value_blob_base64,
                bytes = excluded.bytes,
                updated_at = excluded.updated_at`,
            [
                recordId(namespace, table, key, kind),
                namespace,
                table,
                key,
                kind,
                valueJson,
                valueBlobBase64,
                bytes,
                Date.now()
            ]
        );
    }

    private async selectRows(scope: RuntimeStorageScope): Promise<RuntimeStoreRow[]> {
        const db = await this.getDb();
        const conditions: string[] = [];
        const values: unknown[] = [];
        if (scope.namespace) {
            values.push(scope.namespace);
            conditions.push(`namespace = $${values.length}`);
        }
        if (scope.table) {
            values.push(scope.table);
            conditions.push(`table_name = $${values.length}`);
        }
        if (scope.kind) {
            values.push(scope.kind);
            conditions.push(`kind = $${values.length}`);
        }
        const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
        return await db.select<RuntimeStoreRow[]>(
            `SELECT namespace, table_name, record_key, kind, value_json, value_blob_base64, bytes, updated_at
             FROM extension_store_records
             ${whereClause}
             ORDER BY namespace ASC, table_name ASC, record_key ASC, kind ASC`,
            values
        );
    }

    private async blobValueToBytes(value: unknown): Promise<Uint8Array> {
        if (value instanceof Blob) return arrayBufferToBytes(await value.arrayBuffer());
        if (value instanceof ArrayBuffer) return arrayBufferToBytes(value);
        if (ArrayBuffer.isView(value)) return viewToBytes(value);
        if (typeof value === 'string') return new TextEncoder().encode(value);
        return new TextEncoder().encode(JSON.stringify(value));
    }
}
