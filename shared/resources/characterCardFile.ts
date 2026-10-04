import { base64ToBytes, bytesToBase64, isRecord } from '../CommonUtils.js';
import { resolveCharacterCardSource, worldbookEntriesToLorebookEntries } from './stFormat.js';

export interface CharacterCardFileParseResult {
    card: Record<string, unknown>;
    avatarDataUrl: string | null;
}

const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a] as const;
const AVATAR_FIELD = '_lumina_avatar';

const asRecord = (value: unknown): Record<string, unknown> =>
    isRecord(value) ? value : {};

const readUint32 = (bytes: Uint8Array, offset: number): number =>
    ((bytes[offset] << 24) | (bytes[offset + 1] << 16) | (bytes[offset + 2] << 8) | bytes[offset + 3]) >>> 0;

const readAscii = (bytes: Uint8Array, offset: number, length: number): string => {
    let result = '';
    for (let index = 0; index < length; index += 1) {
        result += String.fromCharCode(bytes[offset + index]);
    }
    return result;
};

const findNull = (bytes: Uint8Array, start: number): number => {
    for (let index = start; index < bytes.length; index += 1) {
        if (bytes[index] === 0) return index;
    }
    return -1;
};

const decodeBase64Text = (value: string): string | null => {
    const compact = value.replace(/\s+/g, '');
    if (!compact) return null;
    try {
        return new TextDecoder().decode(base64ToBytes(compact));
    } catch {
        return null;
    }
};

const inflate = async (data: Uint8Array): Promise<Uint8Array> => {
    if (typeof DecompressionStream === 'undefined') {
        throw new Error('当前环境不支持解压 PNG 角色卡元数据（缺少 DecompressionStream）。');
    }
    const buffer = data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength) as ArrayBuffer;
    const stream = new Blob([buffer]).stream().pipeThrough(new DecompressionStream('deflate'));
    return new Uint8Array(await new Response(stream).arrayBuffer());
};

const cardCandidateFromText = (text: string | null): Record<string, unknown> | null => {
    if (!text) return null;
    const decoded = decodeBase64Text(text) ?? text;
    try {
        const parsed = JSON.parse(decoded);
        const candidate = asRecord(parsed);
        return Object.keys(candidate).length > 0 ? candidate : null;
    } catch {
        return null;
    }
};

const hasCharacterName = (card: Record<string, unknown>): boolean => {
    const source = resolveCharacterCardSource(card);
    return typeof source.name === 'string' && source.name.trim().length > 0;
};

export const parseCharacterCardJson = (text: string): Record<string, unknown> => {
    let parsed: unknown;
    try {
        parsed = JSON.parse(text);
    } catch {
        throw new Error('角色卡 JSON 解析失败。');
    }
    const card = asRecord(parsed);
    if (Object.keys(card).length === 0) {
        throw new Error('角色卡 JSON 必须是对象。');
    }
    if (!hasCharacterName(card)) {
        throw new Error('角色卡缺少 name 字段。');
    }
    return card;
};

/**
 * 从 PNG 的 tEXt / iTXt / zTXt chunk 中读取 ST 角色卡 JSON，并保留整张 PNG 作为头像。
 */
export const extractPngCharacterCard = async (
    input: ArrayBuffer | Uint8Array
): Promise<CharacterCardFileParseResult> => {
    const bytes = input instanceof Uint8Array ? input : new Uint8Array(input);
    if (bytes.length < 8 || PNG_SIGNATURE.some((byte, index) => bytes[index] !== byte)) {
        throw new Error('不是有效的 PNG 文件。');
    }

    let card: Record<string, unknown> | null = null;
    let offset = 8;
    while (offset + 8 <= bytes.length && !card) {
        const length = readUint32(bytes, offset);
        const type = readAscii(bytes, offset + 4, 4);
        const dataStart = offset + 8;
        const dataEnd = dataStart + length;
        if (dataEnd + 4 > bytes.length) break;

        if (type === 'tEXt' || type === 'zTXt' || type === 'iTXt') {
            const keywordEnd = findNull(bytes, dataStart);
            if (keywordEnd !== -1) {
                const keyword = readAscii(bytes, dataStart, keywordEnd - dataStart);
                if (keyword === 'chara' || keyword === 'ccv3') {
                    if (type === 'tEXt') {
                        const textStart = keywordEnd + 1;
                        card = cardCandidateFromText(readAscii(bytes, textStart, dataEnd - textStart));
                    } else if (type === 'zTXt') {
                        const compressedStart = keywordEnd + 2;
                        const inflated = await inflate(bytes.subarray(compressedStart, dataEnd));
                        card = cardCandidateFromText(new TextDecoder().decode(inflated));
                    } else {
                        const flag = bytes[keywordEnd + 1];
                        const searchFrom = keywordEnd + 2;
                        const languageEnd = findNull(bytes, searchFrom);
                        if (languageEnd !== -1) {
                            const translatedEnd = findNull(bytes, languageEnd + 1);
                            if (translatedEnd !== -1) {
                                const textBytes = bytes.subarray(translatedEnd + 1, dataEnd);
                                const raw = flag === 1 ? await inflate(textBytes) : textBytes;
                                card = cardCandidateFromText(new TextDecoder().decode(raw));
                            }
                        }
                    }
                }
            }
        }

        offset = dataEnd + 4;
    }

    if (!card || !hasCharacterName(card)) {
        throw new Error('PNG 中未找到有效的角色卡元数据。');
    }

    return {
        card,
        avatarDataUrl: `data:image/png;base64,${bytesToBase64(bytes)}`
    };
};

/**
 * 读取角色卡内嵌 character_book（兼容 data 嵌套与顶层两种布局）。
 */
export const extractCharacterBookRaw = (raw: unknown): Record<string, unknown> | null => {
    const root = asRecord(raw);
    const source = resolveCharacterCardSource(root);
    const book = asRecord(source.character_book ?? source.characterBook ?? root.character_book ?? root.characterBook);
    return Object.keys(book).length > 0 ? book : null;
};

export const characterBookToLorebookEntries = (raw: unknown): LuminaLorebookEntry[] => {
    const book = extractCharacterBookRaw(raw);
    return book ? worldbookEntriesToLorebookEntries(book) : [];
};

/**
 * 将导入的原始角色卡包装成 LocalResourceSource 的 raw payload。
 */
export const buildImportedCharacterCard = (
    card: Record<string, unknown>,
    avatarDataUrl: string | null
): Record<string, unknown> => (
    avatarDataUrl ? { ...card, [AVATAR_FIELD]: avatarDataUrl } : { ...card }
);

export const readCharacterAvatarDataUrl = (raw: unknown): string | null => {
    const root = asRecord(raw);
    const value = root[AVATAR_FIELD] ?? resolveCharacterCardSource(root)[AVATAR_FIELD];
    return typeof value === 'string' && value.startsWith('data:image/') ? value : null;
};

export const resolveCharacterMacros = (
    text: string,
    names: { userName?: string | null; charName?: string | null } = {}
): string => (
    text
        .replace(/\{\{\s*user\s*\}\}/gi, names.userName?.trim() || 'User')
        .replace(/\{\{\s*char\s*\}\}/gi, names.charName?.trim() || 'Character')
);
