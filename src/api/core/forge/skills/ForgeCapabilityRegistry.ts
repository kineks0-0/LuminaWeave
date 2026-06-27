import {
    forgeSkillRegistry,
    type ForgeSkillLoadResult,
    type ForgeSkillRegistry
} from './ForgeSkillRegistry.js';

export type ForgeCapabilityLoadMode = 'tool-namespace' | 'skill' | 'shell-skill';
export type ForgeCapabilityRisk = 'low' | 'medium' | 'high';
export type ForgeShellProfile = 'project-readonly' | 'project-write-request' | 'sandbox-write' | 'network-request';

export interface ForgeCapabilityIndexItem {
    id: string;
    title: string;
    summary: string;
    triggers: string[];
    loadAs: ForgeCapabilityLoadMode;
    namespace?: string;
    skillName?: string;
    shellProfile?: ForgeShellProfile;
    risk: ForgeCapabilityRisk;
}

export interface ForgeCapabilityLoadRequest {
    capabilityId: string;
    forgeProjectId: string;
    conversationId?: string;
    reason: string;
}

export interface ForgeCapabilityLoadResult {
    capability: ForgeCapabilityIndexItem;
    reason: string;
    loadedAt: number;
    skill?: ForgeSkillLoadResult;
    namespace?: string;
    shellProfile?: ForgeShellProfile;
    trace: {
        capabilityId: string;
        loadAs: ForgeCapabilityLoadMode;
        risk: ForgeCapabilityRisk;
        reason: string;
    };
}

const CAPABILITIES: ForgeCapabilityIndexItem[] = [
    {
        id: 'virtual-lorebook-editor',
        title: '虚拟世界书编辑器',
        summary: '在 Forge 虚拟世界书内创建、拆分、合并、重写条目，并写入项目 VFS。',
        triggers: ['lorebook', 'worldbook', 'entry', 'rewrite', 'merge', 'split', '世界书', '条目'],
        loadAs: 'skill',
        namespace: 'forge.lorebook',
        skillName: 'virtual-lorebook-editor',
        risk: 'medium'
    },
    {
        id: 'memory-curator',
        title: '项目记忆整理员',
        summary: '整理稳定偏好、硬性约束、禁忌和已确认设定决议。',
        triggers: ['memory', 'preference', 'constraint', 'taboo', '记忆', '偏好', '禁忌', '约束'],
        loadAs: 'skill',
        namespace: 'forge.memory',
        skillName: 'memory-curator',
        risk: 'medium'
    },
    {
        id: 'test-chat-runner',
        title: '测试聊天验证员',
        summary: '运行项目测试聊天验证，记录一致性问题和 trace 发现。',
        triggers: ['test chat', 'validate', 'consistency', '测试聊天', '验证'],
        loadAs: 'skill',
        namespace: 'forge.testChat',
        skillName: 'test-chat-runner',
        risk: 'low'
    },
    {
        id: 'export-preparer',
        title: '导出准备员',
        summary: '准备导出包和检查清单，不直接发布到真实 ST 资源。',
        triggers: ['export', 'publish', 'package', '导出', '发布', '打包'],
        loadAs: 'skill',
        namespace: 'forge.export',
        skillName: 'export-preparer',
        risk: 'high'
    },
    {
        id: 'material-analyzer',
        title: '素材分析员',
        summary: '用只读 shell 搜索和检查项目素材，并提取可直接写入项目 VFS 的设定草案。',
        triggers: ['material', 'source file', 'extract', 'grep', 'search', '素材', '提取', '搜索'],
        loadAs: 'shell-skill',
        namespace: 'forge.material',
        skillName: 'material-analyzer',
        shellProfile: 'project-readonly',
        risk: 'medium'
    },
    {
        id: 'shell-writer',
        title: '项目文件写入员',
        summary: '通过工具写入项目文件，VFS 保存当前内容，Git 保存版本历史。',
        triggers: ['write', 'edit', 'modify', 'update', 'create', 'delete', '写入', '修改', '创建', '重写'],
        loadAs: 'shell-skill',
        namespace: 'forge.shellWrite',
        shellProfile: 'project-write-request',
        risk: 'medium'
    }
];

const normalize = (value: string): string => value.trim().toLowerCase();

export class ForgeCapabilityRegistry {
    constructor(private readonly skills: ForgeSkillRegistry = forgeSkillRegistry) {}

    listCapabilities(): ForgeCapabilityIndexItem[] {
        return CAPABILITIES.map(item => ({ ...item, triggers: [...item.triggers] }));
    }

    search(query: string): ForgeCapabilityIndexItem[] {
        const normalizedQuery = normalize(query);
        if (!normalizedQuery) return this.listCapabilities();
        return this.listCapabilities().filter(item => {
            const haystack = [
                item.id,
                item.title,
                item.summary,
                item.namespace ?? '',
                item.skillName ?? '',
                ...item.triggers
            ].map(normalize).join(' ');
            return haystack.includes(normalizedQuery)
                || normalizedQuery.split(/\s+/).some(token => token && haystack.includes(token));
        });
    }

    getCapability(capabilityId: string): ForgeCapabilityIndexItem | null {
        const normalizedId = normalize(capabilityId);
        const found = CAPABILITIES.find(item => item.id === normalizedId);
        return found ? { ...found, triggers: [...found.triggers] } : null;
    }

    async load(request: ForgeCapabilityLoadRequest): Promise<ForgeCapabilityLoadResult> {
        const capability = this.getCapability(request.capabilityId);
        if (!capability) {
            throw new Error(`Forge capability not found: ${request.capabilityId}`);
        }

        const skill = capability.skillName
            ? await this.skills.loadSkill({
                forgeProjectId: request.forgeProjectId,
                conversationId: request.conversationId,
                skillName: capability.skillName
            })
            : undefined;

        return {
            capability,
            reason: request.reason,
            loadedAt: Date.now(),
            skill: skill ?? undefined,
            namespace: capability.namespace,
            shellProfile: capability.shellProfile,
            trace: {
                capabilityId: capability.id,
                loadAs: capability.loadAs,
                risk: capability.risk,
                reason: request.reason
            }
        };
    }
}

export const forgeCapabilityRegistry = new ForgeCapabilityRegistry();
