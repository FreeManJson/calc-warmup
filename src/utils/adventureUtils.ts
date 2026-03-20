import {
    generateQuestions,
} from './quizUtils';
import type {
    AdventureBattleLogEntry,
    AdventureDungeonProgress,
    AdventureEnemyState,
    AdventureResult,
    AdventureTheme,
    EnemySlotType,
    GeneratedQuestion,
    PartyMemberKey,
    QuizSettings,
    UserAdventureProgress,
} from '../types/appTypes';

export const ADVENTURE_CONSTANTS = {
    totalTimeSec: 60,
    secretBossTimeLimitSec: 30,
    feedbackDelayMs: {
        correct: 320,
        wrong: 520,
        timeout: 520,
    },
    questionPoolSize: 120,
    baseAttack: 10,
    weaponMaterialCost: 5,
    weaponAttackBonus: 1,
    treasureAttackBonus: 2,
    enemyHpCoefficients: {
        mobA: 2,
        mobB: 3,
        mobC: 4,
        boss: 9,
        secret: 13,
    } as Record<EnemySlotType, number>,
    materialDrops: {
        mobA: 1,
        mobB: 1,
        mobC: 1,
        boss: 1,
        secret: 2,
    } as Record<EnemySlotType, number>,
} as const;

const RECOMMENDED_ATTACK_BY_DUNGEON_ID: Record<string, number> = {
    'stone-cave': 10,
    'crystal-cavern': 14,
    'amethyst-altar': 19,
    'citrine-corridor': 25,
    'garnet-crater': 32,
    'opal-marsh': 40,
    'sapphire-castle': 49,
    'mythril-tower': 59,
};

const TROPHY_LABELS: Record<string, string> = {
    firstEnemyKill: '初討伐',
    firstBossKill: '初ボス討伐',
    firstNoMissBossClear: 'ノーミス討伐',
    firstSecretKill: 'シークレット討伐',
};

export interface AdventureOverview {
    totalAttack: number;
    totalCraftedWeapons: number;
    totalUnlockedTreasures: number;
    totalRuns: number;
    totalEnemyKills: number;
    totalBossKills: number;
    totalSecretKills: number;
}

export interface AdventureRewardResolution {
    nextProgress: UserAdventureProgress;
    materialsEarned: number;
    newlyCraftedWeaponNames: string[];
    treasureUnlockedThisRun: boolean;
    trophiesUnlocked: string[];
    totalAttackAfterRun: number;
}

export interface AdventureSessionSummaryInput {
    userName: string;
    theme: AdventureTheme;
    dungeonId: string;
    totalTimeSec: number;
    elapsedMs: number;
    totalAttack: number;
    totalAttackAfterRun: number;
    battleLog: AdventureBattleLogEntry[];
    defeatedEnemySlots: EnemySlotType[];
    secretAppeared: boolean;
    materialsEarned: number;
    newlyCraftedWeaponNames: string[];
    treasureUnlockedThisRun: boolean;
    trophiesUnlocked: string[];
}

export function createDefaultAdventureProgress (
    theme: AdventureTheme
): UserAdventureProgress {
    const dungeonProgressById: Record<string, AdventureDungeonProgress> = {};

    theme.dungeons.forEach((dungeon) => {
        dungeonProgressById[dungeon.id] = createDefaultAdventureDungeonProgress();
    });

    return {
        totalRuns: 0,
        totalEnemyKills: 0,
        totalBossKills: 0,
        totalSecretKills: 0,
        trophies: [],
        dungeonProgressById,
    };
}

