export type CourseType = 'add' | 'sub' | 'mul' | 'div';
export type AnswerKind = 'number' | 'quotientRemainder';

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
}

export interface UserProfile {
    id: string;
    name: string;
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
    difficulty: number;
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
}

export interface QuizResult {
    userName: string;
    courseLabel: string;
    totalQuestions: number;
    correctCount: number;
    accuracyRate: number;
    averageAnswerMs: number;
    score: number;
    playedAt: string;
    answers: AnswerResult[];
}

export interface RankingEntry {
    id: string;
    userName: string;
    courseLabel: string;
    score: number;
    accuracyRate: number;
    averageAnswerMs: number;
    playedAt: string;
}