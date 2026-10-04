import type { CustomCommand, FsStat, IFileSystem, ResolvedCommandContext } from 'just-bash';
import type { FileSystem as JustGitFileSystem, Git } from 'just-git';

type JustGitFileStat = Awaited<ReturnType<JustGitFileSystem['stat']>>;

const toJustGitFileStat = (stat: FsStat): JustGitFileStat => ({
    isFile: stat.isFile,
    isDirectory: stat.isDirectory,
    isSymbolicLink: stat.isSymbolicLink,
    mode: stat.mode,
    size: stat.size,
    mtime: stat.mtime,
    dev: typeof stat.dev === 'bigint' ? Number(stat.dev) : stat.dev,
    ino: typeof stat.ino === 'bigint' ? Number(stat.ino) : stat.ino
});

export const toJustGitFileSystem = (fs: IFileSystem): JustGitFileSystem => ({
    readFile: path => fs.readFile(path),
    readFileBuffer: path => fs.readFileBuffer(path),
    writeFile: (path, content) => fs.writeFile(path, content),
    exists: path => fs.exists(path),
    stat: async path => toJustGitFileStat(await fs.stat(path)),
    mkdir: (path, options) => fs.mkdir(path, options),
    readdir: path => fs.readdir(path),
    rm: (path, options) => fs.rm(path, options),
    lstat: async path => toJustGitFileStat(await fs.lstat(path)),
    readlink: path => fs.readlink(path),
    symlink: (target, path) => fs.symlink(target, path),
    mv: (src, dest) => fs.mv(src, dest)
});

export const asJustBashGitCommand = (git: Git): CustomCommand => ({
    name: 'git',
    execute: (args, ctx: ResolvedCommandContext) => git.execute(args, {
        fs: toJustGitFileSystem(ctx.fs),
        cwd: ctx.cwd,
        env: ctx.env,
        stdin: ctx.stdin,
        exec: ctx.exec,
        signal: ctx.signal
    })
});