export function normalizeAdventureProgress (
    raw: unknown,
    theme: AdventureTheme
): UserAdventureProgress {
    const defaults = createDefaultAdventureProgress(theme);
    const value = (typeof raw === 'object' && raw != null)
        ? raw as Partial<UserAdventureProgress>
        : {};

    const nextProgress: UserAdventureProgress = {
        totalRuns: toSafeInteger(value.totalRuns, defaults.totalRuns),
        totalEnemyKills: toSafeInteger(value.totalEnemyKills, defaults.totalEnemyKills),
        totalBossKills: toSafeInteger(value.totalBossKills, defaults.totalBossKills),
        totalSecretKills: toSafeInteger(value.totalSecretKills, defaults.totalSecretKills),
        trophies: Array.isArray(value.trophies)
            ? value.trophies.filter((item): item is UserAdventureProgress['trophies'][number] => {
                return (typeof item === 'string');
            })
            : [],
        dungeonProgressById: { ...defaults.dungeonProgressById },
    };

    theme.dungeons.forEach((dungeon) => {
        const sourceMap = value.dungeonProgressById;
        const rawDungeon = (
            (typeof sourceMap === 'object') &&
            (sourceMap != null) &&
            (dungeon.id in sourceMap)
        )
            ? (sourceMap[dungeon.id] as Partial<AdventureDungeonProgress>)
            : null;

        const craftedKeys = Array.isArray(rawDungeon?.craftedWeaponMemberKeys)
            ? rawDungeon.craftedWeaponMemberKeys.filter((item): item is PartyMemberKey => {
                return (
                    (item === 'warriorMale') ||
                    (item === 'swordswoman') ||
                    (item === 'fighterFemale') ||
                    (item === 'wizardMale')
                );
            })
            : [];

        nextProgress.dungeonProgressById[dungeon.id] = {
            materialCount: toSafeInteger(rawDungeon?.materialCount, 0),
            craftedWeaponMemberKeys: craftedKeys,
            treasureUnlocked: (rawDungeon?.treasureUnlocked === true),
            clearCount: toSafeInteger(rawDungeon?.clearCount, 0),
            bossKillCount: toSafeInteger(rawDungeon?.bossKillCount, 0),
            secretKillCount: toSafeInteger(rawDungeon?.secretKillCount, 0),
        };
    });

    return nextProgress;
}

export function buildAdventureQuestionPool (
    settings: QuizSettings
): GeneratedQuestion[] {
    return generateQuestions({
        ...settings,
        questionCount: ADVENTURE_CONSTANTS.questionPoolSize,
        timeLimitEnabled: false,
    });
}

export function getAdventureDungeonById (
    theme: AdventureTheme,
    dungeonId: string
) {
    return theme.dungeons.find((dungeon) => {
        return (dungeon.id === dungeonId);
    }) ?? theme.dungeons[0];
}

export function buildAdventureEnemySequence (
    theme: AdventureTheme,
    dungeonId: string
): AdventureEnemyState[] {
    const dungeon = getAdventureDungeonById(theme, dungeonId);

    return buildEnemySlots().map((slot) => {
        const maxHp = calculateEnemyMaxHp(dungeonId, slot);

        return {
            slot,
            name: dungeon.enemyNames[slot],
            maxHp,
            currentHp: maxHp,
            defeated: false,
        };
    });
}

export function calculateEnemyMaxHp (
    dungeonId: string,
    slot: EnemySlotType
): number {
    const recommendedAttack = getRecommendedAttackForDungeon(dungeonId);
    const coefficient = ADVENTURE_CONSTANTS.enemyHpCoefficients[slot];
    return (recommendedAttack * coefficient);
}

export function calculateTotalAttack (
    progress: UserAdventureProgress,
    theme: AdventureTheme
): number {
    let totalAttack = ADVENTURE_CONSTANTS.baseAttack;

    theme.dungeons.forEach((dungeon) => {
        const dungeonProgress = ensureDungeonProgress(progress, dungeon.id);
        totalAttack += (
            dungeonProgress.craftedWeaponMemberKeys.length * ADVENTURE_CONSTANTS.weaponAttackBonus
        );

        if (dungeonProgress.treasureUnlocked === true) {
            totalAttack += ADVENTURE_CONSTANTS.treasureAttackBonus;
        }
    });

    return totalAttack;
}

export function buildAdventureOverview (
    progress: UserAdventureProgress,
    theme: AdventureTheme
): AdventureOverview {
    let totalCraftedWeapons = 0;
    let totalUnlockedTreasures = 0;

    theme.dungeons.forEach((dungeon) => {
        const dungeonProgress = ensureDungeonProgress(progress, dungeon.id);
        totalCraftedWeapons += dungeonProgress.craftedWeaponMemberKeys.length;

        if (dungeonProgress.treasureUnlocked === true) {
            totalUnlockedTreasures += 1;
        }
    });

    return {
        totalAttack: calculateTotalAttack(progress, theme),
        totalCraftedWeapons,
        totalUnlockedTreasures,
        totalRuns: progress.totalRuns,
        totalEnemyKills: progress.totalEnemyKills,
        totalBossKills: progress.totalBossKills,
        totalSecretKills: progress.totalSecretKills,
    };
}

