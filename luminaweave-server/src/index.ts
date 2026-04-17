import path from 'path';
import fs from 'fs';
import { Router, Request, Response } from 'express';
import { streamText } from 'ai';
import { Logger } from './logger.js';
import { StreamingManager } from './StreamingManager.js';
import { StorageService } from './StorageService.js';
import { NexusService, mapSTSettingsToAISdk } from './NexusService.js';
import { BaseXMLInterceptor } from '../../shared/BaseXMLInterceptor.js';
import { API_ROUTES } from '../../shared/ApiEndpoints.js';
import { TransactionRecord, TransactionScope, TransactionStatus, NexusApiConfig, PresetRecord, ForgeSessionRecord } from './types.js';
import { LuminaChatMessage, MessageUtils } from '../../shared/LuminaMessage.js';
import { NexusGenerationFlow, PersistenceDelegate } from '../../shared/api/NexusGenerationFlow.js';

class ServerXMLInterceptor extends BaseXMLInterceptor {}

export class LuminaWeaveServer {
    private streaming: StreamingManager;
    private storage: StorageService;
    private nexus: NexusService;
    private interceptor: ServerXMLInterceptor;
    private abortControllers: Map<string, AbortController> = new Map();
    private sseConnections: Map<string, Set<Response>> = new Map();

    constructor(dataDir: string) {
        this.streaming = new StreamingManager();
        this.storage = new StorageService(dataDir);
        this.nexus = new NexusService();
        this.interceptor = new ServerXMLInterceptor();

        setInterval(() => this.storage.syncToDisk(), 5000);
    }

