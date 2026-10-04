import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { STResourceSource } from '@/api/core/host-drivers/st/STResourceSource.js';
import { STClient } from '@/api/core/host-drivers/st/STClient.js';
import { STGlobalAccessor } from '@/api/core/host-drivers/st/STGlobalAccessor.js';
import type { ResourceRef } from '@shared/resources/index.js';

vi.mock('@/api/core/host-drivers/st/STClient.js', () => ({
    STClient: {
        getCharacters: vi.fn(),
        getWorldbookNames: vi.fn(() => []),
        getWorldbook: vi.fn(),
        getPresets: vi.fn(() => []),
        getPreset: vi.fn(),
        getCharacterData: vi.fn()
    }
}));

const createCharacterRef = (resourceId: string): ResourceRef => ({
    sourceId: 'st',
    resourceType: 'character',
    resourceId,
    revision: null,
    path: `st/character/${resourceId}`,
    writable: false,
    origin: 'st',
    forkedFrom: null
});

describe('STResourceSource character resolution', () => {
    let source: STResourceSource;

    beforeEach(() => {
        vi.clearAllMocks();
        source = new STResourceSource();
        vi.spyOn(STGlobalAccessor, 'stMain', 'get').mockReturnValue({} as any);
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('should resolve avatar ids through TavernHelper.getCharData first', async () => {
        const character = { name: 'Alpha', avatar: 'alpha.png', data: { description: 'A' } };
        vi.mocked(STClient.getCharacters).mockReturnValue([character] as any);
        vi.mocked(STClient.getCharacterData).mockReturnValue(character as any);

        const doc = await source.getResource(createCharacterRef('alpha.json'));

        expect(STClient.getCharacterData).toHaveBeenCalledWith('alpha.png');
        expect(doc?.raw).toMatchObject({ name: 'Alpha', id: '0' });
    });

    it('should fall back to the host character array for legacy numeric ids', async () => {
        const character = { name: 'Alpha', avatar: 'alpha.png', data: { description: 'A' } };
        vi.mocked(STClient.getCharacters).mockReturnValue([character] as any);
        vi.mocked(STClient.getCharacterData).mockReturnValue(null);

        const doc = await source.getResource(createCharacterRef('0'));

        expect(doc?.raw).toMatchObject({ name: 'Alpha', id: '0' });
    });
});
