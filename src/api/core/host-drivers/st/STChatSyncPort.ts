import { configureChatSyncPortFactory, type ChatSyncPort } from '../../conversation/ChatSyncPort.js';
import type { WorldlineStore } from '../../storage/WorldlineStore.js';
import { STSyncService } from './STSyncService.js';

class STChatSyncPort implements ChatSyncPort {
    constructor(private readonly service: STSyncService) {}

    get isHostLoading(): boolean {
        return this.service.isSTLoading;
    }

    set isHostLoading(value: boolean) {
        this.service.isSTLoading = value;
    }

    get isSTLoading(): boolean {
        return this.service.isSTLoading;
    }

    set isSTLoading(value: boolean) {
        this.service.isSTLoading = value;
    }

    get isSTGenerating(): boolean {
        return this.service.isSTGenerating;
    }

    set isSTGenerating(value: boolean) {
        this.service.isSTGenerating = value;
    }

    get isAutoSyncPaused(): boolean {
        return this.service.isAutoSyncPaused;
    }

    async syncFromHost(options: { forceOverwrite?: boolean } = {}): Promise<{ totalDiff: number; details?: unknown }> {
        return this.service.syncFromST(options);
    }

    async commitToHost(): Promise<void> {
        await this.service.commitToST();
    }

    async syncFromST(options: { forceOverwrite?: boolean } = {}): Promise<{ totalDiff: number; details?: unknown }> {
        return this.syncFromHost(options);
    }

    async commitToST(): Promise<void> {
        return this.commitToHost();
    }

    pauseAutoSync(): void {
        this.service.pauseAutoSync();
    }

    resumeAutoSync(): void {
        this.service.resumeAutoSync();
    }
}

let registered = false;

export function registerSTChatSyncPort(): void {
    if (registered) return;
    registered = true;
    configureChatSyncPortFactory((store: WorldlineStore) => new STChatSyncPort(new STSyncService(store)));
}
