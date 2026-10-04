import {
    buildImportedCharacterCard,
    extractPngCharacterCard,
    parseCharacterCardJson,
    type ResourceDocument
} from '@shared/resources/index.js';
import type { ResourceService } from './ResourceService.js';

const isPngFile = (file: File): boolean =>
    file.type === 'image/png' || file.name.toLowerCase().endsWith('.png');

const isJsonFile = (file: File): boolean =>
    file.type === 'application/json' || file.name.toLowerCase().endsWith('.json');

/**
 * 将用户选择的角色卡文件导入 Lumina 本地资源源。
 * PNG 走 chara/ccv3 元数据并保留头像；JSON 直接解析 ST v1/v2/v3 卡片。
 */
export class CharacterImportService {
    constructor(private readonly resources: ResourceService) {}

    async importFile(file: File): Promise<ResourceDocument> {
        let card: Record<string, unknown>;
        let avatarDataUrl: string | null = null;

        if (isPngFile(file)) {
            const parsed = await extractPngCharacterCard(await file.arrayBuffer());
            card = parsed.card;
            avatarDataUrl = parsed.avatarDataUrl;
        } else if (isJsonFile(file)) {
            card = parseCharacterCardJson(await file.text());
        } else {
            throw new Error('仅支持导入 .png 或 .json 角色卡。');
        }

        return this.resources.importResource(
            'local',
            'character',
            buildImportedCharacterCard(card, avatarDataUrl)
        );
    }
}
