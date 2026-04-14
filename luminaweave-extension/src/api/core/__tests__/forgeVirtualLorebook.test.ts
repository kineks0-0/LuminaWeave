import { describe, expect, it } from 'vitest';
import {
    buildFrozenVirtualLorebookContent,
    findVirtualLorebookEntry,
    findVirtualLorebookEntryIndex
} from '../utils/forgeVirtualLorebook';
import type { ForgeVirtualLorebookEntry } from '../../../types/SessionTypes';
import type { StagingEntry } from '../../../types/ForgeRuntimeTypes';

const importedEntry: ForgeVirtualLorebookEntry = {
    id: 'forge_lore_import_character.alpha',
    sourceBookId: 'book-1',
    createdAt: 1,
    updatedAt: 1,
    entry: {
        uid: 'character.alpha',
        key: ['alpha'],
        keysecondary: ['hero'],
        comment: '角色卡主条目',
        content: '旧内容',
        order: 42,
        disable: true,
        constant: true,
        selective: true,
        selectiveLogic: 2,
        position: 3,
        depth: 4,
        probability: 55,
        scan_depth: 7
    }
};

const stagedEntry: StagingEntry = {
    id: 'staging-1',
    targetEntryId: 'character.alpha',
    proposedContent: '新角色卡内容',
    originalContent: '旧内容',
    description: '角色卡主条目',
    timestamp: 2,
    layer: 'output',
    sourceTag: 'entry_update',
    sourceMessageId: 'msg-1',
    sourceSessionId: 'forge-session-1'
};

describe('forgeVirtualLorebook utils', () => {
    it('应通过 uid 命中已导入的虚拟世界书条目', () => {
        expect(findVirtualLorebookEntryIndex([importedEntry], 'character.alpha')).toBe(0);
        expect(findVirtualLorebookEntry([importedEntry], 'character.alpha')?.id).toBe(importedEntry.id);
    });

    it('应通过 comment 命中角色卡条目', () => {
        expect(findVirtualLorebookEntryIndex([importedEntry], '角色卡主条目')).toBe(0);
    });

    it('冻结修改时应保留原条目元数据，只替换正文和描述', () => {
        const result = buildFrozenVirtualLorebookContent(stagedEntry, importedEntry.entry);

        expect(result.uid).toBe('character.alpha');
        expect(result.content).toBe('新角色卡内容');
        expect(result.comment).toBe('角色卡主条目');
        expect(result.key).toEqual(['alpha']);
        expect(result.keysecondary).toEqual(['hero']);
        expect(result.order).toBe(42);
        expect(result.disable).toBe(true);
        expect(result.constant).toBe(true);
        expect(result.selective).toBe(true);
        expect(result.selectiveLogic).toBe(2);
        expect(result.position).toBe(3);
        expect(result.depth).toBe(4);
        expect(result.probability).toBe(55);
        expect(result.scan_depth).toBe(7);
    });

    it('新建条目时应回退到默认虚拟世界书字段', () => {
        const result = buildFrozenVirtualLorebookContent({
            ...stagedEntry,
            targetEntryId: 'new.character.card',
            description: '新角色卡条目'
        });

        expect(result.uid).toBe('new.character.card');
        expect(result.comment).toBe('新角色卡条目');
        expect(result.key).toEqual([]);
        expect(result.order).toBe(100);
        expect(result.disable).toBe(false);
        expect(result.constant).toBe(false);
    });
});
