import type { ForgePiPersistedSessionState } from '@shared/ForgePiTypes.js';
import { HALContext } from '../../hal/HALContext.js';

const FORGE_RUNTIME_NAMESPACE = 'lumina.forge';
const PI_SESSION_TABLE = 'pi-sessions';

const isRecord = (value: unknown): value is Record<string, unknown> =>
    typeof value === 'object' && value !== null && !Array.isArray(value);

const cloneJson = <T>(value: T): T =>
    JSON.parse(JSON.stringify(value)) as T;

const isForgePiPersistedSessionState = (value: unknown): value is ForgePiPersistedSessionState => {
    if (!isRecord(value)) return false;
    return typeof value.sessionId === 'string'
        && (typeof value.activeNodeId === 'string' || value.activeNodeId === null)
        && Array.isArray(value.entries)
        && value.version === 1;
};

export interface ForgePiSessionStoreSaveInput {
    sessionId: string;
    state: ForgePiPersistedSessionState;
}

export class ForgePiSessionStore {
    async save(input: ForgePiSessionStoreSaveInput): Promise<void> {
        await HALContext.instance.runtime.extensionStore.setJson({
            namespace: FORGE_RUNTIME_NAMESPACE,
            table: PI_SESSION_TABLE,
            key: input.sessionId,
            value: cloneJson(input.state)
        });
    }

    async load(sessionId: string): Promise<ForgePiPersistedSessionState | null> {
        const raw = await HALContext.instance.runtime.extensionStore.getJson({
            namespace: FORGE_RUNTIME_NAMESPACE,
            table: PI_SESSION_TABLE,
            key: sessionId
        });
        return isForgePiPersistedSessionState(raw) ? cloneJson(raw) : null;
    }

    async delete(sessionId: string): Promise<void> {
        await HALContext.instance.runtime.extensionStore.deleteJson({
            namespace: FORGE_RUNTIME_NAMESPACE,
            table: PI_SESSION_TABLE,
            key: sessionId
        });
    }
}

export const forgePiSessionStore = new ForgePiSessionStore();
