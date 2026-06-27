import type { IFileSystem } from 'just-bash';
import type {
    RuntimeStorageExportEnvelope,
    RuntimeStorageImportRecord,
    RuntimeStorageRecordInfo,
    RuntimeStorageRecordLocation
} from '@shared/api/HALRuntimePorts.js';
import { settingsDomainService } from '../../services/SettingsDomainService.js';
import { HALContext } from '../hal/HALContext.js';
import { shellWorkspaceService } from '../hal/shell/ShellWorkspaceService.js';

export type RuntimeStorageUsageCategoryId =
    | 'settings'
    | 'forge-vfs'
    | 'forge-git'
    | 'forge-agent-sessions'
    | 'resource-runtime'
    | 'other-runtime';

export interface RuntimeStorageUsageItem {
    id: RuntimeStorageUsageCategoryId;
    title: string;
    backend: string;
    source: string;
    bytes: number;
    recordCount: number;
    updatedAt: number | null;
    description: string;
    canImport: boolean;
    canExport: boolean;
    canReset: boolean;
}

export interface RuntimeStorageFileExportEntry {
    path: string;
    dataBase64: string;
}

export interface RuntimeStorageFileExportEnvelope {
    version: 1;
    kind: 'forge-vfs-files' | 'forge-git-files';
    exportedAt: number;
    files: RuntimeStorageFileExportEntry[];
}

export interface RuntimeSettingsExportEnvelope {
    version: 1;
    kind: 'settings';
    exportedAt: number;
    settings: Record<string, unknown>;
}

type RuntimeStorageExportPayload =
    | RuntimeStorageExportEnvelope
    | RuntimeStorageFileExportEnvelope
    | RuntimeSettingsExportEnvelope;

interface WorkspaceStorageStats {
    vfsBytes: number;
    vfsFiles: number;
    gitBytes: number;
    gitFiles: number;
    updatedAt: number | null;
}

const KNOWN_RUNTIME_GROUPS: Record<string, RuntimeStorageUsageCategoryId> = {
    'lumina.forge/pi-sessions': 'forge-agent-sessions',
    'lumina.resource-runtime/shell-workspaces': 'resource-runtime'
};

const SETTINGS_NAMESPACE = 'lumina_weave';
const FORGE_NAMESPACE = 'lumina.forge';
const FORGE_PI_TABLE = 'pi-sessions';
const RESOURCE_NAMESPACE = 'lumina.resource-runtime';
const RESOURCE_WORKSPACE_TABLE = 'shell-workspaces';

const textBytes = (value: unknown): number =>
    new TextEncoder().encode(JSON.stringify(value)).byteLength;

const runtimeGroupKey = (record: Pick<RuntimeStorageRecordInfo, 'namespace' | 'table'>): string =>
    `${record.namespace}/${record.table || 'default'}`;

const isForgeGitPath = (path: string): boolean =>
    path.includes('/.git/') || path.endsWith('/.git');

const isForgeProjectRootPath = (path: string): boolean =>
    /^\/forge\/[^/]+$/.test(path);

