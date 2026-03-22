import { ADVENTURE_ATTACK_TUNING, ADVENTURE_BADGE_TIER_BY_COURSE_COUNT, ADVENTURE_ENEMY_TUNING, ADVENTURE_REWARD_TUNING, ADVENTURE_STAGE_HP_MULTIPLIERS } from '../constants/adventureConstants';
import type { QuizSettings } from '../types/appTypes';
import type { AdventureDungeonPreview, AdventureThemeDefinition, BadgeTier, DungeonThemeDefinition } from '../types/adventureTypes';

export function getProblemLevel (settings: QuizSettings): number {
    const visibleDigits = settings.termMaxDigits.slice(0, settings.maxTerms);

    if (visibleDigits.length <= 0) {
        return 1;
    }

    const sum = visibleDigits.reduce((accumulator, value) => {
        return (accumulator + Math.max(1, value));
    }, 0);

    return Math.max(1, Math.floor(sum / visibleDigits.length));
}

export function getEnabledExtensionCount (settings: QuizSettings): number {
    const flags = [
        settings.allowNegative,
        settings.allowDecimal,
        settings.allowRemainder,
        settings.allowRealDivision,
    ];

    return flags.filter((value) => {
        return (value === true);
    }).length;
}

export function getBadgeTier (settings: QuizSettings): BadgeTier {
    const courseCount = Math.max(1, Math.min(4, settings.selectedCourses.length));
    return ADVENTURE_BADGE_TIER_BY_COURSE_COUNT[courseCount] ?? 'bronze';
}

export function getBadgeLabel (
    settings: QuizSettings,
    theme: AdventureThemeDefinition
): string {
    const tier = getBadgeTier(settings);
    const plusCount = getEnabledExtensionCount(settings);
    const isMastery = (
        (settings.selectedCourses.length >= 4) &&
        (plusCount >= 4)
    );

    if (isMastery === true) {
        return theme.masteryLabel;
    }

    return `${theme.badgeLabels[tier]}${'+'.repeat(plusCount)}`;
}

export function getDungeonById (
    theme: AdventureThemeDefinition,
    dungeonId: string
): DungeonThemeDefinition | null {
    return theme.dungeons.find((dungeon) => {
        return (dungeon.id === dungeonId);
    }) ?? null;
}

export function buildAdventureDungeonPreview (
    settings: QuizSettings,
    theme: AdventureThemeDefinition,
    dungeonId: string
): AdventureDungeonPreview {
    const questionLevel = getProblemLevel(settings);
    const extensionCount = getEnabledExtensionCount(settings);
    const courseCount = Math.max(1, settings.selectedCourses.length);
    const dungeonIndex = Math.max(0, theme.dungeons.findIndex((dungeon) => {
        return (dungeon.id === dungeonId);
    }));

    const attackPower = Math.round(
        ADVENTURE_ATTACK_TUNING.baseAttack *
        (1 + ((questionLevel - 1) * ADVENTURE_ATTACK_TUNING.perQuestionLevelRate)) *
        (1 + ((courseCount - 1) * ADVENTURE_ATTACK_TUNING.perCourseRate)) *
        (1 + (extensionCount * ADVENTURE_ATTACK_TUNING.perExtensionRate))
    );

    const enemyHpBase = (
        ADVENTURE_ENEMY_TUNING.baseHp *
        (1 + ((questionLevel - 1) * ADVENTURE_ENEMY_TUNING.perQuestionLevelRate)) *
        (1 + (dungeonIndex * ADVENTURE_ENEMY_TUNING.perDungeonRate))
    );

    const enemyHpMap = {
        mobA: Math.round(enemyHpBase * ADVENTURE_STAGE_HP_MULTIPLIERS.mobA),
        mobB: Math.round(enemyHpBase * ADVENTURE_STAGE_HP_MULTIPLIERS.mobB),
        mobC: Math.round(enemyHpBase * ADVENTURE_STAGE_HP_MULTIPLIERS.mobC),
        boss: Math.round(enemyHpBase * ADVENTURE_STAGE_HP_MULTIPLIERS.boss),
        secret: Math.round(enemyHpBase * ADVENTURE_STAGE_HP_MULTIPLIERS.secret),
    };

    const rewardMaterialCount = Math.max(
        1,
        Math.round(
            ADVENTURE_REWARD_TUNING.baseMaterials +
            ((questionLevel - 1) * ADVENTURE_REWARD_TUNING.perQuestionLevelRate) +
            (dungeonIndex * ADVENTURE_REWARD_TUNING.perDungeonRate)
        )
    );

    return {
        badgeText: getBadgeLabel(settings, theme),
        questionLevel,
        attackPower,
        recommendedPower: Math.round(attackPower * (1 + (dungeonIndex * 0.18))),
        rewardMaterialCount,
        enemyHpMap,
    };
}
