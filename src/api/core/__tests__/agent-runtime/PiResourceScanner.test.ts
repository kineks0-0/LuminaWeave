import { describe, expect, it } from 'vitest';
import {
    PiResourceScanner,
    type AgentRuntimeResourceScanDirEntry,
    type AgentRuntimeResourceScanFileSystem
} from '@/api/core/agent-runtime/extensions/pi/PiResourceScanner.js';

describe('PiResourceScanner', () => {
    it('discovers pi-compatible extensions, skills, prompts, and themes from injectable filesystem roots', async () => {
        const fs = createMemoryScanFileSystem({
            'D:/repo/.pi/extensions/logger.ts': '',
            'D:/repo/.pi/extensions/pkg/package.json': JSON.stringify({
                pi: { extensions: ['src/main.ts'] }
            }),
            'D:/repo/.pi/extensions/pkg/src/main.ts': '',
            'D:/repo/.pi/skills/quick.md': '',
            'D:/repo/.pi/skills/writer/SKILL.md': '',
            'D:/repo/.pi/prompts/system.md': '',
            'D:/repo/.pi/themes/dark.json': '',
            'D:/repo/.agents/skills/local/SKILL.md': '',
            'C:/Users/dev/.pi/agent/extensions/global.js': '',
            'C:/Users/dev/.pi/agent/skills/global/SKILL.md': '',
            'C:/Users/dev/.pi/agent/prompts/user.md': '',
            'C:/Users/dev/.pi/agent/themes/user.json': '',
            'C:/Users/dev/.agents/skills/shared/SKILL.md': ''
        });
        const scanner = new PiResourceScanner({
            fs,
            cwd: 'D:/repo',
            homeDir: 'C:/Users/dev',
            projectRoot: 'D:/repo'
        });

        await expect(scanner.scan({ reason: 'startup', runtimeId: 'test-runtime' })).resolves.toEqual({
            extensionPaths: [
                'D:/repo/.pi/extensions/logger.ts',
                'D:/repo/.pi/extensions/pkg/src/main.ts',
                'C:/Users/dev/.pi/agent/extensions/global.js'
            ],
            skillPaths: [
                'D:/repo/.pi/skills/quick.md',
                'D:/repo/.pi/skills/writer/SKILL.md',
                'D:/repo/.agents/skills/local/SKILL.md',
                'C:/Users/dev/.pi/agent/skills/global/SKILL.md',
                'C:/Users/dev/.agents/skills/shared/SKILL.md'
            ],
            promptPaths: [
                'D:/repo/.pi/prompts/system.md',
                'C:/Users/dev/.pi/agent/prompts/user.md'
            ],
            themePaths: [
                'D:/repo/.pi/themes/dark.json',
                'C:/Users/dev/.pi/agent/themes/user.json'
            ]
        });
    });

    it('does not include project .pi resources when project trust is disabled', async () => {
        const fs = createMemoryScanFileSystem({
            'D:/repo/.pi/extensions/logger.ts': '',
            'D:/repo/.pi/skills/writer/SKILL.md': '',
            'C:/Users/dev/.pi/agent/extensions/global.js': '',
            'C:/Users/dev/.pi/agent/skills/global/SKILL.md': ''
        });
        const scanner = new PiResourceScanner({
            fs,
            cwd: 'D:/repo',
            homeDir: 'C:/Users/dev',
            projectTrusted: false
        });

        await expect(scanner.scan({ reason: 'startup', runtimeId: 'test-runtime' })).resolves.toEqual({
            extensionPaths: ['C:/Users/dev/.pi/agent/extensions/global.js'],
            skillPaths: ['C:/Users/dev/.pi/agent/skills/global/SKILL.md']
        });
    });
});

const createMemoryScanFileSystem = (
    files: Record<string, string>
): AgentRuntimeResourceScanFileSystem => {
    const normalizedFiles = new Map(
        Object.entries(files).map(([path, content]) => [normalizePath(path), content])
    );
    const directories = new Set<string>();
    for (const path of normalizedFiles.keys()) {
        let current = dirname(path);
        while (current.length > 0 && !directories.has(current)) {
            directories.add(current);
            const parent = dirname(current);
            if (parent === current) break;
            current = parent;
        }
    }

    return {
        async exists(path: string): Promise<boolean> {
            const normalized = normalizePath(path);
            return normalizedFiles.has(normalized) || directories.has(normalized);
        },
        async readText(path: string): Promise<string> {
            const normalized = normalizePath(path);
            const content = normalizedFiles.get(normalized);
            if (content === undefined) {
                throw new Error(`Missing file: ${normalized}`);
            }
            return content;
        },
        async readDir(path: string): Promise<AgentRuntimeResourceScanDirEntry[]> {
            const normalized = normalizePath(path);
            const names = new Map<string, AgentRuntimeResourceScanDirEntry>();
            for (const filePath of normalizedFiles.keys()) {
                if (dirname(filePath) === normalized) {
                    const name = basename(filePath);
                    names.set(name, { name, kind: 'file' });
                }
                const dirPath = dirname(filePath);
                if (dirname(dirPath) === normalized) {
                    const name = basename(dirPath);
                    names.set(name, { name, kind: 'directory' });
                }
            }
            for (const dirPath of directories) {
                if (dirname(dirPath) === normalized && dirPath !== normalized) {
                    const name = basename(dirPath);
                    names.set(name, { name, kind: 'directory' });
                }
            }
            return Array.from(names.values()).sort((left, right) => left.name.localeCompare(right.name));
        }
    };
};

const normalizePath = (path: string): string => path.replace(/\\/g, '/').replace(/\/+/g, '/').replace(/\/$/, '');

const dirname = (path: string): string => {
    const normalized = normalizePath(path);
    const index = normalized.lastIndexOf('/');
    if (index <= 0) return normalized;
    return normalized.slice(0, index);
};

const basename = (path: string): string => {
    const normalized = normalizePath(path);
    const index = normalized.lastIndexOf('/');
    return index < 0 ? normalized : normalized.slice(index + 1);
};
