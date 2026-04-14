import { describe, it, expect, beforeEach, vi } from 'vitest';
import { StorageService } from '../StorageService.js';
import fs from 'fs';
import path from 'path';

describe('StorageService', () => {
    let storage: StorageService;
    const testDir = path.join(process.cwd(), 'tmp/test_data_metadata');

    beforeEach(() => {
        if (fs.existsSync(testDir)) {
            fs.rmSync(testDir, { recursive: true, force: true });
        }
        storage = new StorageService(testDir);
    });

    it('should update metadata correctly when it exists', () => {
        const chatId = 'test_chat_1';
        const initialData = [
            { type: 'metadata', activeLeafId: 'old_leaf', version: 1 },
            { id: 'msg1', role: 'user', content: 'hello' }
        ];
        
        // Mock readChat to return initial data
        vi.spyOn(storage, 'readChat').mockReturnValue(initialData);
        
        storage.updateChatMetadata(chatId, { activeLeafId: 'new_leaf' });
        
        const updatedData = storage.readChat(chatId);
        expect(updatedData[0].activeLeafId).toBe('new_leaf');
        expect(updatedData[0].updatedAt).toBeDefined();
        // @ts-ignore
        expect(storage.dirtyChats.has(chatId)).toBe(true);
    });

    it('should create metadata when it does not exist', () => {
        const chatId = 'test_chat_2';
        const initialData = [
            { id: 'msg1', role: 'user', content: 'hello' }
        ];
        
        vi.spyOn(storage, 'readChat').mockReturnValue(initialData);
        
        storage.updateChatMetadata(chatId, { activeLeafId: 'new_leaf' });
        
        const updatedData = storage.readChat(chatId);
        expect(updatedData[0].type).toBe('metadata');
        expect(updatedData[0].activeLeafId).toBe('new_leaf');
        expect(updatedData.length).toBe(2);
    });
});
