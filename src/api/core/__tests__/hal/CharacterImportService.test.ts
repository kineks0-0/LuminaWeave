import { beforeEach, describe, expect, it, vi } from 'vitest';
import { initMockHAL } from '@/api/core/__tests__/support/halMock.js';
import { CharacterImportService } from '@/api/core/hal/resource/CharacterImportService.js';
import { ResourceService } from '@/api/core/hal/resource/ResourceService.js';
import { ResourceSourceRegistry } from '@/api/core/hal/resource/ResourceSourceRegistry.js';
import { LocalResourceSource } from '@/api/core/host-drivers/standalone/LocalResourceSource.js';

const store = new Map<string, unknown>();

const utf8ToBase64 = (text: string): string => {
    const bytes = new TextEncoder().encode(text);
    let binary = '';
    bytes.forEach((byte) => {
        binary += String.fromCharCode(byte);
    });
    return btoa(binary);
};

const PNG_SIGNATURE = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

const buildPngCardFile = (cardJson: string): File => {
    const payload = new TextEncoder().encode(`chara\0${utf8ToBase64(cardJson)}`);
    const chunk = new Uint8Array(12 + payload.length);
    const view = new DataView(chunk.buffer);
    view.setUint32(0, payload.length);
    chunk.set(new TextEncoder().encode('tEXt'), 4);
    chunk.set(payload, 8);
    const bytes = new Uint8Array(PNG_SIGNATURE.length + chunk.length);
    bytes.set(PNG_SIGNATURE);
    bytes.set(chunk, PNG_SIGNATURE.length);
    return new File([bytes], 'hero.png', { type: 'image/png' });
};

const V2_CARD = JSON.stringify({
    spec: 'chara_card_v2',
    data: { name: '测试角色', description: '描述', first_mes: '你好' }
});

describe('CharacterImportService', () => {
    beforeEach(() => {
        store.clear();
        initMockHAL({ runtime: {
            extensionStore: {
                listKeys: vi.fn(async () => Array.from(store.keys())),
                getJson: vi.fn(async ({ key }: { key: string }) => store.get(key) ?? null),
                setJson: vi.fn(async ({ key, value }: { key: string; value: unknown }) => { store.set(key, value); }),
                updateJson: vi.fn(async ({ key, value }: { key: string; value: unknown }) => { store.set(key, value); }),
                deleteJson: vi.fn(async ({ key }: { key: string }) => { store.delete(key); }),
                setBlob: vi.fn(),
                getBlob: vi.fn()
            }
        } });
    });

    const createService = (): CharacterImportService => {
        const registry = new ResourceSourceRegistry();
        registry.registerSource(new LocalResourceSource());
        return new CharacterImportService(new ResourceService(registry));
    };

    it('imports a v2 JSON card with a data.name derived resource id', async () => {
        const document = await createService().importFile(
            new File([V2_CARD], 'hero.json', { type: 'application/json' })
        );

        expect(document.ref).toMatchObject({
            sourceId: 'local',
            resourceType: 'character',
            resourceId: '测试角色'
        });
        expect(document.summary.name).toBe('测试角色');
    });

    it('imports a PNG card and keeps the avatar data URL in raw', async () => {
        const document = await createService().importFile(buildPngCardFile(V2_CARD));
        const raw = document.raw as Record<string, unknown>;

        expect(document.ref.resourceId).toBe('测试角色');
        expect(String(raw._lumina_avatar)).toContain('data:image/png;base64,');
    });

    it('rejects unsupported files and unnamed cards', async () => {
        const service = createService();
        await expect(service.importFile(new File(['x'], 'hero.txt'))).rejects.toThrow('仅支持');
        await expect(service.importFile(
            new File(['{"description":"x"}'], 'hero.json', { type: 'application/json' })
        )).rejects.toThrow('name');
    });
});
