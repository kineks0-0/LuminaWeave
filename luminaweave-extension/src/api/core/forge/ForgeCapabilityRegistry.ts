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
        title: 'Virtual Lorebook Editor',
        summary: 'Edit Forge virtual lorebook entries through reviewable typed effects.',
        triggers: ['lorebook', 'worldbook', 'entry', 'rewrite', 'merge', 'split', '世界书', '条目'],
        loadAs: 'skill',
        namespace: 'forge.lorebook',
        skillName: 'virtual-lorebook-editor',
        risk: 'medium'
    },
    {
        id: 'memory-curator',
        title: 'Memory Curator',
        summary: 'Curate stable user preferences, constraints, taboos, and setting decisions.',
        triggers: ['memory', 'preference', 'constraint', 'taboo', '记忆', '偏好', '禁忌', '约束'],
        loadAs: 'skill',
        namespace: 'forge.memory',
        skillName: 'memory-curator',
        risk: 'medium'
    },
    {
        id: 'review-stager',
        title: 'Review Stager',
        summary: 'Stage generated project changes for diff review and human approval.',
        triggers: ['review', 'staging', 'commit-ready', 'approve', '审阅', '暂存'],
        loadAs: 'skill',
        namespace: 'forge.review',
        skillName: 'review-stager',
        risk: 'medium'
    },
    {
        id: 'test-chat-runner',
        title: 'Test Chat Runner',
        summary: 'Run project test chat validation and record trace findings.',
        triggers: ['test chat', 'validate', 'consistency', '测试聊天', '验证'],
        loadAs: 'skill',
        namespace: 'forge.testChat',
        skillName: 'test-chat-runner',
        risk: 'low'
    },
    {
        id: 'export-preparer',
        title: 'Export Preparer',
        summary: 'Prepare export packages and checklists without publishing to real ST worldbooks.',
        triggers: ['export', 'publish', 'package', '导出', '发布', '打包'],
        loadAs: 'skill',
        namespace: 'forge.export',
        skillName: 'export-preparer',
        risk: 'high'
    },
    {
        id: 'material-analyzer',
        title: 'Material Analyzer',
        summary: 'Search and inspect project materials with read-only shell, then extract proposals.',
        triggers: ['material', 'source file', 'extract', 'grep', 'search', '素材', '提取', '搜索'],
        loadAs: 'shell-skill',
        namespace: 'forge.material',
        skillName: 'material-analyzer',
        shellProfile: 'project-readonly',
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
