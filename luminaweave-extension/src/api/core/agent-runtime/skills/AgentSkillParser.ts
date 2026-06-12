export interface AgentSkillSource {
    path: string;
    content: string;
}

export interface AgentSkillDefinition {
    name: string;
    description: string;
    path: string;
    body: string;
    license?: string;
    compatibility?: string;
    allowedTools?: string[];
    metadata?: Record<string, string>;
}

export interface AgentSkillCatalogItem {
    name: string;
    description: string;
    path: string;
    title?: string;
}

export interface AgentSkillDiagnostic {
    code:
        | 'missing_frontmatter'
        | 'missing_required_field'
        | 'invalid_required_field'
        | 'invalid_optional_field'
        | 'invalid_frontmatter';
    field?: string;
    message: string;
    path: string;
}

export interface AgentSkillParseResult {
    skill: AgentSkillDefinition | null;
    diagnostics: AgentSkillDiagnostic[];
}

type ParsedFrontmatterValue = string | string[] | Record<string, string | string[]>;

export class AgentSkillParser {
    parse(source: AgentSkillSource): AgentSkillParseResult {
        const parsed = this.readFrontmatter(source);
        if (!parsed.ok) {
            return {
                skill: null,
                diagnostics: [parsed.diagnostic]
            };
        }

        const diagnostics: AgentSkillDiagnostic[] = [];
        const name = this.asString(parsed.frontmatter.name);
        const description = this.asString(parsed.frontmatter.description);
        if (!Object.prototype.hasOwnProperty.call(parsed.frontmatter, 'name')) {
            diagnostics.push({
                code: 'missing_required_field',
                field: 'name',
                message: 'SKILL.md frontmatter must include name.',
                path: source.path
            });
        } else if (!name || !this.isValidSkillName(name)) {
            diagnostics.push({
                code: 'invalid_required_field',
                field: 'name',
                message: 'SKILL.md frontmatter name must use lowercase letters, numbers, and hyphens.',
                path: source.path
            });
        }
        const parentDirectory = this.resolveParentDirectoryName(source.path);
        if (name && parentDirectory && name !== parentDirectory) {
            diagnostics.push({
                code: 'invalid_required_field',
                field: 'name',
                message: 'SKILL.md frontmatter name must match parent directory.',
                path: source.path
            });
        }
        if (!Object.prototype.hasOwnProperty.call(parsed.frontmatter, 'description')) {
            diagnostics.push({
                code: 'missing_required_field',
                field: 'description',
                message: 'SKILL.md frontmatter must include description.',
                path: source.path
            });
        } else if (!description || description.length > 1024) {
            diagnostics.push({
                code: 'invalid_required_field',
                field: 'description',
                message: 'SKILL.md frontmatter description must be between 1 and 1024 characters.',
                path: source.path
            });
        }
        const compatibility = this.asString(parsed.frontmatter.compatibility);
        if (
            Object.prototype.hasOwnProperty.call(parsed.frontmatter, 'compatibility')
            && (!compatibility || compatibility.length > 500)
        ) {
            diagnostics.push({
                code: 'invalid_optional_field',
                field: 'compatibility',
                message: 'SKILL.md frontmatter compatibility must be between 1 and 500 characters when provided.',
                path: source.path
            });
        }
        if (diagnostics.length > 0 || !name || !description) {
            return { skill: null, diagnostics };
        }

        const metadata = this.asMetadataRecord(parsed.frontmatter.metadata);
        return {
            diagnostics: [],
            skill: {
                name,
                description,
                path: source.path,
                body: parsed.body,
                license: this.asString(parsed.frontmatter.license),
                compatibility,
                allowedTools: this.asAllowedTools(parsed.frontmatter['allowed-tools']),
                metadata: Object.keys(metadata).length > 0 ? metadata : undefined
            }
        };
    }

    private readFrontmatter(source: AgentSkillSource): {
        ok: true;
        frontmatter: Record<string, ParsedFrontmatterValue>;
        body: string;
    } | {
        ok: false;
        diagnostic: AgentSkillDiagnostic;
    } {
        const lines = source.content.split(/\r?\n/);
        if (lines[0]?.trim() !== '---') {
            return {
                ok: false,
                diagnostic: {
                    code: 'missing_frontmatter',
                    message: 'SKILL.md must start with YAML frontmatter.',
                    path: source.path
                }
            };
        }
        const endIndex = lines.findIndex((line, index) => index > 0 && line.trim() === '---');
        if (endIndex < 0) {
            return {
                ok: false,
                diagnostic: {
                    code: 'invalid_frontmatter',
                    message: 'SKILL.md frontmatter is missing the closing --- marker.',
                    path: source.path
                }
            };
        }
        return {
            ok: true,
            frontmatter: this.parseYamlSubset(lines.slice(1, endIndex)),
            body: lines.slice(endIndex + 1).join('\n').trim()
        };
    }

