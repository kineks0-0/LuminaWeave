export type AsyncEventHandler<T> = (payload: T) => Promise<void> | void;

/**
 * 跨端/跨层通信的事件异步放行流 (可类比 Kotlin 简易版 Flow)
 */
export class EventFlow<T = void> {
    private listeners: AsyncEventHandler<T>[] = [];

    /**
     * 注册监听器进行消费挂载
     * @returns 一个解除监听的清理函数
     */
    public collect(handler: AsyncEventHandler<T>): () => void {
        this.listeners.push(handler);
        return () => {
            this.listeners = this.listeners.filter(h => h !== handler);
        };
    }

    /**
     * 分发载荷并强阻塞等待该流程上下文内挂载的所有处理程序共同执行完毕。
     * 可避免使用类似 setTimeout 的 Hack 处理时间差。
     */
    public async emit(payload: T): Promise<void> {
        if (this.listeners.length === 0) return;
        
        // 并发等待所有的消费者执行完毕
        const promises = this.listeners.map(handler => {
            try {
                const res = handler(payload);
                if (res instanceof Promise) {
                    return res;
                }
                return Promise.resolve();
            } catch (error) {
                console.error('[EventFlow] Handler 同步执行报错:', error);
                // 确保一处报错不彻底阻断流向（可依据业务调整是否向外 throw）
                return Promise.resolve();
            }
        });

        await Promise.allSettled(promises).then(results => {
            results.forEach(res => {
                if (res.status === 'rejected') {
                    console.error('[EventFlow] 异步消费者执行抛出异常:', res.reason);
                }
            });
        });
    }
}
