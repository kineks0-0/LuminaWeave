import { readFileSync, readdirSync, type Dirent } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const srcRoot = fileURLToPath(new URL('../../..', import.meta.url));
const MODE_PACKAGES = join('desktop-modes', 'builtins');
const MODE_VARIANT_SELECTOR = /data-(?:skin|surface)-variant=['"](?:telegram|discord)['"]/;
const PRIVATE_TYPOGRAPHY_TOKEN = /--lw-telegram-[a-z0-9-]*(?:font|size|weight|line-height)/;

const collectSourceFiles = (dir: string): string[] => {
  const entries: Dirent[] = readdirSync(dir, { withFileTypes: true });
  const files: string[] = [];
  for (const entry of entries) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === '__tests__' || path.endsWith(MODE_PACKAGES)) continue;
      files.push(...collectSourceFiles(path));
      continue;
    }
    if (entry.name.endsWith('.vue') || entry.name.endsWith('.css')) {
      files.push(path);
    }
  }
  return files;
};

describe('mode variant CSS boundary', () => {
  it('keeps telegram/discord variant rules inside their mode packages', () => {
    const offenders = collectSourceFiles(srcRoot)
      .filter(path => MODE_VARIANT_SELECTOR.test(readFileSync(path, 'utf-8')))
      .map(path => path.slice(srcRoot.length));

    expect(offenders).toEqual([]);
  });

  it('keeps mode typography on standard tokens outside the mode package', () => {
    const offenders = collectSourceFiles(srcRoot)
      .filter(path => PRIVATE_TYPOGRAPHY_TOKEN.test(readFileSync(path, 'utf-8')))
      .map(path => path.slice(srcRoot.length));

    expect(offenders).toEqual([]);
  });

  it('keeps the telegram token resolver free of private typography tokens', () => {
    const source = readFileSync(join(srcRoot, MODE_PACKAGES, 'telegram', 'tokens.ts'), 'utf-8');
    const privateTokens = source.match(/--lw-telegram-[a-z0-9-]+/g) ?? [];

    expect(privateTokens.filter(token => PRIVATE_TYPOGRAPHY_TOKEN.test(token))).toEqual([]);
  });
});
