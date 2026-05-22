export type ForgeToolApprovalDetailTone = 'neutral' | 'pending';

export interface ForgeToolApprovalDetailBlock {
  label: string;
  value: string;
  tone: ForgeToolApprovalDetailTone;
}

export interface ForgeToolApprovalPresentation {
  summary: string;
  targetLabel: string;
  targetValue: string;
  blocks: ForgeToolApprovalDetailBlock[];
  rawArgs: string;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const asString = (value: unknown): string =>
  typeof value === 'string' ? value : value == null ? '' : String(value);

const stringifyArgs = (args: unknown): string => {
  if (typeof args === 'string') return args;
  try {
    return JSON.stringify(args, null, 2);
  } catch {
    return String(args);
  }
};

export const buildToolApprovalPresentation = (
  toolName: string,
  args: unknown
): ForgeToolApprovalPresentation => {
  const rawArgs = stringifyArgs(args);
  const input = isRecord(args) ? args : {};

  if (toolName === 'writeFile') {
    return {
      summary: '写入文件并生成可审阅 staging',
      targetLabel: '目标路径',
      targetValue: asString(input.path) || '未指定路径',
      rawArgs,
      blocks: [
        {
          label: '原内容',
          value: '批准后执行工具时读取当前文件内容，并在 staging proposal 中展示完整对比。',
          tone: 'pending'
        },
        {
          label: '新内容',
          value: asString(input.content),
          tone: 'neutral'
        }
      ]
    };
  }

  if (toolName === 'editFile') {
    return {
      summary: '替换文件片段并生成可审阅 staging',
      targetLabel: '目标路径',
      targetValue: asString(input.path) || '未指定路径',
      rawArgs,
      blocks: [
        { label: '原片段', value: asString(input.old_string), tone: 'neutral' },
        { label: '新片段', value: asString(input.new_string), tone: 'neutral' }
      ]
    };
  }

  if (toolName === 'stageEntry') {
    return {
      summary: '直接创建 Review proposal',
      targetLabel: '目标条目',
      targetValue: asString(input.targetEntryId) || '未指定条目',
      rawArgs,
      blocks: [
        {
          label: '原内容',
          value: '批准后进入 staging，由 Review proposal 与虚拟世界书现有条目合成预览。',
          tone: 'pending'
        },
        { label: '新内容', value: asString(input.content), tone: 'neutral' }
      ]
    };
  }

  if (toolName === 'bash') {
    return {
      summary: asString(input.accessMode) === 'project-write-request'
        ? '执行写入请求命令并生成可审阅 staging'
        : '执行只读项目命令',
      targetLabel: '命令',
      targetValue: asString(input.command) || rawArgs,
      rawArgs,
      blocks: [
        {
          label: '访问模式',
          value: asString(input.accessMode) || 'project-readonly',
          tone: 'neutral'
        }
      ]
    };
  }

  return {
    summary: '工具调用需要授权',
    targetLabel: '参数',
    targetValue: rawArgs,
    rawArgs,
    blocks: []
  };
};
