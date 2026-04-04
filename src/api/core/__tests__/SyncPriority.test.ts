import { describe, it, expect } from 'vitest';
import { STProtocol } from '../st-adapter/STProtocol';

describe('SyncPriority - STProtocol 数据提取优先级', () => {
    it('应该优先从 pluginRaw 的 <Chat_Reply> 标签中提取内容作为 mesRaw', () => {
        const mockSTMessage: any = {
            role: 'assistant',
            message: 'ST 界面手动修改后的文本',
            extra: {
                mesRaw: '旧的提取文本',
                pluginRaw: '<Thoughts>思考中...</Thoughts><Chat_Reply>AI 原始生成的回答</Chat_Reply>'
            }
        };

        const result = STProtocol.fromST(mockSTMessage);
        
        // 验证优先级：pluginRaw(extracted) 胜出
        expect(result.mesRaw).toBe('AI 原始生成的回答');
        expect(result.pluginRaw).toBe(mockSTMessage.extra.pluginRaw);
        // mesContent 应该保持 ST 的原始消息以供显示比对
        expect(result.mes).toBe('ST 界面手动修改后的文本');
    });

    it('如果 pluginRaw 存在但没有标签，应回退至全量 pluginRaw', () => {
        const mockSTMessage: any = {
            role: 'assistant',
            message: 'ST 文本',
            extra: {
                mesRaw: '旧文本',
                pluginRaw: '无标签的原始输出'
            }
        };

        const result = STProtocol.fromST(mockSTMessage);
        
        // 验证降级：pluginRaw(full) 胜出
        expect(result.mesRaw).toBe('无标签的原始输出');
    });

    it('如果 pluginRaw 不存在，应回退至 mesRaw', () => {
        const mockSTMessage: any = {
            role: 'assistant',
            message: 'ST 文本',
            extra: {
                mesRaw: '手动编辑过的 Raw'
            }
        };

        const result = STProtocol.fromST(mockSTMessage);
        expect(result.mesRaw).toBe('手动编辑过的 Raw');
    });

    it('对于用户消息，不应从 pluginRaw 提取 (用户消息通常不含该标签)', () => {
        const mockSTMessage: any = {
            role: 'user',
            message: '你好',
            extra: {
                mesRaw: '你好',
                pluginRaw: '某些意外的 pluginRaw'
            }
        };

        const result = STProtocol.fromST(mockSTMessage);
        expect(result.mesRaw).toBe('你好');
    });
});
