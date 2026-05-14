import { STClient } from '../../../host-drivers/st/STClient.js';
import type { ITokenCounter } from '../../interfaces.js';

export class STTokenCounter implements ITokenCounter {
    async count(text: string): Promise<number> {
        return STClient.getTokenCount(text);
    }
}