    private parseYamlSubset(lines: string[]): Record<string, ParsedFrontmatterValue> {
        const result: Record<string, ParsedFrontmatterValue> = {};
        let activeKey: string | null = null;
        for (const line of lines) {
            if (!line.trim()) continue;
            const listMatch = /^\s+-\s*(.*)$/.exec(line);
            if (listMatch && activeKey) {
                const current = result[activeKey];
                result[activeKey] = Array.isArray(current)
                    ? [...current, this.unquote(listMatch[1].trim())]
                    : [this.unquote(listMatch[1].trim())];
                continue;
            }
            const nestedMatch = /^\s+([A-Za-z0-9_-]+):\s*(.*)$/.exec(line);
            if (nestedMatch && activeKey) {
                const current = this.asRecord(result[activeKey]);
                result[activeKey] = {
                    ...current,
                    [nestedMatch[1]]: this.unquote(nestedMatch[2].trim())
                };
                continue;
            }
            const fieldMatch = /^([A-Za-z0-9_-]+):\s*(.*)$/.exec(line);
            if (!fieldMatch) continue;
            activeKey = fieldMatch[1];
            result[activeKey] = fieldMatch[2].trim()
                ? this.parseScalarOrInlineList(fieldMatch[2].trim())
                : [];
        }
        return result;
    }

    private parseScalarOrInlineList(value: string): string | string[] {
        if (value.startsWith('[') && value.endsWith(']')) {
            return value
                .slice(1, -1)
                .split(',')
                .map(item => this.unquote(item.trim()))
                .filter(Boolean);
        }
        return this.unquote(value);
    }

    private unquote(value: string): string {
        if (
            (value.startsWith('"') && value.endsWith('"'))
            || (value.startsWith("'") && value.endsWith("'"))
        ) {
            return value.slice(1, -1);
        }
        return value;
    }

    private asString(value: ParsedFrontmatterValue | undefined): string | undefined {
        return typeof value === 'string' && value.trim() ? value.trim() : undefined;
    }

    private asStringArray(value: ParsedFrontmatterValue | undefined): string[] | undefined {
        if (Array.isArray(value)) return value.filter(item => item.trim());
        if (typeof value === 'string' && value.trim()) return [value.trim()];
        return undefined;
    }

    private asRecord(value: ParsedFrontmatterValue | undefined): Record<string, string | string[]> {
        if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
        return value;
    }

    private asMetadataRecord(value: ParsedFrontmatterValue | undefined): Record<string, string> {
        const record = this.asRecord(value);
        return Object.fromEntries(
            Object.entries(record).filter((entry): entry is [string, string] => typeof entry[1] === 'string')
        );
    }

    private asAllowedTools(value: ParsedFrontmatterValue | undefined): string[] | undefined {
        if (typeof value === 'string' && value.trim()) {
            return value.trim().split(/\s+/).filter(Boolean);
        }
        return this.asStringArray(value);
    }

    private isValidSkillName(name: string): boolean {
        return name.length >= 1
            && name.length <= 64
            && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(name);
    }

    private resolveParentDirectoryName(path: string): string | null {
        const parts = path.replace(/\\/g, '/').split('/').filter(Boolean);
        const fileName = parts.at(-1);
        if (fileName !== 'SKILL.md') return null;
        return parts.at(-2) ?? null;
    }
}

export const formatAgentSkillCatalog = (skills: AgentSkillDefinition[]): string => {
    if (skills.length === 0) return '';
    return [
        '# Agent Skills',
        '',
        '可用技能只以摘要形式列出。需要使用技能时，先通过 readFile 读取对应 SKILL.md。',
        '',
        ...skills.map(skill => `- ${skill.name}: ${skill.description} (path: ${skill.path})`)
    ].join('\n');
};

export const formatAgentSkillCatalogLine = (skill: AgentSkillCatalogItem): string =>
    `${skill.title || skill.description || skill.name} (skillName: ${skill.name}, path: ${skill.path})`;
