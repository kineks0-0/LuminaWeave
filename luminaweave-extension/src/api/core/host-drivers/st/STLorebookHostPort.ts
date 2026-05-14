import { configureLorebookHostPort, type LorebookHostPort } from '../../lorebook/LorebookHostPort.js';
import { globalRegexSyncService } from './RegexSyncService.js';
import { STWorldInfoDriver } from './STWorldInfoDriver.js';

const stLorebookHostPort: LorebookHostPort = {
    getWorldbookRefs: () => STWorldInfoDriver.getWorldbookRefs(),
    getWorldbook: (name) => STWorldInfoDriver.getWorldbook(name),
    createWorldbook: (name, entries) => STWorldInfoDriver.createWorldbook(name, entries),
    importRawWorldbook: (filename, data) => STWorldInfoDriver.importRawWorldbook(filename, data),
    getGlobalWorldbookNames: () => STWorldInfoDriver.getGlobalWorldbookNames(),
    getSelectedWorldbookName: () => STWorldInfoDriver.getSelectedWorldbookName(),
    rebindGlobalWorldbooks: (newList) => STWorldInfoDriver.rebindGlobalWorldbooks(newList),
    syncLuminaRegex: () => globalRegexSyncService.syncLuminaRegexToST()
};

let registered = false;

export function registerSTLorebookHostPort(): void {
    if (registered) return;
    configureLorebookHostPort(stLorebookHostPort);
    registered = true;
}
