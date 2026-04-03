import type { AnswerKind } from '../types/appTypes';

export type TileTargetType = 'answer' | 'quotient' | 'remainder';
export type FeedbackKindType = 'correct' | 'wrong' | 'timeout' | null;

export function validateTileAnswer (
    answerKind: AnswerKind,
    answerValue: string,
    quotientValue: string
): { ok: boolean; message: string } {
    if (answerKind === 'quotientRemainder') {
        if (quotientValue.trim().length <= 0) {
            return {
                ok: false,
                message: '商を入力してください。',
            };
        }

        return {
            ok: true,
            message: '',
        };
    }

    if (answerValue.trim().length <= 0) {
        return {
            ok: false,
            message: '答えを入力してください。',
        };
    }

    return {
        ok: true,
        message: '',
    };
}

export function buildTileUserInput (
    answerKind: AnswerKind,
    answerValue: string,
    quotientValue: string,
    remainderValue: string
): string {
    if (answerKind === 'quotientRemainder') {
        const normalizedQuotient = quotientValue.trim();
        const normalizedRemainder = (
            remainderValue.trim().length > 0
                ? remainderValue.trim()
                : '0'
        );

        return `${normalizedQuotient} ${normalizedRemainder}`.trim();
    }

    return answerValue.trim();
}
