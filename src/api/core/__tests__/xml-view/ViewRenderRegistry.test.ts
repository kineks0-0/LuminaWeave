import { describe, expect, it } from 'vitest';
import { viewRenderRegistry } from '@/api/core/xml-view/ViewRenderRegistry.js';

describe('ViewRenderRegistry', () => {
    it('应让同一 Choices DSL 在 chat 与 forge 上下文解析到不同组件', () => {
        const chatComponent = viewRenderRegistry.resolve('chat', 'Choices');
        const forgeComponent = viewRenderRegistry.resolve('forge', 'Choices');

        expect(chatComponent).toBeTruthy();
        expect(forgeComponent).toBeTruthy();
        expect(chatComponent).not.toBe(forgeComponent);
    });
});
