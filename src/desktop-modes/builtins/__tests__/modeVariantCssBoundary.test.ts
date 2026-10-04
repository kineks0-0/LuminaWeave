import { readFileSync, readdirSync, type Dirent } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const srcRoot = fileURLToPath(new URL('../../..', import.meta.url));
const MODE_PACKAGES = join('desktop-modes', 'builtins');
const MODE_VARIANT_SELECTOR = /data-(?:skin|surface)-variant=['"](?:telegram|discord)['"]/;

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
});
