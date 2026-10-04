import { createGit, type Git } from 'just-git';
import type { IFileSystem } from 'just-bash';
import { toJustGitFileSystem } from './JustGitFileSystemBridge.js';
import { quote as shellQuote } from 'shell-quote';
import {
    formatDiff,
    getChangedFiles,
    readHead,
    walkCommitHistory,
    type TreeDiffEntry
} from 'just-git/repo';
import { cleanPath as normalizeRoot } from '@shared/resources/vfsPath.js';

export interface ForgeWorkspaceGitChangedFile {
    path: string;
    status: TreeDiffEntry['status'];
    oldHash?: string;
    newHash?: string;
}

export interface ForgeWorkspaceGitCommitResult {
    committed: boolean;
    hash: string | null;
    parentHash: string | null;
    changedFiles: ForgeWorkspaceGitChangedFile[];
    status: string;
}

export interface ForgeWorkspaceGitLogEntry {
    hash: string;
    shortHash: string;
    message: string;
    parents: string[];
    authorName: string;
    authorEmail: string;
    createdAt: number;
    changedFiles: ForgeWorkspaceGitChangedFile[];
}

export interface ForgeWorkspaceGitDiffResult {
    baseHash: string | null;
    headHash: string;
    text: string;
}

export interface ForgeWorkspaceGitServiceInput {
    fs: IFileSystem;
    repoRoot: string;
}

export interface ForgeWorkspaceGitCommitInput extends ForgeWorkspaceGitServiceInput {
    message: string;
}

export interface ForgeWorkspaceGitLogInput extends ForgeWorkspaceGitServiceInput {
    limit?: number;
}

export interface ForgeWorkspaceGitDiffInput extends ForgeWorkspaceGitServiceInput {
    baseHash: string | null;
    headHash: string;
}

export interface ForgeWorkspaceGitRestoreInput extends ForgeWorkspaceGitServiceInput {
    ref: string;
    path?: string;
}

const DEFAULT_IDENTITY = {
    name: 'LuminaWeave Forge',
    email: 'forge@luminaweave.local'
};

const quoteGitArg = (value: string): string => shellQuote([value]);

const mapChangedFile = (entry: TreeDiffEntry): ForgeWorkspaceGitChangedFile => ({
    path: entry.path,
    status: entry.status,
    oldHash: entry.oldHash,
    newHash: entry.newHash
});

export class ForgeWorkspaceGitService {
    createCommand(input: ForgeWorkspaceGitServiceInput): Git {
        return createGit({
            fs: toJustGitFileSystem(input.fs),
            cwd: normalizeRoot(input.repoRoot),
            identity: DEFAULT_IDENTITY,
            network: false
        });
    }

    async init(input: ForgeWorkspaceGitServiceInput): Promise<void> {
        const repoRoot = normalizeRoot(input.repoRoot);
        await input.fs.mkdir(repoRoot, { recursive: true });
        const git = this.createCommand({ ...input, repoRoot });
        const repo = await git.findRepo({ fs: toJustGitFileSystem(input.fs), cwd: repoRoot });
        if (repo) return;
        const result = await git.exec('init');
        if (result.exitCode !== 0) {
            throw new Error(result.stderr || result.stdout || 'git init failed');
        }
    }

    async status(input: ForgeWorkspaceGitServiceInput): Promise<string> {
        const repoRoot = normalizeRoot(input.repoRoot);
        await this.init({ ...input, repoRoot });
        const git = this.createCommand({ ...input, repoRoot });
        const result = await git.exec('status --porcelain');
        if (result.exitCode !== 0) {
            throw new Error(result.stderr || result.stdout || 'git status failed');
        }
        return result.stdout;
    }

