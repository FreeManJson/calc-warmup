import { SCORE_CONSTANTS } from '../constants/scoreConstants';
import type {
    AnswerResult,
    DifficultyComponentBreakdown,
    GeneratedQuestion,
    QuestionDifficultyInput,
    QuestionScoreDetail,
    QuizResult,
    QuizSettings,
    RankingEntry,
} from '../types/appTypes';
import { getCourseLabelText } from './quizUtils';

export function calculateDifficultyBreakdown (
    input: QuestionDifficultyInput
): DifficultyComponentBreakdown {
    const baseScore = SCORE_CONSTANTS.difficulty.baseScore;
    const termCountBonus = (
        Math.max(0, (input.termCount - 2)) *
        SCORE_CONSTANTS.difficulty.perExtraTermBonus
    );
    const operationBonus = SCORE_CONSTANTS.difficulty.operationBonus[input.course];
    const mixedOperationBonus = (
        input.hasMixedOperators === true
            ? (
                SCORE_CONSTANTS.difficulty.mixedOperationBaseBonus +
                (Math.max(0, (input.operatorsUsedCount - 2)) * SCORE_CONSTANTS.difficulty.mixedOperationExtraOperatorBonus)
            )
            : 0
    );
    const decimalBonus = (
        input.hasDecimalOperand === true
            ? SCORE_CONSTANTS.difficulty.decimalBonus
            : 0
    );
    const negativeOperandBonus = (
        input.hasNegativeOperand === true
            ? SCORE_CONSTANTS.difficulty.negativeOperandBonus
            : 0
    );
    const negativeResultBonus = (
        input.resultIsNegative === true
            ? SCORE_CONSTANTS.difficulty.negativeResultBonus
            : 0
    );
    const digitBonus = (
        Math.max(0, (input.maxDigits - 1)) *
        SCORE_CONSTANTS.difficulty.maxDigitBonusPerExtraDigit
    );
    const carryBorrowBonus = (
        input.hasCarryOrBorrow === true
            ? SCORE_CONSTANTS.difficulty.carryBorrowBonus
            : 0
    );
    const parenthesesBonus = (
        input.hasParentheses === true
            ? SCORE_CONSTANTS.difficulty.parenthesesBonus
            : 0
    );
    const priorityBonus = (
        input.hasPriorityOperation === true
            ? SCORE_CONSTANTS.difficulty.priorityBonus
            : 0
    );
    const remainderBonus = (
        input.hasRemainder === true
            ? SCORE_CONSTANTS.difficulty.remainderBonus
            : 0
    );
    const realDivisionBonus = (
        input.hasRealDivision === true
            ? SCORE_CONSTANTS.difficulty.realDivisionBonus
            : 0
    );

    const rawTotal = (
        baseScore +
        termCountBonus +
        operationBonus +
        mixedOperationBonus +
        decimalBonus +
        negativeOperandBonus +
        negativeResultBonus +
        digitBonus +
        carryBorrowBonus +
        parenthesesBonus +
        priorityBonus +
        remainderBonus +
        realDivisionBonus
    );

    const totalScore = clamp(
        rawTotal,
        SCORE_CONSTANTS.difficulty.minScore,
        SCORE_CONSTANTS.difficulty.maxScore
    );

    return {
        baseScore,
        termCountBonus,
        operationBonus,
        mixedOperationBonus,
        decimalBonus,
        negativeOperandBonus,
        negativeResultBonus,
        digitBonus,
        carryBorrowBonus,
        parenthesesBonus,
        priorityBonus,
        remainderBonus,
        realDivisionBonus,
        totalScore,
    };
}

export function calculateExpectedTimeMs (
    difficultyScore: number
): number {
    const expectedTimeMs = (
        SCORE_CONSTANTS.expectedTime.baseMs +
        (difficultyScore * SCORE_CONSTANTS.expectedTime.perDifficultyPointMs)
    );

    return Math.round(clamp(
        expectedTimeMs,
        SCORE_CONSTANTS.expectedTime.minMs,
        SCORE_CONSTANTS.expectedTime.maxMs
    ));
}

export function calculateSpeedFactor (
    actualTimeMs: number,
    expectedTimeMs: number
): number {
    const safeActualMs = Math.max(
        actualTimeMs,
        SCORE_CONSTANTS.speed.minActualMs
    );

    const speedRatio = (expectedTimeMs / safeActualMs);
    const rawFactor = Math.pow(
        speedRatio,
        SCORE_CONSTANTS.speed.exponent
    );

    return roundTo(
        clamp(
            rawFactor,
            SCORE_CONSTANTS.speed.minFactor,
            SCORE_CONSTANTS.speed.maxFactor
        ),
        3
    );
}

export function calculateTimeLimitFactor (
    settings: QuizSettings,
    expectedTimeMs: number
): number {
    if (settings.timeLimitEnabled === false) {
        return SCORE_CONSTANTS.timeLimit.noLimitFactor;
    }

    const timeLimitMs = (settings.timeLimitSec * 1000);
    const pressure = (expectedTimeMs / Math.max(timeLimitMs, 1));
    const rawFactor = (
        SCORE_CONSTANTS.timeLimit.limitedBaseFactor +
        ((pressure - 1) * SCORE_CONSTANTS.timeLimit.pressureSlope)
    );

    return roundTo(
        clamp(
            rawFactor,
            SCORE_CONSTANTS.timeLimit.minFactor,
            SCORE_CONSTANTS.timeLimit.maxFactor
        ),
        3
    );
}

