import type {
    AgentRuntimeResourceScanInput,
    AgentRuntimeResourceScanResult,
    AgentRuntimeResourceScanner
} from '../../runtime/AgentRuntimeTypes.js';
import { isRecord } from '@shared/CommonUtils.js';

export type AgentRuntimeResourceScanEntryKind = 'file' | 'directory' | 'symlink';

export interface AgentRuntimeResourceScanDirEntry {
    name: string;
    kind: AgentRuntimeResourceScanEntryKind;
}

export interface AgentRuntimeResourceScanFileSystem {
    exists: (path: string) => Promise<boolean> | boolean;
    readText: (path: string) => Promise<string> | string;
    readDir: (path: string) => Promise<AgentRuntimeResourceScanDirEntry[]> | AgentRuntimeResourceScanDirEntry[];
}

export interface PiResourceScannerOptions {
    fs: AgentRuntimeResourceScanFileSystem;
    cwd: string;
    homeDir?: string;
    agentDir?: string;
    projectRoot?: string;
    projectTrusted?: boolean;
}

interface PiManifest {
    extensions?: string[];
    skills?: string[];
    prompts?: string[];
    themes?: string[];
}

export class PiResourceScanner implements AgentRuntimeResourceScanner {
    constructor(private readonly options: PiResourceScannerOptions) {}

    async scan(_input: AgentRuntimeResourceScanInput): Promise<AgentRuntimeResourceScanResult> {
        // 扫描器只通过注入的文件系统工作，避免 Core SDK 静态依赖 Node fs/path。
        const cwd = normalizePath(this.options.cwd);
        const projectTrusted = this.options.projectTrusted ?? true;
        const agentDir = this.resolveAgentDir();
        const homeDir = this.options.homeDir ? normalizePath(this.options.homeDir) : undefined;
        const projectBaseDir = joinPath(cwd, '.pi');
        const result: Required<Pick<AgentRuntimeResourceScanResult, 'extensionPaths' | 'skillPaths' | 'promptPaths' | 'themePaths'>> = {
            extensionPaths: [],
            skillPaths: [],
            promptPaths: [],
            themePaths: []
        };

        if (projectTrusted) {
            result.extensionPaths.push(...await this.collectAutoExtensionEntries(joinPath(projectBaseDir, 'extensions')));
            result.skillPaths.push(...await this.collectSkillEntries(joinPath(projectBaseDir, 'skills'), 'pi'));
            result.promptPaths.push(...await this.collectDirectFiles(joinPath(projectBaseDir, 'prompts'), '.md'));
            result.themePaths.push(...await this.collectDirectFiles(joinPath(projectBaseDir, 'themes'), '.json'));
        }

        if (projectTrusted) {
            for (const dir of this.collectAncestorAgentsSkillDirs(cwd, homeDir)) {
                result.skillPaths.push(...await this.collectSkillEntries(dir, 'agents'));
            }
        }

        if (agentDir) {
            result.extensionPaths.push(...await this.collectAutoExtensionEntries(joinPath(agentDir, 'extensions')));
            result.skillPaths.push(...await this.collectSkillEntries(joinPath(agentDir, 'skills'), 'pi'));
            result.promptPaths.push(...await this.collectDirectFiles(joinPath(agentDir, 'prompts'), '.md'));
            result.themePaths.push(...await this.collectDirectFiles(joinPath(agentDir, 'themes'), '.json'));
        }

        if (homeDir) {
            result.skillPaths.push(...await this.collectSkillEntries(joinPath(homeDir, '.agents', 'skills'), 'agents'));
        }

        return omitEmptyResourceFields(result);
    }

    private resolveAgentDir(): string | undefined {
        if (this.options.agentDir) {
            return normalizePath(this.options.agentDir);
        }
        if (!this.options.homeDir) {
            return undefined;
        }
        return joinPath(this.options.homeDir, '.pi', 'agent');
    }

    private collectAncestorAgentsSkillDirs(cwd: string, homeDir: string | undefined): string[] {
        // pi 会读取当前项目向上的 .agents/skills；projectRoot 用来限制扫描不会越过接入方声明的项目边界。
        const dirs: string[] = [];
        const stopDir = this.options.projectRoot ? normalizePath(this.options.projectRoot) : undefined;
        const userAgentsSkillsDir = homeDir ? joinPath(homeDir, '.agents', 'skills') : undefined;
        let current = cwd;
        while (true) {
            const dir = joinPath(current, '.agents', 'skills');
            if (dir !== userAgentsSkillsDir) {
                dirs.push(dir);
            }
            if (stopDir && current === stopDir) {
                break;
            }
            const parent = dirname(current);
            if (parent === current) {
                break;
            }
            current = parent;
        }
        return dirs;
    }

    private async collectAutoExtensionEntries(dir: string): Promise<string[]> {
        if (!await this.options.fs.exists(dir)) return [];
        const rootEntries = await this.resolveExtensionEntries(dir);
        // 目录自身声明入口时优先使用自身入口，不再继续扫描子项，匹配 pi loader 的 package 语义。
        if (rootEntries) return rootEntries;

        const entries: string[] = [];
        for (const entry of await this.readSortedDir(dir)) {
            if (shouldSkipEntry(entry.name)) continue;
            const fullPath = joinPath(dir, entry.name);
            if (entry.kind === 'file' || entry.kind === 'symlink') {
                if (entry.name.endsWith('.ts') || entry.name.endsWith('.js')) {
                    entries.push(fullPath);
                }
                continue;
            }
            const resolved = await this.resolveExtensionEntries(fullPath);
            if (resolved) {
                entries.push(...resolved);
            }
        }
        return entries;
    }

