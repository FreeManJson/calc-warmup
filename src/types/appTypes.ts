export type CourseType = 'add' | 'sub' | 'mul' | 'div';
export type AnswerKind = 'number' | 'quotientRemainder';
export type InputMethodType = 'auto' | 'keyboard' | 'tile';
export type PartyMemberKey = 'warriorMale' | 'swordswoman' | 'fighterFemale' | 'wizardMale';
export type EnemySlotType = 'mobA' | 'mobB' | 'mobC' | 'boss' | 'secret';
export type AdventureTrophyKey = 'firstEnemyKill' | 'firstBossKill' | 'firstNoMissBossClear' | 'firstSecretKill';

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
    rankingPlacement?: number | null;
    rankingEntryId?: string | null;
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

export interface AdventurePartyMemberTheme {
    key: PartyMemberKey;
    className: string;
    iconAsset: string;
    baseWeaponName: string;
}

export interface AdventureDungeonTheme {
    id: string;
    order: number;
    name: string;
    materialName: string;
    treasureName: string;
    iconAsset: string;
    backgroundAsset: string;
    enemyNames: Record<EnemySlotType, string>;
    weaponNames: Record<PartyMemberKey, string>;
}

export interface AdventureTheme {
    id: string;
    name: string;
    normalModeLabel: string;
    adventureModeLabel: string;
    partyMembers: AdventurePartyMemberTheme[];
    dungeons: AdventureDungeonTheme[];
}

export interface AdventureDungeonProgress {
    materialCount: number;
    craftedWeaponMemberKeys: PartyMemberKey[];
    treasureUnlocked: boolean;
    clearCount: number;
    bossKillCount: number;
    secretKillCount: number;
}

export interface UserAdventureProgress {
    totalRuns: number;
    totalEnemyKills: number;
    totalBossKills: number;
    totalSecretKills: number;
    trophies: AdventureTrophyKey[];
    dungeonProgressById: Record<string, AdventureDungeonProgress>;
}

export interface AdventureEnemyState {
    slot: EnemySlotType;
    name: string;
    maxHp: number;
    currentHp: number;
    defeated: boolean;
}

export interface AdventureBattleLogEntry {
    questionId: string;
    questionText: string;
    userAnswer: string;
    correctAnswerText: string;
    elapsedMs: number;
    isCorrect: boolean;
    isTimeout: boolean;
    damage: number;
    enemySlot: EnemySlotType;
    enemyName: string;
    enemyRemainingHp: number;
    enemyDefeated: boolean;
}

export interface AdventureResult {
    userName: string;
    dungeonId: string;
    dungeonName: string;
    materialName: string;
    treasureName: string;
    totalTimeSec: number;
    elapsedMs: number;
    problemLevel: number;
    challengeBadgeLabel: string;
    partyAttackRate: number;
    enemyHpRate: number;
    totalAttack: number;
    effectiveBattlePower: number;
    totalAttackAfterRun: number;
    questionsAnswered: number;
    correctCount: number;
    missCount: number;
    accuracyRate: number;
    totalDamage: number;
    defeatedEnemySlots: EnemySlotType[];
    defeatedEnemyNames: string[];
    bossDefeated: boolean;
    secretAppeared: boolean;
    secretDefeated: boolean;
    materialsEarned: number;
    newlyCraftedWeaponNames: string[];
    treasureUnlockedThisRun: boolean;
    trophiesUnlocked: string[];
    reachedStageLabel: string;
    reachedEnemyName: string;
    playedAt: string;
    battleLog: AdventureBattleLogEntry[];
}
