import { describe, it, expect, vi, beforeEach } from 'vitest';
import { STClient } from '../core/st-adapter/STClient.js';
import { NexusClient } from '../core/NexusClient.js';

describe('STClient CSRF Logic', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        // 彻底重置 STClient 静态状态
        (STClient as any)._csrfToken = null;
        (STClient as any)._csrfTime = 0;
        (STClient as any)._fetchPromise = null;
        global.fetch = vi.fn();
    });

    it('当 CSRF Token 获取超时 (5s) 时应该抛出异常', async () => {
        // 模拟 fetch 让 /csrf-token 挂起
        (global.fetch as any).mockImplementation((url: string, options: any) => {
            if (url === '/csrf-token') {
                return new Promise((_, reject) => {
                    if (options?.signal) {
                        const onAbort = () => {
                            const err = new Error('The operation was aborted');
                            err.name = 'AbortError';
                            reject(err);
                        };
                        if (options.signal.aborted) onAbort();
                        else options.signal.addEventListener('abort', onAbort, { once: true });
                    }
                });
            }
            return Promise.resolve({ ok: true, json: async () => ({}) });
        });

        vi.useFakeTimers();
        
        let thrownError: any = null;
        const promise = STClient.getCsrfToken().catch(e => {
            thrownError = e;
        });

        // 推进时间 6 秒触发超时
        await vi.advanceTimersByTimeAsync(6000);

        // 等待 Promise 状态更新完成
        await promise;

        expect(thrownError).toBeDefined();
        expect(thrownError.name).toBe('AbortError');
        
        vi.useRealTimers();
    });

    it('当多个请求并发时，应该只发起一次 CSRF 获取', async () => {
        (global.fetch as any).mockImplementation(() => 
            new Promise(resolve => setTimeout(() => resolve({
                ok: true,
                status: 200,
                json: async () => ({ token: 'new-token' })
            }), 100))
        );

        // 同时发起两个请求
        const [t1, t2] = await Promise.all([
            STClient.getCsrfToken(),
            STClient.getCsrfToken()
        ]);

        expect(t1).toBe('new-token');
        expect(t2).toBe('new-token');
        expect(global.fetch).toHaveBeenCalledTimes(1);
    });

    it('应该正确识别并清理重复的 CSRF Token 请求 Promise', async () => {
        (global.fetch as any).mockResolvedValueOnce({
            ok: true,
            json: async () => ({ token: 'token-1' })
        });

        const t1 = await STClient.getCsrfToken();
        expect(t1).toBe('token-1');
        expect((STClient as any)._fetchPromise).toBeNull();

        (global.fetch as any).mockResolvedValueOnce({
            ok: true,
            json: async () => ({ token: 'token-2' })
        });
        
        // 模拟过期
        (STClient as any)._csrfTime = 0;
        const t2 = await STClient.getCsrfToken();
        expect(t2).toBe('token-2');
    });
});
