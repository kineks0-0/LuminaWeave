import { tokenize } from '../../../../../shared/TagTokenizer.js';

export type ForgeEntryAction = 'upsert' | 'delete';

export interface ParsedEntryUpdate {
    targetEntryId: string | null;
    description: string;
    content: string;
    category?: string;
    layer?: string | null;
    action: ForgeEntryAction;
}

/**
 * 解析 <entry_update> 标签内容
 * 同时兼容 legacy XML 属性风格与现代 JSON 结构化风格
 */
export function parseEntryUpdates(xmlRaw: string, fallbackLayer: string | null = null): ParsedEntryUpdate[] {
    const tokens = tokenize(xmlRaw);
    const openTag = tokens.find(t => t.type === 'open_tag' && t.value.toLowerCase() === 'entry_update');
    
    if (!openTag) return [];

    const attrs = openTag.attrs;
    const innerContent = xmlRaw
        .slice(openTag.end)
        .replace(/<\/entry_update>$/i, '')
        .trim();

    // 1. 尝试寻找 JSON 块
    const jsonMatches = tryExtractJson(innerContent);
    if (jsonMatches && jsonMatches.length > 0) {
        return jsonMatches.map(item => {
            const pathInfo = item.path || {};
            const nodeId = item.node || pathInfo.node;
            const entryId = nodeId || attrs.id || attrs.entry_id || attrs.target || attrs.uid || `forge_entry_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
            const action = (item.action || attrs.action || '').toLowerCase() === 'delete' ? 'delete' : 'upsert';
            
            // 处理内容序列化
            let processedContent = '';
            if (item.content !== undefined) {
                if (typeof item.content === 'object' && item.content !== null) {
                    processedContent = JSON.stringify(item.content, null, 2);
                } else {
                    processedContent = String(item.content);
                }
            } else {
                processedContent = innerContent;
            }

            return {
                targetEntryId: entryId,
                description: item.title || item['标题'] || item.name || item.comment || attrs.description || attrs.title || '',
                content: stripMarkdownBlocks(processedContent),
                category: pathInfo.layer || attrs.type || attrs.category || attrs.class,
                layer: pathInfo.layer || attrs.layer || fallbackLayer,
                action
            };
        });
    }

    // 2. Legacy Fallback (XML 属性式)
    const entryId = attrs.id || attrs.entry_id || attrs.target || attrs.uid || `forge_entry_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
    const action = (attrs.action || '').toLowerCase() === 'delete' ? 'delete' : 'upsert';

    return [{
        targetEntryId: entryId,
        description: attrs.description || attrs.title || '',
        content: stripMarkdownBlocks(innerContent),
        category: attrs.type || attrs.category || attrs.class,
        layer: attrs.layer || fallbackLayer,
        action
    }];
}

function tryExtractJson(text: string): any[] | null {
    // 1. 优先匹配 ```json 代码块
    const jsonBlockMatch = text.match(/```json\s*([\s\S]*?)\s*```/i);
    if (jsonBlockMatch) {
        try {
            const data = JSON.parse(jsonBlockMatch[1].trim());
            return Array.isArray(data) ? data : [data];
        } catch { /* ignore */ }
    }

    // 2. 尝试 YAML 代码块 → 转换为结构化对象（仅提取 title/content/tags 等顶层字段）
    const yamlBlockMatch = text.match(/```yaml\s*([\s\S]*?)\s*```/i);
    if (yamlBlockMatch) {
        const parsed = parseSimpleYaml(yamlBlockMatch[1]);
        if (parsed) return [parsed];
    }

    // 3. 尝试 TOML 代码块
    const tomlBlockMatch = text.match(/```toml\s*([\s\S]*?)\s*```/i);
    if (tomlBlockMatch) {
        const parsed = parseSimpleToml(tomlBlockMatch[1]);
        if (parsed) return [parsed];
    }

    // 4. 裸 JSON（无代码块）
    const candidate = text.trim();
    if (candidate.startsWith('[') || candidate.startsWith('{')) {
        try {
            const data = JSON.parse(candidate);
            return Array.isArray(data) ? data : [data];
        } catch { /* ignore */ }
    }

    return null;
}

/**
 * 极简 YAML 解析器：仅处理顶层 key: value 对（字符串/数字/简单数组）
 */
function parseSimpleYaml(yaml: string): Record<string, any> | null {
    const result: Record<string, any> = {};
    let hasFields = false;
    const lines = yaml.split('\n');
    let i = 0;
    while (i < lines.length) {
        const line = lines[i];
        const m = line.match(/^([a-zA-Z_\u4e00-\u9fff][a-zA-Z0-9_\u4e00-\u9fff]*)\s*:\s*(.*)/);
        if (m) {
            const key = m[1];
            const val = m[2].trim();
            if (val === '' || val === '|' || val === '>') {
                // 多行字符串块：收集缩进内容
                const block: string[] = [];
                i++;
                while (i < lines.length && (lines[i].startsWith('  ') || lines[i].trim() === '')) {
                    block.push(lines[i].replace(/^  /, ''));
                    i++;
                }
                result[key] = block.join('\n').trim();
                hasFields = true;
                continue;
            } else if (val.startsWith('[')) {
                // 内联数组
                try { result[key] = JSON.parse(val.replace(/'/g, '"')); hasFields = true; } catch { result[key] = val; hasFields = true; }
            } else if (val.startsWith('"') || val.startsWith("'")) {
                result[key] = val.replace(/^["']|["']$/g, '');
                hasFields = true;
            } else {
                result[key] = val;
                hasFields = true;
            }
        } else if (line.match(/^\s*-\s+/)) {
            // 跳过纯列表行（未关联 key）
        }
        i++;
    }
    return hasFields ? result : null;
}

/**
 * 极简 TOML 解析器：仅处理顶层 key = value 对（字符串/数字）
 */
function parseSimpleToml(toml: string): Record<string, any> | null {
    const result: Record<string, any> = {};
    let hasFields = false;
    for (const line of toml.split('\n')) {
        const m = line.match(/^([a-zA-Z_\u4e00-\u9fff][a-zA-Z0-9_\u4e00-\u9fff]*)\s*=\s*(.*)/);
        if (!m) continue;
        const key = m[1];
        const val = m[2].trim();
        if (val.startsWith('"') || val.startsWith("'")) {
            result[key] = val.replace(/^["']|["']$/g, '');
        } else if (val.startsWith('[')) {
            try { result[key] = JSON.parse(val.replace(/'/g, '"')); } catch { result[key] = val; }
        } else {
            result[key] = val;
        }
        hasFields = true;
    }
    return hasFields ? result : null;
}

function stripMarkdownBlocks(text: string): string {
    return text
        .replace(/```(?:json|yaml|toml|text|markdown)?\n?([\s\S]*?)\n?```/gi, '$1')
        .trim();
}
