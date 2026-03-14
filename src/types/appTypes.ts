export type CourseType = 'add' | 'sub' | 'mul' | 'div';
export type AnswerKind = 'number' | 'quotientRemainder';
export type InputMethodType = 'auto' | 'keyboard' | 'tile';

export interface QuizSettings {
    selectedCourses: CourseType[];
    maxTerms: number;
    termMaxDigits: number[];
    timeLimitEnabled: boolean;
    timeLimitSec: number;
    questionCount: number;
    allowNegative: boolean;
    allowDecimal: boolean;
    allowRemainder: boolean;
    allowRealDivision: boolean;
    presetName: string;
    handwritingMemoEnabled: boolean;
    inputMethod: InputMethodType;
}

export interface UserProfile {
    id: string;
    name: string;
}

export interface QuestionDifficultyInput {
    course: CourseType;
    termCount: number;
    operatorsUsedCount: number;
    hasMixedOperators: boolean;
    hasDecimalOperand: boolean;
    hasNegativeOperand: boolean;
    resultIsNegative: boolean;
    maxDigits: number;
    hasCarryOrBorrow: boolean;
    hasParentheses: boolean;
    hasPriorityOperation: boolean;
    hasRemainder: boolean;
    hasRealDivision: boolean;
}

export interface DifficultyComponentBreakdown {
    baseScore: number;
    termCountBonus: number;
    operationBonus: number;
    mixedOperationBonus: number;
    decimalBonus: number;
    negativeOperandBonus: number;
    negativeResultBonus: number;
    digitBonus: number;
    carryBorrowBonus: number;
    parenthesesBonus: number;
    priorityBonus: number;
    remainderBonus: number;
    realDivisionBonus: number;
    totalScore: number;
}

export interface QuestionScoreDetail {
    difficultyScore: number;
    difficultyBreakdown: DifficultyComponentBreakdown;
    expectedTimeMs: number;
    actualTimeMs: number;
    speedFactor: number;
    timeLimitFactor: number;
    correctMultiplier: number;
    questionScore: number;
}

export interface GeneratedQuestion {
    id: string;
    course: CourseType;
    expression: string;
    answerKind: AnswerKind;
    correctText: string;
    expectedNumber?: number;
    expectedParts?: [number, number];
    tolerance?: number;
    inputHint?: string;
    difficultyInput: QuestionDifficultyInput;
}

export interface CurrentQuiz {
    id: string;
    selectedUserId: string;
    settingsSnapshot: QuizSettings;
    questions: GeneratedQuestion[];
}

export interface AnswerResult {
    questionId: string;
    questionText: string;
    course: CourseType;
    userAnswer: string;
    correctAnswerText: string;
    isCorrect: boolean;
    isTimeout: boolean;
    elapsedMs: number;
    score: number;
    scoreDetail: QuestionScoreDetail;
}

export interface QuizResult {
    userName: string;
    courseLabel: string;
    totalQuestions: number;
    correctCount: number;
    accuracyRate: number;
    averageAnswerMs: number;
    totalScore: number;
    averageQuestionScore: number;
    rankingScore: number;
    questionCountBonusFactor: number;
    rankingEligible: boolean;
    rankingIneligibleReason: string | null;
    completed: boolean;
    playedAt: string;
    answers: AnswerResult[];
}

export interface RankingEntry {
    id: string;
    userName: string;
    courseLabel: string;
    totalQuestions: number;
    totalScore: number;
    averageQuestionScore: number;
    rankingScore: number;
    accuracyRate: number;
    averageAnswerMs: number;
    playedAt: string;
}