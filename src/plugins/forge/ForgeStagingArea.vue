<script setup lang="ts">
import { luminaWeaveApi } from '../../api';
import { useForgeStore } from '../../stores/useForgeStore';
import { useCardMakerStore } from './CardMakerStore';
import { buildFrozenVirtualLorebookContent, findVirtualLorebookEntry } from '../../api/core/utils/forgeVirtualLorebook.js';
import ForgeLorebookPreview from './ForgeLorebookPreview.vue';
import type { StagingEntry } from '../../types/ForgeRuntimeTypes.js';

const forgeStore = useForgeStore();
const cardMakerStore = useCardMakerStore();

const getFrozenPreview = (stagedEntry: StagingEntry) => {
    const existing = findVirtualLorebookEntry(cardMakerStore.virtualLorebookEntries, stagedEntry.targetEntryId);
    return buildFrozenVirtualLorebookContent(stagedEntry, existing?.entry);
};

const approve = async (id: string) => {
    // TODO: 物理提交到后端/世界书
    console.log('[Staging] Approved:', id);
    await cardMakerStore.approveStagingEntry(id);
};

const reject = async (id: string) => {
    console.log('[Staging] Rejected:', id);
    await cardMakerStore.rejectStagingEntry(id);
};

const moveBack = async (id: string) => {
    console.log('[CommitReady] Move back:', id);
    await cardMakerStore.returnCommitReadyEntry(id);
};

const commitAll = async () => {
    if (forgeStore.commitReadyEntries.length === 0 || cardMakerStore.isCommitting) return;
    const confirmed = window.confirm(`确认将 ${forgeStore.commitReadyEntries.length} 个修改冻结到虚拟工作区吗？`);
    if (!confirmed) return;
    luminaWeaveApi.forgeAgent.freezeWorkspaceDraft();
};
</script>

<template>
    <div class="staging-area-root">
        <div class="header">
            <div class="header-copy">
                <span class="title">变更暂存</span>
                <span class="subtitle">
                    {{ forgeStore.stagingArea.length }} 个待审修改 ·
                    {{ forgeStore.commitReadyEntries.length }} 个写回准备
                </span>
            </div>
            <div class="header-actions">
                <button
                    v-if="forgeStore.commitReadyEntries.length > 0"
                    class="header-btn primary"
                    :disabled="cardMakerStore.isCommitting"
                    @click="commitAll"
                >
                    {{ cardMakerStore.isCommitting ? '冻结中…' : '冻结到虚拟工作区' }}
                </button>
                <span class="count">{{ forgeStore.stagingArea.length + forgeStore.commitReadyEntries.length }}</span>
            </div>
        </div>

        <div class="entry-list">
            <div v-if="forgeStore.commitReadyEntries.length > 0" class="section-label">写回准备</div>
            <div v-if="forgeStore.commitReadyEntries.length > 0" class="commit-banner">
                这些修改已经通过本轮审阅，确认后会冻结到 Forge 虚拟工作区，而不是直接写真实世界书。
            </div>
            <div v-for="entry in forgeStore.commitReadyEntries" :key="`commit-${entry.id}`" class="staging-card commit-ready">
                <div class="card-header">
                    <span class="desc">{{ entry.description }}</span>
                    <span class="target">{{ entry.targetEntryId }}</span>
                </div>

                <div class="diff-container preview-enhanced">
                    <div class="diff-header">Frozen Preview</div>
                    <ForgeLorebookPreview :entry="getFrozenPreview(entry)" minimal />
                </div>

                <div class="actions">
                    <button class="action-btn reject" @click="moveBack(entry.id)">回到暂存</button>
                    <button class="action-btn ready" disabled>{{ cardMakerStore.isCommitting ? '冻结中…' : '等待冻结' }}</button>
                </div>
            </div>

            <div v-if="forgeStore.stagingArea.length > 0" class="section-label">待审修改</div>
            <div v-for="entry in forgeStore.stagingArea" :key="entry.id" class="staging-card">
                <div class="card-header">
                    <span class="desc">{{ entry.description }}</span>
                    <span class="target">{{ entry.targetEntryId }}</span>
                </div>
                
                <div class="diff-container preview-enhanced">
                    <div class="diff-header">Proposed Preview</div>
                    <ForgeLorebookPreview :entry="getFrozenPreview(entry)" minimal />
                </div>

                <div class="actions">
                    <button class="action-btn reject" @click="reject(entry.id)">丢弃</button>
                    <button class="action-btn approve" @click="approve(entry.id)">加入工作区准备</button>
                </div>
            </div>

            <div v-if="forgeStore.stagingArea.length === 0 && forgeStore.commitReadyEntries.length === 0" class="empty-state">
                暂无待确认的变更
            </div>
        </div>
    </div>
</template>