    init(router: Router) {
        // --- 基础设置 ---
        router.get(API_ROUTES.SETTINGS.GET, (req: Request, res: Response) => {
            const settingsFile = path.join(process.cwd(), 'plugins/luminaweave/data/LuminaWeave.json');
            res.json(fs.existsSync(settingsFile) ? JSON.parse(fs.readFileSync(settingsFile, 'utf8')) : {});
        });

        router.post(API_ROUTES.SETTINGS.SAVE, (req: Request, res: Response) => {
            const settingsFile = path.join(process.cwd(), 'plugins/luminaweave/data/LuminaWeave.json');
            fs.writeFileSync(settingsFile, JSON.stringify(req.body, null, 2), 'utf8');
            res.sendStatus(200);
        });

        // --- 预设管理 (Presets) ---
        router.get(API_ROUTES.PRESETS.LIST, (req: Request, res: Response) => {
            res.json({ presets: this.storage.readPresets().map(p => ({ id: p.id, name: p.name, isDefault: p.isDefault, createdAt: p.createdAt, updatedAt: p.updatedAt })) });
        });

        router.get('/presets/:presetId', (req: Request, res: Response) => {
            const preset = this.storage.readPresets().find(p => p.id === req.params.presetId);
            preset ? res.json({ preset }) : res.status(404).json({ error: 'Not found' });
        });

        router.get('/presets/:presetId/export', (req: Request, res: Response) => {
            const preset = this.storage.readPresets().find(p => p.id === req.params.presetId);
            preset ? res.json({ blob: preset.blob }) : res.status(404).json({ error: 'Not found' });
        });

        router.post(API_ROUTES.PRESETS.CREATE, (req: Request, res: Response) => {
            const newPreset = { id: `pst_${Date.now()}`, name: req.body?.name || 'Untitled', isDefault: false, blob: req.body?.blob || {}, createdAt: Date.now(), updatedAt: Date.now() };
            const presets = this.storage.readPresets();
            presets.push(newPreset);
            this.storage.writePresets(presets);
            res.status(201).json({ preset: newPreset });
        });

        router.put('/presets/:presetId', (req: Request, res: Response) => {
            const presets = this.storage.readPresets();
            const idx = presets.findIndex(p => p.id === req.params.presetId);
            if (idx === -1) return res.status(404).json({ error: 'Not found' });
            
            const p = presets[idx];
            presets[idx] = {
                ...p,
                name: typeof req.body?.name === 'string' ? req.body.name : p.name,
                blob: req.body?.blob !== undefined ? req.body.blob : p.blob,
                updatedAt: Date.now()
            };
            this.storage.writePresets(presets);
            res.status(200).json({ preset: presets[idx] });
        });

        router.delete('/presets/:presetId', (req: Request, res: Response) => {
            const presets = this.storage.readPresets();
            const idx = presets.findIndex(p => p.id === req.params.presetId);
            if (idx === -1) return res.status(404).json({ error: 'Not found' });
            if (presets[idx].isDefault) return res.status(409).json({ error: 'Default preset cannot be deleted' });
            
            presets.splice(idx, 1);
            this.storage.writePresets(presets);
            res.sendStatus(204);
        });

        router.post(API_ROUTES.PRESETS.IMPORT, (req: Request, res: Response) => {
            const newPreset = { id: `pst_imp_${Date.now()}`, name: req.body?.name || 'Imported', isDefault: false, blob: req.body?.blob || {}, createdAt: Date.now(), updatedAt: Date.now() };
            const presets = this.storage.readPresets();
            presets.push(newPreset);
            this.storage.writePresets(presets);
            res.status(201).json({ preset: newPreset });
        });

        router.post(API_ROUTES.PRESETS.RESTORE_DEFAULTS, (req: Request, res: Response) => {
            const nonDefault = this.storage.readPresets().filter(p => !p.isDefault);
            this.storage.writePresets(nonDefault); // 重新读取会自动注入种子
            res.json({ success: true });
        });

        router.post(API_ROUTES.PROMPT.COMPILE, (req: Request, res: Response) => {
            const preset = this.storage.readPresets().find(p => p.id === req.body.presetId);
            if (!preset) return res.status(404).json({ error: 'Preset not found' });
            res.json(this.nexus.compilePromptFromPreset(preset.blob, req.body.messages));
        });

        // --- 聊天与同步 (Critical Fix) ---
        router.get(API_ROUTES.CHAT.LIST, (req: Request, res: Response) => {
            res.json({ chats: this.storage.listChats() });
        });

        router.get('/chat/:chatId', (req: Request, res: Response) => {
            const data = this.storage.readChat(String(req.params.chatId));
            data.length > 0 ? res.json(data) : res.status(404).json({ error: 'Chat not found' });
        });

        router.get('/chat/:chatId/sync-status', (req: Request, res: Response) => {
            res.json({ success: true, isTransactionsCompleted: this.storage.isAllTransactionsCompleted(String(req.params.chatId)) });
        });

        router.get('/chat/:chatId/transactions', (req: Request, res: Response) => {
            const records = this.storage.readTransactionLog(String(req.params.chatId));
            res.json({ success: true, transactions: records });
        });

        router.post('/chat/:chatId/transactions/:transactionId/rollback', (req: Request, res: Response) => {
            const chatId = String(req.params.chatId);
            const transactionId = String(req.params.transactionId);
            try {
                // Not perfectly aligned with backend storage rollback since it requires more complex logic.
                // Fallback to simpler error returning if rollback fails.
                const rolledBack = this.storage.transitionTransaction(chatId, { id: transactionId } as any, 'aborted');
                res.status(200).json({ success: true, transaction: rolledBack });
            } catch (error: any) {
                if (error?.message === 'transaction_not_found') {
                    return res.status(404).json({ success: false, error: 'Transaction not found' });
                }
                return res.status(409).json({ success: false, error: 'Rollback failed' });
            }
        });

        router.post('/chat/save/:chatId', (req: Request, res: Response) => {
            const chatId = String(req.params.chatId);
            const payload = Array.isArray(req.body?.data) ? req.body.data : (Array.isArray(req.body) ? req.body : []);
            const records = this.storage.readTransactionLog(chatId);
            const digest = this.storage.digestPayload(payload);
            const tx = this.storage.createTransaction(chatId, 'chat.save', digest, `save_${Date.now()}`, this.storage.getLastCommittedSeq(records) + 1);
            
            this.storage.writeChat(chatId, payload);
            const committedTx = this.storage.transitionTransaction(chatId, tx, 'committed');
            res.json({ success: true, transaction: committedTx });
        });

        router.patch('/chat/:chatId', (req: Request, res: Response) => {
            const chatId = String(req.params.chatId);
            let data = this.storage.readChat(chatId);
            const { added, updated, deletedIds } = req.body;
            
            if (deletedIds) {
                const deleteSet = new Set(deletedIds);
                data = data.filter(item => item.type === 'metadata' || !deleteSet.has(item.id));
            }
            if (updated) {
                const updateMap = new Map(updated.map((u: any) => [u.id, u]));
                data = data.map(item => item.type !== 'metadata' && updateMap.has(item.id) ? { ...item, ...(updateMap.get(item.id)!) } : item);
            }
            if (added) data.push(...added);

            this.storage.writeChat(chatId, data);
            res.json({ success: true, count: data.length });
        });

        // --- Forge 工作会话持久化 ---
        router.get(API_ROUTES.FORGE.LIST, (req: Request, res: Response) => {
            res.json({ sessions: this.storage.listForgeSessions() });
        });

        router.get('/forge/sessions/:sessionId', (req: Request, res: Response) => {
            const session = this.storage.getForgeSession(String(req.params.sessionId));
            session ? res.json({ session }) : res.status(404).json({ error: 'Forge session not found' });
        });

        router.post(API_ROUTES.FORGE.SAVE, (req: Request, res: Response) => {
            const session = req.body as ForgeSessionRecord;
            if (!session?.id) {
                return res.status(400).json({ error: 'Missing forge session id' });
            }
            this.storage.saveForgeSession(session);
            res.status(201).json({ session });
        });

        router.put('/forge/sessions/:sessionId', (req: Request, res: Response) => {
            const session = req.body as ForgeSessionRecord;
            if (!session?.id || session.id !== String(req.params.sessionId)) {
                return res.status(400).json({ error: 'Forge session id mismatch' });
            }
            this.storage.saveForgeSession(session);
            res.json({ session });
        });

        // --- Nexus 生成核心 (Parity with index.ts.bak) ---
        router.get('/nexus/models/:providerId', async (req: Request, res: Response) => {
            const dataDir = path.join(process.cwd(), 'plugins/luminaweave/data');
            const config = JSON.parse(fs.readFileSync(path.join(dataDir, 'LuminaWeave.json'), 'utf8'));
            const api = (config['nexus.apis'] || []).find((a: any) => a.id === String(req.params.providerId));
            if (!api) return res.status(404).json({ error: 'Provider not found' });
            res.json({ models: await this.nexus.listModelsForProvider(api) });
        });

        router.post(API_ROUTES.NEXUS.GENERATE, async (req: Request, res: Response) => {
            // 异步生成逻辑（非 SSE 版本），立即返回 200
            const { chatId, messages } = req.body;
            res.json({ success: true });
            this._runNexusGeneration(String(chatId), messages, req.body);
        });

        // SSE 流式生成接口 (核心通道)
        router.post(API_ROUTES.NEXUS.GENERATE_SSE, async (req: Request, res: Response) => {
            const chatId = String(req.body.chatId);
            Logger.info('Nexus', `收到 SSE 生成请求 [Chat: ${chatId}]`);
            
            if (this.streaming.getState(chatId).isGenerating) {
                Logger.warn('Nexus', `[Chat: ${chatId}] 已在生成中，拒绝请求`);
                return res.status(409).send('Already generating');
            }

            // 设置 SSE 响应头（加固版：直发头部并允许跨域）
            res.writeHead(200, {
                'Content-Type': 'text/event-stream; charset=utf-8',
                'Cache-Control': 'no-cache, no-transform',
                'Connection': 'keep-alive',
                'X-Accel-Buffering': 'no',
                'X-Content-Type-Options': 'nosniff',
                'Access-Control-Allow-Origin': '*',
                'x-no-compression': '1'
            });
            (res as any).flushHeaders?.();

            // 禁用 Nagle 算法以降低物理延迟
            res.socket?.setNoDelay(true);

            // 发送 Padding 确保某些中间件立即刷新 (标准格式 ": comment\n\n")
            res.write(': padding' + ' '.repeat(1024) + '\n\n');
            res.write(': ping\n\n');
            if ((res as any).flush) (res as any).flush();

            // 监听连接关闭（仅用于连接维护，不再中止生成以便支持后端补录）
            const controller = new AbortController();
            res.on('close', () => {
                Logger.info('Nexus', `[Chat: ${chatId}] 客户端 SSE 连接已断开 (生成将在后台持续进行)`);
            });

            this.addSseConnection(chatId, res);
            try {
                // 将 controller 传入生成逻辑
                await this._runNexusGeneration(chatId, req.body.messages, req.body, res, controller);
            } finally {
                if (!res.writableEnded) res.end();
            }
        });

        // 非流式生成接口 (全量返回，兼容 Polling 模式)
        router.post(API_ROUTES.NEXUS.GENERATE, async (req: Request, res: Response) => {
            const chatId = String(req.body.chatId);
            if (!chatId) {
                return res.status(400).json({ error: 'Missing chatId' });
            }

            Logger.info('Nexus', `[Chat: ${chatId}] 收到非流式生成请求，进入生成循环...`);
            const controller = new AbortController();
            
            try {
                // 执行生成逻辑，注意这里不传递 res 给 _runNexusGeneration，防止其尝试直接写入 res
                // 而是让其通过 broadcastSse 广播，并在结束后由本路由统一返回结果
                await this._runNexusGeneration(chatId, req.body.messages, req.body, undefined, controller);
                
                const status = this.streaming.getState(chatId);
                res.json({
                    status: 'success',
                    fullText: status?.rawBuffer || '',
                    activeLeafId: status?.activeLeafId
                });
            } catch (err: any) {
                Logger.error('Nexus', `非流式生成失败: ${err.message}`);
                res.status(500).json({ error: err.message });
            }
        });

        router.get('/nexus/stream/:chatId', (req: Request, res: Response) => {
            const chatId = String(req.params.chatId);
            const gid = String(req.query.gid || '');
            const from = parseInt(String(req.query.from || '0'), 10);
            
            Logger.info('Nexus', `收到 SSE 状态流监听请求 [Chat: ${chatId}] [GID: ${gid}] [From: ${from}]`);
            const state = this.streaming.getState(chatId);
            res.setHeader('Content-Type', 'text/event-stream');
            res.setHeader('Cache-Control', 'no-cache');
            res.setHeader('Connection', 'keep-alive');
            res.setHeader('X-Accel-Buffering', 'no');
            res.setHeader('X-Content-Type-Options', 'nosniff');
            res.flushHeaders();
            
            res.socket?.setNoDelay(true);
            res.write(': padding' + ' '.repeat(4096) + '\n\n');
            res.write(': ping\n\n');
            if ((res as any).flush) (res as any).flush();

            // 增量补推 (Catch-up) 逻辑
            if (gid && gid === state.generationId && from >= 0 && state.isGenerating) {
                const currentBuffer = state.rawBuffer || '';
                if (currentBuffer.length > from) {
                    const catchupDelta = currentBuffer.substring(from);
                    Logger.info('Nexus', `[Chat: ${chatId}] 执行增量补推 (长度: ${catchupDelta.length})`);
                    this.writeSseEvent(res, 'delta', { delta: catchupDelta });
                }
            }

            this.addSseConnection(chatId, res);
            this.writeSseEvent(res, 'ready', { chatId, isGenerating: state.isGenerating, generationId: state.generationId });
        });

        router.get('/nexus/status/:chatId', (req: Request, res: Response) => {
            const chatId = String(req.params.chatId);
            const state = this.streaming.getState(chatId);
            res.json({
                isGenerating: state.isGenerating,
                generationId: state.generationId,
                buffer: state.buffer,
                rawBuffer: state.rawBuffer,
                status: state.status,
                errorMessage: state.errorMessage,
                lastTransactionId: state.lastTransactionId
            });
        });

        router.post('/nexus/stop/:chatId', (req: Request, res: Response) => {
            const chatId = String(req.params.chatId);
            const controller = this.abortControllers.get(chatId);
            
            if (controller) {
                Logger.info('Nexus', `[Chat: ${chatId}] 收到外部中止请求，正在执行中止...`);
                controller.abort();
                this.abortControllers.delete(chatId);
                
                // 标记 StreamingManager 状态
                this.streaming.setGenerating(chatId, false, 'aborted', '用户已停止生成');
                this.broadcastSse(chatId, 'done', { status: 'aborted', errorMessage: '用户已停止生成' });
                
                res.status(200).json({ success: true, message: 'Generation stopped' });
            } else {
                // 如果当前没有正在生成的任务，检查一下 StreamingManager
                const state = this.streaming.getState(chatId);
                if (state.isGenerating) {
                    this.streaming.setGenerating(chatId, false, 'aborted');
                    res.status(200).json({ success: true, message: 'Generation flags cleared' });
                } else {
                    res.status(200).json({ success: true, message: 'No active generation to stop' });
                }
            }
        });
    }

