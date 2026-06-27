import { VFSCommandService } from './VFSCommandService.js';
import { shellPermissionService } from './ShellPermissionService.js';
import { BashTerminalRuntime, createUserTerminalSession } from './BashTerminalRuntime.js';
import { AgentBashToolService } from './AgentBashToolService.js';
import { ShellSessionRuntime } from './ShellSessionRuntime.js';
import { virtualFileSystemService } from '../resource/index.js';
export { virtualFileSystemService, type VirtualFileSystemService } from '../resource/index.js';

export * from './VFSCommandService.js';
export * from './ShellPermissionService.js';
export * from './ResourceBackedBashFs.js';
export * from './BashTerminalRuntime.js';
export * from './AgentBashToolService.js';
export * from './ShellCommandManual.js';
export * from './ShellNetworkPolicyService.js';
export * from './ShellWorkspaceService.js';
export * from './ShellSessionRuntime.js';

export const vfsCommandService = new VFSCommandService(virtualFileSystemService);
export const bashTerminalRuntime = new BashTerminalRuntime({
    session: createUserTerminalSession(),
    vfs: virtualFileSystemService,
    permissions: shellPermissionService,
    network: { dangerouslyAllowFullInternetAccess: true }
});

export const shellSessionRuntime = new ShellSessionRuntime({
    runtime: bashTerminalRuntime
});

export const agentBashToolService = new AgentBashToolService({
    vfs: virtualFileSystemService,
    permissions: shellPermissionService,
    network: { dangerouslyAllowFullInternetAccess: true }
});
