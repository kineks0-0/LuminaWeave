import { describe, expect, it } from 'vitest';

import { buildToolApprovalPresentation } from '../review/forgeToolApprovalPresentation.js';

describe('forgeToolApprovalPresentation', () => {
    it('summarizes writeFile approvals with target path and proposed content', () => {
        const presentation = buildToolApprovalPresentation('writeFile', {
            path: 'lorebook/new.json',
            content: '{"title":"New","content":"City"}'
        });

        expect(presentation).toMatchObject({
            summary: '写入文件并生成可审阅 staging',
            targetLabel: '目标路径',
            targetValue: 'lorebook/new.json'
        });
        expect(presentation.blocks).toEqual([
            {
                label: '原内容',
                value: '批准后执行工具时读取当前文件内容，并在 staging proposal 中展示完整对比。',
                tone: 'pending'
            },
            {
                label: '新内容',
                value: '{"title":"New","content":"City"}',
                tone: 'neutral'
            }
        ]);
    });

    it('summarizes editFile approvals with old and new snippets', () => {
        const presentation = buildToolApprovalPresentation('editFile', {
            path: 'lorebook/city.json',
            old_string: 'old city',
            new_string: 'new city'
        });

        expect(presentation.targetValue).toBe('lorebook/city.json');
        expect(presentation.blocks).toEqual([
            { label: '原片段', value: 'old city', tone: 'neutral' },
            { label: '新片段', value: 'new city', tone: 'neutral' }
        ]);
    });

    it('summarizes stageEntry approvals with target entry and proposed content', () => {
        const presentation = buildToolApprovalPresentation('stageEntry', {
            targetEntryId: 'character.concept',
            title: '概念更新',
            content: '更清晰的角色核心'
        });

        expect(presentation).toMatchObject({
            summary: '直接创建 Review proposal',
            targetLabel: '目标条目',
            targetValue: 'character.concept'
        });
        expect(presentation.blocks).toEqual([
            {
                label: '原内容',
                value: '批准后进入 staging，由 Review proposal 与虚拟世界书现有条目合成预览。',
                tone: 'pending'
            },
            { label: '新内容', value: '更清晰的角色核心', tone: 'neutral' }
        ]);
    });
});