    private async _runNexusGeneration(chatId: string, messages: any, params: any, res?: Response, externalController?: AbortController) {
        const controller = externalController || new AbortController();
        this.abortControllers.set(chatId, controller);
        this.streaming.setGenerating(chatId, true, 'running');

        try {
            const nodes = params.nodes || [{ provider: 'st_current_compatibility', model: 'gpt-4o' }];
            let fullText = '';

            const configPath = path.join(process.cwd(), 'plugins/luminaweave/data/LuminaWeave.json');
            const config = fs.existsSync(configPath) ? JSON.parse(fs.readFileSync(configPath, 'utf8')) : {};
            const apis = config['nexus.apis'] || [];

            const rawSettings = { ...(params.settings || {}) };
            const mappedSettings = mapSTSettingsToAISdk(rawSettings);
            const modelMessages = this.nexus.toModelMessages(messages);

            const policy = {
                filterChatReply: config['nexus.onlyChatReply'] ?? false,
                allowTopLevel: config['nexus.allowTopLevel'] ?? true,
                implicitThinking: config['nexus.implicitThinking'] ?? false,
                aggressiveThinking: config['nexus.aggressiveThinking'] ?? false
            };

            const flow = new NexusGenerationFlow(
                {
                    chatId,
                    parentId: params.parentId || null,
                    charName: params.charName || 'Assistant',
                    characterId: params.characterId,
                    policy
                },
                this.interceptor,
                {
                    appendChatRecord: async (cid, node) => {
                        this.storage.appendChatRecord(cid, node);
                    },
                    updateChatMetadata: async (cid, metadata) => {
                        this.storage.updateChatMetadata(cid, metadata);
                    },
                    commitTransaction: async (cid, scope, payload, idempotencyKey) => {
                        const chatData = this.storage.readChat(cid);
                        const tx = this.storage.createTransaction(cid, scope as any, this.storage.digestPayload(payload), idempotencyKey, chatData.length);
                        this.storage.transitionTransaction(cid, tx, 'committed');
                        return { id: tx.id, seq: tx.seq };
                    }
                }
            );

            Logger.info('Nexus', `[Chat: ${chatId}] 收到生成请求`);
            
            for (const node of nodes) {
                try {
                    const api = (apis as NexusApiConfig[]).find(a => a.id === node.provider) || null;
                    const model = this.nexus.getModelForNode(node, api);
                    Logger.info('Nexus', `[Chat: ${chatId}] 唤起模型: ${node.model} (${node.provider})`);
                    
                    const result = await streamText({ 
                        model, 
                        messages: modelMessages, 
                        abortSignal: controller.signal, 
                        ...mappedSettings
                    });

                    Logger.info('Nexus', `[Chat: ${chatId}] 模型流已建立，等待首帧...`);
                    let chunkCount = 0;

                    for await (const delta of result.textStream) {
                        if (controller.signal.aborted) {
                            Logger.info('Nexus', `[Chat: ${chatId}] 检测到中断信号，退出流循环`);
                            return;
                        }
                        chunkCount++;
                        fullText += delta;
                        flow.pushToken(delta);
                        
                        this.streaming.updateBuffer(chatId, fullText, true, fullText);
                        this.broadcastSse(chatId, 'delta', { delta });
                        
                        if (chunkCount % 50 === 0) {
                            Logger.info('Nexus', `[Chat: ${chatId}] 正在流式输出... (已接收 ${chunkCount} chunks)`);
                        }
                    }

                    if (chunkCount === 0) {
                        Logger.warn('Nexus', `[Chat: ${chatId}] 模型流结束但未收到任何有效的 TextStream 数据`);
                    }

                    // 使用共享 Flow 完成最终构建与持久化
                    const newNode = await flow.finalize();
                    this.storage.syncToDisk();

                    const txMetadata = newNode.extra.transactionId as { id: string, seq: number };
                    
                    this.broadcastSse(chatId, 'committed', { 
                        lastTransactionId: txMetadata.id, 
                        activeLeafId: newNode.id,
                        node: newNode,
                        seq: txMetadata.seq
                    });

                    this.streaming.setGenerating(chatId, false, 'success', null, txMetadata.id, undefined, newNode.id);
                    this.broadcastSse(chatId, 'done', { 
                        status: 'success', 
                        lastTransactionId: txMetadata.id, 
                        activeLeafId: newNode.id, 
                        fullText,
                        node: newNode,
                        seq: txMetadata.seq,
                        generationId: this.streaming.getState(chatId).generationId
                    });
                    
                    return; // 成功后直接返回，不进入下一个 node 兜底
                } catch (e: any) {
                    Logger.warn('Nexus', `Fallback: Node ${node.model} failed`, { error: e.message });
                }
            }
            throw new Error('All nodes failed');
        } catch (err: any) {
            this.streaming.setGenerating(chatId, false, 'error', err.message);
            this.broadcastSse(chatId, 'done', { status: 'error', errorMessage: err.message });
        } finally {
            this.abortControllers.delete(chatId);
            if (res) this.removeSseConnection(chatId, res);
        }
    }

