import { describe, expect, it } from 'vitest';
import { XMLInterceptor, BuiltinXMLTags } from '../XMLInterceptor';

describe('XMLInterceptor Streaming Policy (流式策略性测试)', () => {

    describe('顶层文本保护 (allowTopLevel)', () => {
        it('当 allowTopLevel=true 时，应显示标签外的起始文本', () => {
            const interceptor = new XMLInterceptor();
            // 输入：Hello <Chat_Reply>World</Chat_Reply>
            const state = interceptor.deriveStreamState('Hello <Chat_Reply>World', {
                filterChatReply: true,
                allowTopLevel: true,
                implicitThinking: false
            });
            
            expect(state.displayText).toBe('Hello World');
            expect(state.statusText).toBe('回复中...');
        });

        it('当 allowTopLevel=false 时，应隐藏标签外的起始文本', () => {
            const interceptor = new XMLInterceptor();
            // 输入：Hello <Chat_Reply>World
            // 预期：由于 Hello 在任何标签之外，且保护关闭，它应该被隐藏
            const state = interceptor.deriveStreamState('Hello <Chat_Reply>World', {
                filterChatReply: true,
                allowTopLevel: false,
                implicitThinking: false
            });
            
            expect(state.displayText).toBe('World');
        });

        it('当文本位于两个 persistent 标签之间且 allowTopLevel=false 时，应隐藏中间文本', () => {
            const interceptor = new XMLInterceptor();
            const raw = '<Chat_Reply>Part1</Chat_Reply> Middle <Chat_Reply>Part2</Chat_Reply>';
            const state = interceptor.deriveStreamState(raw, {
                filterChatReply: true,
                allowTopLevel: false,
                implicitThinking: false
            });
            
            // 预期结果：Part1Part2 (中间的 " Middle " 被过滤掉)
            expect(state.displayText).toBe('Part1Part2');
        });
    });

    describe('隐式思考检测 (implicitStartThinking)', () => {
        it('当开启时，起始文本应被视为思考过程并隐藏', () => {
            const interceptor = new XMLInterceptor();
            const raw = 'Wait, let me think... <Chat_Reply>Hello!</Chat_Reply>';
            const state = interceptor.deriveStreamState(raw, {
                filterChatReply: true,
                allowTopLevel: true,
                implicitThinking: true
            });
            
            // 预期结果：只有 Chat_Reply 内容显示
            expect(state.displayText).toBe('Hello!');
            // 初始状态应为思考中（尽管文本已被隐藏）
            expect(state.statusText).toBe('回复中...');
        });

        it('验证隐式思考状态下的中间过程', () => {
            const interceptor = new XMLInterceptor();
            const raw = 'Thinking...';
            const state = interceptor.deriveStreamState(raw, {
                filterChatReply: true,
                allowTopLevel: true,
                implicitThinking: true
            });
            
            expect(state.displayText).toBe('');
            expect(state.statusText).toBe('思考中...');
        });
    });

    describe('流式标签截断保护 (TrailingPartialTag)', () => {
        it('应自动截断末尾正在生成的标签，防止 UI 渲染原始 XML 碎片', () => {
            const interceptor = new XMLInterceptor();
            // 输入：<Chat_Reply>Hello <V
            // 预期：显示 "Hello "，截断 "<V"
            const state = interceptor.deriveStreamState('<Chat_Reply>Hello <V', {
                filterChatReply: true,
                allowTopLevel: true,
                implicitThinking: false
            });
            
            expect(state.displayText).toBe('Hello ');
            expect(state.statusText).toBe('回复中...');
        });

        it('应处理末尾的 "<" 符号保护', () => {
            const interceptor = new XMLInterceptor();
            const state = interceptor.deriveStreamState('<Chat_Reply>Values <', {
                filterChatReply: true,
                allowTopLevel: true,
                implicitThinking: false
            });
            expect(state.displayText).toBe('Values ');
        });

        it('应在 Chat_Reply 内部正确保留不属于标签结构的 "<" 符号 (如数学符号)', () => {
            const interceptor = new XMLInterceptor();
            const state = interceptor.deriveStreamState('<Chat_Reply>1 < 2</Chat_Reply>', {
                filterChatReply: true,
                allowTopLevel: true,
                implicitThinking: false
            });
            expect(state.displayText).toBe('1 < 2');
        });
    });

    describe('复合策略测试', () => {
        it('顶层文本 + Character_Action + Chat_Reply (过滤模式)', () => {
            const interceptor = new XMLInterceptor();
            const raw = 'Stage: <Character_Action>Run</Character_Action> <Chat_Reply>Go!</Chat_Reply>';
            const state = interceptor.deriveStreamState(raw, {
                filterChatReply: true,
                allowTopLevel: true,
                implicitThinking: false
            });
            expect(state.displayText).toBe('Stage:  Go!');
        });

        it('顶级文本 + Character_Action + Chat_Reply (过滤模式 + 无顶级保护)', () => {
            const interceptor = new XMLInterceptor();
            const raw = 'Stage: <Character_Action>Run</Character_Action> <Chat_Reply>Go!</Chat_Reply>';
            const state = interceptor.deriveStreamState(raw, {
                filterChatReply: true,
                allowTopLevel: false,
                implicitThinking: false
            });
            expect(state.displayText).toBe('Go!');
        });
    });

    describe('真实模型回复模拟 (Real-world Response Simulation)', () => {
        it('应依据策略正确过滤复杂的实战回复内容', () => {
            const interceptor = new XMLInterceptor();
            
            // 模拟插件注册的标签
            interceptor.registerXMLParser('Next_Plan', 'ephemeral', () => {});
            interceptor.registerXMLParser('M', 'persistent', () => {});
            interceptor.registerXMLParser('Story_Summary', 'persistent', () => {});

            const rawContent = `用户要求继续剧情，并且“只要几句话，包括你的思考内容长度”。意思是要很简短的输出当前剧情的进展，可能只需要一段简短的叙事段落。

回顾当前情况：
- 队伍在蘑菇洼地南侧边缘，刚刚为躲避西侧再现的鳞片刮擦声而紧急转向南侧蕨类密丛。
- 虎兽人拖着精神恍惚的伙计，DG紧随其后。
- 时间：正午后。
- 地点：绕远小径 - 蘑菇洼地南侧边缘。
- 追踪者（疑似五仙教）可能还在附近。
- 需要简短推进剧情：可能是他们进入蕨类密丛后的状况，或者遭遇新的变化。
- 需要保持紧张感。
- 输出格式：需要按照系统指令，先思考（这个<thinking>已经有了），然后输出<Chat_Reply>（剧情），然后<Next_Plan>（下一轮计划），然后<M>（状态同步），最后<Story_Summary>。
- 用户要求“只要几句话，包括你的思考内容长度”，意味着叙事部分应该很短，可能就几句话描述当前行动。
- 但系统要求完整输出所有标签。
- 思考内容已经在这个标签里了，所以Chat_Reply部分应该简短。

因此，我的Chat_Reply应该简短描述他们进入蕨类密丛后的紧迫情况，可能追踪者逼近，或者环境有异样。保持紧张节奏。

同时需要更新世界状态（global等），并总结剧情。

计划：
Chat_Reply: 简短描述他们冲进蕨类密丛，发现更深的压抑环境，或许有新的危险征兆。
Next_Plan: 下一轮可能是他们被迫做出新的选择，或者遭遇洼地生态的直接影响（比如孢子）。
M: 更新global.time, location, characters.status等。
Story_Summary: 简短概括。

注意：用户要求“剧情简短输出”，所以Chat_Reply应该只有几句话。

</thinking>
<Chat_Reply>
蕨类密丛比预想的更深更密，叶片边缘锯齿锋利，刮过皮毛留下细密的红痕。前方的光线陡然暗了下去，仿佛闯进了一头巨兽的喉咙。虎兽人喘着粗气停下，爪子死死扣住伙计的肩膀，目光死死钉在前方那片几乎不透光的幽暗里。

<V>
Alert("环境变化", "进入更深幽的蕨类密丛")
Badge("能见度", "极低")
Stat("体力/耐力", 45, 100)
</V>
</Chat_Reply>

<Next_Plan>
队伍在蕨类密丛深处被迫停下，前方能见度极低，可能潜伏着未知危险。下一轮需决定是冒险深入、尝试横向移动寻找出路，还是被迫在此短暂隐蔽。追踪者的声音可能再次接近。
</Next_Plan>

<M>
global.time = "正午后（林间光线更暗）";
global.location = "绕远小径 - 蕨类密丛深处";
characters["虎兽人行商"].status = "体力消耗剧烈，决策压力极大，警惕前方未知";
characters["狸猫兽人伙计"].status = "近乎昏迷，精神彻底崩溃";
</M>

<Story_Summary>
队伍为躲避追踪者，闯入蘑菇洼地南侧更深、更暗的蕨类密丛，前方能见度极低，体力濒临耗竭，陷入更为困窘的境地。
</Story_Summary>`;

            // 设置：顶级保护=关，隐式思考=开，过滤=开
            const state = interceptor.deriveStreamState(rawContent, {
                filterChatReply: true,
                allowTopLevel: false,
                implicitThinking: true
            });

            // 1. 验证显示文本：
            expect(state.displayText).toContain('蕨类密丛比预想的更深更密');
            expect(state.displayText).toContain('<V>');
            expect(state.displayText).toContain('Alert("环境变化"');
            expect(state.displayText).toContain('</V>');
            expect(state.displayText).not.toContain('用户要求继续剧情');
            expect(state.displayText).not.toContain('Next_Plan');
            expect(state.displayText).not.toContain('global.time');
            expect(state.displayText).not.toContain('队伍为躲避追踪者');

            // 2. 验证状态文本
            expect(state.statusText).toBe('Story_Summary处理中..');
        });
    });

    describe('流式增量解析模拟 (Streaming Incremental Parsing Simulation)', () => {
        /**
         * 模拟流式增量解析的辅助函数
         */
        const simulateStream = (
            content: string,
            interceptor: XMLInterceptor,
            allowTopLevel: boolean = true,
            implicitThinking: boolean = false,
            chunkSize: number = 2
        ) => {
            const states = [];
            for (let i = 1; i <= content.length; i += chunkSize) {
                const chunk = content.slice(0, i);
                states.push(interceptor.deriveStreamState(chunk, {
                    filterChatReply: true,
                    allowTopLevel,
                    implicitThinking
                }));
            }
            // 确保最后一次全量输入也被解析
            states.push(interceptor.deriveStreamState(content, {
                filterChatReply: true,
                allowTopLevel,
                implicitThinking
            }));
            return states;
        };

        it('模拟文本 -> 标签 -> 文本的逐字过程 (平滑度验证)', () => {
            const interceptor = new XMLInterceptor();
            const raw = 'Wait. <Chat_Reply>Hello world</Chat_Reply>';
            // 开启顶级保护，关闭隐式思考
            const states = simulateStream(raw, interceptor, true, false, 1);

            // 验证 displayText 是否平滑增长，且从不包含未闭合或已过滤的标签
            states.forEach((state, index) => {
                // 1. 不应包含原始标签字符串
                expect(state.displayText).not.toContain('<Chat_Reply>');
                
                // 2. 验证在标签未出现前，顶级文本正常显示
                if (index < 6) { // "Wait. "
                    expect(state.displayText).toBe(raw.slice(0, index + 1));
                }
                
                // 3. 验证在标签内部时，文本拼接正确
                if (state.displayText.includes('Hello')) {
                    expect(state.displayText).toMatch(/^Wait\. Hello/);
                }
            });

            const finalState = states[states.length - 1];
            expect(finalState.displayText).toBe('Wait. Hello world');
        });

        it('模拟多级标签转换与状态切换 (Next_Plan -> M -> Summary)', () => {
            const interceptor = new XMLInterceptor();
            interceptor.registerXMLParser('Next_Plan', 'ephemeral', () => {});
            interceptor.registerXMLParser('M', 'persistent', () => {});
            interceptor.registerXMLParser('Story_Summary', 'persistent', () => {});

            const raw = '<Chat_Reply>Done.</Chat_Reply><Next_Plan>P1</Next_Plan><M>global.v=1</M><Story_Summary>S1</Story_Summary>';
            const states = simulateStream(raw, interceptor, false, false, 3);

            // 提取关键状态转化点
            const statusHistory = states.map(s => s.statusText);
            
            expect(statusHistory).toContain('回复中...');
            expect(statusHistory).toContain('Next_Plan处理中..');
            expect(statusHistory).toContain('状态同步中...');
            expect(statusHistory).toContain('Story_Summary处理中..');
            
            // 最终 displayText 仅包含 Chat_Reply 内容
            const finalState = states[states.length - 1];
            expect(finalState.displayText).toBe('Done.');
        });

        it('模拟隐式思考静默状态切换', () => {
            const interceptor = new XMLInterceptor();
            const raw = 'Let me think first... <Chat_Reply>Ready.</Chat_Reply>';
            // 关闭顶级保护，开启隐式思考
            const states = simulateStream(raw, interceptor, false, true, 1);

            const tagOpenStr = '<Chat_Reply>';
            const replyStartIndex = raw.indexOf(tagOpenStr);
            const contentStartIndex = replyStartIndex + tagOpenStr.length;

            states.forEach((state, index) => {
                const currentLength = index + 1;
                if (currentLength < contentStartIndex) {
                    // 还没到标签内容部分，或者是正在解析标签
                    expect(state.displayText).toBe('');
                    if (currentLength < replyStartIndex) {
                        expect(state.statusText).toBe('思考中...');
                    }
                } else {
                    // 已经进入 Chat_Reply 内容
                    expect(state.statusText).toBe('回复中...');
                    const expectedFullContent = raw.slice(contentStartIndex, currentLength);
                    // 验证 displayText 是期望内容的前缀（因为末尾如果是部分标签如 </Chat 会被过滤）
                    if (state.displayText) {
                        expect(expectedFullContent.startsWith(state.displayText)).toBe(true);
                        expect(state.displayText).not.toContain('<');
                    }
                }
            });
        });
    });
});
