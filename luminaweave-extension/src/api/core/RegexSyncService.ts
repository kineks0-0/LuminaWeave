import { globalXMLInterceptor, BuiltinXMLTags } from './XMLInterceptor';
import { LuminaWeaveAPIBase } from './LuminaWeaveAPIBase';

/**
 * RegexSyncService (正则同步服务)
 * 负责将 LuminaWeave 的内部过滤标签同步至 SillyTavern 的全局正则扩展中。
 */
export class RegexSyncService extends LuminaWeaveAPIBase {
    private static readonly RULE_NAME = '[Lumina] Tag Filter';
    private lastSyncedRegex: string = '';

    constructor() {
        super();
    }

    /**
     * 同步 Lumina 标签过滤规则到 ST 全局正则
     */
    public async syncLuminaRegexToST(): Promise<void> {
        const helper = this.stHelper;
        if (!helper || typeof helper.updateTavernRegexesWith !== 'function') {
            console.warn('[RegexSyncService] TavernHelper Regex API 不可用，跳过同步');
            return;
        }

        // 获取需要过滤的标签 (transient, ephemeral, 以及非显示的 persistent 标签，如 <M>)
        // 注意：排除 Chat_Reply（核心对话内容）和 presentational 标签（展示层组件，应保留在消息中）
        const excludeFromSTFilter = [BuiltinXMLTags.CHAT_REPLY.toLowerCase()];
        const tags = globalXMLInterceptor.getTagsByLifecycle(['transient', 'ephemeral', 'persistent'])
            .filter(tag => !excludeFromSTFilter.includes(tag.toLowerCase()));

        if (tags.length === 0) {
            console.log('[RegexSyncService] 没有需要同步的标签');
            return;
        }

        // 构建正则表达式
        // 模式: /<tag\b[^>]*?>(?:[\s\S]*?)<\/tag>|<tag\b[^>]*?>(?:[\s\S]*?)$/gisu
        const regexParts = tags.map(tag => `<${tag}\\b[^>]*?>(?:[\\s\\S]*?)<\\/${tag}>|<${tag}\\b[^>]*?>(?:[\\s\\S]*?)$`);
        const fullRegex = `/(?:${regexParts.join('|')})/gisu`;

        if (this.lastSyncedRegex === fullRegex) {
            console.log('[RegexSyncService] 正则规则未改变，跳过同步以防止循环重启');
            return;
        }

        console.log(`[RegexSyncService] 正在同步正则规则到 ST: ${fullRegex}`);

        try {
            let hasChanged = false;

            await helper.updateTavernRegexesWith((regexes: any[]) => {
                // 查找现有的 Lumina 过滤规则
                let rule = regexes.find(r => r.script_name === RegexSyncService.RULE_NAME);

                if (rule && rule.find_regex === fullRegex && rule.enabled === true) {
                    console.log('[RegexSyncService] 正则规则未发生变化，跳过更新以防止循环重启');
                    hasChanged = false;
                    return regexes; // 返回原数组，不触发更新
                }

                hasChanged = true;
                const ruleData = {
                    script_name: RegexSyncService.RULE_NAME,
                    enabled: true,
                    find_regex: fullRegex,
                    replace_string: '',
                    trim_strings: '',
                    source: {
                        user_input: false,
                        ai_output: true,
                        slash_command: false,
                        world_info: false
                    },
                    destination: {
                        display: true,
                        prompt: false
                    },
                    run_on_edit: true,
                    min_depth: null,
                    max_depth: null
                };

                if (!rule) {
                    console.log('[RegexSyncService] 创建新的 ST 正则过滤规则');
                    regexes.push({
                        id: `lw_filter_${Date.now()}`,
                        ...ruleData
                    });
                } else {
                    console.log('[RegexSyncService] 检测到差异，正在更新 ST 正则过滤规则');
                    Object.assign(rule, ruleData);
                }

                return regexes;
            }, { type: 'global' });

            if (hasChanged) {
                this.lastSyncedRegex = fullRegex;
                console.log('[RegexSyncService] 正则规则已同步且触发了 ST 聊天重载');
            } else {
                // 如果内部判断没变，也更新缓存以防万一
                this.lastSyncedRegex = fullRegex;
            }
        } catch (e) {
            console.error('[RegexSyncService] 正则规则同步执行失败:', e);
        }
    }
}

export const globalRegexSyncService = new RegexSyncService();
