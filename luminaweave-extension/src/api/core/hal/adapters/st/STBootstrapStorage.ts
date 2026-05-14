import { IBootstrapStorage } from '../../interfaces.js';

/**
 * SillyTavern 宿主的引导存储实现
 * 使用 localStorage 作为同步存储媒介
 */
export class STBootstrapStorage implements IBootstrapStorage {
    getItem(key: string): string | null {
        try {
            return localStorage.getItem(`lw_bootstrap_${key}`);
        } catch {
            return null;
        }
    }

    setItem(key: string, value: string): void {
        try {
            localStorage.setItem(`lw_bootstrap_${key}`, value);
        } catch {
            // Ignore quota errors in bootstrap
        }
    }

    getJson<T>(key: string): T | null {
        const val = this.getItem(key);
        if (!val) return null;
        try {
            return JSON.parse(val) as T;
        } catch {
            return null;
        }
    }

    setJson<T>(key: string, value: T): void {
        this.setItem(key, JSON.stringify(value));
    }
}
