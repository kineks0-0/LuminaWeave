import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

interface TauriCapabilityConfig {
    permissions: unknown;
}

const readDefaultCapability = (): TauriCapabilityConfig => {
    const parsed: unknown = JSON.parse(readFileSync(
        new URL('../../../../../src-tauri/capabilities/default.json', import.meta.url),
        'utf8'
    ));
    if (!parsed || typeof parsed !== 'object' || !('permissions' in parsed)) {
        throw new Error('Tauri default capability missing permissions');
    }
    return parsed as TauriCapabilityConfig;
};

const readDefaultPermissions = (): string[] => {
    const permissions = readDefaultCapability().permissions;
    if (!Array.isArray(permissions) || !permissions.every(item => typeof item === 'string')) {
        throw new Error('Tauri default capability permissions must be string array');
    }
    return permissions;
};

describe('Tauri SQLite capability', () => {
    it('grants the SQL commands required by the runtime store', () => {
        expect(readDefaultPermissions()).toEqual(expect.arrayContaining([
            'sql:default',
            'sql:allow-execute'
        ]));
    });
});