export function applyAdventureRewards (
    progress: UserAdventureProgress,
    theme: AdventureTheme,
    dungeonId: string,
    defeatedEnemySlots: EnemySlotType[],
    missCount: number
): AdventureRewardResolution {
    const nextProgress = normalizeAdventureProgress(progress, theme);
    const dungeon = getAdventureDungeonById(theme, dungeonId);
    const dungeonProgress = ensureDungeonProgress(nextProgress, dungeonId);
    const defeatedEnemyCount = defeatedEnemySlots.length;
    const bossDefeated = defeatedEnemySlots.includes('boss');
    const secretDefeated = defeatedEnemySlots.includes('secret');
    const materialsEarned = defeatedEnemySlots.reduce((sum, slot) => {
        return (sum + ADVENTURE_CONSTANTS.materialDrops[slot]);
    }, 0);

    nextProgress.totalRuns += 1;
    nextProgress.totalEnemyKills += defeatedEnemyCount;

    if (bossDefeated === true) {
        nextProgress.totalBossKills += 1;
        dungeonProgress.clearCount += 1;
        dungeonProgress.bossKillCount += 1;
    }

    if (secretDefeated === true) {
        nextProgress.totalSecretKills += 1;
        dungeonProgress.secretKillCount += 1;
    }

    dungeonProgress.materialCount += materialsEarned;

    const newlyCraftedWeaponNames: string[] = [];

    theme.partyMembers.forEach((member) => {
        const alreadyCrafted = dungeonProgress.craftedWeaponMemberKeys.includes(member.key);

        if (alreadyCrafted === true) {
            return;
        }

        if (dungeonProgress.materialCount < ADVENTURE_CONSTANTS.weaponMaterialCost) {
            return;
        }

        dungeonProgress.materialCount -= ADVENTURE_CONSTANTS.weaponMaterialCost;
        dungeonProgress.craftedWeaponMemberKeys = [
            ...dungeonProgress.craftedWeaponMemberKeys,
            member.key,
        ];
        newlyCraftedWeaponNames.push(dungeon.weaponNames[member.key]);
    });

    let treasureUnlockedThisRun = false;

    if (
        (dungeonProgress.treasureUnlocked === false) &&
        (dungeonProgress.craftedWeaponMemberKeys.length >= theme.partyMembers.length)
    ) {
        dungeonProgress.treasureUnlocked = true;
        treasureUnlockedThisRun = true;
    }

    const trophies = new Set(nextProgress.trophies);
    const trophiesUnlocked: string[] = [];

    unlockTrophyIfNeeded(
        trophies,
        'firstEnemyKill',
        (nextProgress.totalEnemyKills > 0),
        trophiesUnlocked
    );

    unlockTrophyIfNeeded(
        trophies,
        'firstBossKill',
        bossDefeated,
        trophiesUnlocked
    );

    unlockTrophyIfNeeded(
        trophies,
        'firstNoMissBossClear',
        (bossDefeated === true) && (missCount <= 0),
        trophiesUnlocked
    );

    unlockTrophyIfNeeded(
        trophies,
        'firstSecretKill',
        secretDefeated,
        trophiesUnlocked
    );

    nextProgress.trophies = [...trophies];

    return {
        nextProgress,
        materialsEarned,
        newlyCraftedWeaponNames,
        treasureUnlockedThisRun,
        trophiesUnlocked,
        totalAttackAfterRun: calculateTotalAttack(nextProgress, theme),
    };
}

export function buildAdventureResult (
    input: AdventureSessionSummaryInput
): AdventureResult {
    const dungeon = getAdventureDungeonById(input.theme, input.dungeonId);
    const defeatedEnemyNames = input.defeatedEnemySlots.map((slot) => {
        return dungeon.enemyNames[slot];
    });
    const bossDefeated = input.defeatedEnemySlots.includes('boss');
    const secretDefeated = input.defeatedEnemySlots.includes('secret');
    const correctCount = input.battleLog.filter((entry) => {
        return (entry.isCorrect === true);
    }).length;
    const questionsAnswered = input.battleLog.length;
    const missCount = Math.max(0, (questionsAnswered - correctCount));
    const totalDamage = input.battleLog.reduce((sum, entry) => {
        return (sum + entry.damage);
    }, 0);
    const accuracyRate = (
        questionsAnswered > 0
            ? roundTo(((correctCount / questionsAnswered) * 100), 1)
            : 0
    );
    const reachedEnemyName = resolveReachedEnemyName(dungeon, input.defeatedEnemySlots);

    return {
        userName: input.userName,
        dungeonId: dungeon.id,
        dungeonName: dungeon.name,
        materialName: dungeon.materialName,
        treasureName: dungeon.treasureName,
        totalTimeSec: input.totalTimeSec,
        elapsedMs: input.elapsedMs,
        questionsAnswered,
        correctCount,
        missCount,
        accuracyRate,
        totalAttack: input.totalAttack,
        totalAttackAfterRun: input.totalAttackAfterRun,
        totalDamage,
        defeatedEnemySlots: input.defeatedEnemySlots,
        defeatedEnemyNames,
        bossDefeated,
        secretAppeared: input.secretAppeared,
        secretDefeated,
        materialsEarned: input.materialsEarned,
        newlyCraftedWeaponNames: input.newlyCraftedWeaponNames,
        treasureUnlockedThisRun: input.treasureUnlockedThisRun,
        trophiesUnlocked: input.trophiesUnlocked,
        reachedStageLabel: buildAdventureStageLabel(
            input.defeatedEnemySlots,
            input.secretAppeared
        ),
        reachedEnemyName,
        playedAt: formatDateTime(new Date()),
        battleLog: input.battleLog,
    };
}