    private async resolveExtensionEntries(dir: string): Promise<string[] | null> {
        const packageJsonPath = joinPath(dir, 'package.json');
        if (await this.options.fs.exists(packageJsonPath)) {
            // manifest 比 index.ts/index.js 优先，用于支持多入口扩展包。
            const manifest = await this.readPiManifest(packageJsonPath);
            const manifestEntries = await this.resolveManifestPaths(dir, manifest?.extensions ?? []);
            if (manifestEntries.length > 0) {
                return manifestEntries;
            }
        }

        const indexTs = joinPath(dir, 'index.ts');
        if (await this.options.fs.exists(indexTs)) {
            return [indexTs];
        }
        const indexJs = joinPath(dir, 'index.js');
        if (await this.options.fs.exists(indexJs)) {
            return [indexJs];
        }
        return null;
    }

    private async resolveManifestPaths(dir: string, paths: string[]): Promise<string[]> {
        const result: string[] = [];
        for (const path of paths) {
            const resolved = joinPath(dir, path);
            if (await this.options.fs.exists(resolved)) {
                result.push(resolved);
            }
        }
        return result;
    }

    private async readPiManifest(packageJsonPath: string): Promise<PiManifest | null> {
        try {
            // manifest 解析失败只让该目录回退到 index 发现，不让一个坏 package 阻断整体扫描。
            const parsed = JSON.parse(await this.options.fs.readText(packageJsonPath)) as unknown;
            if (!isRecord(parsed) || !isRecord(parsed.pi)) return null;
            return {
                extensions: readStringArray(parsed.pi.extensions),
                skills: readStringArray(parsed.pi.skills),
                prompts: readStringArray(parsed.pi.prompts),
                themes: readStringArray(parsed.pi.themes)
            };
        } catch {
            return null;
        }
    }

    private async collectSkillEntries(dir: string, mode: 'pi' | 'agents', rootDir = dir): Promise<string[]> {
        if (!await this.options.fs.exists(dir)) return [];
        const entries = await this.readSortedDir(dir);
        const skillFile = entries.find(entry => entry.name === 'SKILL.md' && entry.kind !== 'directory');
        if (skillFile) {
            // 一个目录有 SKILL.md 时视为单个 skill 根，避免继续把子目录误当作同级技能。
            return [joinPath(dir, skillFile.name)];
        }

        const result: string[] = [];
        for (const entry of entries) {
            if (shouldSkipEntry(entry.name)) continue;
            const fullPath = joinPath(dir, entry.name);
            // pi 模式允许 .pi/skills 根目录下直接放单文件 Markdown 技能；.agents 模式只认 SKILL.md。
            if (mode === 'pi' && dir === rootDir && entry.kind !== 'directory' && entry.name.endsWith('.md')) {
                result.push(fullPath);
                continue;
            }
            if (entry.kind !== 'directory') continue;
            result.push(...await this.collectSkillEntries(fullPath, mode, rootDir));
        }
        return result;
    }

    private async collectDirectFiles(dir: string, extension: string): Promise<string[]> {
        if (!await this.options.fs.exists(dir)) return [];
        const result: string[] = [];
        for (const entry of await this.readSortedDir(dir)) {
            if (shouldSkipEntry(entry.name)) continue;
            if (entry.kind !== 'directory' && entry.name.endsWith(extension)) {
                result.push(joinPath(dir, entry.name));
            }
        }
        return result;
    }

    private async readSortedDir(dir: string): Promise<AgentRuntimeResourceScanDirEntry[]> {
        return [...await this.options.fs.readDir(dir)].sort((left, right) => left.name.localeCompare(right.name));
    }
}

const omitEmptyResourceFields = (
    result: Required<Pick<AgentRuntimeResourceScanResult, 'extensionPaths' | 'skillPaths' | 'promptPaths' | 'themePaths'>>
): AgentRuntimeResourceScanResult => ({
    ...(result.extensionPaths.length > 0 ? { extensionPaths: result.extensionPaths } : {}),
    ...(result.skillPaths.length > 0 ? { skillPaths: result.skillPaths } : {}),
    ...(result.promptPaths.length > 0 ? { promptPaths: result.promptPaths } : {}),
    ...(result.themePaths.length > 0 ? { themePaths: result.themePaths } : {})
});

const shouldSkipEntry = (name: string): boolean =>
    name.startsWith('.') || name === 'node_modules';

const readStringArray = (value: unknown): string[] | undefined =>
    Array.isArray(value) && value.every(item => typeof item === 'string')
        ? [...value]
        : undefined;

const joinPath = (...parts: string[]): string =>
    normalizePath(parts
        .filter(part => part.length > 0)
        .map((part, index) => index === 0 ? part.replace(/\/+$/g, '') : part.replace(/^\/+|\/+$/g, ''))
        .join('/'));

const normalizePath = (path: string): string =>
    path.replace(/\\/g, '/').replace(/\/+/g, '/').replace(/\/$/g, '');

const dirname = (path: string): string => {
    const normalized = normalizePath(path);
    const index = normalized.lastIndexOf('/');
    if (index <= 0) return normalized;
    return normalized.slice(0, index);
};
