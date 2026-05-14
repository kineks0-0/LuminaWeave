import { STGlobalAccessor } from './STGlobalAccessor.js';
import { STClient } from './STClient.js';
import type {PartialDeep} from 'type-fest';

//type PartialDeep<T> = T extends object ? { [P in keyof T]?: PartialDeep<T[P]> } : T;

export interface STWorldbookRef {
    id: string;
    name: string;
}

export interface STWorldbookData {
    entries: Record<string, any>;
    [key: string]: any;
}

type STWorldbookImportResult = boolean | Response | undefined | null;
type TavernHelperWorldbookEntry = Record<string, any>;

/**
 * 封装 SillyTavern 与世界书 (World Info) 相关的底层交互
 */
export class STWorldInfoDriver {

    /** 获取 TavernHelper */
    private static get stHelper(): typeof TavernHelper {
        return STGlobalAccessor.stHelper as any;
    }

    /** 获取 ST 的核心 Context */
    private static get ctx(): typeof SillyTavern {
        return STGlobalAccessor.ctx as any;
    }

    private static normalizeBookName(name: string): string {
        return String(name || '').trim().replace(/\.json$/i, '');
    }

    private static normalizeWorldbookRef(raw: unknown): STWorldbookRef | null {
        if (typeof raw === 'string') {
            const normalized = this.normalizeBookName(raw);
            return normalized ? { id: normalized, name: normalized } : null;
        }

        if (!raw || typeof raw !== 'object') {
            return null;
        }

        const record = raw as Record<string, unknown>;
        const rawName = typeof record.name === 'string'
            ? record.name
            : (typeof record.file_id === 'string' ? record.file_id : '');
        const rawId = typeof record.file_id === 'string'
            ? record.file_id
            : rawName;
        const name = this.normalizeBookName(rawName);
        const id = this.normalizeBookName(rawId);
        return name || id ? { id: id || name, name: name || id } : null;
    }

    private static normalizeWorldbookList(raw: unknown): STWorldbookRef[] {
        const refs = Array.isArray(raw)
            ? raw.map((item) => this.normalizeWorldbookRef(item))
            : [];
        const seen = new Set<string>();
        return refs.filter((ref): ref is STWorldbookRef => {
            if (!ref || seen.has(ref.id)) return false;
            seen.add(ref.id);
            return true;
        });
    }

    private static normalizeEntryKeyList(raw: unknown): string[] {
        if (!Array.isArray(raw)) return [];
        return raw
            .map((item) => {
                if (typeof item === 'string') return item;
                if (item instanceof RegExp) return item.source;
                return String(item ?? '').trim();
            })
            .filter(Boolean);
    }

    private static normalizeSelectiveLogic(raw: unknown): number {
        switch (raw) {
            case 'and_all':
                return 0;
            case 'and_any':
                return 1;
            case 'not_all':
            case 'not_any':
                return 2;
            default:
                return typeof raw === 'number' ? raw : 0;
        }
    }

    private static normalizePositionType(raw: unknown): number {
        switch (raw) {
            case 'before_character_definition':
                return 0;
            case 'after_character_definition':
                return 1;
            case 'before_author_note':
                return 2;
            case 'after_author_note':
                return 3;
            case 'at_depth':
                return 4;
            case 'before_example_messages':
                return 5;
            case 'after_example_messages':
                return 6;
            case 'outlet':
                return 7;
            default:
                return typeof raw === 'number' ? raw : 0;
        }
    }

    private static normalizeRole(raw: unknown): number | undefined {
        switch (raw) {
            case 'system':
                return 0;
            case 'user':
                return 1;
            case 'assistant':
                return 2;
            default:
                return typeof raw === 'number' ? raw : undefined;
        }
    }

    private static normalizeScanDepth(raw: unknown): number {
        return typeof raw === 'number' ? raw : 0;
    }