<style scoped>
.staging-area-root {
    display: flex;
    flex-direction: column;
    padding: 12px 18px 10px;
    background:
        linear-gradient(180deg, rgba(var(--lw-primary-rgb), 0.05), rgba(var(--lw-primary-rgb), 0.015) 24%, transparent 58%);
    border-top: 1px solid color-mix(in srgb, var(--lw-border-base) 86%, transparent);
    max-height: 300px;
    overflow-y: auto;
}

.header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 10px;
    gap: 12px;
}

.header-copy {
    display: flex;
    flex-direction: column;
    gap: 2px;
}

.title {
    font-size: 12px;
    font-weight: 700;
    color: var(--lw-text-main);
}

.subtitle {
    font-size: 11px;
    color: var(--lw-text-muted);
}

.count {
    background: color-mix(in srgb, var(--lw-bg-elevated) 94%, transparent);
    color: var(--lw-text-main);
    font-size: 11px;
    font-weight: 700;
    padding: 4px 9px;
    border-radius: 999px;
    border: 1px solid var(--lw-border-base);
}

.header-actions {
    display: flex;
    align-items: center;
    gap: 10px;
    flex-wrap: wrap;
    justify-content: flex-end;
}

.header-btn {
    border-radius: 999px;
    padding: 7px 12px;
    font-size: 11px;
    font-weight: 700;
    border: 1px solid var(--lw-border-base);
    cursor: pointer;
}

.header-btn.primary {
    background: #111111;
    color: var(--lw-text-inverse);
    border-color: #111111;
}

.header-btn:disabled {
    opacity: 0.6;
    cursor: progress;
}

.entry-list {
    display: flex;
    flex-direction: column;
    gap: 8px;
}

.section-label {
    font-size: 10px;
    font-weight: 800;
    color: var(--lw-primary);
    text-transform: uppercase;
    letter-spacing: 0.08em;
    margin-top: 4px;
    margin-bottom: -2px;
}

.commit-banner {
    padding: 10px 12px;
    border-radius: 18px;
    background: rgba(var(--lw-primary-rgb), 0.08);
    border: 1px solid rgba(var(--lw-primary-rgb), 0.14);
    color: var(--lw-text-secondary);
    font-size: 11px;
    line-height: 1.5;
}

.staging-card {
    background:
        linear-gradient(180deg, color-mix(in srgb, var(--lw-bg-elevated) 96%, transparent), color-mix(in srgb, var(--lw-bg-subtle) 70%, transparent));
    border: 1px solid var(--lw-border-base);
    border-radius: 22px;
    padding: 13px 13px 12px;
    box-shadow:
        0 10px 24px rgba(15, 23, 42, 0.05),
        inset 0 1px 0 rgba(255, 255, 255, 0.18);
}

.staging-card.commit-ready {
    border-color: rgba(var(--lw-primary-rgb), 0.16);
    background: linear-gradient(180deg, rgba(var(--lw-primary-rgb), 0.07), rgba(var(--lw-primary-rgb), 0.025));
}

.card-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: 12px;
    margin-bottom: 12px;
}

.desc {
    font-size: 12px;
    font-weight: 600;
    color: var(--lw-text-main);
}

.target {
    font-size: 11px;
    color: var(--lw-text-muted);
    background: var(--lw-bg-subtle);
    padding: 3px 8px;
    border-radius: 999px;
}

.diff-container {
    background: color-mix(in srgb, var(--lw-bg-subtle) 82%, white);
    border-radius: 18px;
    padding: 11px;
    margin-bottom: 12px;
    border: 1px solid var(--lw-border-subtle);
}

.diff-container.preview-enhanced {
    padding: 0;
    overflow: hidden;
    background: transparent;
    border: none;
}

.diff-header {
    font-size: 10px;
    font-weight: 700;
    color: var(--lw-text-muted);
    text-transform: uppercase;
    margin-bottom: 8px;
    letter-spacing: 0.08em;
}

.content {
    margin: 0;
    white-space: pre-wrap;
    font-size: 12px;
    font-family: ui-monospace, Consolas, monospace;
    line-height: 1.5;
}

.proposed {
    color: var(--lw-text-main);
}

.actions {
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
}

.action-btn {
    flex: 1 1 120px;
    padding: 9px;
    border-radius: 999px;
    font-size: 11px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s;
}

.approve {
    background: #111111;
    color: var(--lw-text-inverse);
    border: none;
}

.approve:hover {
    background: #000000;
}

.ready {
    background: rgba(var(--lw-primary-rgb), 0.08);
    color: var(--lw-primary);
    border: 1px solid rgba(var(--lw-primary-rgb), 0.12);
}

.reject {
    background: var(--lw-bg-elevated);
    border: 1px solid var(--lw-border-base);
    color: var(--lw-text-secondary);
}

.reject:hover {
    background: rgba(255, 115, 115, 0.08);
    color: #ffb8b8;
    border-color: rgba(255, 115, 115, 0.16);
}

.empty-state {
    text-align: center;
    padding: 28px;
    color: var(--lw-text-muted);
    font-size: 13px;
}
</style>