    async commitAll(input: ForgeWorkspaceGitCommitInput): Promise<ForgeWorkspaceGitCommitResult> {
        const repoRoot = normalizeRoot(input.repoRoot);
        await this.init({ ...input, repoRoot });
        const git = this.createCommand({ ...input, repoRoot });
        const beforeStatus = await this.status({ ...input, repoRoot });
        const repoBefore = await git.findRepo({ fs: toJustGitFileSystem(input.fs), cwd: repoRoot });
        const headBefore = repoBefore ? await readHead(repoBefore) : { hash: null };
        if (!beforeStatus.trim()) {
            return {
                committed: false,
                hash: headBefore.hash,
                parentHash: headBefore.hash,
                changedFiles: [],
                status: beforeStatus
            };
        }

        const addResult = await git.exec('add .');
        if (addResult.exitCode !== 0) {
            throw new Error(addResult.stderr || addResult.stdout || 'git add failed');
        }
        const stagedStatus = await this.status({ ...input, repoRoot });
        if (!stagedStatus.trim()) {
            return {
                committed: false,
                hash: headBefore.hash,
                parentHash: headBefore.hash,
                changedFiles: [],
                status: stagedStatus
            };
        }

        const commitMessage = input.message.trim() || 'Update Forge workspace';
        const commitResult = await git.exec(`commit -m ${quoteGitArg(commitMessage)}`);
        if (commitResult.exitCode !== 0) {
            throw new Error(commitResult.stderr || commitResult.stdout || 'git commit failed');
        }
        const repoAfter = await git.findRepo({ fs: toJustGitFileSystem(input.fs), cwd: repoRoot });
        if (!repoAfter) throw new Error('git repository not found after commit');
        const headAfter = await readHead(repoAfter);
        if (!headAfter.hash) throw new Error('git HEAD missing after commit');
        const changedFiles = await getChangedFiles(repoAfter, headBefore.hash, headAfter.hash);
        return {
            committed: true,
            hash: headAfter.hash,
            parentHash: headBefore.hash,
            changedFiles: changedFiles.map(mapChangedFile),
            status: stagedStatus
        };
    }

    async log(input: ForgeWorkspaceGitLogInput): Promise<ForgeWorkspaceGitLogEntry[]> {
        const repoRoot = normalizeRoot(input.repoRoot);
        await this.init({ ...input, repoRoot });
        const git = this.createCommand({ ...input, repoRoot });
        const repo = await git.findRepo({ fs: toJustGitFileSystem(input.fs), cwd: repoRoot });
        if (!repo) return [];
        const head = await readHead(repo);
        if (!head.hash) return [];
        const limit = input.limit ?? 50;
        const entries: ForgeWorkspaceGitLogEntry[] = [];
        for await (const commit of walkCommitHistory(repo, head.hash, { limit })) {
            const changedFiles = await getChangedFiles(repo, commit.parents[0] ?? null, commit.hash);
            entries.push({
                hash: commit.hash,
                shortHash: commit.hash.slice(0, 7),
                message: commit.message,
                parents: commit.parents,
                authorName: commit.author.name,
                authorEmail: commit.author.email,
                createdAt: commit.author.timestamp * 1000,
                changedFiles: changedFiles.map(mapChangedFile)
            });
        }
        return entries;
    }

    async diff(input: ForgeWorkspaceGitDiffInput): Promise<ForgeWorkspaceGitDiffResult> {
        const repoRoot = normalizeRoot(input.repoRoot);
        await this.init({ ...input, repoRoot });
        const git = this.createCommand({ ...input, repoRoot });
        const repo = await git.findRepo({ fs: toJustGitFileSystem(input.fs), cwd: repoRoot });
        if (!repo) throw new Error('git repository not found');
        if (!input.baseHash) {
            const result = await git.exec(`show --format= --patch ${input.headHash}`);
            if (result.exitCode !== 0) throw new Error(result.stderr || result.stdout || 'git show failed');
            return {
                baseHash: null,
                headHash: input.headHash,
                text: result.stdout
            };
        }
        return {
            baseHash: input.baseHash,
            headHash: input.headHash,
            text: await formatDiff(repo, input.baseHash, input.headHash)
        };
    }

    async restore(input: ForgeWorkspaceGitRestoreInput): Promise<void> {
        const repoRoot = normalizeRoot(input.repoRoot);
        await this.init({ ...input, repoRoot });
        const git = this.createCommand({ ...input, repoRoot });
        const pathArgs = input.path ? ` -- ${quoteGitArg(input.path)}` : '';
        const result = await git.exec(`restore --source ${quoteGitArg(input.ref)}${pathArgs}`);
        if (result.exitCode !== 0) {
            throw new Error(result.stderr || result.stdout || 'git restore failed');
        }
    }
}

export const forgeWorkspaceGitService = new ForgeWorkspaceGitService();