export function evaluateQuestionScore (
    question: GeneratedQuestion,
    actualTimeMs: number,
    isCorrect: boolean,
    settings: QuizSettings
): QuestionScoreDetail {
    const difficultyBreakdown = calculateDifficultyBreakdown(question.difficultyInput);
    const difficultyScore = difficultyBreakdown.totalScore;
    const expectedTimeMs = calculateExpectedTimeMs(difficultyScore);
    const speedFactor = calculateSpeedFactor(actualTimeMs, expectedTimeMs);
    const timeLimitFactor = calculateTimeLimitFactor(settings, expectedTimeMs);
    const correctMultiplier = (isCorrect === true ? 1 : 0);

    const rawQuestionScore = (
        correctMultiplier *
        difficultyScore *
        speedFactor *
        timeLimitFactor
    );

    const questionScore = Math.round(rawQuestionScore);

    return {
        difficultyScore,
        difficultyBreakdown,
        expectedTimeMs,
        actualTimeMs,
        speedFactor,
        timeLimitFactor,
        correctMultiplier,
        questionScore,
    };
}

export function buildQuizResult (
    userName: string,
    settings: QuizSettings,
    answers: AnswerResult[],
    options?: {
        completed?: boolean;
    }
): QuizResult {
    const completed = (options?.completed ?? true);
    const totalQuestions = answers.length;
    const correctCount = answers.filter((answer) => {
        return (answer.isCorrect === true);
    }).length;

    const totalElapsedMs = answers.reduce((sum, answer) => {
        return (sum + answer.elapsedMs);
    }, 0);

    const totalScore = answers.reduce((sum, answer) => {
        return (sum + answer.score);
    }, 0);

    const accuracyRate = (
        totalQuestions > 0
            ? Math.round((correctCount / totalQuestions) * 100)
            : 0
    );

    const averageAnswerMs = (
        totalQuestions > 0
            ? Math.round(totalElapsedMs / totalQuestions)
            : 0
    );

    const rawAverageQuestionScore = (
        totalQuestions > 0
            ? (totalScore / totalQuestions)
            : 0
    );

    const questionCountBonusFactor = calculateQuestionCountBonusFactor(totalQuestions);
    const rankingScoreRaw = (rawAverageQuestionScore * questionCountBonusFactor);
    const rankingEligibility = evaluateRankingEligibility(totalQuestions, completed);

    return {
        userName,
        courseLabel: getCourseLabelText(settings.selectedCourses),
        totalQuestions,
        correctCount,
        accuracyRate,
        averageAnswerMs,
        totalScore,
        averageQuestionScore: roundTo(rawAverageQuestionScore, 1),
        rankingScore: roundTo(rankingScoreRaw, 1),
        questionCountBonusFactor: roundTo(questionCountBonusFactor, 3),
        rankingEligible: rankingEligibility.eligible,
        rankingIneligibleReason: rankingEligibility.reason,
        completed,
        playedAt: formatDateTime(new Date()),
        answers,
    };
}

export function createRankingEntryFromResult (
    result: QuizResult
): RankingEntry {
    return {
        id: `rank-${Date.now()}`,
        userName: result.userName,
        courseLabel: result.courseLabel,
        totalQuestions: result.totalQuestions,
        totalScore: result.totalScore,
        averageQuestionScore: result.averageQuestionScore,
        rankingScore: result.rankingScore,
        accuracyRate: result.accuracyRate,
        averageAnswerMs: result.averageAnswerMs,
        playedAt: result.playedAt,
    };
}

function calculateQuestionCountBonusFactor (
    totalQuestions: number
): number {
    const minQuestions = SCORE_CONSTANTS.ranking.minEligibleQuestionCount;

    if (totalQuestions <= minQuestions) {
        return SCORE_CONSTANTS.ranking.baseQuestionCountBonusFactor;
    }

    const growth = (
        Math.sqrt(totalQuestions) -
        Math.sqrt(minQuestions)
    );

    return clamp(
        SCORE_CONSTANTS.ranking.baseQuestionCountBonusFactor +
        (growth * SCORE_CONSTANTS.ranking.countBonusPerSqrtStep),
        SCORE_CONSTANTS.ranking.baseQuestionCountBonusFactor,
        SCORE_CONSTANTS.ranking.maxQuestionCountBonusFactor
    );
}

function evaluateRankingEligibility (
    totalQuestions: number,
    completed: boolean
): { eligible: boolean; reason: string | null } {
    if (completed === false) {
        return {
            eligible: false,
            reason: '途中終了のためランキング対象外です。',
        };
    }

    if (totalQuestions < SCORE_CONSTANTS.ranking.minEligibleQuestionCount) {
        return {
            eligible: false,
            reason: `ランキング反映は ${SCORE_CONSTANTS.ranking.minEligibleQuestionCount}問以上からです。`,
        };
    }

    return {
        eligible: true,
        reason: null,
    };
}

function formatDateTime (date: Date): string {
    const year = date.getFullYear();
    const month = `${date.getMonth() + 1}`.padStart(2, '0');
    const day = `${date.getDate()}`.padStart(2, '0');
    const hour = `${date.getHours()}`.padStart(2, '0');
    const minute = `${date.getMinutes()}`.padStart(2, '0');
    const second = `${date.getSeconds()}`.padStart(2, '0');

    return `${year}-${month}-${day} ${hour}:${minute}:${second}`;
}

function roundTo (
    value: number,
    digits: number
): number {
    const scale = Math.pow(10, digits);
    return Math.round(value * scale) / scale;
}

function clamp (
    value: number,
    minValue: number,
    maxValue: number
): number {
    return Math.min(Math.max(value, minValue), maxValue);
}