const bytesToBase64 = (bytes: Uint8Array): string => {
    let binary = '';
    const chunkSize = 0x8000;
    for (let index = 0; index < bytes.length; index += chunkSize) {
        const chunk = bytes.slice(index, index + chunkSize);
        binary += String.fromCharCode(...chunk);
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

const isRecord = (value: unknown): value is Record<string, unknown> =>
    typeof value === 'object' && value !== null && !Array.isArray(value);

const isRuntimeStorageExportEnvelope = (value: unknown): value is RuntimeStorageExportEnvelope =>
    isRecord(value)
    && value.version === 1
    && Array.isArray(value.records);

const isRuntimeSettingsExportEnvelope = (value: unknown): value is RuntimeSettingsExportEnvelope =>
    isRecord(value)
    && value.version === 1
    && value.kind === 'settings'
    && isRecord(value.settings);

const isRuntimeStorageFileExportEnvelope = (value: unknown): value is RuntimeStorageFileExportEnvelope =>
    isRecord(value)
    && value.version === 1
    && (value.kind === 'forge-vfs-files' || value.kind === 'forge-git-files')
    && Array.isArray(value.files);

export class RuntimeStorageAdminService {
    async listUsage(): Promise<RuntimeStorageUsageItem[]> {
        const records = await this.listRuntimeRecords();
        const settingsBytes = textBytes(settingsDomainService.getGlobalSettingsSnapshot())
            + this.sumRecords(records.filter(record => record.namespace === SETTINGS_NAMESPACE));
        const workspaceStats = await this.collectWorkspaceStats();
        const groupedRuntimeRecords = this.groupRuntimeRecords(records);

        return [
            {
                id: 'settings',
                title: '设置项目',
                backend: 'runtime settings + extensionStore',
                source: 'settingsDomainService / lumina_weave',
                bytes: settingsBytes,
                recordCount: Object.keys(settingsDomainService.getGlobalSettingsSnapshot()).length,
                updatedAt: this.latestUpdatedAt(records.filter(record => record.namespace === SETTINGS_NAMESPACE)),
                description: '全局设置、API 配置、生成预设引用与设置镜像。',
                canImport: true,
                canExport: true,
                canReset: true
            },
            {
                id: 'forge-vfs',
                title: 'Forge VFS 当前文件',
                backend: 'lightning-fs IndexedDB',
                source: '/forge/<projectId> excluding .git',
                bytes: workspaceStats.vfsBytes,
                recordCount: workspaceStats.vfsFiles,
                updatedAt: workspaceStats.updatedAt,
                description: 'Forge 项目当前文件树，不包含版本历史。',
                canImport: true,
                canExport: true,
                canReset: true
            },
            {
                id: 'forge-git',
                title: 'Forge Git 历史',
                backend: 'lightning-fs IndexedDB',
                source: '/forge/<projectId>/.git',
                bytes: workspaceStats.gitBytes,
                recordCount: workspaceStats.gitFiles,
                updatedAt: workspaceStats.updatedAt,
                description: 'Forge 工作区 Git 仓库对象、索引与引用。',
                canImport: true,
                canExport: true,
                canReset: true
            },
            this.runtimeUsageItem(
                'forge-agent-sessions',
                'Forge Agent 会话',
                'runtime extensionStore',
                'lumina.forge / pi-sessions',
                '完整 piSession，包括 tool_result payload。',
                groupedRuntimeRecords['forge-agent-sessions'] ?? []
            ),
            this.runtimeUsageItem(
                'resource-runtime',
                'Resource Runtime',
                'runtime extensionStore',
                'lumina.resource-runtime / shell-workspaces',
                'Shell workspace 绑定、资源运行时索引与投影元数据。',
                groupedRuntimeRecords['resource-runtime'] ?? []
            ),
            this.runtimeUsageItem(
                'other-runtime',
                '其他 runtime 内容',
                'runtime extensionStore',
                'uncategorized namespaces',
                '未归入设置、Forge 会话或 Resource Runtime 的 runtime 记录。',
                groupedRuntimeRecords['other-runtime'] ?? []
            )
        ];
    }

    async exportCategory(categoryId: RuntimeStorageUsageCategoryId): Promise<RuntimeStorageExportPayload> {
        if (categoryId === 'settings') {
            return {
                version: 1,
                kind: 'settings',
                exportedAt: Date.now(),
                settings: settingsDomainService.getGlobalSettingsSnapshot()
            };
        }
        if (categoryId === 'forge-vfs' || categoryId === 'forge-git') {
            return this.exportWorkspaceFiles(categoryId);
        }
        return this.exportRuntimeRecords(categoryId);
    }

    async importCategory(categoryId: RuntimeStorageUsageCategoryId, payload: unknown): Promise<void> {
        if (categoryId === 'settings') {
            const envelope = isRuntimeSettingsExportEnvelope(payload)
                ? payload
                : (isRecord(payload) ? { settings: payload } : null);
            if (!envelope) throw new Error('Invalid settings import payload');
            await settingsDomainService.importData(envelope.settings, Object.keys(envelope.settings));
            return;
        }
        if (categoryId === 'forge-vfs' || categoryId === 'forge-git') {
            if (!isRuntimeStorageFileExportEnvelope(payload)) throw new Error('Invalid workspace file import payload');
            await this.importWorkspaceFiles(payload);
            return;
        }
        if (!isRuntimeStorageExportEnvelope(payload)) throw new Error('Invalid runtime store import payload');
        if (!HALContext.instance.runtime.extensionStore.importRecords) {
            throw new Error('Runtime store import is not available');
        }
        await HALContext.instance.runtime.extensionStore.importRecords(this.filterImportRecords(categoryId, payload.records));
    }

    async resetCategory(categoryId: RuntimeStorageUsageCategoryId): Promise<void> {
        if (categoryId === 'settings') {
            const snapshot = settingsDomainService.getGlobalSettingsSnapshot();
            for (const key of Object.keys(snapshot)) {
                await settingsDomainService.setGlobalValue(key, undefined);
            }
            await HALContext.instance.runtime.extensionStore.deleteJson({
                namespace: SETTINGS_NAMESPACE,
                key: 'global-settings-mirror'
            }).catch(() => undefined);
            await HALContext.instance.runtime.extensionStore.deleteJson({
                namespace: SETTINGS_NAMESPACE,
                key: 'session-state'
            }).catch(() => undefined);
            return;
        }
        if (categoryId === 'forge-vfs' || categoryId === 'forge-git') {
            await this.resetWorkspaceFiles(categoryId);
            return;
        }
        const records = this.filterRecords(categoryId, await this.listRuntimeRecords());
        await Promise.all(records.map(record => this.deleteRuntimeRecord(record)));
    }

    private runtimeUsageItem(
        id: RuntimeStorageUsageCategoryId,
        title: string,
        backend: string,
        source: string,
        description: string,
        records: RuntimeStorageRecordInfo[]
    ): RuntimeStorageUsageItem {
        return {
            id,
            title,
            backend: records[0]?.backend ?? backend,
            source,
            bytes: this.sumRecords(records),
            recordCount: records.length,
            updatedAt: this.latestUpdatedAt(records),
            description,
            canImport: true,
            canExport: true,
            canReset: true
        };
    }

    private async listRuntimeRecords(): Promise<RuntimeStorageRecordInfo[]> {
        const store = HALContext.instance.runtime.extensionStore;
        if (store.listRecords) {
            return await store.listRecords();
        }
        const rows: RuntimeStorageRecordInfo[] = [];
        const scopes = [
            { namespace: SETTINGS_NAMESPACE },
            { namespace: FORGE_NAMESPACE, table: FORGE_PI_TABLE },
            { namespace: RESOURCE_NAMESPACE, table: RESOURCE_WORKSPACE_TABLE }
        ];
        for (const scope of scopes) {
            const keys = await store.listKeys(scope).catch(() => []);
            for (const key of keys) {
                const value = await store.getJson({ ...scope, key }).catch(() => null);
                rows.push({
                    namespace: scope.namespace,
                    table: scope.table ?? 'default',
                    key,
                    kind: 'json',
                    backend: 'host-extension-store',
                    bytes: textBytes(value),
                    updatedAt: Date.now()
                });
            }
        }
        return rows;
    }

    private groupRuntimeRecords(records: RuntimeStorageRecordInfo[]): Record<RuntimeStorageUsageCategoryId, RuntimeStorageRecordInfo[]> {
        const grouped: Record<RuntimeStorageUsageCategoryId, RuntimeStorageRecordInfo[]> = {
            settings: [],
            'forge-vfs': [],
            'forge-git': [],
            'forge-agent-sessions': [],
            'resource-runtime': [],
            'other-runtime': []
        };
        for (const record of records) {
            if (record.namespace === SETTINGS_NAMESPACE) {
                grouped.settings.push(record);
                continue;
            }
            const group = KNOWN_RUNTIME_GROUPS[runtimeGroupKey(record)] ?? 'other-runtime';
            grouped[group].push(record);
        }
        return grouped;
    }

    private async collectWorkspaceStats(): Promise<WorkspaceStorageStats> {
        const fs = await shellWorkspaceService.getFileSystem();
        const stats: WorkspaceStorageStats = {
            vfsBytes: 0,
            vfsFiles: 0,
            gitBytes: 0,
            gitFiles: 0,
            updatedAt: null
        };
        for (const path of fs.getAllPaths()) {
            if (!path.startsWith('/forge/')) continue;
            const stat = await fs.stat(path).catch(() => null);
            if (!stat?.isFile) continue;
            if (isForgeGitPath(path)) {
                stats.gitBytes += stat.size;
                stats.gitFiles += 1;
            } else {
                stats.vfsBytes += stat.size;
                stats.vfsFiles += 1;
            }
            const updatedAt = stat.mtime?.getTime?.() ?? null;
            if (updatedAt !== null) {
                stats.updatedAt = Math.max(stats.updatedAt ?? 0, updatedAt);
            }
        }
        return stats;
    }

    private async exportWorkspaceFiles(categoryId: 'forge-vfs' | 'forge-git'): Promise<RuntimeStorageFileExportEnvelope> {
        const fs = await shellWorkspaceService.getFileSystem();
        const files: RuntimeStorageFileExportEntry[] = [];
        for (const path of fs.getAllPaths()) {
            if (!path.startsWith('/forge/')) continue;
            if ((categoryId === 'forge-git') !== isForgeGitPath(path)) continue;
            const stat = await fs.stat(path).catch(() => null);
            if (!stat?.isFile) continue;
            files.push({
                path,
                dataBase64: bytesToBase64(await fs.readFileBuffer(path))
            });
        }
        return {
            version: 1,
            kind: categoryId === 'forge-git' ? 'forge-git-files' : 'forge-vfs-files',
            exportedAt: Date.now(),
            files
        };
    }

    private async importWorkspaceFiles(payload: RuntimeStorageFileExportEnvelope): Promise<void> {
        const fs = await shellWorkspaceService.getFileSystem();
        for (const file of payload.files) {
            if (!file.path.startsWith('/forge/')) continue;
            await this.ensureParentDirectory(fs, file.path);
            await fs.writeFile(file.path, base64ToBytes(file.dataBase64));
        }
        await shellWorkspaceService.persist();
    }

    private async resetWorkspaceFiles(categoryId: 'forge-vfs' | 'forge-git'): Promise<void> {
        const fs = await shellWorkspaceService.getFileSystem();
        const paths = fs.getAllPaths()
            .filter(path => path.startsWith('/forge/'))
            .filter(path => (categoryId === 'forge-git') === isForgeGitPath(path))
            .filter(path => categoryId === 'forge-git' || !isForgeProjectRootPath(path))
            .sort((left, right) => right.length - left.length);
        for (const path of paths) {
            if (path === '/forge') continue;
            await fs.rm(path, { recursive: true, force: true }).catch(() => undefined);
        }
        await shellWorkspaceService.persist();
    }

    private async exportRuntimeRecords(categoryId: RuntimeStorageUsageCategoryId): Promise<RuntimeStorageExportEnvelope> {
        const store = HALContext.instance.runtime.extensionStore;
        if (store.exportRecords) {
            const records = this.filterImportRecords(categoryId, (await store.exportRecords()).records);
            return {
                version: 1,
                exportedAt: Date.now(),
                records
            };
        }
        const records = await Promise.all(this.filterRecords(categoryId, await this.listRuntimeRecords()).map(async (record): Promise<RuntimeStorageImportRecord> => ({
            namespace: record.namespace,
            table: record.table,
            key: record.key,
            kind: record.kind,
            value: await store.getJson({
                namespace: record.namespace,
                table: record.table,
                key: record.key
            }).catch(() => null)
        })));
        return {
            version: 1,
            exportedAt: Date.now(),
            records
        };
    }

    private filterRecords(
        categoryId: RuntimeStorageUsageCategoryId,
        records: RuntimeStorageRecordInfo[]
    ): RuntimeStorageRecordInfo[] {
        return records.filter(record => this.recordBelongsToCategory(record, categoryId));
    }

    private filterImportRecords(
        categoryId: RuntimeStorageUsageCategoryId,
        records: RuntimeStorageImportRecord[]
    ): RuntimeStorageImportRecord[] {
        return records.filter(record => this.recordBelongsToCategory({
            namespace: record.namespace,
            table: record.table ?? 'default'
        }, categoryId));
    }

    private recordBelongsToCategory(
        record: Pick<RuntimeStorageRecordInfo, 'namespace' | 'table'>,
        categoryId: RuntimeStorageUsageCategoryId
    ): boolean {
        if (categoryId === 'forge-agent-sessions') {
            return record.namespace === FORGE_NAMESPACE && (record.table || 'default') === FORGE_PI_TABLE;
        }
        if (categoryId === 'resource-runtime') {
            return record.namespace === RESOURCE_NAMESPACE;
        }
        if (categoryId === 'other-runtime') {
            return record.namespace !== SETTINGS_NAMESPACE
                && record.namespace !== FORGE_NAMESPACE
                && record.namespace !== RESOURCE_NAMESPACE;
        }
        return false;
    }

    private async deleteRuntimeRecord(record: RuntimeStorageRecordLocation): Promise<void> {
        const store = HALContext.instance.runtime.extensionStore;
        if (store.deleteRecord) {
            await store.deleteRecord(record);
            return;
        }
        if (record.kind === 'json') {
            await store.deleteJson(record);
        }
    }

    private sumRecords(records: RuntimeStorageRecordInfo[]): number {
        return records.reduce((sum, record) => sum + record.bytes, 0);
    }

    private latestUpdatedAt(records: RuntimeStorageRecordInfo[]): number | null {
        const values = records.map(record => record.updatedAt).filter(value => value > 0);
        return values.length > 0 ? Math.max(...values) : null;
    }

    private async ensureParentDirectory(fs: IFileSystem, path: string): Promise<void> {
        const index = path.lastIndexOf('/');
        if (index <= 0) return;
        await fs.mkdir(path.slice(0, index), { recursive: true });
    }
}

export const runtimeStorageAdminService = new RuntimeStorageAdminService();