    private static normalizeWorldbookEntry(entry: TavernHelperWorldbookEntry, fallbackUid: string | number): TavernHelperWorldbookEntry {
        const strategy = entry.strategy && typeof entry.strategy === 'object' ? entry.strategy : null;
        const position = entry.position && typeof entry.position === 'object' ? entry.position : null;
        const recursion = entry.recursion && typeof entry.recursion === 'object' ? entry.recursion : null;
        const extra = entry.extra && typeof entry.extra === 'object' ? entry.extra : null;
        const extensions = entry.extensions && typeof entry.extensions === 'object' ? entry.extensions : null;
        const secondary = strategy?.keys_secondary && typeof strategy.keys_secondary === 'object'
            ? strategy.keys_secondary
            : null;

        const uid = entry.uid ?? entry.id ?? fallbackUid;
        const key = this.normalizeEntryKeyList(entry.key ?? entry.keys ?? strategy?.keys);
        const keysecondary = this.normalizeEntryKeyList(entry.keysecondary ?? entry.secondary_keys ?? secondary?.keys);
        const strategyType = strategy?.type;
        const isConstant = entry.constant ?? strategyType === 'constant';
        const isSelective = entry.selective ?? strategyType === 'selective';
        const enabled = entry.enabled ?? !entry.disable;
        const probability = entry.probability ?? extensions?.probability ?? 100;

        return {
            ...entry,
            uid,
            comment: entry.comment ?? entry.name ?? '',
            key,
            keysecondary,
            content: entry.content ?? '',
            constant: Boolean(isConstant),
            selective: Boolean(isSelective),
            selectiveLogic: entry.selectiveLogic ?? extensions?.selectiveLogic ?? this.normalizeSelectiveLogic(secondary?.logic),
            disable: entry.disable ?? !enabled,
            enabled: Boolean(enabled),
            position: this.normalizePositionType(position?.type ?? entry.position),
            role: this.normalizeRole(position?.role ?? extensions?.role ?? entry.role),
            depth: entry.depth ?? position?.depth ?? extensions?.depth ?? 0,
            order: entry.order ?? position?.order ?? entry.insertion_order ?? extensions?.position ?? 100,
            probability,
            useProbability: entry.useProbability ?? extensions?.useProbability ?? probability < 100,
            scan_depth: entry.scan_depth ?? this.normalizeScanDepth(strategy?.scan_depth ?? extensions?.scan_depth),
            caseSensitive: entry.caseSensitive ?? extensions?.case_sensitive ?? entry.case_sensitive,
            matchWholeWords: entry.matchWholeWords ?? extensions?.match_whole_words ?? entry.match_whole_words,
            excludeRecursion: entry.excludeRecursion ?? extensions?.exclude_recursion,
            preventRecursion: entry.preventRecursion ?? recursion?.prevent_outgoing ?? extensions?.prevent_recursion,
            delayUntilRecursion: entry.delayUntilRecursion ?? recursion?.delay_until ?? extensions?.delay_until_recursion,
            extra: extra ?? entry.extra
        };
    }

    private static normalizeEntries(rawEntries: unknown): Record<string, any> {
        if (Array.isArray(rawEntries)) {
            const entries: Record<string, any> = {};
            rawEntries.forEach((entry, index) => {
                if (!entry || typeof entry !== 'object') return;
                const normalized = this.normalizeWorldbookEntry(entry as TavernHelperWorldbookEntry, index);
                entries[String(normalized.uid ?? index)] = normalized;
            });
            return entries;
        }

        if (rawEntries && typeof rawEntries === 'object') {
            return Object.fromEntries(
                Object.entries(rawEntries as Record<string, any>)
                    .filter(([, entry]) => entry && typeof entry === 'object')
                    .map(([uid, entry]) => {
                        const normalized = this.normalizeWorldbookEntry(entry as TavernHelperWorldbookEntry, uid);
                        return [String(normalized.uid ?? uid), normalized];
                    })
            );
        }

        return {};
    }

    private static toWorldbookData(raw: unknown, fallbackName?: string): STWorldbookData {
        if (Array.isArray(raw)) {
            return { name: fallbackName, entries: this.normalizeEntries(raw) };
        }

        if (raw && typeof raw === 'object') {
            const record = raw as Record<string, any>;
            const entries = record.entries ?? record.data ?? {};
            return {
                ...record,
                name: record.name ?? fallbackName,
                entries: this.normalizeEntries(entries)
            };
        }

        return { name: fallbackName, entries: {} };
    }

    private static async fetchWorldbookViaRest(name: string): Promise<STWorldbookData | null> {
        if (typeof fetch !== 'function') return null;

        try {
            const csrfToken = await STClient.getCsrfToken();
            const res = await fetch('/api/worldinfo/get', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrfToken },
                body: JSON.stringify({ name })
            });

            if (!res.ok) {
                return null;
            }

