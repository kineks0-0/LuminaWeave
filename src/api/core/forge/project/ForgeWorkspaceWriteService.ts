import type { IFileSystem } from 'just-bash';
import { digestString } from '@shared/hash.js';
import type {
    ForgeTurnWorkspaceWriteSummary,
    ForgeWorkspaceChangedFile
} from '@shared/ForgePiTypes.js';
import {
    shellWorkspaceService,
    type ShellWorkspaceService
} from '../../hal/shell/ShellWorkspaceService.js';
import {
    forgeWorkspaceGitService,
    type ForgeWorkspaceGitService
} from './ForgeWorkspaceGitService.js';
import { cleanPath as normalizeLocalPath } from '@shared/resources/vfsPath.js';

export interface ForgeWorkspaceWriteServiceDeps {
    workspaces?: ShellWorkspaceService;
    git?: ForgeWorkspaceGitService;
}

export interface ForgeWorkspaceWriteInput {
    forgeProjectId: string;
    conversationId?: string;
    sourceToolCallId: string;
    displayPath: string;
    workspacePath: string;
    contentAfter: string | null;
    command?: string;
}

export interface ForgeWorkspaceWriteResult {
    path: string;
    workspacePath: string;
    applied: boolean;
    changedFiles: ForgeWorkspaceChangedFile[];
    workspaceWriteSummary: ForgeTurnWorkspaceWriteSummary;
    gitCommitHash: string | null;
    gitParentHash: string | null;
    command?: string;
    error?: string;
}

const parentLocalPath = (path: string): string => {
    const normalized = normalizeLocalPath(path);
    const index = normalized.lastIndexOf('/');
    return index <= 0 ? '/' : normalized.slice(0, index);
};

const workspaceLocalPath = (workspacePath: string): string =>
    normalizeLocalPath(workspacePath.replace(/^\/workspaces(?=\/|$)/, ''));

const forgeRepoRoot = (projectId: string): string =>
    `/forge/${encodeURIComponent(projectId)}`;

const hashContent = (content: string): string => `sha256:${digestString(content)}`;

export class ForgeWorkspaceWriteService {
    private readonly workspaces: ShellWorkspaceService;
    private readonly git: ForgeWorkspaceGitService;

    constructor(deps: ForgeWorkspaceWriteServiceDeps = {}) {
        this.workspaces = deps.workspaces ?? shellWorkspaceService;
        this.git = deps.git ?? forgeWorkspaceGitService;
    }

    async write(input: ForgeWorkspaceWriteInput): Promise<ForgeWorkspaceWriteResult> {
        const fs = await this.workspaces.getFileSystem({
            projectId: input.forgeProjectId,
            conversationId: input.conversationId
        });
        const localPath = workspaceLocalPath(input.workspacePath);
        const contentBefore = await this.readTextOrNull(fs, localPath);
        if (input.contentAfter === null && contentBefore === null) {
            return this.failed(input, `File not found: ${input.displayPath}`);
        }

        if (input.contentAfter === contentBefore) {
            return this.succeeded(input, [], null, null);
        }

        if (input.contentAfter === null) {
            await fs.rm(localPath);
        } else {
            await fs.mkdir(parentLocalPath(localPath), { recursive: true });
            await fs.writeFile(localPath, input.contentAfter);
        }
        await this.workspaces.persist();

        const changedFile: ForgeWorkspaceChangedFile = {
            path: input.displayPath,
            workspacePath: input.workspacePath,
            kind: contentBefore === null ? 'create' : input.contentAfter === null ? 'delete' : 'update',
            beforeHash: contentBefore === null ? null : hashContent(contentBefore),
            afterHash: input.contentAfter === null ? null : hashContent(input.contentAfter)
        };
        const commit = await this.git.commitAll({
            fs,
            repoRoot: forgeRepoRoot(input.forgeProjectId),
            message: this.createCommitMessage(input, changedFile)
        });

        return this.succeeded(
            input,
            [changedFile],
            commit.committed ? commit.hash : null,
            commit.parentHash
        );
    }

    mergeSummaries(sourceToolCallId: string, results: ForgeWorkspaceWriteResult[]): ForgeTurnWorkspaceWriteSummary {
        const changedFiles = results.flatMap(result => result.changedFiles);
        const errors = results
            .filter(result => !result.applied && result.error)
            .map(result => ({
                path: result.path,
                error: result.error ?? 'workspace write failed'
            }));
        const lastCommit = [...results].reverse().find(result => result.gitCommitHash);
        const summary: ForgeTurnWorkspaceWriteSummary = {
            sourceToolCallId,
            changedFiles,
            writeCount: changedFiles.length,
            errors
        };
        if (lastCommit) {
            summary.gitCommitHash = lastCommit.gitCommitHash;
            summary.gitParentHash = lastCommit.gitParentHash;
        }
        return summary;
    }

    private async readTextOrNull(fs: IFileSystem, path: string): Promise<string | null> {
        return await fs.readFile(path)
            .then(content => String(content ?? ''))
            .catch(() => null);
    }

    private createCommitMessage(input: ForgeWorkspaceWriteInput, changedFile: ForgeWorkspaceChangedFile): string {
        const action = changedFile.kind === 'create'
            ? 'Create'
            : changedFile.kind === 'delete'
                ? 'Delete'
                : 'Update';
        return `${action} ${input.displayPath}`;
    }

    private succeeded(
        input: ForgeWorkspaceWriteInput,
        changedFiles: ForgeWorkspaceChangedFile[],
        gitCommitHash: string | null,
        gitParentHash: string | null
    ): ForgeWorkspaceWriteResult {
        const workspaceWriteSummary: ForgeTurnWorkspaceWriteSummary = {
            sourceToolCallId: input.sourceToolCallId,
            changedFiles,
            writeCount: changedFiles.length,
            errors: [],
            gitCommitHash,
            gitParentHash
        };
        return {
            path: input.displayPath,
            workspacePath: input.workspacePath,
            applied: true,
            changedFiles,
            workspaceWriteSummary,
            gitCommitHash,
            gitParentHash,
            command: input.command
        };
    }

    private failed(input: ForgeWorkspaceWriteInput, error: string): ForgeWorkspaceWriteResult {
        return {
            path: input.displayPath,
            workspacePath: input.workspacePath,
            applied: false,
            changedFiles: [],
            workspaceWriteSummary: {
                sourceToolCallId: input.sourceToolCallId,
                changedFiles: [],
                writeCount: 0,
                errors: [{ path: input.displayPath, error }],
                gitCommitHash: null,
                gitParentHash: null
            },
            gitCommitHash: null,
            gitParentHash: null,
            command: input.command,
            error
        };
    }
}

export const forgeWorkspaceWriteService = new ForgeWorkspaceWriteService();
