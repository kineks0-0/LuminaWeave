import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'vite';

const repoRoot = fileURLToPath(new URL('../../../../..', import.meta.url));
const forgeAgentAppDir = join(repoRoot, 'src/api/core/forge/agent-app');
const forgePluginDir = join(repoRoot, 'src/plugins/forge');

const collectSourceFiles = (dir: string): string[] =>
    readdirSync(dir).flatMap((name) => {
        const path = join(dir, name);
        return statSync(path).isDirectory() ? collectSourceFiles(path) : [path];
    }).filter(path => /\.(ts|tsx)$/.test(path));

describe('Forge pi-core browser dependency guard', () => {
    it('depends on pi-agent-core root and rejects Node-only pi imports', () => {
        const packageJson = JSON.parse(readFileSync(join(repoRoot, 'package.json'), 'utf8'));
        expect(packageJson.dependencies).toHaveProperty('@earendil-works/pi-agent-core');
        expect(packageJson.dependencies).not.toHaveProperty('@earendil-works/pi-coding-agent');

        const combinedSource = collectSourceFiles(forgeAgentAppDir)
            .map(path => readFileSync(path, 'utf8'))
            .join('\n');

        expect(combinedSource).toContain('@earendil-works/pi-agent-core');
        expect(combinedSource).not.toContain('@earendil-works/pi-agent-core/node');
        expect(combinedSource).not.toContain('@earendil-works/pi-coding-agent');
        expect(combinedSource).not.toContain('node:fs');
        expect(combinedSource).not.toContain('node:child_process');
    });

    it('keeps the Forge plugin UI shell independent from pi and model runtime internals', () => {
        const combinedSource = collectSourceFiles(forgePluginDir)
            .map(path => readFileSync(path, 'utf8'))
            .join('\n');

        expect(combinedSource).not.toContain('@earendil-works/pi-agent-core');
        expect(combinedSource).not.toContain('@earendil-works/pi-ai');
        expect(combinedSource).not.toContain("from 'ai'");
        expect(combinedSource).not.toContain('from "ai"');
        expect(combinedSource).not.toContain('@ai-sdk/');
        expect(combinedSource).not.toContain('/agent-app/session/');
        expect(combinedSource).not.toContain('/agent-app/model/');
        expect(combinedSource).not.toContain('/agent-app/tools/');
        expect(combinedSource).not.toContain('/agent-app/resources/');
    });

    it('keeps the Forge agent app model layer on pi-ai instead of AI SDK', () => {
        const combinedSource = collectSourceFiles(forgeAgentAppDir)
            .map(path => readFileSync(path, 'utf8'))
            .join('\n');

        expect(combinedSource).toContain('@earendil-works/pi-ai');
        expect(combinedSource).not.toContain("from 'ai'");
        expect(combinedSource).not.toContain('from "ai"');
        expect(combinedSource).not.toContain('@ai-sdk/');
        expect(combinedSource).not.toContain('streamText');
        expect(combinedSource).not.toContain('LanguageModel');
        expect(combinedSource).not.toContain('ModelMessage');
        expect(combinedSource).not.toContain('ToolSet');
    });

    it('removes legacy Forge agent runtime entrypoints from the runtime source', () => {
        const forgeCoreDir = join(repoRoot, 'src/api/core/forge');
        const combinedSource = collectSourceFiles(forgeCoreDir)
            .map(path => readFileSync(path, 'utf8'))
            .join('\n');

        expect(combinedSource).not.toContain('ForgeExecutionGateway');
        expect(combinedSource).not.toContain('ForgeAgentLoop');
        expect(combinedSource).not.toContain('ForgeIsolatedSubagent');
        expect(combinedSource).not.toContain('runWithTools');
        expect(combinedSource).not.toContain('lumina-forge.agentToolCalling.enabled');
    });

    it('browser-bundles the pi core root dependency without Node-only modules', async () => {
        const result = await build({
            configFile: false,
            root: repoRoot,
            logLevel: 'silent',
            build: {
                write: false,
                lib: {
                    entry: join(forgeAgentAppDir, 'ForgePiCoreDependency.ts'),
                    formats: ['es'],
                    fileName: 'forge-pi-core-dependency'
                },
                rollupOptions: {
                    external: []
                }
            }
        }) as any;
        const chunks = Array.isArray(result) ? result.flatMap(item => item.output) : result.output;
        const output = chunks
            .filter((chunk: any) => typeof chunk.code === 'string')
            .map((chunk: any) => chunk.code)
            .join('\n');

        expect(output).toContain('pi-agent-core');
        expect(output).not.toMatch(/\bfrom\s+['"]node:fs['"]/);
        expect(output).not.toMatch(/\bimport\s*\(\s*['"]node:fs['"]\s*\)/);
        expect(output).not.toMatch(/\brequire\s*\(\s*['"]node:fs['"]\s*\)/);
        expect(output).not.toMatch(/\bfrom\s+['"]node:child_process['"]/);
        expect(output).not.toMatch(/\bimport\s*\(\s*['"]node:child_process['"]\s*\)/);
        expect(output).not.toMatch(/\brequire\s*\(\s*['"]node:child_process['"]\s*\)/);
        expect(output).not.toContain('pi-agent-core/node');
        expect(output).not.toContain('pi-coding-agent');
    });
});
