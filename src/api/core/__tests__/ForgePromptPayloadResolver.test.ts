import { describe, expect, it } from 'vitest';
import { ForgePromptPayloadResolver } from '../ForgePromptPayloadResolver';

describe('ForgePromptPayloadResolver', () => {
    it('应正确构造会话记忆快照模板输入', () => {
        const result = ForgePromptPayloadResolver.buildMemorySnapshotTemplateInput({
            sourceId: 'forge',
            sessionId: 'forge_session_1',
            activeLeafId: 'node_123456',
            messageCount: 6,
            selectedChatSessionId: 'chat_1',
            selectedChatSnapshotId: 'snapshot_chat_1',
            lorebook: {
                bookId: 'book_1',
                versionMode: 'follow-timeline',
                versionLabel: 'Forge · 123456',
                versionHint: 'hint',
                snapshotKey: 'snapshot_1',
                entryCount: 3,
                entries: []
            }
        });

        expect(result.sessionId).toBe('forge_session_1');
        expect(result.activeLeafId).toBe('node_123456');
        expect(result.referenceChatLine).toContain('reference_chat=chat_1');
        expect(result.referenceSnapshotLine).toContain('reference_snapshot=snapshot_chat_1');
        expect(result.lorebookEntryCount).toBe(3);
    });

    it('应正确构造 workflow 模板输入', () => {
        const result = ForgePromptPayloadResolver.buildWorkflowTemplateInput({
            stage: 'rewrite_export',
            visiblePhase: 'output_delivery',
            detailMode: 'detailed',
            activeLayer: 'output',
            subLayer: 'output',
            promptMode: 'planner',
            reason: '等待最终确认',
            recommendedAction: '确认提交范围',
            shouldGenerate: true,
            stagingCount: 0,
            commitReadyCount: 2,
            stagingEntries: [],
            commitReadyEntries: [],
            draftCount: 2,
            allowedActions: ['freeze_workspace'],
            missingFields: [],
            nextRecommendedLayer: null,
            entryMode: 'structured',
            completedLayers: ['concept', 'entity'],
            requiresUserDecision: true,
            updatedAt: Date.now()
        });

        expect(result.stage).toBe('rewrite_export');
        expect(result.visiblePhase).toBe('output_delivery');
        expect(result.commitReadyCount).toBe('2');
        expect(result.requiresUserDecision).toBe(true);
    });

    it('应在 structured state 模板输入中包含字段值摘要', () => {
        const result = ForgePromptPayloadResolver.buildStructuredStateTemplateInput({
            activeFormId: 'role_core_profile',
            activeMessageFormId: null,
            lastUpdatedAt: 123456,
            forms: {
                role_core_profile: {
                    id: 'role_core_profile',
                    layer: 'concept',
                    title: '概念层',
                    lastSubmittedAt: 123450,
                    missingFields: ['background'],
                    fields: {
                        name: { value: '林雾', locked: false, confirmed: true, source: 'manual', updatedAt: 1 },
                        identity: { value: '失忆的教会审讯官', locked: false, confirmed: true, source: 'manual', updatedAt: 2 },
                        background: { value: '', locked: false, confirmed: false, source: 'system', updatedAt: 3 }
                    }
                }
            }
        });

        expect(result.formsDigest).toContain('role_core_profile:name,identity,background');
        expect(result.formsDetail).toContain('name=林雾');
        expect(result.formsDetail).toContain('identity=失忆的教会审讯官');
        expect(result.formsDetail).toContain('missing=background');
    });
});