            return this.toWorldbookData(await res.json(), name);
        } catch (error) {
            console.warn(`[STWorldInfoDriver] REST 获取世界书失败: ${name}`, error);
            return null;
        }
    }

    private static isImportSuccess(result: STWorldbookImportResult): boolean {
        return result === true || !!(result && typeof result === 'object' && 'ok' in result && (result as Response).ok);
    }

    /**
     * 获取所有世界书的名称列表
     */
    public static getWorldbookRefs(): STWorldbookRef[] {
        const helper = this.stHelper as any;
        if (helper && typeof helper.getWorldbookNames === 'function') {
            try {
                const refs = this.normalizeWorldbookList(helper.getWorldbookNames());
                if (refs.length) return refs;
            } catch (error) {
                console.warn('[STWorldInfoDriver] TavernHelper 获取世界书列表失败', error);
            }
        }

        const contextRefs = this.normalizeWorldbookList((this.ctx as any)?.world_info_list);
        if (contextRefs.length) return contextRefs;

        return STClient.getWorldbookNames()
            .map((name) => this.normalizeWorldbookRef(name))
            .filter((ref): ref is STWorldbookRef => ref !== null);
    }

    public static getWorldbookNames(): string[] {
        return this.getWorldbookRefs().map((book) => book.name);
    }

    /**
     * 读取指定世界书的原始数据
     */
    public static async getWorldbook(name: string): Promise<STWorldbookData> {
        const normalizedName = this.normalizeBookName(name);
        const helper = this.stHelper as any;

        if (helper && typeof helper.getWorldbook === 'function') {
            try {
                const raw = await helper.getWorldbook(normalizedName);
                if (raw) {
                    return this.toWorldbookData(raw, normalizedName);
                }
            } catch (error) {
                console.warn(`[STWorldInfoDriver] TavernHelper 获取世界书失败: ${normalizedName}`, error);
            }
        }

        return (await this.fetchWorldbookViaRest(normalizedName)) ?? { name: normalizedName, entries: {} };
    }

    /**
     * 创建一本新的世界书
     */
    public static async createWorldbook(name: string, entries: any[] = []): Promise<boolean> {
        const normalizedName = this.normalizeBookName(name);
        const helper = this.stHelper as any;
        if (helper && typeof helper.createWorldbook === 'function') {
            try {
                return !!(await helper.createWorldbook(normalizedName, entries));
            } catch (error) {
                console.warn(`[STWorldInfoDriver] TavernHelper 创建世界书失败: ${normalizedName}`, error);
            }
        }
        return false;
    }

    /**
     * 将原始数据强行覆盖/导入到世界书中
     */
    public static async importRawWorldbook(filename: string, data: string): Promise<boolean> {
        const normalizedName = this.normalizeBookName(filename);
        const helper = this.stHelper as any;
        if (helper && typeof helper.importRawWorldbook === 'function') {
            try {
                const result = await helper.importRawWorldbook(normalizedName, data);
                if (this.isImportSuccess(result)) return true;

                if (result && typeof result === 'object' && 'text' in result && typeof (result as Response).text === 'function') {
                    const body = await (result as Response).text().catch(() => '');
                    console.error(`[STWorldInfoDriver] 导入世界书失败: ${normalizedName}`, body);
                }
            } catch (error) {
                console.warn(`[STWorldInfoDriver] TavernHelper 导入世界书失败: ${normalizedName}`, error);
            }
        }
        return false;
    }

    /**
     * 获取全局激活的世界书名称列表
     */
    public static getGlobalWorldbookNames(): string[] {
        const helper = this.stHelper as any;
        if (helper && typeof helper.getGlobalWorldbookNames === 'function') {
            try {
                const names = helper.getGlobalWorldbookNames();
                if (Array.isArray(names)) {
                    return names
                        .map((name) => typeof name === 'string' ? this.normalizeBookName(name) : '')
                        .filter(Boolean);
                }
            } catch (error) {
                console.warn('[STWorldInfoDriver] TavernHelper 获取全局世界书失败', error);
            }
        }

        const globalBooks = (this.ctx as any)?.world_info_global;
        return Array.isArray(globalBooks)
            ? globalBooks.map((name) => typeof name === 'string' ? this.normalizeBookName(name) : '').filter(Boolean)
            : [];
    }

    public static getSelectedWorldbookName(): string | null {
        const selected = (this.ctx as any)?.selected_world_info;
        const normalized = typeof selected === 'string' ? this.normalizeBookName(selected) : '';
        return normalized || null;
    }

    /**
     * 重新绑定全局世界书
     */
    public static async rebindGlobalWorldbooks(newList: string[]): Promise<void> {
        const helper = this.stHelper as any;
        if (helper && typeof helper.rebindGlobalWorldbooks === 'function') {
            await helper.rebindGlobalWorldbooks(newList.map((name) => this.normalizeBookName(name)).filter(Boolean));
        }
    }

    public static async replaceWorldbook(
        worldbook_name: string,
        worldbook: PartialDeep<WorldbookEntry>[],
        options: ReplaceWorldbookOptions = {}
    ): Promise<void> {
        const helper = this.stHelper as any;
        if (!helper || typeof helper.replaceWorldbook !== 'function') return;
        const { render } = options;
        await helper.replaceWorldbook(this.normalizeBookName(worldbook_name), worldbook, { render });
    }
}
