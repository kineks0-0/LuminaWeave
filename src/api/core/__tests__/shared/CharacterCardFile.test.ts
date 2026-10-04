import { describe, expect, it } from 'vitest';
import {
    buildImportedCharacterCard,
    characterBookToLorebookEntries,
    extractCharacterBookRaw,
    extractPngCharacterCard,
    parseCharacterCardJson,
    readCharacterAvatarDataUrl,
    resolveCharacterMacros
} from '@shared/resources/index.js';

const utf8ToBase64 = (text: string): string => {
    const bytes = new TextEncoder().encode(text);
    let binary = '';
    bytes.forEach((byte) => {
        binary += String.fromCharCode(byte);
    });
    return btoa(binary);
};

const buildChunk = (type: string, data: Uint8Array): Uint8Array => {
    const chunk = new Uint8Array(12 + data.length);
    const view = new DataView(chunk.buffer);
    view.setUint32(0, data.length);
    for (let index = 0; index < 4; index += 1) {
        chunk[4 + index] = type.charCodeAt(index);
    }
    chunk.set(data, 8);
    return chunk;
};

const concat = (...parts: Uint8Array[]): Uint8Array => {
    const total = parts.reduce((sum, part) => sum + part.length, 0);
    const result = new Uint8Array(total);
    let offset = 0;
    for (const part of parts) {
        result.set(part, offset);
        offset += part.length;
    }
    return result;
};

const PNG_SIGNATURE = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

const buildTextPng = (cardJson: string, keyword = 'chara'): Uint8Array => {
    const payload = new TextEncoder().encode(`${keyword}\0${utf8ToBase64(cardJson)}`);
    return concat(PNG_SIGNATURE, buildChunk('tEXt', payload));
};

const buildCompressedPng = async (cardJson: string): Promise<Uint8Array> => {
    const compressed = new Uint8Array(await new Response(
        new Blob([new TextEncoder().encode(cardJson)]).stream().pipeThrough(new CompressionStream('deflate'))
    ).arrayBuffer());
    return concat(PNG_SIGNATURE, buildChunk('zTXt', new Uint8Array([
        ...new TextEncoder().encode('chara\0\0'),
        ...compressed
    ])));
};

const V2_CARD = JSON.stringify({
    spec: 'chara_card_v2',
    spec_version: '2.0',
    data: {
        name: '测试角色',
        description: '描述',
        first_mes: '你好，{{user}}！我是{{char}}。',
        character_book: {
            name: '测试世界书',
            entries: [
                {
                    keys: ['森林'],
                    content: '森林深处有一座塔。',
                    enabled: true,
                    insertion_order: 10
                }
            ]
        }
    }
});

describe('characterCardFile', () => {
    it('parses v2/v3 nested and v1 flat JSON cards', () => {
        expect(parseCharacterCardJson(V2_CARD).spec).toBe('chara_card_v2');
        expect(parseCharacterCardJson(JSON.stringify({
            spec: 'chara_card_v3',
            data: { name: 'V3' }
        })).spec).toBe('chara_card_v3');
        expect(parseCharacterCardJson(JSON.stringify({ name: 'Flat' })).name).toBe('Flat');
    });

    it('rejects invalid or unnamed JSON cards', () => {
        expect(() => parseCharacterCardJson('not json')).toThrow('解析失败');
        expect(() => parseCharacterCardJson('[]')).toThrow('必须是对象');
        expect(() => parseCharacterCardJson('{"description":"x"}')).toThrow('name');
    });

    it('extracts card metadata and avatar from a PNG tEXt chunk', async () => {
        const result = await extractPngCharacterCard(buildTextPng(V2_CARD));
        expect(result.card.spec).toBe('chara_card_v2');
        expect(result.avatarDataUrl?.startsWith('data:image/png;base64,')).toBe(true);
    });

    it('extracts card metadata from ccv3 and compressed zTXt chunks', async () => {
        const ccv3 = await extractPngCharacterCard(buildTextPng(
            JSON.stringify({ spec: 'chara_card_v3', data: { name: 'PNG V3' } }),
            'ccv3'
        ));
        expect((ccv3.card.data as Record<string, unknown>).name).toBe('PNG V3');

        const compressed = await extractPngCharacterCard(await buildCompressedPng(
            JSON.stringify({ spec: 'chara_card_v2', data: { name: '压缩卡' } })
        ));
        expect((compressed.card.data as Record<string, unknown>).name).toBe('压缩卡');
    });

    it('rejects non-PNG input and PNG without card metadata', async () => {
        await expect(extractPngCharacterCard(new Uint8Array([1, 2, 3]))).rejects.toThrow('PNG');
        await expect(extractPngCharacterCard(PNG_SIGNATURE)).rejects.toThrow('未找到');
    });

    it('reads character_book entries from nested and flat layouts', () => {
        expect(extractCharacterBookRaw(JSON.parse(V2_CARD))).not.toBeNull();
        expect(extractCharacterBookRaw({ character_book: { entries: [] } })).not.toBeNull();
        expect(extractCharacterBookRaw({ data: { name: 'no book' } })).toBeNull();

        const entries = characterBookToLorebookEntries(JSON.parse(V2_CARD));
        expect(entries).toHaveLength(1);
        expect(entries[0].key).toEqual(['森林']);
        expect(entries[0].content).toBe('森林深处有一座塔。');
    });

    it('attaches and reads the avatar data URL', () => {
        const card = buildImportedCharacterCard({ name: 'A' }, 'data:image/png;base64,AAAA');
        expect(readCharacterAvatarDataUrl(card)).toBe('data:image/png;base64,AAAA');
        expect(readCharacterAvatarDataUrl(buildImportedCharacterCard({ name: 'A' }, null))).toBeNull();
    });

    it('resolves user/char macros and keeps other macros untouched', () => {
        expect(resolveCharacterMacros('{{user}} 和 {{ char }}', {
            userName: 'Alice',
            charName: 'Bob'
        })).toBe('Alice 和 Bob');
        expect(resolveCharacterMacros('{{time}} {{user}}', { userName: '' })).toBe('{{time}} User');
    });
});