export function getPartyMemberLabel (
    theme: AdventureTheme,
    key: PartyMemberKey
): string {
    return theme.partyMembers.find((member) => {
        return (member.key === key);
    })?.className ?? key;
}

export function getRecommendedAttackForDungeon (
    dungeonId: string
): number {
    return RECOMMENDED_ATTACK_BY_DUNGEON_ID[dungeonId] ?? ADVENTURE_CONSTANTS.baseAttack;
}

function createDefaultAdventureDungeonProgress (): AdventureDungeonProgress {
    return {
        materialCount: 0,
        craftedWeaponMemberKeys: [],
        treasureUnlocked: false,
        clearCount: 0,
        bossKillCount: 0,
        secretKillCount: 0,
    };
}

function buildEnemySlots (): EnemySlotType[] {
    return ['mobA', 'mobB', 'mobC', 'boss', 'secret'];
}

function ensureDungeonProgress (
    progress: UserAdventureProgress,
    dungeonId: string
): AdventureDungeonProgress {
    if (progress.dungeonProgressById[dungeonId] == null) {
        progress.dungeonProgressById[dungeonId] = createDefaultAdventureDungeonProgress();
    }

    return progress.dungeonProgressById[dungeonId];
}

function unlockTrophyIfNeeded (
    trophies: Set<string>,
    trophyKey: keyof typeof TROPHY_LABELS,
    condition: boolean,
    trophiesUnlocked: string[]
): void {
    if ((condition === false) || (trophies.has(trophyKey) === true)) {
        return;
    }

    trophies.add(trophyKey);
    trophiesUnlocked.push(TROPHY_LABELS[trophyKey]);
}

function resolveReachedEnemyName (
    dungeon: AdventureTheme['dungeons'][number],
    defeatedEnemySlots: EnemySlotType[]
): string {
    if (defeatedEnemySlots.includes('secret') === true) {
        return dungeon.enemyNames.secret;
    }

    if (defeatedEnemySlots.includes('boss') === true) {
        return dungeon.enemyNames.boss;
    }

    if (defeatedEnemySlots.includes('mobC') === true) {
        return dungeon.enemyNames.mobC;
    }

    if (defeatedEnemySlots.includes('mobB') === true) {
        return dungeon.enemyNames.mobB;
    }

    if (defeatedEnemySlots.includes('mobA') === true) {
        return dungeon.enemyNames.mobA;
    }

    return dungeon.enemyNames.mobA;
}

function buildAdventureStageLabel (
    defeatedEnemySlots: EnemySlotType[],
    secretAppeared: boolean
): string {
    if (defeatedEnemySlots.includes('secret') === true) {
        return 'シークレット撃破';
    }

    if (defeatedEnemySlots.includes('boss') === true) {
        return (secretAppeared === true ? 'シークレット到達' : 'ボス撃破');
    }

    if (defeatedEnemySlots.includes('mobC') === true) {
        return 'ボス到達';
    }

    if (defeatedEnemySlots.includes('mobB') === true) {
        return 'ザコC到達';
    }

    if (defeatedEnemySlots.includes('mobA') === true) {
        return 'ザコB到達';
    }

    return 'ザコA挑戦中';
}

function toSafeInteger (
    value: unknown,
    fallback: number
): number {
    return (
        (typeof value === 'number') && Number.isFinite(value)
            ? Math.max(0, Math.floor(value))
            : fallback
    );
}

function roundTo (
    value: number,
    digits: number
): number {
    const scale = (10 ** digits);
    return (Math.round(value * scale) / scale);
}

function formatDateTime (date: Date): string {
    const yyyy = date.getFullYear();
    const mm = String(date.getMonth() + 1).padStart(2, '0');
    const dd = String(date.getDate()).padStart(2, '0');
    const hh = String(date.getHours()).padStart(2, '0');
    const mi = String(date.getMinutes()).padStart(2, '0');
    const ss = String(date.getSeconds()).padStart(2, '0');

    return `${yyyy}/${mm}/${dd} ${hh}:${mi}:${ss}`;
}
