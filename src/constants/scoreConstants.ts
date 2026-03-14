import type { CourseType } from '../types/appTypes';

export const SCORE_CONSTANTS = {
    difficulty: {
        baseScore: 100,
        perExtraTermBonus: 12,
        operationBonus: {
            add: 0,
            sub: 8,
            mul: 24,
            div: 30,
        } as Record<CourseType, number>,
        mixedOperationBaseBonus: 18,
        mixedOperationExtraOperatorBonus: 6,
        decimalBonus: 18,
        negativeOperandBonus: 10,
        negativeResultBonus: 8,
        maxDigitBonusPerExtraDigit: 7,
        carryBorrowBonus: 12,
        parenthesesBonus: 12,
        priorityBonus: 12,
        remainderBonus: 10,
        realDivisionBonus: 14,
        minScore: 80,
        maxScore: 260,
    },
    expectedTime: {
        baseMs: 1200,
        perDifficultyPointMs: 22,
        minMs: 1800,
        maxMs: 15000,
    },
    speed: {
        exponent: 0.55,
        minActualMs: 250,
        minFactor: 0.55,
        maxFactor: 1.35,
    },
    timeLimit: {
        noLimitFactor: 1.0,
        limitedBaseFactor: 1.02,
        pressureSlope: 0.08,
        minFactor: 1.02,
        maxFactor: 1.12,
    },
    ranking: {
        minEligibleQuestionCount: 10,
        countBonusPerSqrtStep: 0.01,
        maxQuestionCountBonusFactor: 1.08,
        baseQuestionCountBonusFactor: 1.0,
    },
};