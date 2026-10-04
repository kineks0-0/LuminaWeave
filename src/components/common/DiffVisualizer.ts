import { MessageUtils, type LuminaChatMessage } from '@shared/LuminaMessage.js';
import type { DiffResult } from '@shared/api/SyncEngine.js';

export interface DiffRow {
    index: number;
    leftLine: string;
    rightLine: string;
    leftSign: string;
    rightSign: string;
    leftText: string;
    rightText: string;
    leftClass: string;
    rightClass: string;
}

/**
 * 差异可视化工具（纯展示计算，不依赖宿主实现层）
 */
export class DiffVisualizer {
    public static generateDiffRows(diffResult: DiffResult): DiffRow[] {
        const rows: DiffRow[] = [];
        const maxLen = Math.max(diffResult.independentSequence.length, diffResult.stSequence.length);
        let leftLineNo = 1;
        let rightLineNo = 1;

        for (let i = 0; i < maxLen; i++) {
            const left = diffResult.independentSequence[i] as Partial<LuminaChatMessage> | undefined;
            const right = diffResult.stSequence[i] as Partial<LuminaChatMessage> | undefined;
            const leftExists = !!left;
            const rightExists = !!right;

            const leftText = leftExists ? (left.mes ?? '') : '';
            const rightText = rightExists ? (right.mes ?? '') : '';

            const isHiddenEqual = leftExists && rightExists && (!!left.is_hidden === !!right.is_hidden);
            const isNameEqual = leftExists && rightExists && MessageUtils.normalize(left.name ?? '') === MessageUtils.normalize(right.name ?? '');
            const isRoleEqual = leftExists && rightExists && MessageUtils.normalize(left.role ?? '') === MessageUtils.normalize(right.role ?? '');

            const leftStFp = leftExists
                ? (typeof left.stFingerprint === 'string' && left.stFingerprint ? left.stFingerprint : MessageUtils.getFingerprint(String(leftText)))
                : '';
            const rightStFp = rightExists
                ? (typeof right.stFingerprint === 'string' && right.stFingerprint ? right.stFingerprint : MessageUtils.getFingerprint(String(rightText)))
                : '';

            const isSame = leftExists && rightExists && isHiddenEqual && isNameEqual && isRoleEqual && leftStFp === rightStFp;
            const isModified = leftExists && rightExists && !isSame;
            const onlyLocal = leftExists && !rightExists;
            const onlySt = !leftExists && rightExists;

            rows.push({
                index: i,
                leftLine: leftExists ? String(leftLineNo++) : '',
                rightLine: rightExists ? String(rightLineNo++) : '',
                leftSign: isSame ? ' ' : onlyLocal || isModified ? '+' : ' ',
                rightSign: isSame ? ' ' : onlySt || isModified ? '+' : ' ',
                leftText,
                rightText,
                leftClass: onlyLocal ? 'is-add' : isModified ? 'is-mod' : leftExists ? 'is-same' : 'is-empty',
                rightClass: onlySt ? 'is-add' : isModified ? 'is-mod' : rightExists ? 'is-same' : 'is-empty'
            });
        }
        return rows;
    }
}
