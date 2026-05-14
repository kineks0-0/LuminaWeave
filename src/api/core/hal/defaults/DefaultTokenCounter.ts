import type { ITokenCounter } from '../interfaces.js';

export class DefaultTokenCounter implements ITokenCounter {
    async count(text: string): Promise<number> {
        return text.length;
    }
}
