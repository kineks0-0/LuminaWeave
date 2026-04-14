<script setup lang="ts">
import { ref } from 'vue';

interface Snippet {
    id: string;
    content: string;
    source: string;
    score: number;
}

const props = defineProps<{
    snippets: Snippet[];
}>();

const emit = defineEmits(['select', 'close']);

const selectedIds = ref<Set<string>>(new Set());

const toggleSelect = (id: string) => {
    if (selectedIds.value.has(id)) {
        selectedIds.value.delete(id);
    } else {
        selectedIds.value.add(id);
    }
};

const confirm = () => {
    emit('select', Array.from(selectedIds.value));
};
</script>

<template>
    <div class="snippet-selector-overlay">
        <div class="modal">
            <div class="header">
                <div class="title-group">
                    <h3>素材片段萃取 (Snippet Extraction)</h3>
                    <p class="subtitle">请选择能代表角色设定或世界观的片段作为制卡种子</p>
                </div>
                <button class="close-btn" @click="emit('close')">&times;</button>
            </div>

            <div class="grid">
                <div 
                    v-for="s in snippets" 
                    :key="s.id" 
                    class="snippet-card" 
                    :class="{ selected: selectedIds.has(s.id) }"
                    @click="toggleSelect(s.id)"
                >
                    <div class="selection-indicator">
                        <div class="dot"></div>
                    </div>
                    <div class="card-content">
                        <div class="snippet-meta">
                            <span class="score">匹配度: {{ s.score }}</span>
                            <span class="source">{{ s.source }}</span>
                        </div>
                        <p class="text">{{ s.content }}</p>
                    </div>
                </div>
            </div>

            <div class="footer">
                <div class="selection-info">已选择 {{ selectedIds.size }} 个片段</div>
                <div class="actions">
                    <button class="btn secondary" @click="emit('close')">取消</button>
                    <button class="btn primary" :disabled="selectedIds.size === 0" @click="confirm">开始制卡</button>
                </div>
            </div>
        </div>
    </div>
</template>

<style scoped>
.snippet-selector-overlay {
    position: fixed;
    top: 0;
    left: 0;
    width: 100vw;
    height: 100vh;
    background: rgba(0, 0, 0, 0.4);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 10000;
    backdrop-filter: blur(4px);
}

.modal {
    background: #fff;
    width: 80%;
    max-width: 900px;
    height: 85vh;
    border-radius: 20px;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
    border: 1px solid rgba(255, 255, 255, 0.3);
}

.header {
    padding: 24px 32px;
    border-bottom: 1px solid #f3f4f6;
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
}

.title-group h3 {
    margin: 0;
    font-size: 20px;
    font-weight: 800;
    color: #111827;
}

.subtitle {
    margin: 4px 0 0;
    font-size: 14px;
    color: #6b7280;
}

.close-btn {
    background: #f3f4f6;
    border: none;
    font-size: 24px;
    width: 32px;
    height: 32px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 50%;
    cursor: pointer;
    color: #9ca3af;
}

.grid {
    flex: 1;
    overflow-y: auto;
    padding: 24px 32px;
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
    gap: 16px;
    background: #fdfdfd;
}

.snippet-card {
    border: 2px solid #f3f4f6;
    border-radius: 12px;
    padding: 16px;
    cursor: pointer;
    transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
    background: #fff;
    position: relative;
    display: flex;
    flex-direction: column;
}

.snippet-card:hover {
    border-color: #e5e7eb;
    transform: translateY(-2px);
    box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.05);
}

.snippet-card.selected {
    border-color: #6366f1;
    background: #f5f3ff;
}

.selection-indicator {
    position: absolute;
    top: 12px;
    right: 12px;
    width: 20px;
    height: 20px;
    border: 2px solid #d1d5db;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
}

.selected .selection-indicator {
    background: #6366f1;
    border-color: #6366f1;
}

.selected .selection-indicator .dot {
    width: 6px;
    height: 6px;
    background: #fff;
    border-radius: 50%;
}

.snippet-meta {
    display: flex;
    justify-content: space-between;
    margin-bottom: 12px;
    font-size: 10px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.05em;
}

.score {
    color: #6366f1;
}

.source {
    color: #9ca3af;
    max-width: 120px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}

.text {
    font-size: 13px;
    line-height: 1.6;
    color: #374151;
    margin: 0;
    display: -webkit-box;
    -webkit-line-clamp: 6;
    line-clamp: 6;
    -webkit-box-orient: vertical;
    overflow: hidden;
}

.footer {
    padding: 20px 32px;
    border-top: 1px solid #f3f4f6;
    display: flex;
    justify-content: space-between;
    align-items: center;
    background: #fff;
}

.selection-info {
    font-size: 14px;
    font-weight: 600;
    color: #4b5563;
}

.actions {
    display: flex;
    gap: 12px;
}

.btn {
    padding: 10px 24px;
    border-radius: 10px;
    font-size: 14px;
    font-weight: 700;
    cursor: pointer;
    transition: all 0.2s;
}

.primary {
    background: #6366f1;
    color: #fff;
    border: none;
}

.primary:not(:disabled):hover {
    background: #4f46e5;
    box-shadow: 0 4px 6px -1px rgba(99, 102, 241, 0.4);
}

.primary:disabled {
    background: #e5e7eb;
    cursor: not-allowed;
}

.secondary {
    background: #fff;
    border: 1px solid #d1d5db;
    color: #4b5563;
}

.secondary:hover {
    background: #f9fafb;
}

/* Custom Scrollbar */
.grid::-webkit-scrollbar {
    width: 6px;
}
.grid::-webkit-scrollbar-thumb {
    background: #e5e7eb;
    border-radius: 3px;
}
</style>
