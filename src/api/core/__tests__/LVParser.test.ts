import { describe, expect, it } from 'vitest';
import { splitToSegments } from '../LVParser';

describe('LVParser Reproducer', () => {
    it('should parse a complete V block correctly', () => {
        const input = 'Hello\n<V>\nStat("HP", 100, 100)\n</V>\nWorld';
        const segments = splitToSegments(input);
        
        expect(segments.length).toBe(3);
        expect(segments[0].type).toBe('text');
        expect(segments[1].type).toBe('view');
        expect(segments[1].components).toBeDefined();
        expect(segments[1].components![0].component).toBe('Stat');
        expect(segments[2].type).toBe('text');
    });

    it('should parse an unclosed V block at the end (streaming case)', () => {
        const input = 'Hello\n<V>\nStat("HP", 100, 100)';
        const segments = splitToSegments(input);
        
        expect(segments.length).toBe(2);
        expect(segments[0].type).toBe('text');
        expect(segments[1].type).toBe('view');
        expect(segments[1].components![0].component).toBe('Stat');
        expect(segments[1].isStreaming).toBe(true);
    });

    it('should parse multiple components inside one V block', () => {
        const input = '<V>\nStat("HP", 100, 100)\nStat("MP", 50, 50)\n</V>';
        const segments = splitToSegments(input);
        
        expect(segments[0].type).toBe('view');
        expect(segments[0].components!.length).toBe(2);
        expect(segments[0].components![0].component).toBe('Stat');
        expect(segments[0].components![0].props.label).toBe('HP');
        expect(segments[0].components![1].component).toBe('Stat');
        expect(segments[0].components![1].props.label).toBe('MP');
    });

    it('should handle lowercase <v> tags', () => {
        const input = '<v>Stat("HP", 100, 100)</v>';
        const segments = splitToSegments(input);
        expect(segments[0].type).toBe('view');
    });

    it('should be idempotent (not fail on second call due to shared regex state)', () => {
        const input = '<V>Stat("HP", 100, 100)</V>';
        const call1 = splitToSegments(input);
        const call2 = splitToSegments(input);
        
        expect(call1[0].type).toBe('view');
        expect(call2[0].type).toBe('view');
    });

    it('should handle unclosed <v> tag without content', () => {
        const input = 'Hello <v>';
        const segments = splitToSegments(input);
        expect(segments.length).toBe(2);
        expect(segments[0].raw).toContain('Hello');
        expect(segments[1].type).toBe('view');
        expect(segments[1].isStreaming).toBe(true);
    });

    it('should handle multi-line Choices component (Fallback Path)', () => {
        const input = `<V>
C([
"终结：彻底吸干最后的本命精元，令其力竭而亡。",
"暂停：抽身离开，留他一命——但这具身体还能活多久，难说。"
])
</V>`;
        const segments = splitToSegments(input);
        expect(segments.length).toBe(1);
        expect(segments[0].type).toBe('view');
        expect(segments[0].components!.length).toBe(1);
        expect(segments[0].components![0].component).toBe('Choices');
        const options = (segments[0].components![0].props as any).options;
        expect(options.length).toBe(2);
        expect(options[0]).toContain('终结');
    });

    it('should handle functional DSL with trailing semicolon', () => {
        const input = '<V>\nP("意志崩溃度", 98);\n</V>';
        const segments = splitToSegments(input);
        expect(segments[0].components![0].component).toBe('Progress');
        expect(segments[0].components![0].props.label).toBe('意志崩溃度');
        expect(segments[0].components![0].props.value).toBe(98);
    });

    it('should handle functional DSL with trailing semicolon and spaces', () => {
        const input = '<V> Stat("HP", 50, 100) ; </V>';
        const segments = splitToSegments(input);
        expect(segments[0].components![0].component).toBe('Stat');
        expect(segments[0].components![0].props.value).toBe(50);
    });

    it('should parse multi-character forge pipe syntax', () => {
        const input = '<V>\nFI|role_core_profile|name|角色姓名|例如：林雾\n</V>';
        const segments = splitToSegments(input);
        expect(segments[0].components![0].component).toBe('ForgeInput');
        expect(segments[0].components![0].props.formId).toBe('role_core_profile');
        expect(segments[0].components![0].props.fieldKey).toBe('name');
        expect(segments[0].components![0].props.label).toBe('角色姓名');
    });

    it('should parse forge select pipe syntax with array options', () => {
        const input = '<V>\nFS|role_core_profile|faction|阵营 / 立场|["教会","帝国","中立"]\n</V>';
        const segments = splitToSegments(input);
        expect(segments[0].components![0].component).toBe('ForgeSelect');
        expect(segments[0].components![0].props.options).toEqual(['教会', '帝国', '中立']);
    });
});
