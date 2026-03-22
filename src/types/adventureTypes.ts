import type { GeneratedQuestion, QuizSettings } from './appTypes';

export type PlayMode = 'study' | 'adventure';
export type AdventureStageKey = 'mobA' | 'mobB' | 'mobC' | 'boss' | 'secret';
export type BadgeTier = 'bronze' | 'silver' | 'gold' | 'platinum';
export type AdventureFeedbackKind = 'correct' | 'wrong' | 'timeout';

export interface ThemePartyMember {
    id: string;
    characterLabel: string;
    jobName: string;
    initialWeaponName: string;
}

export interface ThemeEnemySet {
    mobA: string;
    mobB: string;
    mobC: string;
    boss: string;
    secret: string;
}

export interface ThemeRewardSet {
    materialName: string;
    treasureName: string;
}

export interface DungeonThemeDefinition {
    id: string;
    name: string;
    description: string;
    accentText: string;
    iconName?: string;
    backgroundName?: string;
    enemies: ThemeEnemySet;
    rewards: ThemeRewardSet;
}

export interface AdventureThemeDefinition {
    id: string;
    title: string;
    introText: string;
    badgeLabels: Record<BadgeTier, string>;
    masteryLabel: string;
    partyMembers: ThemePartyMember[];
    dungeons: DungeonThemeDefinition[];
}

export interface AdventureDungeonPreview {
    badgeText: string;
    questionLevel: number;
    attackPower: number;
    recommendedPower: number;
    rewardMaterialCount: number;
    enemyHpMap: Record<AdventureStageKey, number>;
}

export interface AdventureEnemyState {
    stageKey: AdventureStageKey;
    enemyName: string;
    maxHp: number;
    remainingHp: number;
    unlocked: boolean;
    defeated: boolean;
}

export interface AdventureBattleLogEntry {
    questionId: string;
    stageKeyBefore: AdventureStageKey | null;
    stageKeyAfter: AdventureStageKey | null;
    expression: string;
    userAnswer: string;
    correctAnswerText: string;
    isCorrect: boolean;
    isTimeout: boolean;
    damage: number;
    defeatedStages: AdventureStageKey[];
    answeredAt: string;
}

export interface AdventureSession {
    id: string;
    userId: string;
    userName: string;
    themeId: string;
    dungeonId: string;
    dungeonName: string;
    settingsSnapshot: QuizSettings;
    preview: AdventureDungeonPreview;
    startedAt: string;
    remainingMs: number;
    totalElapsedMs: number;
    questionIndex: number;
    totalDamage: number;
    correctCount: number;
    missCount: number;
    timeoutCount: number;
    defeatedStages: AdventureStageKey[];
    secretAppeared: boolean;
    cleared: boolean;
    failed: boolean;
    enemyStates: Record<AdventureStageKey, AdventureEnemyState>;
    currentQuestion: GeneratedQuestion | null;
    battleLog: AdventureBattleLogEntry[];
}

export interface AdventureFeedbackState {
    kind: AdventureFeedbackKind;
    title: string;
    subText: string;
    damage: number;
    defeatedStages: AdventureStageKey[];
    stageKeyBefore: AdventureStageKey | null;
    stageKeyAfter: AdventureStageKey | null;
    expression: string;
    correctAnswerText: string;
}

export interface AdventureResult {
    id: string;
    sessionId: string;
    userId: string;
    userName: string;
    themeId: string;
    dungeonId: string;
    dungeonName: string;
    settingsSnapshot: QuizSettings;
    preview: AdventureDungeonPreview;
    playedAt: string;
    totalElapsedMs: number;
    totalDamage: number;
    answeredCount: number;
    correctCount: number;
    missCount: number;
    timeoutCount: number;
    defeatedStages: AdventureStageKey[];
    cleared: boolean;
    secretAppeared: boolean;
    materialEarned: number;
    treasureEarned: boolean;
    battleLog: AdventureBattleLogEntry[];
}
