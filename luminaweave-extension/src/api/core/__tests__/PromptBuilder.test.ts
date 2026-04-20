import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PromptBuilder } from '../PromptBuilder';
import { STClient } from '../st-adapter/STClient';
import { lwStorage } from '../../storage';

vi.mock('../st-adapter/STClient', () => ({
    STClient: {
        substituteMacros: vi.fn(text => text.replace('{{user}}', 'UserA')),
        getActiveWorldInfoItems: vi.fn(() => []),
        getResolvedCurrentCharacterId: vi.fn(() => '0'),
        getResolvedCurrentChatId: vi.fn(() => 'chat_1')
    }
}));

describe('PromptBuilder', () => {
    const originalGet = lwStorage.get.bind(lwStorage);

    beforeEach(() => {
        vi.clearAllMocks();
        vi.restoreAllMocks();
    });

    it('应该能正确合成基础系统提示词', () => {
        const messages = [{ role: 'user' as const, content: 'Hello' }];
        const systemPrompt = 'You are an assistant.';
        
        const result = PromptBuilder.buildActiveMessages({
            systemPrompt,
            messages
        });

        expect(result).toHaveLength(2);
        expect(result[0].role).toBe('system');
        expect(result[0].content).toBe('You are an assistant.');
        expect(result[1].content).toBe('Hello');
    });

    it('应该正确执行宏替换', () => {
        const systemPrompt = 'Hello {{user}}!';
        const result = PromptBuilder.buildActiveMessages({
            systemPrompt,
            messages: []
        });

        expect(STClient.substituteMacros).toHaveBeenCalledWith(systemPrompt);
        expect(result[0].content).toBe('Hello UserA!');
    });

    it('应该能动态注入已激活的世界书条目', () => {
        vi.mocked(STClient.getActiveWorldInfoItems).mockReturnValue([
            { id: 'item1', content: 'World setting A', role: 0 }
        ]);

        const result = PromptBuilder.buildActiveMessages({
            systemPrompt: 'Start.',
            messages: []
        });

        expect(result[0].content).toContain('World setting A');
        expect(result[0].content).toContain('[World Info: item1]');
    });

    it('如果没有激活的世界书条目，不应增加额外内容', () => {
        vi.mocked(STClient.getActiveWorldInfoItems).mockReturnValue([]);

        const result = PromptBuilder.buildActiveMessages({
            systemPrompt: 'Start.',
            messages: []
        });

        expect(result[0].content).toBe('Start.');
    });

    it('应优先使用解析后的世界书视图条目，而不是 ST 当前激活世界书', () => {
        vi.mocked(STClient.getActiveWorldInfoItems).mockReturnValue([
            { id: 'st_item', content: 'ST World setting', role: 0 }
        ]);

        const result = PromptBuilder.buildActiveMessages({
            systemPrompt: 'Start.',
            messages: [],
            resolvedLorebookEntries: [
                {
                    uid: 'resolved_1',
                    comment: 'Resolved Entry',
                    key: ['forge'],
                    keysecondary: [],
                    content: 'Resolved World setting',
                    constant: false,
                    selective: false,
                    selectiveLogic: 0,
                    disable: false,
                    position: 0,
                    depth: 0,
                    order: 0,
                    probability: 100,
                    scan_depth: 0
                }
            ]
        });

        expect(result[0].content).toContain('Resolved World setting');
        expect(result[0].content).not.toContain('ST World setting');
    });

    it('应在系统提示词中注入会话记忆快照摘要', () => {
        const result = PromptBuilder.buildActiveMessages({
            systemPrompt: 'Start.',
            messages: [],
            memorySnapshot: {
                sourceId: 'forge',
                sessionId: 'forge_session_1',
                activeLeafId: 'node_123456',
                messageCount: 4,
                selectedChatSessionId: 'chat_1',
                selectedChatSnapshotId: 'snapshot_chat_1',
                lorebook: {
                    bookId: 'book_1',
                    versionMode: 'follow-timeline',
                    versionLabel: 'Forge · 123456',
                    versionHint: 'hint',
                    snapshotKey: 'snapshot_1',
                    entryCount: 2,
                    entries: []
                }
            }
        });

        expect(result[0].content).toContain('【会话记忆快照】');
        expect(result[0].content).toContain('source=forge');
        expect(result[0].content).toContain('reference_chat=chat_1');
        expect(result[0].content).toContain('lorebook_entries=2');
    });

    it('应在系统提示词中注入 Forge workflow 快照', () => {
        const result = PromptBuilder.buildActiveMessages({
            systemPrompt: 'Start.',
            messages: [],
            workflowSnapshot: {
                stage: 'rewrite_export',
                visiblePhase: 'output_delivery',
                detailMode: 'detailed',
                activeLayer: 'output',
                subLayer: 'output',
                promptMode: 'planner',
                reason: '当前已有待审核修改。',
                recommendedAction: '继续与用户确认 staging 条目。',
                shouldGenerate: true,
                stagingCount: 2,
                commitReadyCount: 0,
                stagingEntries: [],
                commitReadyEntries: [],
                draftCount: 1,
                allowedActions: ['review_drafts'],
                missingFields: [],
                nextRecommendedLayer: null,
                entryMode: 'structured',
                completedLayers: ['concept'],
                requiresUserDecision: true,
                updatedAt: Date.now()
            }
        });

        expect(result[0].content).toContain('【Forge Workflow】');
        expect(result[0].content).toContain('stage=rewrite_export');
        expect(result[0].content).toContain('commit_ready_count=0');
        expect(result[0].content).toContain('recommended_action=继续与用户确认 staging 条目。');
    });

    it('应为 forge 上下文注入专属 system protocol，且不混入 Chat_Reply', () => {
        const result = PromptBuilder.buildForgePrompt({
            systemPrompt: 'Forge Start.',
            messages: [],
            includeSystemProtocol: true
        });

        expect(result[0].content).toContain('[System Protocol]');
        expect(result[0].content).toContain('<thinking>');
        expect(result[0].content).toContain('<forge_skill>');
        expect(result[0].content).toContain('<draft_plan>');
        expect(result[0].content).toContain('<entry_update>');
        expect(result[0].content).toContain('<V>');
        expect(result[0].content).not.toContain('<Chat_Reply>');
        expect(result[0].content).toContain('Forge <V> DSL 结构化收集规范');
        expect(result[0].content).toContain('ForgeInput("role_core_profile", "name", "角色姓名", "例如：林雾")');
        expect(result[0].content).toContain('绝对禁止写成 XML 标签或属性式伪语法');
        expect(result[0].content).toContain('参数按位置顺序传入，不得使用任何 key=value 写法。');
        expect(result[0].content).toContain('ForgeMissingFields("power_system", "name,origin")');
    });

    it('当设置为管道式时，提示词文档应只暴露管道语法', () => {
        vi.spyOn(lwStorage, 'get').mockImplementation((key: string, defaultValue: any, scope?: any) => {
            if (key === 'lumina-settings.luminaViewSyntaxStyle') {
                return 'pipe';
            }
            return originalGet(key, defaultValue, scope);
        });

        const result = PromptBuilder.buildForgePrompt({
            systemPrompt: 'Forge Start.',
            messages: [],
            includeSystemProtocol: true
        });

        expect(result[0].content).toContain('Forge 当前设置为管道式 DSL');
        expect(result[0].content).toContain('FI|role_core_profile|name|角色姓名|例如：林雾');
        expect(result[0].content).not.toContain('ForgeInput("role_core_profile", "name", "角色姓名", "例如：林雾")');
    });
});
