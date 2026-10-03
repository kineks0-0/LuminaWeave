import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = fileURLToPath(new URL('../../../../..', import.meta.url));
const sdkDir = join(repoRoot, 'src/api/core/agent-runtime');

const collectSourceFiles = (dir: string): string[] =>
    readdirSync(dir).flatMap((name) => {
        const path = join(dir, name);
        return statSync(path).isDirectory() ? collectSourceFiles(path) : [path];
    }).filter(path => /\.(ts|tsx)$/.test(path));

// SDK 必须保持浏览器安全且与 UI 解耦：pi 1.0 之后不得引入 Node-only 入口，也不得依赖 Vue / Pinia。
const FORBIDDEN_IMPORTS = [
    "from 'node:",
    'from "node:',
    '@earendil-works/pi-agent-core/node',
    '@earendil-works/pi-coding-agent',
    "from 'vue'",
    "from 'pinia'"
];

const NODE_IMPORT_PATTERN =
    /from\s+['"](node:[^'"]+|fs|path|child_process|os|crypto)['"]|import\(\s*['"]node:|\brequire\(/;

describe('Agent Runtime SDK browser guard', () => {
    it('keeps SDK sources free of Node-only, Vue and Pinia imports', () => {
        const files = collectSourceFiles(sdkDir);
        expect(files.length).toBeGreaterThan(0);
        for (const file of files) {
            const source = readFileSync(file, 'utf8');
            for (const pattern of FORBIDDEN_IMPORTS) {
                expect(source, `${relative(repoRoot, file)} must not contain ${pattern}`).not.toContain(pattern);
            }
            expect(source, `${relative(repoRoot, file)} must not import Node built-ins`).not.toMatch(NODE_IMPORT_PATTERN);
        }
    });
});
