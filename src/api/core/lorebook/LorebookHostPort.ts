export interface LorebookHostWorldbookRef {
    name: string;
    id: string;
}

export interface LorebookHostWorldbookData {
    entries?: Record<string, unknown> | unknown[];
    data?: Record<string, unknown> | unknown[];
    [key: string]: unknown;
}

export interface LorebookHostPort {
    getWorldbookRefs(): LorebookHostWorldbookRef[];
    getWorldbook(name: string): Promise<LorebookHostWorldbookData>;
    createWorldbook(name: string, entries?: any[]): Promise<boolean>;
    importRawWorldbook(filename: string, data: string): Promise<boolean>;
    getGlobalWorldbookNames(): string[];
    getSelectedWorldbookName(): string | null;
    rebindGlobalWorldbooks(newList: string[]): Promise<void>;
    syncLuminaRegex?(): Promise<void>;
}

const emptyLorebookHostPort: LorebookHostPort = {
    getWorldbookRefs: () => [],
    getWorldbook: async () => ({ entries: {} }),
    createWorldbook: async () => false,
    importRawWorldbook: async () => false,
    getGlobalWorldbookNames: () => [],
    getSelectedWorldbookName: () => null,
    rebindGlobalWorldbooks: async () => { /* no-op for hostless runtimes */ }
};

let currentLorebookHostPort: LorebookHostPort = emptyLorebookHostPort;

export function configureLorebookHostPort(port: LorebookHostPort): void {
    currentLorebookHostPort = port;
}

export function getLorebookHostPort(): LorebookHostPort {
    return currentLorebookHostPort;
}
