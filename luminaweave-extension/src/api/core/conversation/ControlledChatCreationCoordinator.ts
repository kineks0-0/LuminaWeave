export type ControlledChatCreationStatus = 'idle' | 'running' | 'finalizing';

export interface ControlledChatCreationState {
    status: ControlledChatCreationStatus;
    targetCharacterId: string | null;
    intermediateChatId: string | null;
    finalChatId: string | null;
    startedAt: number | null;
}

export interface ControlledChatCreationSummary extends ControlledChatCreationState {
    durationMs: number;
    skippedHostSyncCount: number;
    deferredPromptSync: boolean;
}

const IDLE_STATE: ControlledChatCreationState = {
    status: 'idle',
    targetCharacterId: null,
    intermediateChatId: null,
    finalChatId: null,
    startedAt: null
};

export class ControlledChatCreationCoordinator {
    private state: ControlledChatCreationState = { ...IDLE_STATE };
    private skippedHostSyncKeys = new Set<string>();
    private deferredPromptSync = false;
    private lastDryRunPromptFingerprint: string | null = null;
    private lastDryRunPromptAt = 0;
    private lastDryRunRestartAt = 0;

    begin(targetCharacterId: string | number | null | undefined): ControlledChatCreationState {
        this.state = {
            status: 'running',
            targetCharacterId: targetCharacterId == null ? null : String(targetCharacterId),
            intermediateChatId: null,
            finalChatId: null,
            startedAt: Date.now()
        };
        this.skippedHostSyncKeys.clear();
        this.deferredPromptSync = false;
        this.lastDryRunPromptFingerprint = null;
        this.lastDryRunPromptAt = 0;
        this.lastDryRunRestartAt = 0;
        return this.getState();
    }

    isActive(): boolean {
        return this.state.status !== 'idle';
    }

    getState(): ControlledChatCreationState {
        return { ...this.state };
    }

    markObservedChat(chatId: string | null | undefined): void {
        if (!this.isActive() || !chatId) {
            return;
        }

        if (this.state.finalChatId && chatId === this.state.finalChatId) {
            return;
        }

        if (!this.state.intermediateChatId) {
            this.state.intermediateChatId = chatId;
        }
    }

    suppressHostSync(reason: string, chatId: string | null | undefined): boolean {
        if (!this.isActive()) {
            return false;
        }

        this.markObservedChat(chatId);
        this.skippedHostSyncKeys.add(`${reason}:${chatId || 'null'}`);
        return true;
    }

    markFinalChat(chatId: string | null | undefined): ControlledChatCreationState {
        if (!chatId) {
            return this.getState();
        }

        this.state.finalChatId = chatId;
        this.state.status = 'finalizing';
        return this.getState();
    }

    deferPromptSync(): boolean {
        if (!this.isActive()) {
            return false;
        }

        this.deferredPromptSync = true;
        return true;
    }

    consumeDeferredPromptSync(): boolean {
        const shouldFlush = this.deferredPromptSync;
        this.deferredPromptSync = false;
        return shouldFlush;
    }

    shouldEmitDryRunPrompt(fingerprint: string | null): boolean {
        if (!fingerprint) {
            return true;
        }

        const now = Date.now();
        const isDuplicate = this.lastDryRunPromptFingerprint === fingerprint && now - this.lastDryRunPromptAt < 800;
        this.lastDryRunPromptFingerprint = fingerprint;
        this.lastDryRunPromptAt = now;
        return !isDuplicate;
    }

    shouldSuppressDryRunRestart(): boolean {
        if (!this.isActive()) {
            return false;
        }

        const now = Date.now();
        const isDuplicate = now - this.lastDryRunRestartAt < 800;
        this.lastDryRunRestartAt = now;
        return isDuplicate;
    }

    end(): ControlledChatCreationSummary {
        const finishedState = this.getState();
        const durationMs = finishedState.startedAt ? Math.max(0, Date.now() - finishedState.startedAt) : 0;
        const summary: ControlledChatCreationSummary = {
            ...finishedState,
            durationMs,
            skippedHostSyncCount: this.skippedHostSyncKeys.size,
            deferredPromptSync: this.deferredPromptSync
        };

        this.state = { ...IDLE_STATE };
        this.skippedHostSyncKeys.clear();
        this.deferredPromptSync = false;
        this.lastDryRunPromptFingerprint = null;
        this.lastDryRunPromptAt = 0;
        this.lastDryRunRestartAt = 0;
        return summary;
    }
}