    private addSseConnection(chatId: string, res: Response) {
        if (!this.sseConnections.has(chatId)) this.sseConnections.set(chatId, new Set());
        const set = this.sseConnections.get(chatId)!;
        set.add(res);
        Logger.info('Nexus', `[Chat: ${chatId}] SSE 客户端加入，当前连接数: ${set.size}`);
    }

    private removeSseConnection(chatId: string, res: Response) {
        const set = this.sseConnections.get(chatId);
        if (set) {
            set.delete(res);
            Logger.info('Nexus', `[Chat: ${chatId}] SSE 客户端退出，剩余连接数: ${set.size}`);
        }
    }

    private broadcastSse(chatId: string, event: string, data: any) {
        const set = this.sseConnections.get(chatId);
        if (set) set.forEach(res => this.writeSseEvent(res, event, data));
    }

    private writeSseEvent(res: Response, event: string, data: any) {
        if (!res.writable || res.writableEnded) return;
        
        try {
            res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
            if ((res as any).flush) {
                (res as any).flush();
            }
        } catch (e) {
            Logger.warn('Nexus', `写入 SSE 事件失败: ${e}`);
        }
    }
}

const server = new LuminaWeaveServer(path.join(process.cwd(), 'plugins/luminaweave/data'));

export const info = {
    id: 'luminaweave',
    name: 'LuminaStatus Server Storage',
    description: 'Dedicated backend for LuminaWeave'
};

export const init = (router: Router) => {
    server.init(router);
};
