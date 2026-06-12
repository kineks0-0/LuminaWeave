import { describe, expect, it } from 'vitest';
import { AgentSkillParser, formatAgentSkillCatalog } from '@/api/core/agent-runtime/skills/AgentSkillParser.js';

describe('AgentSkillParser', () => {
    it('parses standard SKILL.md frontmatter and keeps the markdown body separate', () => {
        const parser = new AgentSkillParser();
        const result = parser.parse({
            path: './agent/skills/project-writer/SKILL.md',
            content: [
                '---',
                'name: project-writer',
                'description: Maintains project files.',
                'license: MIT',
                'compatibility: Requires LuminaWeave Forge.',
                'allowed-tools: readFile writeFile Bash(git:*)',
                'metadata:',
                '  risk: medium',
                '---',
                '# Project Writer',
                '',
                'Use project files carefully.'
            ].join('\n')
        });

        expect(result.diagnostics).toEqual([]);
        expect(result.skill).toMatchObject({
            name: 'project-writer',
            description: 'Maintains project files.',
            path: './agent/skills/project-writer/SKILL.md',
            license: 'MIT',
            compatibility: 'Requires LuminaWeave Forge.',
            allowedTools: ['readFile', 'writeFile', 'Bash(git:*)'],
            metadata: { risk: 'medium' },
            body: '# Project Writer\n\nUse project files carefully.'
        });
    });

    it('returns diagnostics instead of falling back to Forge metadata when required fields are missing', () => {
        const parser = new AgentSkillParser();
        const result = parser.parse({
            path: './agent/skills/broken/SKILL.md',
            content: [
                '---',
                'name: broken',
                'allowed-tools:',
                '  - writeFile',
                '---',
                '# Broken'
            ].join('\n')
        });

        expect(result.skill).toBeNull();
        expect(result.diagnostics).toEqual([
            expect.objectContaining({
                code: 'missing_required_field',
                message: 'SKILL.md frontmatter must include description.'
            })
        ]);
    });

    it('formats a pi-style catalog without granting permissions from allowed-tools', () => {
        const parser = new AgentSkillParser();
        const parsed = parser.parse({
            path: './agent/skills/project-writer/SKILL.md',
            content: [
                '---',
                'name: project-writer',
                'description: Maintains project files.',
                'allowed-tools:',
                '  - writeFile',
                '---',
                '# Body that must not appear in the catalog'
            ].join('\n')
        });

        const catalog = formatAgentSkillCatalog(parsed.skill ? [parsed.skill] : []);

        expect(catalog).toContain('project-writer');
        expect(catalog).toContain('Maintains project files.');
        expect(catalog).toContain('./agent/skills/project-writer/SKILL.md');
        expect(catalog).not.toContain('writeFile');
        expect(catalog).not.toContain('Body that must not appear');
    });

    it('validates Agent Skills name, description, compatibility, and parent directory constraints', () => {
        const parser = new AgentSkillParser();
        const result = parser.parse({
            path: './agent/skills/project-writer/SKILL.md',
            content: [
                '---',
                'name: Project_Writer',
                'description: ',
                `compatibility: ${'x'.repeat(501)}`,
                '---',
                '# Broken'
            ].join('\n')
        });

        expect(result.skill).toBeNull();
        expect(result.diagnostics).toEqual(expect.arrayContaining([
            expect.objectContaining({
                code: 'invalid_required_field',
                field: 'name'
            }),
            expect.objectContaining({
                code: 'invalid_required_field',
                field: 'description'
            }),
            expect.objectContaining({
                code: 'invalid_optional_field',
                field: 'compatibility'
            })
        ]));
    });

    it('reports a name mismatch with the SKILL.md parent directory', () => {
        const parser = new AgentSkillParser();
        const result = parser.parse({
            path: './agent/skills/memory-curator/SKILL.md',
            content: [
                '---',
                'name: project-writer',
                'description: Maintains project files.',
                '---',
                '# Project Writer'
            ].join('\n')
        });

        expect(result.skill).toBeNull();
        expect(result.diagnostics).toEqual([
            expect.objectContaining({
                code: 'invalid_required_field',
                field: 'name',
                message: 'SKILL.md frontmatter name must match parent directory.'
            })
        ]);
    });
});
