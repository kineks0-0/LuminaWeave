import { describe, expect, it, vi } from 'vitest';
import { ForgeFormSubmissionController } from '../store/ForgeFormSubmissionController.js';

describe('ForgeFormSubmissionController', () => {
    it('submits transient selections as user input for non-structured scopes', async () => {
        const addUserViewMessage = vi.fn();
        const dispatchWorkspaceCommand = vi.fn().mockResolvedValue({});
        const clearTransientSelections = vi.fn();
        const markScopeSubmitted = vi.fn();
        const controller = new ForgeFormSubmissionController({
            hasStructuredForm: () => false,
            buildSubmittedFormUserInput: vi.fn(),
            getTransientSelections: () => new Map<string, string | string[]>([
                ['风格', '冷峻'],
                ['关键词', ['雪', '钟楼']]
            ]),
            addUserViewMessage,
            dispatchWorkspaceCommand,
            clearTransientSelections,
            markScopeSubmitted,
            setLastError: vi.fn(),
            showToast: vi.fn(),
            logger: { log: vi.fn(), warn: vi.fn(), error: vi.fn() }
        });

        await controller.submitStructuredForm('scope-1');

        expect(addUserViewMessage).toHaveBeenCalledWith('【用户选择与意图收集】:\n风格: 冷峻\n关键词: 雪、钟楼');
        expect(dispatchWorkspaceCommand).toHaveBeenCalledWith({
            type: 'submit_form',
            formId: 'scope-1',
            userInput: '风格: 冷峻\n关键词: 雪、钟楼'
        });
        expect(clearTransientSelections).toHaveBeenCalledWith('scope-1');
        expect(markScopeSubmitted).toHaveBeenCalledWith('scope-1');
    });

    it('submits structured form xml without transient scope cleanup', async () => {
        const dispatchWorkspaceCommand = vi.fn().mockResolvedValue({});
        const clearTransientSelections = vi.fn();
        const controller = new ForgeFormSubmissionController({
            hasStructuredForm: () => true,
            buildSubmittedFormUserInput: () => '<forge_form_result />',
            getTransientSelections: vi.fn(),
            addUserViewMessage: vi.fn(),
            dispatchWorkspaceCommand,
            clearTransientSelections,
            markScopeSubmitted: vi.fn(),
            setLastError: vi.fn(),
            showToast: vi.fn(),
            logger: { log: vi.fn(), warn: vi.fn(), error: vi.fn() }
        });

        await controller.submitStructuredForm('form-1');

        expect(dispatchWorkspaceCommand).toHaveBeenCalledWith({
            type: 'submit_form',
            formId: 'form-1',
            userInput: '<forge_form_result />'
        });
        expect(clearTransientSelections).not.toHaveBeenCalled();
    });

    it('does not dispatch when no structured or transient input exists', async () => {
        const dispatchWorkspaceCommand = vi.fn();
        const warn = vi.fn();
        const controller = new ForgeFormSubmissionController({
            hasStructuredForm: () => false,
            buildSubmittedFormUserInput: vi.fn(),
            getTransientSelections: () => new Map(),
            addUserViewMessage: vi.fn(),
            dispatchWorkspaceCommand,
            clearTransientSelections: vi.fn(),
            markScopeSubmitted: vi.fn(),
            setLastError: vi.fn(),
            showToast: vi.fn(),
            logger: { log: vi.fn(), warn, error: vi.fn() }
        });

        await controller.submitStructuredForm('empty-scope');

        expect(dispatchWorkspaceCommand).not.toHaveBeenCalled();
        expect(warn).toHaveBeenCalledWith('[Forge-Store] 提交中止：没有任何有效数据。');
    });
});
