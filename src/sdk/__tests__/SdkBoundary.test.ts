import { describe, expect, it } from 'vitest';
import ts from 'typescript';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const extensionRoot = fileURLToPath(new URL('../../..', import.meta.url));
const srcDir = join(extensionRoot, 'src');
const sdkDir = join(srcDir, 'sdk');
const examplesDir = join(srcDir, 'examples');
const ALIASES: Record<string, string> = { '@/': `${srcDir}/`, '@shared/': join(extensionRoot, 'shared/') };

const collectSourceFiles = (dir: string): string[] =>
    readdirSync(dir).flatMap((name) => {
        const path = join(dir, name);
        if (statSync(path).isDirectory()) return name === '__tests__' ? [] : collectSourceFiles(path);
        return /\.(ts|tsx|vue)$/.test(path) ? [path] : [];
    });

const EXAMPLE_ALLOWED_PACKAGES = new Set(['vue', 'zod', 'lucide-vue-next']);
const sdkEntry = join(sdkDir, 'index.js');

const scriptOf = (file: string, text: string): string =>
    file.endsWith('.vue')
        ? [...text.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/g)].map(match => match[1]).join('\n')
        : text;

// preProcessFile 忽略注释，覆盖 from / 裸导入 / 动态 import / import = require / 模块增强。
const importSpecifiers = (file: string): string[] =>
    ts.preProcessFile(scriptOf(file, readFileSync(file, 'utf8')), true, true).importedFiles.map(entry => entry.fileName);

// 示例代表第三方代码：只允许白名单包、示例目录内的相对路径，以及公开 SDK 入口。
const isAllowedExampleSpecifier = (file: string, specifier: string): boolean => {
    if (!specifier.startsWith('.')) return EXAMPLE_ALLOWED_PACKAGES.has(specifier);
    const target = resolve(dirname(file), specifier);
    return target.startsWith(`${examplesDir}${sep}`) || target === sdkEntry;
};

const resolveLocal = (from: string, specifier: string): string | null => {
    const alias = Object.keys(ALIASES).find(prefix => specifier.startsWith(prefix));
    const base = alias
        ? join(ALIASES[alias], specifier.slice(alias.length))
        : specifier.startsWith('.') ? resolve(dirname(from), specifier) : null;
    if (!base) return null;
    const stem = base.replace(/\.js$/, '');
    const hit = [base, `${stem}.ts`, `${stem}.tsx`, join(stem, 'index.ts')]
        .find(path => existsSync(path) && statSync(path).isFile());
    if (!hit) throw new Error(`Cannot resolve "${specifier}" from ${relative(extensionRoot, from)}`);
    return hit;
};

// 只有整句 `import type` / `export type` 视为擦除；裸导入、动态 import、内联 type 一律按值处理（保守）。
const runtimeSpecifiers = (file: string): string[] => {
    const source = ts.createSourceFile(file, readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true);
    const out: string[] = [];
    const visit = (node: ts.Node): void => {
        if (ts.isImportDeclaration(node) && ts.isStringLiteral(node.moduleSpecifier)) {
            if (!node.importClause?.isTypeOnly) out.push(node.moduleSpecifier.text);
        } else if (ts.isExportDeclaration(node) && node.moduleSpecifier && ts.isStringLiteral(node.moduleSpecifier)) {
            if (!node.isTypeOnly) out.push(node.moduleSpecifier.text);
        } else if (ts.isCallExpression(node) && node.expression.kind === ts.SyntaxKind.ImportKeyword) {
            const [arg] = node.arguments;
            if (arg && ts.isStringLiteralLike(arg)) out.push(arg.text);
        }
        ts.forEachChild(node, visit);
    };
    visit(source);
    return out;
};

describe('public SDK boundary', () => {
    it('keeps examples on the public SDK entry', () => {
        const files = collectSourceFiles(examplesDir);
        expect(files.length).toBeGreaterThan(0);
        for (const file of files) {
            for (const specifier of importSpecifiers(file)) {
                expect(
                    isAllowedExampleSpecifier(file, specifier),
                    `${relative(extensionRoot, file)} must import "${specifier}" through src/sdk`
                ).toBe(true);
            }
        }
    });

    // 公开 SDK 的运行时模块图必须精确等于快照：新增运行时依赖需要有意识地更新此处并确认无副作用。
    it('keeps the SDK runtime module graph side-effect free', () => {
        const modules = new Set<string>();
        const packages = new Set<string>();
        const walk = (file: string): void => {
            if (modules.has(file)) return;
            modules.add(file);
            for (const specifier of runtimeSpecifiers(file)) {
                const target = resolveLocal(file, specifier);
                if (target) walk(target); else packages.add(specifier);
            }
        };
        walk(join(sdkDir, 'index.ts'));
        expect([...modules].map(file => relative(srcDir, file).split(sep).join('/')).sort()).toEqual([
            'platform/surface/useSurfaceRuntimeContext.ts',
            'sdk/index.ts'
        ]);
        expect([...packages].sort()).toEqual(['vue']);
    });

    it('exposes only side-effect-free runtime values', async () => {
        const sdk = await import('../index.js');
        expect(sdk.SDK_VERSION).toMatch(/^\d+\.\d+\.\d+$/);
        expect(Object.keys(sdk).sort()).toEqual(['SDK_VERSION', 'useSurfaceInput', 'useSurfaceRuntimeContext']);
    });
});
