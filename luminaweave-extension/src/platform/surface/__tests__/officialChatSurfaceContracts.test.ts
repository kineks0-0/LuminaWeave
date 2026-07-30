import { describe, expect, it } from 'vitest';
import {
    OFFICIAL_SURFACE_CONTRACTS,
    OFFICIAL_SURFACE_INPUT_SCHEMAS
} from '../officialContracts.js';

const CHAT_SURFACE_CONTRACTS = [
    'character.roster',
    'conversation.sessionList',
    'chat.transcript',
    'chat.composer',
    'chat.promptInspector',
    'chat.main'
] as const;

describe('official chat surface contracts', () => {
    it('registers every composable chat contract', () => {
        expect(OFFICIAL_SURFACE_CONTRACTS).toEqual(expect.arrayContaining([...CHAT_SURFACE_CONTRACTS]));
    });

    it('uses strict input schemas for every composable chat contract', () => {
        for (const contractId of CHAT_SURFACE_CONTRACTS) {
            const schema = Reflect.get(OFFICIAL_SURFACE_INPUT_SCHEMAS, contractId);

            expect(schema, contractId).toBeDefined();
            expect(schema.safeParse({ unsupportedInput: true }).success, contractId).toBe(false);
        }
    });
});
