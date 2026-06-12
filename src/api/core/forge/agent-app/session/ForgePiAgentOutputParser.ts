export type ForgePiAgentOutputBlockTag = 'process' | 'final';

export type ForgePiAgentOutputDiagnosticCode =
    | 'text_outside_block'
    | 'unexpected_closing_block'
    | 'mismatched_closing_block'
    | 'nested_block'
    | 'unclosed_block';

export interface ForgePiAgentOutputDiagnostic {
    code: ForgePiAgentOutputDiagnosticCode;
    tag?: ForgePiAgentOutputBlockTag;
    expectedTag?: ForgePiAgentOutputBlockTag;
    text?: string;
}

export interface ForgePiParsedAgentOutput {
    rawText: string;
    processBlocks: string[];
    finalText: string;
    diagnostics: ForgePiAgentOutputDiagnostic[];
}

export interface ForgePiStreamingAgentOutputProjection {
    rawText: string;
    processText: string;
    finalText: string;
    diagnostics: ForgePiAgentOutputDiagnostic[];
}

interface BlockState {
    tag: ForgePiAgentOutputBlockTag;
    text: string;
}

const TAG_PATTERN = /<\/?(process|final)>/g;

export const parseForgePiAgentOutput = (rawText: string): ForgePiParsedAgentOutput => {
    const state = scanForgePiAgentOutput(rawText, false);
    return {
        rawText,
        processBlocks: state.processBlocks,
        finalText: state.finalBlocks.join('\n\n'),
        diagnostics: state.diagnostics
    };
};

export const projectForgePiStreamingOutput = (rawText: string): ForgePiStreamingAgentOutputProjection => {
    const state = scanForgePiAgentOutput(rawText, true);
    return {
        rawText,
        processText: state.processBlocks.join('\n\n'),
        finalText: state.finalBlocks.join('\n\n'),
        diagnostics: state.diagnostics
    };
};

const scanForgePiAgentOutput = (
    rawText: string,
    includeOpenBlock: boolean
): {
    processBlocks: string[];
    finalBlocks: string[];
    diagnostics: ForgePiAgentOutputDiagnostic[];
} => {
    const processBlocks: string[] = [];
    const finalBlocks: string[] = [];
    const diagnostics: ForgePiAgentOutputDiagnostic[] = [];
    let block: BlockState | null = null;
    let cursor = 0;

    for (const match of rawText.matchAll(TAG_PATTERN)) {
        const index = match.index ?? 0;
        const leadingText = rawText.slice(cursor, index);
        if (block) {
            block.text += leadingText;
        } else {
            recordOutsideText(leadingText, diagnostics);
        }

        const token = match[0];
        const tag = match[1] as ForgePiAgentOutputBlockTag;
        const isClosing = token.startsWith('</');
        if (isClosing) {
            if (!block) {
                diagnostics.push({ code: 'unexpected_closing_block', tag });
            } else if (block.tag !== tag) {
                diagnostics.push({
                    code: 'mismatched_closing_block',
                    tag,
                    expectedTag: block.tag
                });
            } else {
                pushBlock(block, processBlocks, finalBlocks);
                block = null;
            }
        } else if (block) {
            diagnostics.push({ code: 'nested_block', tag });
            block.text += token;
        } else {
            block = { tag, text: '' };
        }

        cursor = index + token.length;
    }

    const trailingText = rawText.slice(cursor);
    if (block) {
        block.text += trailingText;
        if (includeOpenBlock) {
            pushBlock(block, processBlocks, finalBlocks);
        } else {
            diagnostics.push({ code: 'unclosed_block', tag: block.tag });
        }
    } else {
        recordOutsideText(trailingText, diagnostics);
    }

    return { processBlocks, finalBlocks, diagnostics };
};

const pushBlock = (
    block: BlockState,
    processBlocks: string[],
    finalBlocks: string[]
): void => {
    const text = block.text.trim();
    if (!text) return;
    if (block.tag === 'process') {
        processBlocks.push(text);
    } else {
        finalBlocks.push(text);
    }
};

const recordOutsideText = (
    text: string,
    diagnostics: ForgePiAgentOutputDiagnostic[]
): void => {
    const trimmed = text.trim();
    if (!trimmed) return;
    diagnostics.push({
        code: 'text_outside_block',
        text: trimmed
    });
};
