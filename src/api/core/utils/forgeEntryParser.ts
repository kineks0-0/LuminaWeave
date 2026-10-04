import { tokenize } from '@shared/TagTokenizer.js';
import { createPrefixedId } from '@shared/CommonUtils.js';
import { parse as parseYaml } from 'yaml';

export type ForgeEntryAction = 'upsert' | 'delete';

/**
 * 从条目内容中提取可读标题。
 * 优先取 JSON 对象的 title / 标题 / name 字段，其次 YAML / TOML 的 title 行，最后截取首行文本。
 */
export function extractEntryTitle(content: string): string {
    const trimmed = content.trim();

    // JSON（含 ```json 代码块）
    const jsonCandidate = trimmed.replace(/^```json\s*/i, '').replace(/\s*```$/, '');
    if (jsonCandidate.startsWith('{') || jsonCandidate.startsWith('[')) {
        try {
            const obj = JSON.parse(jsonCandidate);
            const src = Array.isArray(obj) ? obj[0] : obj;
            if (src && typeof src === 'object') {
                const t = src.title || src['标题'] || src.name || src.comment || src.description;
                if (t && typeof t === 'string') return t.trim();
            }
        } catch { /* ignore */ }
    }

    // YAML: `title: value`
    const yamlMatch = trimmed.match(/^title\s*:\s*["']?(.+?)["']?\s*$/im);
    if (yamlMatch) return yamlMatch[1].trim();

    // TOML: `title = "value"`
    const tomlMatch = trimmed.match(/^title\s*=\s*["'](.+?)["']\s*$/im);
    if (tomlMatch) return tomlMatch[1].trim();

    // 首行非空文本（最多 40 字）
    const firstLine = trimmed.split('\n').find(l => l.trim().length > 0) || '';
    return firstLine.slice(0, 40).trim();
}

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
            const entryId = nodeId || attrs.id || attrs.entry_id || attrs.target || attrs.uid || createPrefixedId('forge_entry');
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
    const entryId = attrs.id || attrs.entry_id || attrs.target || attrs.uid || createPrefixedId('forge_entry');
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

    // 2. 尝试 YAML 代码块 → 转换为结构化对象
    const yamlBlockMatch = text.match(/```yaml\s*([\s\S]*?)\s*```/i);
    if (yamlBlockMatch) {
        const parsed = parseYaml(yamlBlockMatch[1]);
        if (parsed && typeof parsed === 'object' && !Array.isArray(parsed) && Object.keys(parsed).length > 0) {
            return [parsed];
        }
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
 * 极简 TOML 解析器：仅处理顶层 key = value 对（字符串/数字）。
 * 注意：LLM 输出的 TOML 常包含未加引号的值，严格 TOML 库会直接拒绝，故保留宽容实现。
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
